# Parakh API Contract — v1

Base URL: `http://localhost:8000/api/v1` (frontend dev server proxies `/api` → `:8000`).

Auth: `Authorization: Bearer <access_token>` on every endpoint except `/auth/login` and `/health`.
All timestamps are ISO-8601 UTC. All money values are INR integers (paise omitted). Errors use FastAPI shape `{"detail": "message"}` with status 401 (unauthenticated), 403 (role/limit forbidden), 404, 409 (invalid state transition), 422 (validation), 429 (rate limited).

## Roles

| role | can |
|---|---|
| `credit_officer` | create applications, request/approve consents, run assessments, decide applications with `amount_requested <= 2500000` |
| `risk_head` | everything credit_officer can + decide any amount + view audit log + portfolio alerts |
| `admin` | everything + audit log |

Demo users (seeded): `officer@parakh.demo` / `Officer@2026`, `risk@parakh.demo` / `Risk@2026`, `admin@parakh.demo` / `Admin@2026`.

## Application status lifecycle

`draft` → (request consents) → `consent_pending` → (all consents approved & data pulled) → `data_ready` → (assess) → `assessed` → (decision) → `approved` | `conditional` | `rejected` | `referred`

---

## Auth

### POST /auth/login
Request: `{"email": "officer@parakh.demo", "password": "Officer@2026"}`
Response 200:
```json
{
  "access_token": "eyJ...",
  "token_type": "bearer",
  "expires_in": 3600,
  "user": {"id": "usr_01", "email": "officer@parakh.demo", "full_name": "Asha Verma", "role": "credit_officer"}
}
```

### GET /auth/me
Response 200: the `user` object above.

---

## Applications

### GET /applications?status=&search=&page=1&page_size=20
`status` optional (any lifecycle value), `search` matches business name / ref / GSTIN.
Response 200:
```json
{
  "items": [
    {
      "id": "app_01",
      "ref": "PRK-2026-000001",
      "applicant": {
        "id": "apl_01",
        "business_name": "Saraswati Kirana & General Stores",
        "gstin_masked": "27XXXXXX0001Z5",
        "pan_masked": "AXXPX1234X",
        "sector": "Retail Trade",
        "entity_type": "proprietorship",
        "city": "Nashik", "state": "Maharashtra",
        "incorporation_date": "2018-04-12",
        "is_ntc": true, "is_ntb": true
      },
      "product": "working_capital",
      "amount_requested": 1500000,
      "tenure_months": 24,
      "status": "assessed",
      "health_score": 742, "grade": "B+", "verification_index": 87, "pd_12m": 0.11,
      "decision": null, "decision_note": null,
      "created_at": "2026-07-01T06:10:00Z", "updated_at": "2026-07-01T06:14:00Z"
    }
  ],
  "total": 6, "page": 1, "page_size": 20
}
```
`health_score`/`grade`/`verification_index`/`pd_12m` are `null` until assessed. `product` ∈ `working_capital | term_loan | invoice_finance`.

### POST /applications
Request:
```json
{
  "applicant": {
    "business_name": "New Venture Traders", "gstin": "27ABCDE1234F1Z5", "pan": "ABCDE1234F",
    "sector": "Retail Trade", "entity_type": "proprietorship",
    "city": "Pune", "state": "Maharashtra", "incorporation_date": "2022-06-01",
    "is_ntc": true, "is_ntb": true
  },
  "product": "working_capital", "amount_requested": 1200000, "tenure_months": 24,
  "purpose": "Inventory purchase for festive season"
}
```
Response 201: full ApplicationDetail (below), `status: "draft"`.

### GET /applications/{id}
Response 200 — ApplicationDetail = list item shape **plus**:
```json
{
  "purpose": "Inventory purchase for festive season",
  "consents": [
    {
      "id": "cns_01", "source": "AA", "artefact_id": "AA-ART-7f3e9c",
      "status": "ACTIVE", "purpose_code": "101",
      "data_from": "2024-07-01", "data_to": "2026-06-30",
      "requested_at": "2026-07-01T06:10:30Z", "granted_at": "2026-07-01T06:11:00Z",
      "expires_at": "2026-10-01T06:11:00Z",
      "data_pull": {"id": "dp_01", "fetched_at": "2026-07-01T06:11:02Z", "record_count": 4180, "sha256": "ab12..."}
    }
  ],
  "has_assessment": true,
  "decided_by": null, "decided_at": null
}
```
`source` ∈ `AA | GST | EPFO`. Consent `status` ∈ `PENDING | ACTIVE | REVOKED | EXPIRED`. `data_pull` is `null` until approved.

### POST /applications/{id}/consents
Request: `{"sources": ["AA", "GST", "EPFO"]}` — allowed from `draft`/`consent_pending`. Moves status to `consent_pending`.
Response 201: `{"consents": [ ...consent objects, status PENDING... ]}`

### POST /applications/{id}/consents/{consent_id}/approve
Simulates the borrower approving on their AA/GST handle (production: async webhook). Pulls data through the connector, stores it.
Response 200: the consent object with `status: "ACTIVE"` and populated `data_pull`. When the last consent is approved, application status becomes `data_ready`.

### POST /applications/{id}/assess
Allowed from `data_ready` (or `assessed` to re-run; creates version+1). Synchronous in demo (production: queued worker).
Response 200: AssessmentDetail:
```json
{
  "id": "asm_01", "application_id": "app_01", "version": 1,
  "engine_version": "1.0.0", "created_at": "2026-07-01T06:14:00Z",
  "health_score": 742, "grade": "B+", "verification_index": 87,
  "pd_12m": 0.11, "risk_band": "Moderate",
  "recommendation": {
    "action": "APPROVE_CONDITIONAL",
    "suggested_limit": 1200000,
    "conditions": ["Quarterly GST filing check", "Limit step-up review after 6 months"],
    "rationale": "Verified cash flows support the requested facility with headroom; conditional on continued filing discipline."
  },
  "pillars": [
    {
      "key": "revenue_quality", "label": "Revenue Quality & Growth", "score": 78, "weight": 0.25,
      "metrics": [
        {"key": "verified_annual_revenue", "label": "Verified annual revenue", "value": 8400000, "unit": "INR",
         "benchmark": null, "status": "good",
         "explanation": "Bank-verified inflows corroborate 92% of GST-declared turnover."}
      ]
    }
  ],
  "triangulation": {
    "index": 87,
    "checks": [
      {"key": "gst_vs_bank", "label": "GST turnover vs bank inflows", "status": "PASS", "severity": "high",
       "metrics": {"ratio_ttm": 0.92, "months_in_band": 21},
       "explanation": "Declared turnover matches banked inflows within tolerance for 21 of 24 months."}
    ],
    "fraud_flags": [
      {"code": "CIRCULAR_FLOW", "severity": "critical", "description": "38% of inflows return to the same counterparties within 7 days."}
    ]
  },
  "stress": {
    "pd_12m": 0.11, "first_breach_month": null,
    "curve": [
      {"month": "2026-08", "dscr_p50": 1.82, "dscr_p10": 1.31, "stress_prob": 0.006, "cumulative_prob": 0.006}
    ],
    "drivers": [{"factor": "seasonality_trough", "impact": "medium", "description": "Apr–Jun trough reduces DSCR to 1.3x at P10."}],
    "ews_signals": [{"code": "EWS_GST_DELAY", "label": "GST filing delays increasing", "severity": "medium", "evidence": "Mean filing delay rose from 2 to 9 days over last 2 quarters."}]
  }
}
```
Pillar keys (fixed set, always all 5): `revenue_quality`, `cashflow_stability`, `obligations_leverage`, `compliance_discipline`, `counterparty_concentration`.
Triangulation check keys: `gst_vs_bank`, `payroll_plausibility`, `circular_flows`, `window_dressing`, `balance_consistency`, `filing_vs_cash`.
Statuses: check `PASS|WARN|FAIL`; metric `good|warn|bad`; recommendation `action` ∈ `APPROVE | APPROVE_CONDITIONAL | REFER | DECLINE`.

### GET /applications/{id}/assessment
Response 200: latest AssessmentDetail. 404 if never assessed.

### GET /applications/{id}/memo
Response 200:
```json
{
  "memo_markdown": "# Credit Assessment Memo — PRK-2026-000001\n...",
  "citations": [{"tag": "S1", "source": "GSTR-3B 2025-04..2026-03", "description": "Declared outward taxable supplies"}],
  "generated_at": "2026-07-01T06:14:01Z", "engine_version": "1.0.0"
}
```

### POST /applications/{id}/decision
Request: `{"decision": "approved", "note": "Approved at reduced limit per assessment."}`
`decision` ∈ `approved | conditional | rejected | referred`. Allowed from `assessed`. RBAC: credit_officer limited to `amount_requested <= 2500000`, else 403 with guidance to refer.
Response 200: updated ApplicationDetail (status = decision).

### GET /applications/{id}/cashflow
Response 200:
```json
{
  "months": [
    {"month": "2024-07", "inflow": 612000, "outflow": 548000, "net": 64000,
     "avg_balance": 182000, "gst_turnover": 590000, "emi_outflow": 22000, "bounce_count": 0}
  ]
}
```

### GET /applications/{id}/transactions?month=2026-05&page=1&page_size=50
Response 200: paginated `{"items": [{"date": "2026-05-03", "narration": "UPI/CR/512399887766/GPAY/retail collection", "amount": 18450, "direction": "CR", "channel": "UPI", "counterparty": "UPI Collections", "balance_after": 234500}], "total": 178, "page": 1, "page_size": 50}`
`direction` ∈ `CR|DR`; `channel` ∈ `UPI | NEFT | IMPS | RTGS | CASH | CHEQUE | ACH | CHARGES`.

### GET /applications/{id}/timeline
Response 200: `{"items": [{"id": "aud_09", "ts": "2026-07-01T06:14:00Z", "actor_email": "officer@parakh.demo", "actor_role": "credit_officer", "action": "assessment.run", "entity_type": "application", "entity_id": "app_01", "detail": {"version": 1, "health_score": 742}}]}`

---

## Portfolio

### GET /portfolio/summary
```json
{
  "kpis": {
    "total_applications": 6, "pending_review": 2, "approved_count": 2,
    "approval_rate": 0.5, "avg_health_score": 664,
    "total_requested": 21500000, "total_approved_amount": 4200000, "avg_tat_minutes": 34
  },
  "status_funnel": [{"status": "draft", "count": 1}],
  "grade_distribution": [{"grade": "A", "count": 1}],
  "sector_mix": [{"sector": "Retail Trade", "count": 2, "amount": 3500000}],
  "monthly_intake": [{"month": "2026-06", "count": 3}]
}
```
Grades (fixed order): `A+ A B+ B C D`. Bands: 800+ A+, 750–799 A, 700–749 B+, 650–699 B, 550–649 C, <550 D.

### GET /portfolio/alerts  (risk_head/admin)
`{"items": [{"application_id": "app_05", "ref": "PRK-2026-000005", "business_name": "Balaji Auto Components", "code": "EWS_BOUNCE", "label": "Payment bounces detected", "severity": "high", "detail": "3 inward cheque/ACH returns in last 6 months.", "created_at": "2026-07-01T06:20:00Z"}]}`

---

## Audit  (risk_head/admin)

### GET /audit?page=1&page_size=50&action=&actor=
Paginated audit events, newest first — same event shape as `/timeline`, plus `"ip"`.

---

## Health Card (borrower-facing)

### GET /applications/{id}/healthcard
The MSME-facing view of an assessment: plain language, no underwriting jargon. 404 if never assessed.
```json
{
  "ref": "PRK-2026-000006", "business_name": "GreenLeaf Organics",
  "generated_at": "2026-07-08T10:00:00Z", "engine_version": "1.0.0",
  "score": 692, "grade": "B", "verification_index": 100,
  "badge": "VERIFIED",
  "summary": "GreenLeaf Organics shows verified, fast-growing cash flows...",
  "strengths": [{"title": "Fully corroborated revenue", "detail": "GST filings and banked inflows agree within 8%."}],
  "watchouts": [{"title": "Short track record", "detail": "Only 14 months of operating history."}],
  "pillars": [{"key": "revenue_quality", "label": "Revenue Quality & Growth", "score": 78, "status": "good"}],
  "eligible_offer": {"product": "working_capital", "limit": 300000, "indicative_emi": 18120, "tenure_months": 18},
  "roadmap": [
    {"action": "File GSTR-3B by the due date for the next two quarters",
     "why": "Filing discipline feeds your Compliance pillar directly.",
     "impact_points": 12, "timeframe_months": 6}
  ],
  "next_review_date": "2026-10-01",
  "card_id": "PRKC-4f2a9c1b", "issued_by": "Parakh · IDBI Innovate 2026 sandbox"
}
```
`badge` ∈ `VERIFIED` (index ≥ 80) | `PARTIALLY_VERIFIED` | `VERIFICATION_FAILED` (critical fraud flags — card shows verification guidance instead of offers).
`eligible_offer` is `null` unless the engine recommendation was APPROVE/APPROVE_CONDITIONAL. `roadmap` is present for every card (empty only for perfect scores); `impact_points` are estimated score gains.

## Ecosystem (portable report)

### GET /ecosystem/health-report/{application_id}
ULI/OCEN-aligned portable JSON (schema `parakh.health-report.v1`) for lender-to-lender or marketplace consumption. Access is audited.
```json
{
  "schema": "parakh.health-report.v1",
  "report_id": "PRKR-9a1b2c3d", "generated_at": "2026-07-08T10:00:00Z",
  "engine_version": "1.0.0",
  "subject": {"gstin_masked": "06XXXXX812C1ZR", "business_name": "GreenLeaf Organics", "sector": "FMCG / D2C", "state": "Haryana"},
  "consent_artefacts": [{"source": "AA", "artefact_id": "AA-ART-7f3e9c", "data_from": "2024-07-01", "data_to": "2026-06-30"}],
  "score": {"value": 692, "grade": "B", "verification_index": 100,
            "pillars": [{"key": "revenue_quality", "score": 78, "weight": 0.25}]},
  "stress": {"pd_12m": 0.0037, "risk_band": "Low", "first_breach_month": null},
  "flags": []
}
```

## Meta

### GET /health  (no auth)
`{"status": "ok", "version": "1.0.0", "time": "2026-07-08T10:00:00Z"}`

### GET /meta/enums
`{"products": [...], "statuses": [...], "sectors": [...], "consent_sources": ["AA","GST","EPFO"], "decisions": [...], "grades": [...]}`
