"""Portable health report for the ULI/OCEN/AA ecosystem.

A lender, marketplace or the ULI rail consumes this one JSON document
(schema parakh.health-report.v1) instead of re-underwriting from scratch —
the consent artefacts travel with the score so provenance is verifiable.
Every access is audited.
"""
import hashlib

from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session

from .. import audit, services
from ..database import get_db
from ..models import LoanApplication, User
from ..security import get_current_user

router = APIRouter(prefix="/ecosystem", tags=["ecosystem"])


@router.get("/health-report/{application_id}")
def health_report(application_id: str, request: Request,
                  db: Session = Depends(get_db),
                  user: User = Depends(get_current_user)):
    app = db.get(LoanApplication, application_id)
    if app is None:
        raise HTTPException(status_code=404, detail="Application not found")
    asm = services.latest_assessment(app)
    if asm is None:
        raise HTTPException(status_code=404, detail="No assessment yet")

    audit.record(db, actor=user, action="ecosystem.report_access",
                 entity_type="application", entity_id=app.id, request=request,
                 detail={"assessment_version": asm.version})
    db.commit()

    detail = services.application_detail(app)
    report_id = "PRKR-" + hashlib.sha256(f"{asm.id}:{asm.version}".encode()).hexdigest()[:8]
    return {
        "schema": "parakh.health-report.v1",
        "report_id": report_id,
        "generated_at": asm.created_at.isoformat() if asm.created_at else None,
        "engine_version": asm.engine_version,
        "subject": {
            "gstin_masked": detail["applicant"]["gstin_masked"],
            "business_name": detail["applicant"]["business_name"],
            "sector": detail["applicant"]["sector"],
            "state": detail["applicant"]["state"],
        },
        "consent_artefacts": [
            {"source": c["source"], "artefact_id": c["artefact_id"],
             "data_from": c["data_from"], "data_to": c["data_to"]}
            for c in detail["consents"] if c["status"] == "ACTIVE"
        ],
        "score": {
            "value": asm.health_score, "grade": asm.grade,
            "verification_index": asm.verification_index,
            "pillars": [{"key": p["key"], "score": p["score"], "weight": p["weight"]}
                        for p in asm.pillars],
        },
        "stress": {
            "pd_12m": asm.pd_12m, "risk_band": asm.risk_band,
            "first_breach_month": asm.stress.get("first_breach_month"),
        },
        "flags": [{"code": f["code"], "severity": f["severity"]}
                  for f in asm.triangulation.get("fraud_flags", [])],
    }
