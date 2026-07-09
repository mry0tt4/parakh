"""Application configuration.

Every value can be overridden via environment variables (PARAKH_ prefix)
or a .env file, so the same image runs in dev, sandbox and production.
"""
from datetime import date
from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_prefix="PARAKH_", env_file=".env", extra="ignore")

    app_name: str = "Parakh — MSME Credit Intelligence"
    version: str = "1.0.0"
    engine_version: str = "1.0.0"
    environment: str = "dev"  # dev | sandbox | production

    # Persistence. SQLite for the demo; point at Postgres in production
    # (e.g. postgresql+psycopg://user:pass@host/parakh) — no code changes needed.
    database_url: str = "sqlite:///./parakh.db"

    # Auth
    jwt_secret: str = "dev-only-secret-change-me-0123456789abcdef"  # override in every non-dev env
    jwt_algorithm: str = "HS256"
    jwt_expires_seconds: int = 3600

    # CORS — the frontend dev server. Lock down per environment.
    cors_origins: list[str] = ["http://localhost:5173", "http://127.0.0.1:5173"]

    # Rate limiting (in-memory sliding window; swap for Redis in production).
    rate_limit_per_minute: int = 240
    login_rate_limit_per_minute: int = 10

    # Business rules
    officer_decision_limit: int = 2_500_000  # credit officers decide up to ₹25L
    lending_rate_annual: float = 0.11        # assumed pricing for DSCR / EMI math
    target_dscr: float = 1.4                 # limit sizing target

    # Deterministic demo clock: synthetic data is generated relative to this
    # anchor so scores and tests are reproducible.
    demo_anchor: date = date(2026, 7, 1)
    history_months: int = 24

    autoseed: bool = True

    # -- Setu AA sandbox (EXPERIMENTAL, off by default) ----------------------
    # When all three credentials are set, the AA connector binds to the real
    # Setu sandbox instead of the synthetic mock. See docs/ARCHITECTURE.md.
    setu_base_url: str = "https://fiu-sandbox.setu.co"
    setu_client_id: str = ""
    setu_client_secret: str = ""
    setu_product_instance_id: str = ""
    setu_test_vua: str = "999999999@onemoney"  # sandbox mock handle


@lru_cache
def get_settings() -> Settings:
    return Settings()
