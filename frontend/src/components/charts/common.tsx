import type { ReactNode } from 'react'
import { CHART } from '../../lib/theme'

/* Shared recharts config fragments */

export const AXIS_TICK = { fill: CHART.tickInk, fontSize: 10.5 } as const

export const axisProps = {
  stroke: CHART.axis,
  tickLine: false,
  axisLine: { stroke: CHART.axis },
  tick: AXIS_TICK,
} as const

/* ── Tooltip frame (recharts custom content) ─────────────────────────── */

export interface TooltipEntry {
  color?: string
  name?: string | number
  value?: unknown
  dataKey?: unknown
  payload?: unknown
}

export interface TooltipCtx {
  active?: boolean
  label?: string | number
  payload?: readonly TooltipEntry[]
}

export function TooltipFrame({ title, children }: { title: ReactNode; children: ReactNode }) {
  return (
    <div className="bg-card border border-line-2 rounded-md shadow-lg px-3 py-2.5 text-[12px] min-w-40">
      <p className="font-semibold text-ink mb-1.5">{title}</p>
      <div className="space-y-1">{children}</div>
    </div>
  )
}

export function TooltipRow({
  color,
  label,
  value,
}: {
  color?: string
  label: string
  value: string
}) {
  return (
    <div className="flex items-center justify-between gap-4">
      <span className="flex items-center gap-1.5 text-ink-2">
        {color && <span className="size-2 rounded-full shrink-0" style={{ backgroundColor: color }} />}
        {label}
      </span>
      <span className="num font-semibold text-ink">{value}</span>
    </div>
  )
}

/** Legend swatch row rendered above charts (identity never color-alone). */
export function LegendRow({
  items,
  className = '',
}: {
  items: { color: string; label: string; line?: boolean; dashed?: boolean }[]
  className?: string
}) {
  return (
    <div className={`flex flex-wrap items-center gap-x-4 gap-y-1 ${className}`}>
      {items.map((it) => (
        <span key={it.label} className="inline-flex items-center gap-1.5 text-[11.5px] text-ink-2">
          {it.line ? (
            <svg width="16" height="6" aria-hidden="true">
              <line
                x1="0"
                y1="3"
                x2="16"
                y2="3"
                stroke={it.color}
                strokeWidth="2"
                strokeDasharray={it.dashed ? '3 3' : undefined}
              />
            </svg>
          ) : (
            <span className="size-2.5 rounded-[3px] shrink-0" style={{ backgroundColor: it.color }} />
          )}
          {it.label}
        </span>
      ))}
    </div>
  )
}
