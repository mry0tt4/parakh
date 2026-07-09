import { useMemo, useState } from 'react'
import {
  Bar,
  CartesianGrid,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Scatter,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { axisProps, LegendRow, TooltipFrame, TooltipRow } from '../../components/charts/common'
import type { TooltipCtx } from '../../components/charts/common'
import { ChannelChip, DirectionTag } from '../../components/ui/badges'
import {
  Card,
  EmptyState,
  ErrorState,
  Pagination,
  Select,
  SkeletonRows,
  Td,
  Th,
} from '../../components/ui/primitives'
import { api } from '../../lib/api'
import { fmtDate, fmtMonth, inr, inrFull } from '../../lib/format'
import { useApi } from '../../lib/hooks'
import { CHART, SEM, SERIES } from '../../lib/theme'
import type { CashflowMonth } from '../../lib/types'

const TXN_PAGE_SIZE = 50

interface ChartRow extends CashflowMonth {
  label: string
  bounceMarker: number | null
}

export function CashflowTab({ appId }: { appId: string }) {
  const cashflow = useApi(() => api.getCashflow(appId), [appId])

  const rows: ChartRow[] = useMemo(
    () =>
      (cashflow.data?.months ?? []).map((m) => ({
        ...m,
        label: fmtMonth(m.month),
        bounceMarker: m.bounce_count > 0 ? m.outflow : null,
      })),
    [cashflow.data],
  )

  const stats = useMemo(() => {
    if (rows.length === 0) return null
    const n = rows.length
    const sum = (f: (m: CashflowMonth) => number) => rows.reduce((acc, m) => acc + f(m), 0)
    return {
      avgInflow: sum((m) => m.inflow) / n,
      avgNet: sum((m) => m.net) / n,
      avgBalance: sum((m) => m.avg_balance) / n,
      totalEmi: sum((m) => m.emi_outflow),
      bounces: sum((m) => m.bounce_count),
      months: n,
    }
  }, [rows])

  return (
    <div className="space-y-3">
      <Card
        title={`Monthly cash flow — bank verified${stats ? ` · ${stats.months} months` : ''}`}
        aside={
          <LegendRow
            items={[
              { color: SERIES.green, label: 'Inflow' },
              { color: SERIES.clay, label: 'Outflow' },
              { color: CHART.ink, label: 'Net', line: true },
              { color: SERIES.blue, label: 'GST turnover', line: true, dashed: true },
              { color: SERIES.ochre, label: 'EMI', line: true },
              { color: SEM.bad, label: 'Bounce month' },
            ]}
          />
        }
        className="rise rise-1"
      >
        {cashflow.loading ? (
          <SkeletonRows rows={8} />
        ) : cashflow.error ? (
          <ErrorState error={cashflow.error} onRetry={cashflow.reload} />
        ) : rows.length === 0 ? (
          <EmptyState title="No cash flow data" body="Bank data has not been pulled for this application yet." />
        ) : (
          <div className="px-2 pb-3 pt-2">
            <ResponsiveContainer width="100%" height={320}>
              <ComposedChart data={rows} margin={{ top: 10, right: 12, left: 6, bottom: 0 }} barGap={1}>
                <CartesianGrid stroke={CHART.grid} vertical={false} />
                <XAxis dataKey="label" {...axisProps} interval="preserveStartEnd" minTickGap={24} />
                <YAxis {...axisProps} tickFormatter={(v: number) => inr(v)} width={62} />
                <Tooltip
                  cursor={{ fill: 'rgba(0,0,0,0.03)' }}
                  content={(ctx: TooltipCtx) => {
                    if (!ctx.active || !ctx.payload?.length) return null
                    const row = ctx.payload[0]?.payload as ChartRow | undefined
                    if (!row) return null
                    return (
                      <TooltipFrame title={row.label}>
                        <TooltipRow color={SERIES.green} label="Inflow" value={inrFull(row.inflow)} />
                        <TooltipRow color={SERIES.clay} label="Outflow" value={inrFull(row.outflow)} />
                        <TooltipRow color={CHART.ink} label="Net" value={inrFull(row.net)} />
                        <TooltipRow color={SERIES.blue} label="GST turnover" value={inrFull(row.gst_turnover)} />
                        <TooltipRow color={SERIES.ochre} label="EMI outflow" value={inrFull(row.emi_outflow)} />
                        <TooltipRow label="Avg balance" value={inrFull(row.avg_balance)} />
                        {row.bounce_count > 0 && (
                          <TooltipRow color={SEM.bad} label="Bounces" value={String(row.bounce_count)} />
                        )}
                      </TooltipFrame>
                    )
                  }}
                />
                <Bar dataKey="inflow" fill={SERIES.green} radius={[3, 3, 0, 0]} maxBarSize={14} />
                <Bar dataKey="outflow" fill={SERIES.clay} radius={[3, 3, 0, 0]} maxBarSize={14} />
                <Line dataKey="net" stroke={CHART.ink} strokeWidth={2} dot={false} type="monotone" />
                <Line
                  dataKey="gst_turnover"
                  stroke={SERIES.blue}
                  strokeWidth={2}
                  strokeDasharray="5 4"
                  dot={false}
                  type="monotone"
                />
                <Line dataKey="emi_outflow" stroke={SERIES.ochre} strokeWidth={1.5} dot={false} type="monotone" />
                <Scatter
                  dataKey="bounceMarker"
                  fill={SEM.bad}
                  shape={(props: unknown) => {
                    const { cx, cy } = props as { cx?: number; cy?: number }
                    if (cx === undefined || cy === undefined) return <g />
                    return (
                      <path
                        d={`M ${cx} ${cy - 11} l 5 8 h -10 z`}
                        fill={SEM.bad}
                        stroke="#ffffff"
                        strokeWidth={1.2}
                      />
                    )
                  }}
                />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        )}
      </Card>

      {/* summary stats */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3 rise rise-2">
          <MiniStat label="Avg monthly inflow" value={inr(stats.avgInflow)} />
          <MiniStat label="Avg monthly net" value={inr(stats.avgNet)} tone={stats.avgNet >= 0 ? 'good' : 'bad'} />
          <MiniStat label="Avg balance" value={inr(stats.avgBalance)} />
          <MiniStat label="EMI outflow (total)" value={inr(stats.totalEmi)} />
          <MiniStat
            label="Bounces"
            value={String(stats.bounces)}
            tone={stats.bounces > 0 ? 'bad' : 'good'}
          />
        </div>
      )}

      <TransactionsCard appId={appId} months={cashflow.data?.months.map((m) => m.month) ?? []} />
    </div>
  )
}

function MiniStat({ label, value, tone }: { label: string; value: string; tone?: 'good' | 'bad' }) {
  return (
    <div className="bg-card border border-line rounded-md px-3.5 py-3">
      <p className="overline-label">{label}</p>
      <p
        className="num text-[18px] font-semibold leading-tight mt-1"
        style={{ color: tone === 'good' ? SEM.good : tone === 'bad' ? SEM.bad : undefined }}
      >
        {value}
      </p>
    </div>
  )
}

/* ── Transactions ────────────────────────────────────────────────────── */

function TransactionsCard({ appId, months }: { appId: string; months: string[] }) {
  const sortedMonths = useMemo(() => [...months].sort().reverse(), [months])
  const [month, setMonth] = useState('')
  const [page, setPage] = useState(1)
  const effectiveMonth = month || sortedMonths[0] || ''

  const txns = useApi(
    () =>
      effectiveMonth
        ? api.getTransactions(appId, { month: effectiveMonth, page, page_size: TXN_PAGE_SIZE })
        : api.getTransactions(appId, { page, page_size: TXN_PAGE_SIZE }),
    [appId, effectiveMonth, page],
  )

  return (
    <Card
      title="Bank transactions"
      aside={
        sortedMonths.length > 0 ? (
          <Select
            value={effectiveMonth}
            onChange={(e) => {
              setMonth(e.target.value)
              setPage(1)
            }}
            className="!w-36 !h-7.5 num text-[12px]"
            aria-label="Select month"
          >
            {sortedMonths.map((m) => (
              <option key={m} value={m}>
                {fmtMonth(m)}
              </option>
            ))}
          </Select>
        ) : undefined
      }
      className="rise rise-3"
    >
      {txns.loading ? (
        <SkeletonRows rows={8} />
      ) : txns.error ? (
        <ErrorState compact error={txns.error} onRetry={txns.reload} />
      ) : !txns.data || txns.data.items.length === 0 ? (
        <EmptyState compact title="No transactions" body="No transactions found for the selected month." />
      ) : (
        <>
          <div className="overflow-x-auto mt-2">
            <table className="w-full border-collapse text-[12.5px]">
              <thead>
                <tr>
                  <Th>Date</Th>
                  <Th>Narration</Th>
                  <Th>Counterparty</Th>
                  <Th>Channel</Th>
                  <Th />
                  <Th className="text-right">Amount</Th>
                  <Th className="text-right">Balance</Th>
                </tr>
              </thead>
              <tbody>
                {txns.data.items.map((t, i) => (
                  <tr key={`${t.date}-${i}`} className="hover:bg-well transition-colors">
                    <Td className="num text-[11.5px] text-ink-2 whitespace-nowrap">{fmtDate(t.date)}</Td>
                    <Td className="num text-[11px] text-ink-2 max-w-90">
                      <span className="line-clamp-1 break-all" title={t.narration}>
                        {t.narration}
                      </span>
                    </Td>
                    <Td className="text-ink whitespace-nowrap">{t.counterparty}</Td>
                    <Td>
                      <ChannelChip channel={t.channel} />
                    </Td>
                    <Td>
                      <DirectionTag direction={t.direction} />
                    </Td>
                    <Td
                      className={`num text-right font-semibold whitespace-nowrap ${
                        t.direction === 'CR' ? 'text-good' : 'text-ink'
                      }`}
                    >
                      {t.direction === 'CR' ? '+' : '−'}
                      {inrFull(t.amount).replace('₹', '₹')}
                    </Td>
                    <Td className="num text-right text-ink-2 whitespace-nowrap">{inrFull(t.balance_after)}</Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pagination page={page} pageSize={TXN_PAGE_SIZE} total={txns.data.total} onPage={setPage} />
        </>
      )}
    </Card>
  )
}
