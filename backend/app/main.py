"""Parakh API entrypoint.

Stateless FastAPI service: JWT auth, RBAC, per-IP rate limiting, security
headers, append-only audit. OpenAPI spec at /api/v1/openapi.json is the
integration contract a bank's API gateway would consume.
"""
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import Depends, FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse

from .config import get_settings
from .database import Base, SessionLocal, engine
from .routes import admin, applications, auth, ecosystem, portfolio
from .security import rate_limit

settings = get_settings()


@asynccontextmanager
async def lifespan(app: FastAPI):
    Base.metadata.create_all(engine)
    if settings.autoseed:
        from .seed import seed
        db = SessionLocal()
        try:
            seed(db)
        finally:
            db.close()
    yield


app = FastAPI(
    title=settings.app_name,
    version=settings.version,
    lifespan=lifespan,
    docs_url="/docs",
    openapi_url="/api/v1/openapi.json",
    dependencies=[Depends(rate_limit)],
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=False,
    allow_methods=["GET", "POST"],
    allow_headers=["Authorization", "Content-Type"],
)


@app.middleware("http")
async def security_headers(request, call_next):
    response = await call_next(request)
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["Referrer-Policy"] = "no-referrer"
    if request.url.path.startswith("/api/"):
        response.headers["Cache-Control"] = "no-store"
    if settings.environment == "production":
        response.headers["Strict-Transport-Security"] = "max-age=63072000; includeSubDomains"
    return response


API_PREFIX = "/api/v1"
app.include_router(auth.router, prefix=API_PREFIX)
app.include_router(applications.router, prefix=API_PREFIX)
app.include_router(portfolio.router, prefix=API_PREFIX)
app.include_router(ecosystem.router, prefix=API_PREFIX)
app.include_router(admin.router, prefix=API_PREFIX)


@app.get("/healthz", include_in_schema=False)
def healthz():
    """Cheap liveness probe — also the keep-warm ping target."""
    return {"status": "ok"}


# ── single-service mode: serve the built SPA next to the API ────────────────
# PARAKH_STATIC_DIR points at frontend/dist; any GET that isn't an API route
# or a real file falls back to index.html so client-side routing works.
_static_root = Path(settings.static_dir).resolve() if settings.static_dir else None
if _static_root and _static_root.is_dir():

    @app.get("/{spa_path:path}", include_in_schema=False)
    async def spa(spa_path: str):
        candidate = (_static_root / spa_path).resolve()
        if spa_path and candidate.is_file() and candidate.is_relative_to(_static_root):
            return FileResponse(candidate)
        return FileResponse(_static_root / "index.html")
