/* ── Parakh API contract types (docs/API-CONTRACT.md v1) ─────────────── */

export type Role = 'credit_officer' | 'risk_head' | 'admin'

export interface User {
  id: string
  email: string
  full_name: string
  role: Role
}

export interface LoginResponse {
  access_token: string
  token_type: string
  expires_in: number
  user: User
}

export type Product = 'working_capital' | 'term_loan' | 'invoice_finance'

export type ApplicationStatus =
  | 'draft'
  | 'consent_pending'
  | 'data_ready'
  | 'assessed'
  | 'approved'
  | 'conditional'
  | 'rejected'
  | 'referred'

export type Decision = 'approved' | 'conditional' | 'rejected' | 'referred'

export type Grade = 'A+' | 'A' | 'B+' | 'B' | 'C' | 'D'

export interface Applicant {
  id: string
  business_name: string
  gstin_masked: string
  pan_masked: string
  sector: string
  entity_type: string
  city: string
  state: string
  incorporation_date: string
  is_ntc: boolean
  is_ntb: boolean
}

export interface ApplicationListItem {
  id: string
  ref: string
  applicant: Applicant
  product: Product
  amount_requested: number
  tenure_months: number
  status: ApplicationStatus
  health_score: number | null
  grade: Grade | null
  verification_index: number | null
  pd_12m: number | null
  decision: Decision | null
  decision_note: string | null
  created_at: string
  updated_at: string
}

export interface Paginated<T> {
  items: T[]
  total: number
  page: number
  page_size: number
}

export type ConsentSource = 'AA' | 'GST' | 'EPFO'
export type ConsentStatus = 'PENDING' | 'ACTIVE' | 'REVOKED' | 'EXPIRED'

export interface DataPull {
  id: string
  fetched_at: string
  record_count: number
  sha256: string
}

export interface Consent {
  id: string
  source: ConsentSource
  artefact_id: string
  status: ConsentStatus
  purpose_code: string
  data_from: string
  data_to: string
  requested_at: string
  granted_at: string | null
  expires_at: string | null
  data_pull: DataPull | null
}

export interface ApplicationDetail extends ApplicationListItem {
  purpose: string
  consents: Consent[]
  has_assessment: boolean
  decided_by: string | null
  decided_at: string | null
}

export interface NewApplicantPayload {
  business_name: string
  gstin: string
  pan: string
  sector: string
  entity_type: string
  city: string
  state: string
  incorporation_date: string
  is_ntc: boolean
  is_ntb: boolean
}

export interface NewApplicationPayload {
  applicant: NewApplicantPayload
  product: Product
  amount_requested: number
  tenure_months: number
  purpose: string
}

/* ── Assessment ──────────────────────────────────────────────────────── */

export type MetricStatus = 'good' | 'warn' | 'bad'

export interface PillarMetric {
  key: string
  label: string
  value: number | string | null
  unit: string | null
  benchmark: number | string | null
  status: MetricStatus
  explanation: string
}

export type PillarKey =
  | 'revenue_quality'
  | 'cashflow_stability'
  | 'obligations_leverage'
  | 'compliance_discipline'
  | 'counterparty_concentration'

export interface Pillar {
  key: PillarKey
  label: string
  score: number
  weight: number
  metrics: PillarMetric[]
}

export type CheckStatus = 'PASS' | 'WARN' | 'FAIL'

export interface TriangulationCheck {
  key: string
  label: string
  status: CheckStatus
  severity: string
  metrics: Record<string, number | string>
  explanation: string
}

export interface FraudFlag {
  code: string
  severity: string
  description: string
}

export interface Triangulation {
  index: number
  checks: TriangulationCheck[]
  fraud_flags: FraudFlag[]
}

export interface StressPoint {
  month: string
  dscr_p50: number
  dscr_p10: number
  stress_prob: number
  cumulative_prob: number
}

export interface StressDriver {
  factor: string
  impact: string
  description: string
}

export interface EwsSignal {
  code: string
  label: string
  severity: string
  evidence: string
}

export interface Stress {
  pd_12m: number
  first_breach_month: string | null
  curve: StressPoint[]
  drivers: StressDriver[]
  ews_signals: EwsSignal[]
}

export type RecommendationAction = 'APPROVE' | 'APPROVE_CONDITIONAL' | 'REFER' | 'DECLINE'

export interface Recommendation {
  action: RecommendationAction
  suggested_limit: number | null
  conditions: string[]
  rationale: string
}

export interface AssessmentDetail {
  id: string
  application_id: string
  version: number
  engine_version: string
  created_at: string
  health_score: number
  grade: Grade
  verification_index: number
  pd_12m: number
  risk_band: string
  recommendation: Recommendation
  pillars: Pillar[]
  triangulation: Triangulation
  stress: Stress
}

/* ── Health Card (borrower-facing) ───────────────────────────────────── */

export type HealthCardBadge = 'VERIFIED' | 'PARTIALLY_VERIFIED' | 'VERIFICATION_FAILED'

/** A titled plain-language point (strength or watch-out). */
export interface HealthCardPoint {
  title: string
  detail: string
}

export interface HealthCardPillar {
  key: PillarKey
  label: string
  score: number
  status: MetricStatus
}

export interface EligibleOffer {
  product: Product
  limit: number
  indicative_emi: number
  tenure_months: number
}

export interface RoadmapItem {
  action: string
  why: string
  impact_points: number
  timeframe_months: number
}

export interface HealthCard {
  ref: string
  business_name: string
  generated_at: string
  engine_version: string
  score: number
  grade: Grade
  verification_index: number
  badge: HealthCardBadge
  summary: string
  strengths: HealthCardPoint[]
  watchouts: HealthCardPoint[]
  pillars: HealthCardPillar[]
  eligible_offer: EligibleOffer | null
  roadmap: RoadmapItem[]
  next_review_date: string
  card_id: string
  issued_by: string
}

/* ── Memo ────────────────────────────────────────────────────────────── */

export interface Citation {
  tag: string
  source: string
  description: string
}

export interface MemoResponse {
  memo_markdown: string
  citations: Citation[]
  generated_at: string
  engine_version: string
}

/* ── Cash flow & transactions ────────────────────────────────────────── */

export interface CashflowMonth {
  month: string
  inflow: number
  outflow: number
  net: number
  avg_balance: number
  gst_turnover: number
  emi_outflow: number
  bounce_count: number
}

export interface CashflowResponse {
  months: CashflowMonth[]
}

export type TxnDirection = 'CR' | 'DR'
export type TxnChannel = 'UPI' | 'NEFT' | 'IMPS' | 'RTGS' | 'CASH' | 'CHEQUE' | 'ACH' | 'CHARGES'

export interface Transaction {
  date: string
  narration: string
  amount: number
  direction: TxnDirection
  channel: TxnChannel
  counterparty: string
  balance_after: number
}

/* ── Timeline / audit ────────────────────────────────────────────────── */

export interface TimelineEvent {
  id: string
  ts: string
  actor_email: string | null
  actor_role: string | null
  action: string
  entity_type: string
  entity_id: string
  detail: Record<string, unknown> | null
}

export interface AuditEvent extends TimelineEvent {
  ip?: string
}

/* ── Portfolio ───────────────────────────────────────────────────────── */

export interface PortfolioKpis {
  total_applications: number
  pending_review: number
  approved_count: number
  approval_rate: number
  avg_health_score: number
  total_requested: number
  total_approved_amount: number
  avg_tat_minutes: number
}

export interface StatusFunnelEntry {
  status: ApplicationStatus
  count: number
}

export interface GradeDistributionEntry {
  grade: Grade
  count: number
}

export interface SectorMixEntry {
  sector: string
  count: number
  amount: number
}

export interface MonthlyIntakeEntry {
  month: string
  count: number
}

export interface PortfolioSummary {
  kpis: PortfolioKpis
  status_funnel: StatusFunnelEntry[]
  grade_distribution: GradeDistributionEntry[]
  sector_mix: SectorMixEntry[]
  monthly_intake: MonthlyIntakeEntry[]
}

export interface PortfolioAlert {
  application_id: string
  ref: string
  business_name: string
  code: string
  label: string
  severity: string
  detail: string
  created_at: string
}

/* ── Meta ────────────────────────────────────────────────────────────── */

export interface HealthResponse {
  status: string
  version: string
  time: string
}

export interface MetaEnums {
  products: Product[]
  statuses: ApplicationStatus[]
  sectors: string[]
  consent_sources: ConsentSource[]
  decisions: Decision[]
  grades: Grade[]
}
