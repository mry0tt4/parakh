"""ORM models.

Design notes for bank integration:
- Public string IDs (prefixed, non-sequential) so internal row IDs never leak.
- AuditEvent is append-only: the application exposes no update/delete path.
- Raw source payloads (DataPull) are stored with a SHA-256 integrity hash so
  every number in an assessment can be traced back to a verifiable pull.
"""
import uuid
from datetime import datetime, timezone

from sqlalchemy import (JSON, Boolean, Date, DateTime, Float, ForeignKey,
                        Integer, String, Text)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .database import Base


def _id(prefix: str) -> str:
    return f"{prefix}_{uuid.uuid4().hex[:10]}"


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


class User(Base):
    __tablename__ = "users"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: _id("usr"))
    email: Mapped[str] = mapped_column(String, unique=True, index=True)
    full_name: Mapped[str] = mapped_column(String)
    hashed_password: Mapped[str] = mapped_column(String)
    role: Mapped[str] = mapped_column(String)  # credit_officer | risk_head | admin
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)


class Applicant(Base):
    __tablename__ = "applicants"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: _id("apl"))
    business_name: Mapped[str] = mapped_column(String, index=True)
    gstin: Mapped[str] = mapped_column(String, index=True)
    pan: Mapped[str] = mapped_column(String)
    sector: Mapped[str] = mapped_column(String)
    entity_type: Mapped[str] = mapped_column(String)
    city: Mapped[str] = mapped_column(String)
    state: Mapped[str] = mapped_column(String)
    incorporation_date: Mapped[str] = mapped_column(String)  # ISO date
    is_ntc: Mapped[bool] = mapped_column(Boolean, default=False)
    is_ntb: Mapped[bool] = mapped_column(Boolean, default=False)
    # Which synthetic persona backs this applicant's data in the demo
    # connectors. Real connectors ignore this field entirely.
    persona_key: Mapped[str | None] = mapped_column(String, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)

    applications: Mapped[list["LoanApplication"]] = relationship(back_populates="applicant")


class LoanApplication(Base):
    __tablename__ = "loan_applications"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: _id("app"))
    ref: Mapped[str] = mapped_column(String, unique=True, index=True)
    applicant_id: Mapped[str] = mapped_column(ForeignKey("applicants.id"))
    product: Mapped[str] = mapped_column(String)  # working_capital | term_loan | invoice_finance
    amount_requested: Mapped[int] = mapped_column(Integer)
    tenure_months: Mapped[int] = mapped_column(Integer)
    purpose: Mapped[str] = mapped_column(Text, default="")
    status: Mapped[str] = mapped_column(String, default="draft", index=True)
    decision: Mapped[str | None] = mapped_column(String, nullable=True)
    decision_note: Mapped[str | None] = mapped_column(Text, nullable=True)
    decided_by: Mapped[str | None] = mapped_column(ForeignKey("users.id"), nullable=True)
    decided_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_by: Mapped[str] = mapped_column(ForeignKey("users.id"))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, onupdate=utcnow)

    applicant: Mapped[Applicant] = relationship(back_populates="applications")
    consents: Mapped[list["ConsentRecord"]] = relationship(back_populates="application")
    assessments: Mapped[list["Assessment"]] = relationship(back_populates="application")


class ConsentRecord(Base):
    """Consent artefact, modelled on Sahamati/DEPA semantics: purpose-bound,
    time-bound, revocable, and linked to the exact data pull it authorised."""
    __tablename__ = "consents"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: _id("cns"))
    application_id: Mapped[str] = mapped_column(ForeignKey("loan_applications.id"))
    source: Mapped[str] = mapped_column(String)  # AA | GST | EPFO
    artefact_id: Mapped[str] = mapped_column(String)
    status: Mapped[str] = mapped_column(String, default="PENDING")  # PENDING|ACTIVE|REVOKED|EXPIRED
    purpose_code: Mapped[str] = mapped_column(String, default="101")  # AA purpose code: loan underwriting
    data_from: Mapped[str] = mapped_column(String)
    data_to: Mapped[str] = mapped_column(String)
    requested_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    granted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    expires_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    application: Mapped[LoanApplication] = relationship(back_populates="consents")
    data_pull: Mapped["DataPull | None"] = relationship(back_populates="consent", uselist=False)


class DataPull(Base):
    __tablename__ = "data_pulls"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: _id("dp"))
    consent_id: Mapped[str] = mapped_column(ForeignKey("consents.id"))
    source: Mapped[str] = mapped_column(String)
    fetched_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    record_count: Mapped[int] = mapped_column(Integer)
    sha256: Mapped[str] = mapped_column(String)
    payload: Mapped[dict] = mapped_column(JSON)

    consent: Mapped[ConsentRecord] = relationship(back_populates="data_pull")


class Assessment(Base):
    __tablename__ = "assessments"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: _id("asm"))
    application_id: Mapped[str] = mapped_column(ForeignKey("loan_applications.id"))
    version: Mapped[int] = mapped_column(Integer, default=1)
    engine_version: Mapped[str] = mapped_column(String)
    health_score: Mapped[int] = mapped_column(Integer)
    grade: Mapped[str] = mapped_column(String)
    verification_index: Mapped[int] = mapped_column(Integer)
    pd_12m: Mapped[float] = mapped_column(Float)
    risk_band: Mapped[str] = mapped_column(String)
    recommendation: Mapped[dict] = mapped_column(JSON)
    pillars: Mapped[list] = mapped_column(JSON)
    triangulation: Mapped[dict] = mapped_column(JSON)
    stress: Mapped[dict] = mapped_column(JSON)
    memo_markdown: Mapped[str] = mapped_column(Text)
    memo_citations: Mapped[list] = mapped_column(JSON)
    created_by: Mapped[str] = mapped_column(ForeignKey("users.id"))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)

    application: Mapped[LoanApplication] = relationship(back_populates="assessments")


class AuditEvent(Base):
    __tablename__ = "audit_events"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: _id("aud"))
    ts: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, index=True)
    actor_id: Mapped[str | None] = mapped_column(String, nullable=True)
    actor_email: Mapped[str | None] = mapped_column(String, nullable=True)
    actor_role: Mapped[str | None] = mapped_column(String, nullable=True)
    action: Mapped[str] = mapped_column(String, index=True)
    entity_type: Mapped[str] = mapped_column(String)
    entity_id: Mapped[str] = mapped_column(String, index=True)
    ip: Mapped[str | None] = mapped_column(String, nullable=True)
    detail: Mapped[dict] = mapped_column(JSON, default=dict)
