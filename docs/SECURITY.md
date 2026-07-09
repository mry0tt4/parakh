# Parakh — Security model

Scope: controls implemented in this codebase, and the posture they extend to
in a bank deployment. Demo runs entirely on synthetic data — no real PII.

## Identity & access

- **AuthN**: bcrypt(12) password hashes; short-lived HS256 JWTs (1h default),
  issuer-pinned, verified on every request. Uniform-timing verification on
  failed logins (hash comparison runs even for unknown users).
- **AuthZ (RBAC)**: role guards as FastAPI dependencies. Credit officers
  cannot view the audit log or portfolio alerts, and cannot decide
  applications above ₹25L (`PARAKH_OFFICER_DECISION_LIMIT`) — maker/checker
  separation is enforced server-side, not in the UI.
- Production upgrade path: JWT → bank SSO/OIDC; HS256 → RS256 with KMS-held
  keys; httpOnly cookie transport.

## Data protection

- **Consent-first**: no pull without a consent artefact (purpose-bound
  code 101, time-bound window, expiry, revocable status) — DEPA/ReBIT
  aligned. The pull stores a SHA-256 of the payload: every number in an
  assessment traces to a verifiable, consented fetch.
- **PII minimisation**: GSTIN/PAN leave the API only masked
  (length-preserving). Raw payloads are returned only through authorised,
  audited endpoints; audit `detail` payloads never carry document numbers.
- **At rest**: demo SQLite; production Postgres with disk encryption +
  column-level encryption for identifiers (the model layer isolates where
  that lands).

## Abuse resistance

- **Rate limiting**: per-IP sliding window; login endpoint 10/min (brute-force
  guard), API 240/min. Redis-backed for multi-instance in production.
- **Input validation**: Pydantic schemas everywhere — GSTIN/PAN patterns,
  bounded amounts/tenures/pagination; SQLAlchemy bound parameters (no string
  SQL anywhere).
- **State machine**: lifecycle transitions validated server-side (409 on
  anything out of order); decisions are terminal.
- **Headers**: nosniff, DENY framing, no-referrer, no-store on API responses,
  HSTS in production mode. CORS pinned to the console origin, methods and
  headers enumerated.

## Accountability

- **Append-only audit trail**: every mutating action (and every login,
  including failures) records actor, role, IP, action, entity and structured
  detail. The application exposes no update/delete path for audit rows.
  Per-application timeline is served from the same trail — one source of
  truth for "who did what, when".
- **Reproducibility as a control**: engines are deterministic and versioned;
  an assessment can be re-derived from its stored pulls byte-for-byte
  (memo timestamp aside) — supports model-risk review and dispute handling.

## Known demo-vs-production gaps (stated deliberately)

| Demo | Production |
|---|---|
| JWT in localStorage | httpOnly SameSite cookies via bank gateway |
| HS256 shared secret | RS256, keys in KMS/HSM, rotation |
| In-memory rate limiter | Redis, plus WAF at the edge |
| SQLite file | Postgres + TDE, PITR backups |
| Consent approval simulated in-app | Signed webhooks from AA/GSP rails |
| No virus/secrets scanning in CI | Bank SDLC pipeline controls |
