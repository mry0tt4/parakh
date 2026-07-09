import { useState } from 'react'
import { ScoreArc } from '../../components/ScoreArc'
import { Icon } from '../../components/ui/Icon'
import { ActionChip, Chip, Dot } from '../../components/ui/badges'
import { Card, EmptyState, ErrorState, SkeletonRows } from '../../components/ui/primitives'
import type { ApiError } from '../../lib/api'
import { fmtDateTime, inr, metricValue, pct } from '../../lib/format'
import { METRIC_STATUS_COLOR, riskBandTone, SERIES } from '../../lib/theme'
import type { AssessmentDetail, Pillar } from '../../lib/types'

export interface AssessmentTabProps {
  assessment: AssessmentDetail | null
  loading: boolean
  error: ApiError | null
  onRetry: () => void
}

export function AssessmentTab({ assessment, loading, error, onRetry }: AssessmentTabProps) {
  if (loading) return <SkeletonRows rows={10} className="bg-card border border-line rounded-md" />
  if (error) {
    return (
      <Card>
        <ErrorState error={error} onRetry={onRetry} />
      </Card>
    )
  }
  if (!assessment) {
    return (
      <Card>
        <EmptyState title="No assessment yet" body="Run the assessment from the action bar above once data is ready." />
      </Card>
    )
  }

  const a = assessment
  return (
    <div className="space-y-3">
      {/* ── Score hero ── */}
      <Card className="rise rise-1">
        <div className="grid md:grid-cols-[auto_1fr] gap-x-8 items-center px-6 py-5">
          <ScoreArc score={a.health_score} grade={a.grade} />
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <p className="overline-label">Business health · 300–900</p>
              <Chip tone={riskBandTone(a.risk_band)}>{a.risk_band} risk</Chip>
            </div>
            <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 mt-3">
              <HeroStat
                label="Verification index"
                value={`${a.verification_index}`}
                suffix="/100"
                bar={a.verification_index / 100}
              />
              <HeroStat label="PD · 12 months" value={pct(a.pd_12m)} />
              <HeroStat label="Assessed" value={fmtDateTime(a.created_at)} small />
            </div>
            <p className="num text-[11px] text-ink-3 mt-3">
              engine v{a.engine_version} · assessment #{a.version}
            </p>
          </div>
        </div>
      </Card>

      {/* ── Recommendation ── */}
      <Card title="Engine recommendation" className="rise rise-2">
        <div className="px-4 pb-4 pt-2.5">
          <div className="flex flex-wrap items-center gap-3">
            <ActionChip action={a.recommendation.action} />
            {a.recommendation.suggested_limit !== null && (
              <span className="text-[13px] text-ink-2">
                Suggested limit{' '}
                <span className="num text-[15px] font-semibold text-ink">
                  {inr(a.recommendation.suggested_limit)}
                </span>
              </span>
            )}
          </div>
          <p className="text-[13px] text-ink-2 leading-relaxed mt-2.5 max-w-3xl">
            {a.recommendation.rationale}
          </p>
          {a.recommendation.conditions.length > 0 && (
            <ul className="mt-3 space-y-1.5">
              {a.recommendation.conditions.map((c) => (
                <li key={c} className="flex items-start gap-2 text-[12.5px] text-ink">
                  <Icon name="check" size={13} className="text-pine-700 mt-0.5 shrink-0" />
                  {c}
                </li>
              ))}
            </ul>
          )}
        </div>
      </Card>

      {/* ── Pillars ── */}
      <Card title="Score pillars — click to drill down" className="rise rise-3">
        <div className="px-2 pb-2 pt-1">
          {a.pillars.map((p) => (
            <PillarRow key={p.key} pillar={p} />
          ))}
        </div>
      </Card>
    </div>
  )
}

function HeroStat({
  label,
  value,
  suffix,
  bar,
  small = false,
}: {
  label: string
  value: string
  suffix?: string
  bar?: number
  small?: boolean
}) {
  return (
    <div className="border border-line rounded-md bg-well px-3.5 py-3">
      <p className="overline-label">{label}</p>
      <p className={`num font-semibold text-ink mt-1 ${small ? 'text-[13px] leading-snug' : 'text-[22px] leading-tight'}`}>
        {value}
        {suffix && <span className="text-[13px] text-ink-3 font-normal">{suffix}</span>}
      </p>
      {bar !== undefined && (
        <div className="h-1.5 bg-line rounded-sm overflow-hidden mt-2">
          <div
            className="h-full rounded-sm"
            style={{ width: `${Math.min(100, bar * 100)}%`, backgroundColor: SERIES.green }}
          />
        </div>
      )}
    </div>
  )
}

function pillarBarColor(score: number): string {
  if (score >= 70) return '#107a52'
  if (score >= 50) return '#8f6b00'
  return '#b4552d'
}

function PillarRow({ pillar }: { pillar: Pillar }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="border-b border-line last:border-b-0">
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full grid grid-cols-[16px_180px_1fr_auto] items-center gap-3 px-2 py-3 cursor-pointer hover:bg-well rounded transition-colors text-left"
        aria-expanded={open}
      >
        <Icon
          name="chevron-right"
          size={13}
          className={`text-ink-3 transition-transform ${open ? 'rotate-90' : ''}`}
        />
        <span>
          <span className="block text-[13px] font-semibold text-ink">{pillar.label}</span>
          <span className="num block text-[10.5px] text-ink-3">weight {pct(pillar.weight, 0)}</span>
        </span>
        <span className="h-2.5 bg-well border border-line rounded-sm overflow-hidden">
          <span
            className="block h-full rounded-sm transition-[width] duration-500"
            style={{ width: `${pillar.score}%`, backgroundColor: pillarBarColor(pillar.score) }}
          />
        </span>
        <span className="num text-[15px] font-semibold text-ink w-12 text-right">
          {pillar.score}
          <span className="text-[11px] text-ink-3 font-normal">/100</span>
        </span>
      </button>

      {open && (
        <div className="ml-8 mr-2 mb-3 border border-line rounded-md overflow-hidden">
          {pillar.metrics.length === 0 ? (
            <p className="text-[12px] text-ink-3 px-4 py-3">No metric detail supplied for this pillar.</p>
          ) : (
            pillar.metrics.map((m) => (
              <div
                key={m.key}
                className="grid sm:grid-cols-[220px_130px_1fr] gap-x-4 gap-y-1 px-4 py-2.5 border-b border-line last:border-b-0 bg-well/50"
              >
                <span className="flex items-center gap-2 text-[12.5px] font-medium text-ink">
                  <Dot color={METRIC_STATUS_COLOR[m.status]} />
                  {m.label}
                </span>
                <span className="num text-[12.5px] font-semibold text-ink">
                  {metricValue(m.value, m.unit)}
                  {m.benchmark !== null && (
                    <span className="text-ink-3 font-normal"> / {metricValue(m.benchmark, m.unit)}</span>
                  )}
                </span>
                <span className="text-[12px] text-ink-2 leading-relaxed">{m.explanation}</span>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  )
}
