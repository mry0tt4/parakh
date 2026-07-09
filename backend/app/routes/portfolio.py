from collections import Counter, defaultdict
from statistics import mean

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.orm import Session, joinedload

from .. import services
from ..database import get_db
from ..models import LoanApplication, User
from ..security import get_current_user, require_roles

router = APIRouter(prefix="/portfolio", tags=["portfolio"])

GRADE_ORDER = ["A+", "A", "B+", "B", "C", "D"]
STATUS_ORDER = ["draft", "consent_pending", "data_ready", "assessed",
                "approved", "conditional", "rejected", "referred"]
SEVERITY_ORDER = {"critical": 0, "high": 1, "medium": 2, "low": 3}


def _all_apps(db: Session) -> list[LoanApplication]:
    return db.scalars(
        select(LoanApplication).options(
            joinedload(LoanApplication.applicant),
            joinedload(LoanApplication.assessments))
    ).unique().all()


@router.get("/summary")
def summary(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    apps = _all_apps(db)
    decided = [a for a in apps if a.status in ("approved", "conditional", "rejected")]
    approved = [a for a in decided if a.status in ("approved", "conditional")]
    scores = [services.latest_assessment(a).health_score
              for a in apps if services.latest_assessment(a)]

    approved_amount = 0
    for a in approved:
        asm = services.latest_assessment(a)
        approved_amount += (asm.recommendation.get("suggested_limit") or a.amount_requested) if asm \
            else a.amount_requested

    tats = []
    for a in apps:
        asm = services.latest_assessment(a)
        if asm and asm.created_at and a.created_at:
            tats.append((asm.created_at - a.created_at).total_seconds() / 60)

    status_counts = Counter(a.status for a in apps)
    grade_counts = Counter(g for g in (
        services.latest_assessment(a).grade if services.latest_assessment(a) else None
        for a in apps) if g)
    sector: dict[str, dict] = defaultdict(lambda: {"count": 0, "amount": 0})
    for a in apps:
        s = sector[a.applicant.sector]
        s["count"] += 1
        s["amount"] += a.amount_requested
    intake = Counter(a.created_at.strftime("%Y-%m") for a in apps if a.created_at)

    return {
        "kpis": {
            "total_applications": len(apps),
            "pending_review": sum(1 for a in apps if a.status in ("assessed", "referred")),
            "approved_count": len(approved),
            "approval_rate": round(len(approved) / len(decided), 3) if decided else None,
            "avg_health_score": round(mean(scores)) if scores else None,
            "total_requested": sum(a.amount_requested for a in apps),
            "total_approved_amount": approved_amount,
            "avg_tat_minutes": round(mean(tats)) if tats else None,
        },
        "status_funnel": [{"status": s, "count": status_counts.get(s, 0)} for s in STATUS_ORDER],
        "grade_distribution": [{"grade": g, "count": grade_counts.get(g, 0)} for g in GRADE_ORDER],
        "sector_mix": [{"sector": k, **v} for k, v in sorted(sector.items())],
        "monthly_intake": [{"month": m, "count": c} for m, c in sorted(intake.items())],
    }


@router.get("/alerts")
def alerts(db: Session = Depends(get_db),
           user: User = Depends(require_roles("risk_head", "admin"))):
    items = []
    for a in _all_apps(db):
        asm = services.latest_assessment(a)
        if not asm:
            continue
        base = {"application_id": a.id, "ref": a.ref,
                "business_name": a.applicant.business_name,
                "created_at": asm.created_at.isoformat() if asm.created_at else None}
        for fl in asm.triangulation.get("fraud_flags", []):
            items.append({**base, "code": fl["code"], "label": "Fraud indicator",
                          "severity": fl["severity"], "detail": fl["description"]})
        for s in asm.stress.get("ews_signals", []):
            items.append({**base, "code": s["code"], "label": s["label"],
                          "severity": s["severity"], "detail": s["evidence"]})
    items.sort(key=lambda x: SEVERITY_ORDER.get(x["severity"], 9))
    return {"items": items}
