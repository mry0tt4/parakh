"""Application lifecycle services.

Thin, transactional operations shared by the API routes, the seed script and
the test suite — one code path for every state transition, every one audited.
"""
import uuid
from datetime import date, datetime, timedelta, timezone

from fastapi import Request
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from . import audit, engines, synth
from .config import get_settings
from .connectors import ConnectorError, get_connector
from .models import (Applicant, Assessment, ConsentRecord, DataPull,
                     LoanApplication, User)
from .schemas import ApplicationCreate
from .security import mask_gstin, mask_pan

settings = get_settings()


class StateError(Exception):
    """Invalid lifecycle transition → HTTP 409."""


def _applicant_fields(a: Applicant) -> dict:
    return dict(business_name=a.business_name, gstin=a.gstin, pan=a.pan,
                sector=a.sector, entity_type=a.entity_type, city=a.city,
                state=a.state, incorporation_date=a.incorporation_date,
                is_ntc=a.is_ntc, is_ntb=a.is_ntb)


def next_ref(db: Session) -> str:
    count = db.scalar(select(func.count(LoanApplication.id))) or 0
    return f"PRK-{settings.demo_anchor.year}-{count + 1:06d}"


def create_application(db: Session, user: User, payload: ApplicationCreate,
                       request: Request | None = None,
                       persona_key: str | None = None) -> LoanApplication:
    a = payload.applicant
    applicant = db.scalar(select(Applicant).where(Applicant.gstin == a.gstin))
    if applicant is None:
        matched = next((p.key for p in synth.PERSONAS.values() if p.gstin == a.gstin), None)
        applicant = Applicant(**a.model_dump(), persona_key=persona_key or matched)
        db.add(applicant)
        db.flush()

    app = LoanApplication(
        ref=next_ref(db), applicant_id=applicant.id, product=payload.product,
        amount_requested=payload.amount_requested, tenure_months=payload.tenure_months,
        purpose=payload.purpose, status="draft", created_by=user.id,
    )
    db.add(app)
    db.flush()
    audit.record(db, actor=user, action="application.create", entity_type="application",
                 entity_id=app.id, request=request,
                 detail={"ref": app.ref, "amount": app.amount_requested, "product": app.product})
    db.commit()
    db.refresh(app)
    return app


def _consents_of(db: Session, app: LoanApplication) -> list[ConsentRecord]:
    return db.scalars(
        select(ConsentRecord)
        .where(ConsentRecord.application_id == app.id)
        .order_by(ConsentRecord.requested_at)
    ).all()


def request_consents(db: Session, user: User, app: LoanApplication, sources: list[str],
                     request: Request | None = None) -> list[ConsentRecord]:
    if app.status not in ("draft", "consent_pending"):
        raise StateError(f"Consents can only be requested from draft/consent_pending (current: {app.status})")
    existing = {c.source for c in _consents_of(db, app) if c.status in ("PENDING", "ACTIVE")}
    created = []
    data_to = settings.demo_anchor - timedelta(days=1)
    data_from = date(settings.demo_anchor.year - 2, settings.demo_anchor.month, 1)
    for source in sources:
        if source in existing:
            continue
        consent = ConsentRecord(
            application_id=app.id, source=source,
            artefact_id=f"{source}-ART-{uuid.uuid4().hex[:6]}",
            status="PENDING", purpose_code="101",
            data_from=data_from.isoformat(), data_to=data_to.isoformat(),
        )
        db.add(consent)
        created.append(consent)
    app.status = "consent_pending"
    db.flush()
    audit.record(db, actor=user, action="consent.request", entity_type="application",
                 entity_id=app.id, request=request,
                 detail={"sources": [c.source for c in created]})
    db.commit()
    for c in created:
        db.refresh(c)
    return created


def approve_consent(db: Session, user: User, app: LoanApplication, consent: ConsentRecord,
                    request: Request | None = None) -> ConsentRecord:
    """Simulates the borrower approving on their AA handle / GST portal.
    In production this arrives as a signed webhook from the rail."""
    if consent.status != "PENDING":
        raise StateError(f"Consent is {consent.status}, not PENDING")
    now = datetime.now(timezone.utc)
    consent.status = "ACTIVE"
    consent.granted_at = now
    consent.expires_at = now + timedelta(days=90)

    connector = get_connector(consent.source)
    try:
        payload = connector.fetch(persona_key=app.applicant.persona_key,
                                  **_applicant_fields(app.applicant))
    except ConnectorError as e:
        # rail-side pending/failed: roll the consent back to PENDING so the
        # operator can retry after completing the rail-side step
        db.rollback()
        raise StateError(str(e))
    pull = DataPull(
        consent_id=consent.id, source=consent.source,
        record_count=connector.record_count(payload),
        sha256=connector.integrity(payload), payload=payload,
    )
    db.add(pull)

    audit.record(db, actor=user, action="consent.approve", entity_type="application",
                 entity_id=app.id, request=request,
                 detail={"source": consent.source, "artefact_id": consent.artefact_id,
                         "records": pull.record_count})

    db.flush()
    if all(c.status == "ACTIVE" for c in _consents_of(db, app)):
        app.status = "data_ready"
        audit.record(db, actor=user, action="application.data_ready", entity_type="application",
                     entity_id=app.id, request=request, detail={})
    db.commit()
    db.refresh(consent)
    return consent


def _consent_dict(c: ConsentRecord) -> dict:
    dp = c.data_pull
    return {
        "id": c.id, "source": c.source, "artefact_id": c.artefact_id,
        "status": c.status, "purpose_code": c.purpose_code,
        "data_from": c.data_from, "data_to": c.data_to,
        "requested_at": c.requested_at.isoformat() if c.requested_at else None,
        "granted_at": c.granted_at.isoformat() if c.granted_at else None,
        "expires_at": c.expires_at.isoformat() if c.expires_at else None,
        "data_pull": ({"id": dp.id, "fetched_at": dp.fetched_at.isoformat(),
                       "record_count": dp.record_count, "sha256": dp.sha256}
                      if dp else None),
    }


def payloads_for(db: Session, app: LoanApplication) -> dict:
    out = {}
    for c in _consents_of(db, app):
        if c.status == "ACTIVE" and c.data_pull:
            out[c.source] = c.data_pull.payload
    return out


def run_assessment(db: Session, user: User, app: LoanApplication,
                   request: Request | None = None) -> Assessment:
    if app.status not in ("data_ready", "assessed"):
        raise StateError(f"Assessment requires data_ready/assessed (current: {app.status})")
    payloads = payloads_for(db, app)
    if "AA" not in payloads:
        raise StateError("An approved AA (bank statement) pull is required for assessment")

    a = app.applicant
    result = engines.run_assessment(
        applicant={**_applicant_fields(a), "gstin_masked": mask_gstin(a.gstin)},
        application={"ref": app.ref, "product": app.product,
                     "amount_requested": app.amount_requested,
                     "tenure_months": app.tenure_months, "purpose": app.purpose,
                     "engine_version": settings.engine_version},
        payloads=payloads,
        consents=[_consent_dict(c) for c in _consents_of(db, app)],
    )
    version = 1 + max((x.version for x in app.assessments), default=0)
    asm = Assessment(
        application_id=app.id, version=version, engine_version=settings.engine_version,
        health_score=result["health_score"], grade=result["grade"],
        verification_index=result["verification_index"], pd_12m=result["pd_12m"],
        risk_band=result["risk_band"], recommendation=result["recommendation"],
        pillars=result["pillars"], triangulation=result["triangulation"],
        stress=result["stress"], memo_markdown=result["memo_markdown"],
        memo_citations=result["memo_citations"], created_by=user.id,
    )
    db.add(asm)
    app.status = "assessed"
    db.flush()
    audit.record(db, actor=user, action="assessment.run", entity_type="application",
                 entity_id=app.id, request=request,
                 detail={"version": version, "health_score": asm.health_score,
                         "grade": asm.grade, "recommendation": asm.recommendation["action"]})
    db.commit()
    db.refresh(asm)
    return asm


def decide(db: Session, user: User, app: LoanApplication, decision: str, note: str,
           request: Request | None = None) -> LoanApplication:
    if app.status != "assessed":
        raise StateError(f"Decisions require an assessed application (current: {app.status})")
    app.decision = decision
    app.decision_note = note
    app.decided_by = user.id
    app.decided_at = datetime.now(timezone.utc)
    app.status = decision
    audit.record(db, actor=user, action="application.decision", entity_type="application",
                 entity_id=app.id, request=request,
                 detail={"decision": decision, "note": note[:200]})
    db.commit()
    db.refresh(app)
    return app


def latest_assessment(app: LoanApplication) -> Assessment | None:
    return max(app.assessments, key=lambda x: x.version, default=None)


# ---- serializers -----------------------------------------------------------

def applicant_dict(a: Applicant) -> dict:
    return {
        "id": a.id, "business_name": a.business_name,
        "gstin_masked": mask_gstin(a.gstin), "pan_masked": mask_pan(a.pan),
        "sector": a.sector, "entity_type": a.entity_type,
        "city": a.city, "state": a.state,
        "incorporation_date": a.incorporation_date,
        "is_ntc": a.is_ntc, "is_ntb": a.is_ntb,
    }


def application_summary(app: LoanApplication) -> dict:
    asm = latest_assessment(app)
    return {
        "id": app.id, "ref": app.ref,
        "applicant": applicant_dict(app.applicant),
        "product": app.product, "amount_requested": app.amount_requested,
        "tenure_months": app.tenure_months, "status": app.status,
        "health_score": asm.health_score if asm else None,
        "grade": asm.grade if asm else None,
        "verification_index": asm.verification_index if asm else None,
        "pd_12m": asm.pd_12m if asm else None,
        "decision": app.decision, "decision_note": app.decision_note,
        "created_at": app.created_at.isoformat() if app.created_at else None,
        "updated_at": app.updated_at.isoformat() if app.updated_at else None,
    }


def application_detail(app: LoanApplication) -> dict:
    out = application_summary(app)
    out.update({
        "purpose": app.purpose,
        "consents": [_consent_dict(c) for c in app.consents],
        "has_assessment": bool(app.assessments),
        "decided_by": app.decided_by,
        "decided_at": app.decided_at.isoformat() if app.decided_at else None,
    })
    return out


def assessment_detail(asm: Assessment) -> dict:
    return {
        "id": asm.id, "application_id": asm.application_id, "version": asm.version,
        "engine_version": asm.engine_version,
        "created_at": asm.created_at.isoformat() if asm.created_at else None,
        "health_score": asm.health_score, "grade": asm.grade,
        "verification_index": asm.verification_index,
        "pd_12m": asm.pd_12m, "risk_band": asm.risk_band,
        "recommendation": asm.recommendation, "pillars": asm.pillars,
        "triangulation": asm.triangulation, "stress": asm.stress,
    }
