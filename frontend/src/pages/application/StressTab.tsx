import { useMemo } from 'react'
import {
  Area,
  Bar,
  CartesianGrid,
  ComposedChart,
  Line,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { axisProps, LegendRow, TooltipFrame, TooltipRow } from '../../components/charts/common'
import type { TooltipCtx } from '../../components/charts/common'
import { Chip, SeverityChip } from '../../components/ui/badges'
import { Card, EmptyState, ErrorState, SkeletonRows } from '../../components/ui/primitives'
import { fmtMonth, pct, unSnake } from '../../lib/format'
import { CHART, SEM, SERIES, severityTone } from '../../lib/theme'
import type { StressPoint } from '../../lib/types'
import type { AssessmentTabProps } from './AssessmentTab'

interface StressRow extends StressPoint {
  label: string
  band: [number, number]
}

export function StressTab({ assessment, loading, error, onRetry }: AssessmentTabProps) {
  const curve: StressRow[] = useMemo(
    () =>
      (assessment?.stress.curve ?? []).map((p) => ({
        ...p,
        label: fmtMonth(p.month),
        band: [p.dscr_p10, p.dscr_p50],
      })),
    [assessment],
  )

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
        <EmptyState title="No stress outlook" body="The 12-month stress simulation is produced by the assessment run." />
      </Card>
    )
  }

  const s = assessment.stress
  const breachLabel = s.first_breach_month ? fmtMonth(s.first_breach_month) : null

  return (
    <div className="space-y-3">
      {/* headline */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3 rise rise-1">
        <div className="bg-card border border-line rounded-md px-4 py-3.5">
          <p className="overline-label">Probability of default · 12m</p>
          <p className="num text-[26px] font-semibold text-ink leading-tight mt-1">{pct(s.pd_12m)}</p>
        </div>
        <div className="bg-card border border-line rounded-md px-4 py-3.5">
          <p className="overline-label">First projected breach</p>
          <p
            className="num text-[26px] font-semibold leading-tight mt-1"
            style={{ color: breachLabel ? SEM.bad : SEM.good }}
          >
            {breachLabel ?? 'None'}
          </p>
          <p className="text-[11px] text-ink-3 mt-0.5">DSCR falling below 1.0× at P10</p>
        </div>
        <div className="bg-card border border-line rounded-md px-4 py-3.5">
          <p className="overline-label">Horizon</p>
          <p className="num text-[26px] font-semibold text-ink leading-tight mt-1">{curve.length} months</p>
          <p className="text-[11px] text-ink-3 mt-0.5">Monte-Carlo forward simulation</p>
        </div>
      </div>

      <div className="grid lg:grid-cols-2 gap-3">
        {/* stress probability */}
        <Card
          title="Stress probability"
          aside={
            <LegendRow
              items={[
                { color: SERIES.ochre, label: 'Monthly' },
                { color: SERIES.clay, label: 'Cumulative', line: true },
              ]}
            />
          }
          className="rise rise-2"
        >
          <div className="px-2 pb-3 pt-2">
            <ResponsiveContainer width="100%" height={250}>
              <ComposedChart data={curve} margin={{ top: 8, right: 12, left: -10, bottom: 0 }}>
                <CartesianGrid stroke={CHART.grid} vertical={false} />
                <XAxis dataKey="label" {...axisProps} interval="preserveStartEnd" minTickGap={20} />
                <YAxis {...axisProps} tickFormatter={(v: number) => `${(v * 100).toFixed(0)}%`} width={44} />
                <Tooltip
                  cursor={{ fill: 'rgba(0,0,0,0.03)' }}
                  content={(ctx: TooltipCtx) => {
                    if (!ctx.active || !ctx.payload?.length) return null
                    const row = ctx.payload[0]?.payload as StressRow | undefined
                    if (!row) return null
                    return (
                      <TooltipFrame title={row.label}>
                        <TooltipRow color={SERIES.ochre} label="Monthly stress" value={pct(row.stress_prob)} />
                        <TooltipRow color={SERIES.clay} label="Cumulative" value={pct(row.cumulative_prob)} />
                      </TooltipFrame>
                    )
                  }}
                />
                <Bar dataKey="stress_prob" fill={SERIES.ochre} radius={[3, 3, 0, 0]} maxBarSize={16} />
                <Area
                  dataKey="cumulative_prob"
                  stroke={SERIES.clay}
                  strokeWidth={2}
                  fill={SERIES.clay}
                  fillOpacity={0.12}
                  type="monotone"
                />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </Card>

        {/* DSCR band */}
        <Card
          title="DSCR outlook (P50 / P10)"
          aside={
            <LegendRow
              items={[
                { color: SERIES.green, label: 'P50', line: true },
                { color: SERIES.teal, label: 'P10', line: true, dashed: true },
                { color: SEM.bad, label: 'Breach 1.0×', line: true, dashed: true },
              ]}
            />
          }
          className="rise rise-2"
        >
          <div className="px-2 pb-3 pt-2">
            <ResponsiveContainer width="100%" height={250}>
              <ComposedChart data={curve} margin={{ top: 8, right: 12, left: -18, bottom: 0 }}>
                <CartesianGrid stroke={CHART.grid} vertical={false} />
                <XAxis dataKey="label" {...axisProps} interval="preserveStartEnd" minTickGap={20} />
                <YAxis
                  {...axisProps}
                  tickFormatter={(v: number) => `${v.toFixed(1)}×`}
                  domain={[0, 'auto']}
                  width={48}
                />
                <Tooltip
                  cursor={{ stroke: CHART.axis, strokeDasharray: '3 3' }}
                  content={(ctx: TooltipCtx) => {
                    if (!ctx.active || !ctx.payload?.length) return null
                    const row = ctx.payload[0]?.payload as StressRow | undefined
                    if (!row) return null
                    return (
                      <TooltipFrame title={row.label}>
                        <TooltipRow color={SERIES.green} label="DSCR P50" value={`${row.dscr_p50.toFixed(2)}×`} />
                        <TooltipRow color={SERIES.teal} label="DSCR P10" value={`${row.dscr_p10.toFixed(2)}×`} />
                      </TooltipFrame>
                    )
                  }}
                />
                <Area
                  dataKey="band"
                  stroke="none"
                  fill={SERIES.green}
                  fillOpacity={0.12}
                  type="monotone"
                  activeDot={false}
                />
                <Line dataKey="dscr_p50" stroke={SERIES.green} strokeWidth={2} dot={false} type="monotone" />
                <Line
                  dataKey="dscr_p10"
                  stroke={SERIES.teal}
                  strokeWidth={1.8}
                  strokeDasharray="5 4"
                  dot={false}
                  type="monotone"
                />
                <ReferenceLine y={1} stroke={SEM.bad} strokeDasharray="4 4" strokeWidth={1.4} />
                {s.first_breach_month && (
                  <ReferenceLine
                    x={fmtMonth(s.first_breach_month)}
                    stroke={SEM.bad}
                    strokeWidth={1.2}
                    label={{ value: 'breach', fill: SEM.bad, fontSize: 10, position: 'insideTopRight' }}
                  />
                )}
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>

      {/* drivers */}
      <Card title="Stress drivers" className="rise rise-3">
        {s.drivers.length === 0 ? (
          <EmptyState compact title="No material drivers" body="The simulation found no dominant stress factor." />
        ) : (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-3 px-4 pb-4 pt-3">
            {s.drivers.map((d) => (
              <div key={d.factor} className="border border-line rounded-md bg-well px-3.5 py-3">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[12.5px] font-semibold text-ink">{unSnake(d.factor)}</span>
                  <Chip tone={severityTone(d.impact)}>{d.impact.toUpperCase()}</Chip>
                </div>
                <p className="text-[12px] text-ink-2 leading-relaxed mt-1.5">{d.description}</p>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* EWS signals */}
      <Card title="Early warning signals" className="rise rise-4">
        {s.ews_signals.length === 0 ? (
          <EmptyState compact title="No active signals" body="No early-warning behaviour detected in the data window." />
        ) : (
          <ul className="divide-y divide-line px-4 pb-2 pt-1">
            {s.ews_signals.map((sig) => (
              <li key={sig.code} className="py-3 flex items-start gap-3">
                <SeverityChip severity={sig.severity} />
                <div className="min-w-0">
                  <p className="text-[13px] font-semibold text-ink">
                    {sig.label} <span className="num text-[10.5px] text-ink-3 font-normal">· {sig.code}</span>
                  </p>
                  <p className="text-[12px] text-ink-2 leading-relaxed mt-0.5">{sig.evidence}</p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  )
}
