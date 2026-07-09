from fastapi import APIRouter, Depends, HTTPException, Query, Request
from sqlalchemy import or_, select
from sqlalchemy.orm import Session, joinedload

from .. import services
from ..config import get_settings
from ..database import get_db
from ..engines import features
from ..models import Applicant, AuditEvent, LoanApplication, User
from ..schemas import ApplicationCreate, ConsentRequestIn, DecisionIn
from ..security import get_current_user

router = APIRouter(prefix="/applications", tags=["applications"])
settings = get_settings()

STATUSES = ["draft", "consent_pending", "data_ready", "assessed",
            "approved", "conditional", "rejected", "referred"]


def _load(db: Session, app_id: str) -> LoanApplication:
    app = db.scalar(
        select(LoanApplication)
        .options(joinedload(LoanApplication.applicant),
                 joinedload(LoanApplication.consents),
                 joinedload(LoanApplication.assessments))
        .where(LoanApplication.id == app_id)
        .execution_options(populate_existing=True)
    )
    if app is None:
        raise HTTPException(status_code=404, detail="Application not found")
    return app


@router.get("")
def list_applications(
    status: str | None = Query(default=None),
    search: str | None = Query(default=None, max_length=100),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    q = select(LoanApplication).join(Applicant)
    if status:
        if status not in STATUSES:
            raise HTTPException(status_code=422, detail=f"Unknown status '{status}'")
        q = q.where(LoanApplication.status == status)
    if search:
        like = f"%{search}%"
        q = q.where(or_(Applicant.business_name.ilike(like),
                        LoanApplication.ref.ilike(like),
                        Applicant.gstin.ilike(like)))
    rows = db.scalars(q.order_by(LoanApplication.created_at.desc())).unique().all()
    total = len(rows)
    page_rows = rows[(page - 1) * page_size: page * page_size]
    return {"items": [services.application_summary(a) for a in page_rows],
            "total": total, "page": page, "page_size": page_size}


@router.post("", status_code=201)
def create_application(
    body: ApplicationCreate, request: Request,
    db: Session = Depends(get_db), user: User = Depends(get_current_user),
):
    app = services.create_application(db, user, body, request)
    return services.application_detail(_load(db, app.id))


@router.get("/{app_id}")
def get_application(app_id: str, db: Session = Depends(get_db),
                    user: User = Depends(get_current_user)):
    return services.application_detail(_load(db, app_id))


@router.post("/{app_id}/consents", status_code=201)
def request_consents(app_id: str, body: ConsentRequestIn, request: Request,
                     db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    app = _load(db, app_id)
    try:
        services.request_consents(db, user, app, list(dict.fromkeys(body.sources)), request)
    except services.StateError as e:
        raise HTTPException(status_code=409, detail=str(e))
    return {"consents": services.application_detail(_load(db, app_id))["consents"]}


@router.post("/{app_id}/consents/{consent_id}/approve")
def approve_consent(app_id: str, consent_id: str, request: Request,
                    db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    app = _load(db, app_id)
    consent = next((c for c in app.consents if c.id == consent_id), None)
    if consent is None:
        raise HTTPException(status_code=404, detail="Consent not found")
    try:
        consent = services.approve_consent(db, user, app, consent, request)
    except services.StateError as e:
        raise HTTPException(status_code=409, detail=str(e))
    return services._consent_dict(consent)


@router.post("/{app_id}/assess")
def assess(app_id: str, request: Request,
           db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    app = _load(db, app_id)
    try:
        asm = services.run_assessment(db, user, app, request)
    except services.StateError as e:
        raise HTTPException(status_code=409, detail=str(e))
    return services.assessment_detail(asm)


@router.get("/{app_id}/assessment")
def get_assessment(app_id: str, db: Session = Depends(get_db),
                   user: User = Depends(get_current_user)):
    asm = services.latest_assessment(_load(db, app_id))
    if asm is None:
        raise HTTPException(status_code=404, detail="No assessment yet")
    return services.assessment_detail(asm)


@router.get("/{app_id}/memo")
def get_memo(app_id: str, db: Session = Depends(get_db),
             user: User = Depends(get_current_user)):
    asm = services.latest_assessment(_load(db, app_id))
    if asm is None:
        raise HTTPException(status_code=404, detail="No assessment yet")
    return {"memo_markdown": asm.memo_markdown, "citations": asm.memo_citations,
            "generated_at": asm.created_at.isoformat() if asm.created_at else None,
            "engine_version": asm.engine_version}


@router.post("/{app_id}/decision")
def decision(app_id: str, body: DecisionIn, request: Request,
             db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    app = _load(db, app_id)
    if (user.role == "credit_officer"
            and app.amount_requested > settings.officer_decision_limit):
        raise HTTPException(
            status_code=403,
            detail=f"Amount exceeds officer discretion (₹{settings.officer_decision_limit:,}); "
                   "refer to risk head")
    try:
        app = services.decide(db, user, app, body.decision, body.note, request)
    except services.StateError as e:
        raise HTTPException(status_code=409, detail=str(e))
    return services.application_detail(_load(db, app_id))


@router.get("/{app_id}/cashflow")
def cashflow(app_id: str, db: Session = Depends(get_db),
             user: User = Depends(get_current_user)):
    app = _load(db, app_id)
    payloads = services.payloads_for(db, app)
    if not payloads:
        raise HTTPException(status_code=404, detail="No data pulled yet")
    f = features.build_features(payloads.get("AA"), payloads.get("GST"), payloads.get("EPFO"))
    return {"months": [{
        "month": r.month, "inflow": int(r.inflow), "outflow": int(r.outflow),
        "net": int(r.net), "avg_balance": int(r.avg_balance),
        "gst_turnover": int(r.gst_turnover) if r.gst_turnover is not None else None,
        "emi_outflow": int(r.emi), "bounce_count": r.bounces,
    } for r in f.rows]}


@router.get("/{app_id}/transactions")
def transactions(app_id: str,
                 month: str | None = Query(default=None, pattern=r"^\d{4}-\d{2}$"),
                 page: int = Query(default=1, ge=1),
                 page_size: int = Query(default=50, ge=1, le=200),
                 db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    app = _load(db, app_id)
    payloads = services.payloads_for(db, app)
    if "AA" not in payloads:
        raise HTTPException(status_code=404, detail="No bank data pulled yet")
    txns = payloads["AA"]["transactions"]
    if month:
        txns = [t for t in txns if t["date"].startswith(month)]
    txns = sorted(txns, key=lambda t: t["date"], reverse=True)
    total = len(txns)
    page_rows = txns[(page - 1) * page_size: page * page_size]
    return {"items": page_rows, "total": total, "page": page, "page_size": page_size}


@router.get("/{app_id}/healthcard")
def healthcard(app_id: str, db: Session = Depends(get_db),
               user: User = Depends(get_current_user)):
    app = _load(db, app_id)
    asm = services.latest_assessment(app)
    if asm is None:
        raise HTTPException(status_code=404, detail="No assessment yet")
    from ..engines import healthcard as hc
    return hc.build(
        applicant={"business_name": app.applicant.business_name},
        application={"ref": app.ref, "product": app.product,
                     "tenure_months": app.tenure_months},
        assessment=services.assessment_detail(asm),
    )


@router.get("/{app_id}/timeline")
def timeline(app_id: str, db: Session = Depends(get_db),
             user: User = Depends(get_current_user)):
    _load(db, app_id)  # 404 if missing
    events = db.scalars(
        select(AuditEvent)
        .where(AuditEvent.entity_type == "application", AuditEvent.entity_id == app_id)
        .order_by(AuditEvent.ts.desc())
    ).all()
    from .. import audit as audit_mod
    return {"items": [audit_mod.serialize(e) for e in events]}
