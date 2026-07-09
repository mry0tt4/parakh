from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy import select
from sqlalchemy.orm import Session

from .. import audit
from ..config import get_settings
from ..database import get_db
from ..models import User
from ..schemas import LoginRequest
from ..security import create_access_token, get_current_user, verify_password

router = APIRouter(prefix="/auth", tags=["auth"])
settings = get_settings()


def _user_dict(user: User) -> dict:
    return {"id": user.id, "email": user.email, "full_name": user.full_name, "role": user.role}


@router.post("/login")
def login(body: LoginRequest, request: Request, db: Session = Depends(get_db)):
    user = db.scalar(select(User).where(User.email == body.email.lower().strip()))
    # verify against a constant even for unknown users → uniform timing
    ok = verify_password(body.password, user.hashed_password if user else
                         "$2b$12$C6UzMDM.H6dfI/f/IKcEeO7ZBlPz0yV1cJhF0qW9nZbGqmO2b2m2u")
    if user is None or not ok or not user.is_active:
        audit.record(db, actor=None, action="auth.login_failed", entity_type="user",
                     entity_id=body.email[:64], request=request)
        db.commit()
        raise HTTPException(status_code=401, detail="Invalid credentials")
    audit.record(db, actor=user, action="auth.login", entity_type="user",
                 entity_id=user.id, request=request)
    db.commit()
    return {
        "access_token": create_access_token(user),
        "token_type": "bearer",
        "expires_in": settings.jwt_expires_seconds,
        "user": _user_dict(user),
    }


@router.get("/me")
def me(user: User = Depends(get_current_user)):
    return _user_dict(user)
