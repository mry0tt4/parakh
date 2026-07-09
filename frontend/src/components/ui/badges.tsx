import type { ReactNode } from 'react'
import {
  ACTION_META,
  CHECK_TONE,
  CONSENT_TONE,
  DECISION_META,
  GRADE_COLORS,
  STATUS_META,
  TONES,
  severityTone,
} from '../../lib/theme'
import type { ToneName } from '../../lib/theme'
import type {
  ApplicationStatus,
  CheckStatus,
  ConsentStatus,
  Decision,
  Grade,
  RecommendationAction,
  TxnChannel,
  TxnDirection,
} from '../../lib/types'

/* ── Base chip ───────────────────────────────────────────────────────── */

export function Chip({
  tone = 'neutral',
  children,
  className = '',
  dot = false,
}: {
  tone?: ToneName
  children: ReactNode
  className?: string
  dot?: boolean
}) {
  const t = TONES[tone]
  return (
    <span
      className={`inline-flex items-center gap-1.5 h-5.5 px-2 rounded-full border text-[11px] font-semibold whitespace-nowrap ${className}`}
      style={{ color: t.fg, backgroundColor: t.bg, borderColor: t.border }}
    >
      {dot && <span className="size-1.5 rounded-full" style={{ backgroundColor: t.fg }} />}
      {children}
    </span>
  )
}

export function Dot({ color, className = '' }: { color: string; className?: string }) {
  return (
    <span
      className={`inline-block size-2 rounded-full shrink-0 ${className}`}
      style={{ backgroundColor: color }}
      aria-hidden="true"
    />
  )
}

/* ── Domain badges ───────────────────────────────────────────────────── */

export function StatusBadge({ status }: { status: ApplicationStatus }) {
  const meta = STATUS_META[status]
  return (
    <Chip tone={meta.tone} dot>
      {meta.label}
    </Chip>
  )
}

/** Grade chip — solid grade color, used app-wide for score identity. */
export function GradeChip({ grade, size = 'md' }: { grade: Grade; size?: 'sm' | 'md' | 'lg' }) {
  const cls =
    size === 'lg'
      ? 'h-7 min-w-9 px-2 text-[14px] rounded'
      : size === 'sm'
        ? 'h-4.5 min-w-6 px-1 text-[10px] rounded-sm'
        : 'h-5.5 min-w-7 px-1.5 text-[11.5px] rounded'
  return (
    <span
      className={`num inline-flex items-center justify-center font-semibold text-white ${cls}`}
      style={{ backgroundColor: GRADE_COLORS[grade] }}
    >
      {grade}
    </span>
  )
}

/** Health score + grade combined pill for tables. */
export function ScoreChip({ score, grade }: { score: number | null; grade: Grade | null }) {
  if (score === null || grade === null) {
    return <span className="text-[12px] text-ink-4">—</span>
  }
  return (
    <span className="inline-flex items-center gap-1.5">
      <GradeChip grade={grade} size="sm" />
      <span className="num text-[13px] font-semibold text-ink">{score}</span>
    </span>
  )
}

export function CheckChip({ status }: { status: CheckStatus }) {
  return (
    <Chip tone={CHECK_TONE[status]} dot>
      {status}
    </Chip>
  )
}

export function SeverityChip({ severity }: { severity: string }) {
  return <Chip tone={severityTone(severity)}>{severity.toUpperCase()}</Chip>
}

export function ConsentChip({ status }: { status: ConsentStatus }) {
  return (
    <Chip tone={CONSENT_TONE[status]} dot>
      {status}
    </Chip>
  )
}

export function ActionChip({ action }: { action: RecommendationAction }) {
  const meta = ACTION_META[action]
  return (
    <Chip tone={meta.tone} dot className="h-6.5 px-2.5 text-[12px]">
      {meta.label}
    </Chip>
  )
}

export function DecisionChip({ decision }: { decision: Decision }) {
  const meta = DECISION_META[decision]
  return (
    <Chip tone={meta.tone} dot>
      {meta.label}
    </Chip>
  )
}

export function ChannelChip({ channel }: { channel: TxnChannel }) {
  return (
    <span className="num inline-flex items-center h-5 px-1.5 rounded-sm border border-line-2 bg-well text-[10px] font-medium text-ink-2">
      {channel}
    </span>
  )
}

export function DirectionTag({ direction }: { direction: TxnDirection }) {
  const isCr = direction === 'CR'
  return (
    <span
      className={`num inline-flex items-center justify-center h-5 w-7 rounded-sm text-[10px] font-semibold ${
        isCr ? 'text-good bg-good-bg' : 'text-ink-2 bg-well border border-line'
      }`}
    >
      {direction}
    </span>
  )
}

/** New-to-credit / new-to-bank flags. */
export function NtcNtbBadges({ isNtc, isNtb }: { isNtc: boolean; isNtb: boolean }) {
  if (!isNtc && !isNtb) return null
  return (
    <span className="inline-flex gap-1">
      {isNtc && (
        <span
          className="inline-flex items-center h-5 px-1.5 rounded-sm bg-pine-100 text-pine-800 text-[10px] font-bold tracking-wide"
          title="New to Credit"
        >
          NTC
        </span>
      )}
      {isNtb && (
        <span
          className="inline-flex items-center h-5 px-1.5 rounded-sm bg-info-bg text-info text-[10px] font-bold tracking-wide"
          title="New to Bank"
        >
          NTB
        </span>
      )}
    </span>
  )
}

export function RoleChip({ role }: { role: string }) {
  const label = role.replace('_', ' ')
  return (
    <span className="inline-flex items-center h-4.5 px-1.5 rounded-sm bg-white/10 text-white/80 text-[9.5px] font-bold uppercase tracking-[0.1em]">
      {label}
    </span>
  )
}
