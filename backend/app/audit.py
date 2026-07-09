"""Append-only audit trail.

Every state-changing action is recorded with actor, IP and a structured
detail payload. The service exposes read-only access (risk_head/admin);
there is deliberately no API path that mutates or deletes audit rows.
"""
from fastapi import Request
from sqlalchemy.orm import Session

from .models import AuditEvent, User


def record(
    db: Session,
    *,
    actor: User | None,
    action: str,
    entity_type: str,
    entity_id: str,
    request: Request | None = None,
    detail: dict | None = None,
) -> AuditEvent:
    event = AuditEvent(
        actor_id=actor.id if actor else None,
        actor_email=actor.email if actor else None,
        actor_role=actor.role if actor else None,
        action=action,
        entity_type=entity_type,
        entity_id=entity_id,
        ip=(request.client.host if request and request.client else None),
        detail=detail or {},
    )
    db.add(event)
    return event


def serialize(e: AuditEvent, include_ip: bool = False) -> dict:
    out = {
        "id": e.id,
        "ts": e.ts.isoformat() if e.ts else None,
        "actor_email": e.actor_email,
        "actor_role": e.actor_role,
        "action": e.action,
        "entity_type": e.entity_type,
        "entity_id": e.entity_id,
        "detail": e.detail or {},
    }
    if include_ip:
        out["ip"] = e.ip
    return out
