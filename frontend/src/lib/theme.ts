/* ── Parakh design tokens: semantic colors, chart palette ────────────────
   Chart series palette validated with the dataviz six-checks script
   (light surface #ffffff — all PASS: lightness band, chroma floor,
   CVD separation worst ΔE 54.6, contrast ≥ 3:1).                         */

import type {
  ApplicationStatus,
  CheckStatus,
  ConsentStatus,
  Decision,
  Grade,
  MetricStatus,
  RecommendationAction,
} from './types'

/* Fixed-order categorical series (never cycled) */
export const SERIES = {
  green: '#107a52',
  blue: '#3565c0',
  ochre: '#8f6b00',
  plum: '#7c4da0',
  clay: '#b4552d',
  teal: '#0c86a0',
} as const

/* Chart chrome */
export const CHART = {
  grid: '#e7e4da',
  axis: '#c9c5b8',
  tickInk: '#8a8578',
  ink: '#1c1b17',
  inkSoft: '#57534a',
} as const

/* Semantic status (reserved — never used as series colors) */
export const SEM = {
  good: '#0e7a46',
  goodBg: '#e9f4ee',
  goodBorder: '#bfdccc',
  warn: '#9a5b00',
  warnBg: '#faf1e0',
  warnBorder: '#e6d3ac',
  bad: '#b42318',
  badBg: '#fbeceb',
  badBorder: '#efc4c0',
  neutral: '#57534a',
  neutralBg: '#f1efe9',
  neutralBorder: '#dcd8cc',
  info: '#2f5aa8',
  infoBg: '#eaf0fa',
  infoBorder: '#c3d2ec',
} as const

export interface ChipTone {
  fg: string
  bg: string
  border: string
}

const tone = (fg: string, bg: string, border: string): ChipTone => ({ fg, bg, border })

export const TONES = {
  good: tone(SEM.good, SEM.goodBg, SEM.goodBorder),
  warn: tone(SEM.warn, SEM.warnBg, SEM.warnBorder),
  bad: tone(SEM.bad, SEM.badBg, SEM.badBorder),
  neutral: tone(SEM.neutral, SEM.neutralBg, SEM.neutralBorder),
  info: tone(SEM.info, SEM.infoBg, SEM.infoBorder),
} as const

export type ToneName = keyof typeof TONES

/* ── Application status ──────────────────────────────────────────────── */

export const STATUS_META: Record<ApplicationStatus, { label: string; tone: ToneName; bar: string }> = {
  draft: { label: 'Draft', tone: 'neutral', bar: '#a8a394' },
  consent_pending: { label: 'Consent Pending', tone: 'warn', bar: '#c99a2e' },
  data_ready: { label: 'Data Ready', tone: 'info', bar: '#3565c0' },
  assessed: { label: 'Assessed', tone: 'info', bar: '#0c86a0' },
  approved: { label: 'Approved', tone: 'good', bar: '#107a52' },
  conditional: { label: 'Conditional', tone: 'good', bar: '#4d8a2f' },
  rejected: { label: 'Rejected', tone: 'bad', bar: '#b42318' },
  referred: { label: 'Referred', tone: 'warn', bar: '#8f6b00' },
}

export const STATUS_ORDER: ApplicationStatus[] = [
  'draft',
  'consent_pending',
  'data_ready',
  'assessed',
  'approved',
  'conditional',
  'rejected',
  'referred',
]

/* ── Grades (ordinal green → red band scale) ─────────────────────────── */

export const GRADE_COLORS: Record<Grade, string> = {
  'A+': '#0b5d3b',
  A: '#107a52',
  'B+': '#5c7a1e',
  B: '#8f6b00',
  C: '#b4552d',
  D: '#b42318',
}

export const GRADE_ORDER: Grade[] = ['A+', 'A', 'B+', 'B', 'C', 'D']

export function gradeForScore(score: number): Grade {
  if (score >= 800) return 'A+'
  if (score >= 750) return 'A'
  if (score >= 700) return 'B+'
  if (score >= 650) return 'B'
  if (score >= 550) return 'C'
  return 'D'
}

/* ── Assessment semantics ────────────────────────────────────────────── */

export const METRIC_STATUS_COLOR: Record<MetricStatus, string> = {
  good: SEM.good,
  warn: SEM.warn,
  bad: SEM.bad,
}

export const CHECK_TONE: Record<CheckStatus, ToneName> = {
  PASS: 'good',
  WARN: 'warn',
  FAIL: 'bad',
}

export function severityTone(severity: string): ToneName {
  const s = severity.toLowerCase()
  if (s === 'critical' || s === 'high') return 'bad'
  if (s === 'medium') return 'warn'
  return 'neutral'
}

export const ACTION_META: Record<RecommendationAction, { label: string; tone: ToneName }> = {
  APPROVE: { label: 'Approve', tone: 'good' },
  APPROVE_CONDITIONAL: { label: 'Approve · Conditional', tone: 'good' },
  REFER: { label: 'Refer', tone: 'warn' },
  DECLINE: { label: 'Decline', tone: 'bad' },
}

export const DECISION_META: Record<Decision, { label: string; tone: ToneName }> = {
  approved: { label: 'Approved', tone: 'good' },
  conditional: { label: 'Conditional Approval', tone: 'good' },
  rejected: { label: 'Rejected', tone: 'bad' },
  referred: { label: 'Referred', tone: 'warn' },
}

export const CONSENT_TONE: Record<ConsentStatus, ToneName> = {
  PENDING: 'warn',
  ACTIVE: 'good',
  REVOKED: 'bad',
  EXPIRED: 'neutral',
}

export function riskBandTone(band: string): ToneName {
  const b = band.toLowerCase()
  if (b.includes('low')) return 'good'
  if (b.includes('moderate') || b.includes('medium')) return 'warn'
  if (b.includes('high') || b.includes('severe')) return 'bad'
  return 'neutral'
}
