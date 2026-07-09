"""Data-source connectors.

Each connector exposes the same interface: fetch(applicant_fields,
persona_key) -> payload dict. The demo connectors synthesise data; a
production deployment swaps in implementations that call the real rails —
Setu AA (FIU flow), a GSP such as Sandbox.co.in for GST returns, and an
EPFO verification provider — behind the identical interface. Engine code
never knows the difference.
"""
import hashlib
import json
import time
from datetime import date

import httpx

from . import synth
from .config import get_settings

settings = get_settings()


class ConnectorError(Exception):
    """A rail-side failure the caller can surface to the operator."""


class BaseConnector:
    source = "BASE"

    def fetch(self, *, persona_key: str | None, **applicant_fields) -> dict:
        raise NotImplementedError

    @staticmethod
    def integrity(payload: dict) -> str:
        return hashlib.sha256(json.dumps(payload, sort_keys=True).encode()).hexdigest()

    @staticmethod
    def record_count(payload: dict) -> int:
        raise NotImplementedError


class MockAAConnector(BaseConnector):
    """Stands in for a Sahamati-registered AA FIU pull (e.g. via Setu)."""
    source = "AA"

    def fetch(self, *, persona_key: str | None, **applicant_fields) -> dict:
        return synth.bank_payload(synth.resolve_persona(persona_key, **applicant_fields))

    @staticmethod
    def record_count(payload: dict) -> int:
        return len(payload["transactions"])


class MockGSTConnector(BaseConnector):
    """Stands in for a GSP returns-fetch (taxpayer-consented, OTP flow)."""
    source = "GST"

    def fetch(self, *, persona_key: str | None, **applicant_fields) -> dict:
        return synth.gst_payload(synth.resolve_persona(persona_key, **applicant_fields))

    @staticmethod
    def record_count(payload: dict) -> int:
        return len(payload["returns"])


class MockEPFOConnector(BaseConnector):
    """Stands in for an EPFO establishment-contribution verification API."""
    source = "EPFO"

    def fetch(self, *, persona_key: str | None, **applicant_fields) -> dict:
        return synth.epfo_payload(synth.resolve_persona(persona_key, **applicant_fields))

    @staticmethod
    def record_count(payload: dict) -> int:
        return len(payload["months"])


class SetuAAConnector(BaseConnector):
    """EXPERIMENTAL — real Setu AA sandbox integration (v2 API).

    Flow: create consent → borrower approves on Setu's Anumati page (sandbox
    OTP 123456) → create data session → fetch FI data → transform to the
    payload shape the engines consume. Synchronous with a short poll window:
    if the borrower hasn't approved yet, raises ConnectorError carrying the
    approval URL so the operator can complete the loop and retry.

    Enabled only when PARAKH_SETU_CLIENT_ID / _SECRET / _PRODUCT_INSTANCE_ID
    are configured; otherwise the synthetic mock stays bound and the demo
    runs fully offline.
    """
    source = "AA"
    POLL_SECONDS = 20

    def _headers(self) -> dict:
        return {"x-client-id": settings.setu_client_id,
                "x-client-secret": settings.setu_client_secret,
                "x-product-instance-id": settings.setu_product_instance_id,
                "Content-Type": "application/json"}

    def fetch(self, *, persona_key: str | None, **applicant_fields) -> dict:
        base = settings.setu_base_url.rstrip("/")
        data_from = f"{date.today().year - 2}-{date.today().month:02d}-01"
        data_to = date.today().isoformat()
        with httpx.Client(timeout=15) as http:
            consent = http.post(f"{base}/v2/consents", headers=self._headers(), json={
                "consentDuration": {"unit": "MONTH", "value": 6},
                "vua": settings.setu_test_vua,
                "dataRange": {"from": f"{data_from}T00:00:00Z", "to": f"{data_to}T00:00:00Z"},
                "context": [],
            })
            if consent.status_code >= 300:
                raise ConnectorError(f"Setu consent create failed: {consent.status_code} {consent.text[:200]}")
            consent_body = consent.json()
            consent_id, approval_url = consent_body["id"], consent_body.get("url", "")

            deadline = time.monotonic() + self.POLL_SECONDS
            status = consent_body.get("status", "PENDING")
            while status != "ACTIVE" and time.monotonic() < deadline:
                time.sleep(2)
                status = http.get(f"{base}/v2/consents/{consent_id}",
                                  headers=self._headers()).json().get("status", "PENDING")
            if status != "ACTIVE":
                raise ConnectorError(
                    f"Consent {consent_id} awaiting borrower approval on the AA rail. "
                    f"Open {approval_url} (sandbox OTP 123456), then retry.")

            session = http.post(f"{base}/v2/sessions", headers=self._headers(), json={
                "consentId": consent_id,
                "dataRange": {"from": f"{data_from}T00:00:00Z", "to": f"{data_to}T00:00:00Z"},
                "format": "json",
            }).json()
            session_id = session["id"]
            deadline = time.monotonic() + self.POLL_SECONDS
            body = session
            while body.get("status") not in ("COMPLETED", "PARTIAL") and time.monotonic() < deadline:
                time.sleep(2)
                body = http.get(f"{base}/v2/sessions/{session_id}", headers=self._headers()).json()
            if body.get("status") not in ("COMPLETED", "PARTIAL"):
                raise ConnectorError(f"Setu data session {session_id} did not complete in time.")
            return self._transform(body, applicant_fields.get("business_name", ""))

    @staticmethod
    def _transform(session_body: dict, holder: str) -> dict:
        """Setu FI deposit payload → engine bank-payload shape."""
        txns = []
        masked = "XXXXXXXX0000"
        for fip in session_body.get("fips", []):
            for account in fip.get("accounts", []):
                data = account.get("data", {}).get("account", {})
                masked = account.get("maskedAccNumber", masked)
                raw = data.get("transactions", {}).get("transaction", [])
                for t in raw:
                    amount = float(t.get("amount", 0))
                    narration = t.get("narration", "") or t.get("reference", "")
                    mode = (t.get("mode") or "OTHERS").upper()
                    channel = ("UPI" if "UPI" in mode or "UPI" in narration.upper()
                               else "CASH" if "CASH" in mode
                               else "NEFT" if mode in ("FT", "OTHERS") else mode)
                    txns.append({
                        "date": str(t.get("valueDate") or t.get("transactionTimestamp", ""))[:10],
                        "narration": narration,
                        "amount": int(round(amount)),
                        "direction": "CR" if t.get("type", "").upper() == "CREDIT" else "DR",
                        "channel": channel if channel in
                        ("UPI", "NEFT", "IMPS", "RTGS", "CASH", "CHEQUE", "ACH", "CHARGES") else "NEFT",
                        "counterparty": narration.split("-")[0][:40] or "Counterparty",
                        "balance_after": int(float(t.get("currentBalance", 0))),
                    })
        txns.sort(key=lambda x: x["date"])
        return {
            "fip": "SETU-SANDBOX-FIP",
            "account": {"type": "CURRENT", "masked_number": masked,
                        "ifsc": "SETU0000001", "holder": holder},
            "period": {"from": txns[0]["date"] if txns else "",
                       "to": txns[-1]["date"] if txns else ""},
            "transactions": txns,
        }

    @staticmethod
    def record_count(payload: dict) -> int:
        return len(payload["transactions"])


def _aa_connector() -> BaseConnector:
    if settings.setu_client_id and settings.setu_client_secret and settings.setu_product_instance_id:
        return SetuAAConnector()
    return MockAAConnector()


CONNECTORS: dict[str, BaseConnector] = {
    c.source: c for c in (_aa_connector(), MockGSTConnector(), MockEPFOConnector())
}


def get_connector(source: str) -> BaseConnector:
    if source not in CONNECTORS:
        raise KeyError(f"Unknown data source: {source}")
    return CONNECTORS[source]
