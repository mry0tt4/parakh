"""AuthN/AuthZ, rate limiting and PII masking.

Controls implemented here (see docs/SECURITY.md for the full model):
- bcrypt password hashing (cost 12)
- short-lived HS256 JWTs (stateless — horizontally scalable)
- role-based access control via dependency guards
- per-IP sliding-window rate limiting (in-memory; same interface backs a
  Redis implementation in production)
- length-preserving PII masking for identifiers that leave the service
"""
import threading
import time
from collections import defaultdict, deque
from datetime import datetime, timedelta, timezone

import bcrypt
import jwt
from fastapi import Depends, HTTPException, Request
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from .config import get_settings
from .database import get_db
from .models import User

settings = get_settings()
_bearer = HTTPBearer(auto_error=False)


# --- passwords -------------------------------------------------------------

def hash_password(plain: str) -> str:
    return bcrypt.hashpw(plain.encode(), bcrypt.gensalt(rounds=12)).decode()


def verify_password(plain: str, hashed: str) -> bool:
    try:
        return bcrypt.checkpw(plain.encode(), hashed.encode())
    except ValueError:
        return False


# --- tokens ----------------------------------------------------------------

def create_access_token(user: User) -> str:
    now = datetime.now(timezone.utc)
    payload = {
        "sub": user.id,
        "role": user.role,
        "iat": now,
        "exp": now + timedelta(seconds=settings.jwt_expires_seconds),
        "iss": "parakh",
    }
    return jwt.encode(payload, settings.jwt_secret, algorithm=settings.jwt_algorithm)


def get_current_user(
    creds: HTTPAuthorizationCredentials | None = Depends(_bearer),
    db: Session = Depends(get_db),
) -> User:
    if creds is None:
        raise HTTPException(status_code=401, detail="Not authenticated")
    try:
        payload = jwt.decode(
            creds.credentials, settings.jwt_secret,
            algorithms=[settings.jwt_algorithm], issuer="parakh",
        )
    except jwt.PyJWTError:
        raise HTTPException(status_code=401, detail="Invalid or expired token")
    user = db.get(User, payload.get("sub"))
    if user is None or not user.is_active:
        raise HTTPException(status_code=401, detail="Unknown or inactive user")
    return user


def require_roles(*roles: str):
    def guard(user: User = Depends(get_current_user)) -> User:
        if user.role not in roles:
            raise HTTPException(status_code=403, detail=f"Requires role: {' or '.join(roles)}")
        return user
    return guard


# --- rate limiting ---------------------------------------------------------

class SlidingWindowLimiter:
    """Per-key sliding window. In-memory for the demo; the check() interface
    is what a Redis-backed implementation would expose for multi-instance
    deployments."""

    def __init__(self):
        self._hits: dict[str, deque] = defaultdict(deque)
        self._lock = threading.Lock()

    def check(self, key: str, limit: int, window_seconds: int = 60) -> bool:
        now = time.monotonic()
        with self._lock:
            q = self._hits[key]
            while q and now - q[0] > window_seconds:
                q.popleft()
            if len(q) >= limit:
                return False
            q.append(now)
            return True


limiter = SlidingWindowLimiter()


def rate_limit(request: Request) -> None:
    ip = request.client.host if request.client else "unknown"
    path = request.url.path
    is_login = path.endswith("/auth/login")
    limit = settings.login_rate_limit_per_minute if is_login else settings.rate_limit_per_minute
    key = f"{ip}:{'login' if is_login else 'api'}"
    if not limiter.check(key, limit):
        raise HTTPException(status_code=429, detail="Rate limit exceeded, retry shortly")


# --- PII masking -----------------------------------------------------------

def mask_id(value: str, keep_start: int = 2, keep_end: int = 4) -> str:
    if not value or len(value) <= keep_start + keep_end:
        return value
    return value[:keep_start] + "X" * (len(value) - keep_start - keep_end) + value[-keep_end:]


def mask_gstin(gstin: str) -> str:
    return mask_id(gstin, 2, 6)


def mask_pan(pan: str) -> str:
    return mask_id(pan, 1, 2)
