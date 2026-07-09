"""Demo seed: three users and six persona applications, each parked at a
different lifecycle stage so every screen and action has something to show.

Run manually:  python -m app.seed   (or automatic on first startup)
"""
from datetime import datetime, timedelta, timezone

from sqlalchemy import select
from sqlalchemy.orm import Session

from . import services
from .database import Base, SessionLocal, engine
from .models import User
from .schemas import ApplicantIn, ApplicationCreate
from .security import hash_password
from .synth import PERSONAS

USERS = [
    ("officer@parakh.demo", "Officer@2026", "Asha Verma", "credit_officer"),
    ("risk@parakh.demo", "Risk@2026", "Rohan Iyer", "risk_head"),
    ("admin@parakh.demo", "Admin@2026", "Priya Nair", "admin"),
]

# persona -> (product, amount, tenure, purpose, stage)
# stage: assessed | data_ready | consent_partial | decided:<decision>
PLAN = {
    "saraswati_kirana": ("working_capital", 600_000, 36,
                         "Working capital for inventory expansion into FMCG staples", "assessed"),
    "rathore_textiles": ("working_capital", 2_000_000, 12,
                         "Trade finance for yarn purchases ahead of export orders", "assessed"),
    "meher_foods": ("term_loan", 2_500_000, 36,
                    "Packaging line automation to serve modern-trade contracts", "decided:approved"),
    "nexus_digital": ("working_capital", 1_500_000, 24,
                      "Bridge working capital for two new enterprise contracts", "data_ready"),
    "balaji_auto": ("term_loan", 5_000_000, 48,
                    "Refinance and consolidation of existing equipment loans", "assessed"),
    "greenleaf_organics": ("working_capital", 800_000, 18,
                           "Festive-season inventory for D2C marketplace channels", "consent_partial"),
}


def seed(db: Session) -> bool:
    if db.scalar(select(User).limit(1)):
        return False  # already seeded

    users = {}
    for email, password, name, role in USERS:
        u = User(email=email, full_name=name, role=role,
                 hashed_password=hash_password(password))
        db.add(u)
        users[role] = u
    db.commit()

    officer, risk = users["credit_officer"], users["risk_head"]
    now = datetime.now(timezone.utc)

    for i, (key, (product, amount, tenure, purpose, stage)) in enumerate(PLAN.items()):
        p = PERSONAS[key]
        payload = ApplicationCreate(
            applicant=ApplicantIn(
                business_name=p.business_name, gstin=p.gstin, pan=p.pan,
                sector=p.sector, entity_type=p.entity_type, city=p.city,
                state=p.state, incorporation_date=p.incorporation_date,
                is_ntc=p.is_ntc, is_ntb=p.is_ntb),
            product=product, amount_requested=amount,
            tenure_months=tenure, purpose=purpose)
        app = services.create_application(db, officer, payload, persona_key=key)

        consents = services.request_consents(db, officer, app, ["AA", "GST", "EPFO"])
        if stage == "consent_partial":
            for c in consents:
                if c.source in ("AA", "GST"):
                    services.approve_consent(db, officer, app, c)
        else:
            for c in consents:
                services.approve_consent(db, officer, app, c)
            if stage != "data_ready":
                services.run_assessment(db, officer, app)
            if stage.startswith("decided:"):
                decision = stage.split(":", 1)[1]
                services.decide(db, risk, app, decision,
                                "Approved per engine recommendation; standard covenants apply.")

        # stagger intake dates so the dashboard has a story to tell, and keep
        # assessment/decision timestamps consistent with the shifted intake
        app.created_at = now - timedelta(days=34 - i * 6, hours=3 * i)
        from .models import Assessment
        for asm in db.scalars(select(Assessment).where(Assessment.application_id == app.id)):
            asm.created_at = app.created_at + timedelta(minutes=26 + 5 * i)
        if app.decided_at:
            app.decided_at = app.created_at + timedelta(hours=5)
        db.commit()
    return True


def main():
    Base.metadata.create_all(engine)
    db = SessionLocal()
    try:
        created = seed(db)
        print("Seeded demo data." if created else "Database already seeded; nothing to do.")
    finally:
        db.close()


if __name__ == "__main__":
    main()
