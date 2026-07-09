from datetime import datetime, timezone

from fastapi import APIRouter, Depends, Query
from sqlalchemy import select
from sqlalchemy.orm import Session

from .. import audit
from ..config import get_settings
from ..database import get_db
from ..models import AuditEvent, User
from ..security import get_current_user, require_roles
from ..synth import SECTORS

router = APIRouter(tags=["meta"])
settings = get_settings()


@router.get("/health")
def health():
    return {"status": "ok", "version": settings.version,
            "time": datetime.now(timezone.utc).isoformat()}


@router.get("/meta/enums")
def enums(user: User = Depends(get_current_user)):
    return {
        "products": ["working_capital", "term_loan", "invoice_finance"],
        "statuses": ["draft", "consent_pending", "data_ready", "assessed",
                     "approved", "conditional", "rejected", "referred"],
        "sectors": SECTORS,
        "consent_sources": ["AA", "GST", "EPFO"],
        "decisions": ["approved", "conditional", "rejected", "referred"],
        "grades": ["A+", "A", "B+", "B", "C", "D"],
        "entity_types": ["proprietorship", "partnership", "llp", "private_limited"],
    }


@router.get("/audit")
def audit_log(
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=50, ge=1, le=200),
    action: str | None = Query(default=None, max_length=64),
    actor: str | None = Query(default=None, max_length=254),
    db: Session = Depends(get_db),
    user: User = Depends(require_roles("risk_head", "admin")),
):
    q = select(AuditEvent)
    if action:
        q = q.where(AuditEvent.action.ilike(f"%{action}%"))
    if actor:
        q = q.where(AuditEvent.actor_email.ilike(f"%{actor}%"))
    rows = db.scalars(q.order_by(AuditEvent.ts.desc())).all()
    total = len(rows)
    page_rows = rows[(page - 1) * page_size: page * page_size]
    return {"items": [audit.serialize(e, include_ip=True) for e in page_rows],
            "total": total, "page": page, "page_size": page_size}
