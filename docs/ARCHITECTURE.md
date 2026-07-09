# Parakh — Architecture

## System shape

```
                     ┌────────────────────────────────────────────┐
                     │              Bank mobile / web              │
                     │      (existing channels; embed console)     │
                     └──────────────────┬─────────────────────────┘
                                        │ HTTPS
┌───────────────┐    ┌──────────────────▼─────────────────────────┐
│  React console │───▶│            Parakh API (FastAPI)            │
│  (this repo)   │    │  stateless · JWT+RBAC · rate-limit · audit │
└───────────────┘    └───────┬──────────────────┬─────────────────┘
                             │                  │
                   ┌─────────▼────────┐  ┌──────▼───────────────────────┐
                   │   Postgres/SQLite │  │      Assessment engines      │
                   │ applicants, apps, │  │  (pure functions, no I/O):   │
                   │ consents, pulls,  │  │  features → triangulation →  │
                   │ assessments,      │  │  scoring → stress → memo     │
                   │ audit (append-only)│ └──────▲───────────────────────┘
                   └───────────────────┘         │ payloads
                             ┌───────────────────┴───────────────┐
                             │        Connector layer            │
                             │  AA (Setu FIU) · GST (GSP) · EPFO │
                             │  demo: synthetic · prod: real API │
                             └───────────────────────────────────┘
```

## Why it scales

- **Stateless API.** Auth is a signed JWT; no server session. Any number of
  replicas behind a load balancer; DB is the only shared state.
- **Engines are pure functions** (`payloads in → assessment out`, no I/O).
  Today they run in-request (~1s); moving them behind a queue (Celery/arq +
  Redis) is a deployment change, not a redesign — `services.run_assessment`
  is the single call site.
- **Storage via SQLAlchemy URL.** SQLite for the demo, Postgres in production
  (`PARAKH_DATABASE_URL`), no code changes. JSON columns hold engine outputs,
  so schema migrations don't chase engine iteration.
- **Rate limiting interface** is `check(key, limit) -> bool`; the in-memory
  sliding window swaps for Redis for multi-instance correctness.
- **Deterministic engine versioning.** Every assessment stores
  `engine_version` + immutable inputs (hashed pulls), so scores are
  reproducible and back-testable — a model-risk-management requirement.

## The production data-rail swap

`connectors.py` defines one interface (`fetch → payload`, `record_count`,
`integrity`). The demo binds synthetic implementations; production binds:

| Source | Production rail | Notes |
|---|---|---|
| AA | Setu / Sahamati FIU flow | consent artefact + webhook data-ready; IDBI is already an FIU |
| GST | GSP returns-fetch (e.g. Sandbox.co.in) | taxpayer OTP consent, GSTR-1/3B |
| EPFO | verification provider API | establishment contribution history |

The consent lifecycle (PENDING → ACTIVE, purpose code 101, time-bound,
artefact IDs, SHA-256 pull integrity) already mirrors DEPA/ReBIT semantics, so
the swap does not touch `services`, `engines`, routes, or the UI. The demo's
"Approve consent" button stands in for the borrower's action on their AA
handle; in production it becomes a webhook receiver.

## Engine methodology (deliberately explainable)

1. **Features** — one shared extraction: aligned monthly series (inflow,
   outflow, EMI, bounces, GST turnover/delays, headcount), counterparty flow
   maps, seasonal indices. Every engine reads this one structure.
2. **Triangulation** — six checks across sources (GST↔bank ratio, payroll
   plausibility, circular flows, window dressing, balance consistency,
   filing-vs-cash drift) → verification index 0–100 + fraud flags.
3. **Scoring** — five pillars (revenue quality 25%, cash-flow stability 25%,
   obligations 20%, compliance 15%, concentration 15%), each metric carrying
   value + status + explanation (reason codes). Composite maps to 300–900.
   **Verification gates cap the score** — a fraudulent applicant cannot
   pillar-perform its way to approval.
4. **Stress** — liquidity-buffer depletion model: project cash available for
   debt service (trend + seasonality ± residual σ), evolve the cash cushion
   as a random walk, first-passage probability of exhaustion = cumulative
   stress curve. Emits named drivers + RBI-EWS-mapped signals.
5. **Recommendation** — affordability right-sizing: max EMI from target DSCR
   (1.4×) → principal cap → suggest min(requested, DSCR cap, turnover cap).
   Approves, right-sizes, refers, or declines with a stated rationale.
6. **Memo** — deterministic markdown assembly; every figure tagged [S1..S4]
   to its source pull. Deterministic by design: auditable and testable (an
   LLM polish pass is an optional layer, never the system of record).

## Integration surface

The OpenAPI spec (`/api/v1/openapi.json`) is the contract. The score/assess
capability is also consumable headless (`POST /applications/{id}/assess` →
JSON), so the same engine can back: branch underwriting, the bank's mobile
app (self-serve MSME pre-check), or a ULI/OCEN-style lender flow — the API
was designed schema-first (docs/API-CONTRACT.md) for exactly that.
