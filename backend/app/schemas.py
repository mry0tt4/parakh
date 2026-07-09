"""Request validation schemas."""
from typing import Literal

from pydantic import BaseModel, Field

Product = Literal["working_capital", "term_loan", "invoice_finance"]
Source = Literal["AA", "GST", "EPFO"]
Decision = Literal["approved", "conditional", "rejected", "referred"]


class LoginRequest(BaseModel):
    email: str = Field(min_length=5, max_length=254)
    password: str = Field(min_length=8, max_length=128)


class ApplicantIn(BaseModel):
    business_name: str = Field(min_length=2, max_length=200)
    gstin: str = Field(min_length=15, max_length=15, pattern=r"^[0-9A-Z]{15}$")
    pan: str = Field(min_length=10, max_length=10, pattern=r"^[A-Z]{5}[0-9]{4}[A-Z]$")
    sector: str = Field(min_length=2, max_length=100)
    entity_type: Literal["proprietorship", "partnership", "llp", "private_limited"]
    city: str = Field(min_length=2, max_length=100)
    state: str = Field(min_length=2, max_length=100)
    incorporation_date: str = Field(pattern=r"^\d{4}-\d{2}-\d{2}$")
    is_ntc: bool = False
    is_ntb: bool = False


class ApplicationCreate(BaseModel):
    applicant: ApplicantIn
    product: Product
    amount_requested: int = Field(gt=0, le=1_000_000_000)
    tenure_months: int = Field(ge=3, le=120)
    purpose: str = Field(default="", max_length=2000)


class ConsentRequestIn(BaseModel):
    sources: list[Source] = Field(min_length=1, max_length=3)


class DecisionIn(BaseModel):
    decision: Decision
    note: str = Field(default="", max_length=2000)
