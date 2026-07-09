import { Link } from 'react-router-dom'
import { Bar, BarChart, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { ApplicationsTable } from '../components/ApplicationsTable'
import { axisProps, TooltipFrame, TooltipRow } from '../components/charts/common'
import type { TooltipCtx } from '../components/charts/common'
import { Icon } from '../components/ui/Icon'
import { SeverityChip } from '../components/ui/badges'
import { Button, Card, EmptyState, ErrorState, PageHeader, Skeleton, SkeletonRows } from '../components/ui/primitives'
import { api } from '../lib/api'
import { useAuth } from '../lib/auth'
import { fmtMonth, inr, pct, timeAgo } from '../lib/format'
import { useApi } from '../lib/hooks'
import { GRADE_COLORS, GRADE_ORDER, SERIES, STATUS_META, STATUS_ORDER } from '../lib/theme'
import type { PortfolioSummary } from '../lib/types'

/* ── KPI tile ────────────────────────────────────────────────────────── */

function StatTile({ label, value, sub, delay }: { label: string; value: string; sub?: string; delay: number }) {
  return (
    <div className={`bg-card border border-line rounded-md px-4 py-3.5 rise rise-${delay}`}>
      <p className="overline-label">{label}</p>
      <p className="num text-[24px] font-semibold text-ink leading-tight mt-1.5">{value}</p>
      {sub && <p className="text-[11.5px] text-ink-3 mt-0.5">{sub}</p>}
    </div>
  )
}

/* ── HTML bar list (funnel / sector mix) ─────────────────────────────── */

function BarList({
  rows,
}: {
  rows: { label: string; value: number; color: string; sub?: string }[]
}) {
  const max = Math.max(1, ...rows.map((r) => r.value))
  return (
    <div className="space-y-2.5 px-4 pb-4 pt-3">
      {rows.map((r) => (
        <div key={r.label}>
          <div className="flex items-baseline justify-between text-[12px] mb-1">
            <span className="text-ink-2 font-medium">{r.label}</span>
            <span className="num font-semibold text-ink">
              {r.value}
              {r.sub && <span className="text-ink-3 font-normal ml-1.5">{r.sub}</span>}
            </span>
          </div>
          <div className="h-2 bg-well rounded-sm overflow-hidden">
            <div
              className="h-full rounded-sm transition-[width] duration-500"
              style={{ width: `${(r.value / max) * 100}%`, backgroundColor: r.color }}
            />
          </div>
        </div>
      ))}
    </div>
  )
}

/* ── Charts ──────────────────────────────────────────────────────────── */

function GradeChart({ summary }: { summary: PortfolioSummary }) {
  const byGrade = new Map(summary.grade_distribution.map((g) => [g.grade, g.count]))
  const data = GRADE_ORDER.map((grade) => ({ grade, count: byGrade.get(grade) ?? 0 }))
  return (
    <div className="px-2 pb-2 pt-1">
      <ResponsiveContainer width="100%" height={168}>
        <BarChart data={data} margin={{ top: 12, right: 8, left: -22, bottom: 0 }}>
          <XAxis dataKey="grade" {...axisProps} />
          <YAxis {...axisProps} allowDecimals={false} />
          <Tooltip
            cursor={{ fill: 'rgba(0,0,0,0.03)' }}
            content={(ctx: TooltipCtx) => {
              if (!ctx.active || !ctx.payload?.length) return null
              return (
                <TooltipFrame title={`Grade ${String(ctx.label)}`}>
                  <TooltipRow label="Applications" value={String(ctx.payload[0]?.value ?? 0)} />
                </TooltipFrame>
              )
            }}
          />
          <Bar dataKey="count" radius={[3, 3, 0, 0]} maxBarSize={34}>
            {data.map((d) => (
              <Cell key={d.grade} fill={GRADE_COLORS[d.grade]} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

function IntakeChart({ summary }: { summary: PortfolioSummary }) {
  const data = summary.monthly_intake.map((m) => ({ ...m, label: fmtMonth(m.month) }))
  return (
    <div className="px-2 pb-2 pt-1">
      <ResponsiveContainer width="100%" height={168}>
        <BarChart data={data} margin={{ top: 12, right: 8, left: -22, bottom: 0 }}>
          <XAxis dataKey="label" {...axisProps} />
          <YAxis {...axisProps} allowDecimals={false} />
          <Tooltip
            cursor={{ fill: 'rgba(0,0,0,0.03)' }}
            content={(ctx: TooltipCtx) => {
              if (!ctx.active || !ctx.payload?.length) return null
              return (
                <TooltipFrame title={String(ctx.label)}>
                  <TooltipRow color={SERIES.green} label="Applications" value={String(ctx.payload[0]?.value ?? 0)} />
                </TooltipFrame>
              )
            }}
          />
          <Bar dataKey="count" fill={SERIES.green} radius={[3, 3, 0, 0]} maxBarSize={30} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

/* ── Alerts rail ─────────────────────────────────────────────────────── */

function AlertsFeed() {
  const alerts = useApi(() => api.portfolioAlerts(), [])

  if (alerts.error) {
    /* 403 for credit_officer → hide gracefully; other errors show inline */
    if (alerts.error.status === 403) return null
    return (
      <Card title="Early warning alerts" className="rise rise-4">
        <ErrorState compact error={alerts.error} onRetry={alerts.reload} />
      </Card>
    )
  }

  return (
    <Card title="Early warning alerts" className="rise rise-4">
      {alerts.loading ? (
        <SkeletonRows rows={5} />
      ) : !alerts.data || alerts.data.items.length === 0 ? (
        <EmptyState compact title="No active alerts" body="Portfolio early-warning signals will surface here." />
      ) : (
        <ul className="divide-y divide-line px-1 pb-1 mt-2">
          {alerts.data.items.map((alert, i) => (
            <li key={`${alert.application_id}-${alert.code}-${i}`}>
              <Link
                to={`/applications/${alert.application_id}`}
                className="block px-3 py-3 hover:bg-well transition-colors rounded"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[12.5px] font-semibold text-ink">{alert.label}</span>
                  <SeverityChip severity={alert.severity} />
                </div>
                <p className="text-[11.5px] text-ink-2 mt-1 line-clamp-2">{alert.detail}</p>
                <p className="num text-[10.5px] text-ink-3 mt-1.5">
                  {alert.ref} · {alert.business_name} · {timeAgo(alert.created_at)}
                </p>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </Card>
  )
}

/* ── Page ────────────────────────────────────────────────────────────── */

export function DashboardPage() {
  const { user } = useAuth()
  const summary = useApi(() => api.portfolioSummary(), [])
  const recent = useApi(() => api.listApplications({ page: 1, page_size: 8 }), [])
  const canSeeAlerts = user?.role === 'risk_head' || user?.role === 'admin'

  return (
    <>
      <PageHeader
        title="Portfolio"
        subtitle={`MSME lending pipeline · signed in as ${user?.full_name ?? '—'}`}
        actions={
          <Link to="/applications/new">
            <Button variant="primary">
              <Icon name="plus" size={14} /> New application
            </Button>
          </Link>
        }
      />

      {summary.error ? (
        <Card>
          <ErrorState error={summary.error} onRetry={summary.reload} />
        </Card>
      ) : (
        <>
          {/* KPI tiles */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-3">
            {summary.loading || !summary.data ? (
              Array.from({ length: 8 }, (_, i) => (
                <div key={i} className="bg-card border border-line rounded-md px-4 py-3.5">
                  <Skeleton className="h-3 w-20 mb-3" />
                  <Skeleton className="h-6 w-16" />
                </div>
              ))
            ) : (
              <>
                <StatTile delay={1} label="Applications" value={String(summary.data.kpis.total_applications)} sub="Total in pipeline" />
                <StatTile delay={1} label="Pending review" value={String(summary.data.kpis.pending_review)} sub="Awaiting officer action" />
                <StatTile delay={2} label="Approved" value={String(summary.data.kpis.approved_count)} sub={`Approval rate ${pct(summary.data.kpis.approval_rate, 0)}`} />
                <StatTile delay={2} label="Avg health score" value={String(Math.round(summary.data.kpis.avg_health_score))} sub="Across assessed" />
                <StatTile delay={3} label="Requested" value={inr(summary.data.kpis.total_requested)} sub="Total facility demand" />
                <StatTile delay={3} label="Approved amount" value={inr(summary.data.kpis.total_approved_amount)} sub="Sanctioned so far" />
                <StatTile delay={4} label="Avg turnaround" value={`${summary.data.kpis.avg_tat_minutes} min`} sub="Application → decision" />
                <StatTile delay={4} label="Approval rate" value={pct(summary.data.kpis.approval_rate, 0)} sub="Of decided applications" />
              </>
            )}
          </div>

          {/* Charts + alerts */}
          <div className={`grid gap-3 mb-3 ${canSeeAlerts ? 'lg:grid-cols-[2fr_1fr]' : ''}`}>
            <div className="grid sm:grid-cols-2 gap-3">
              <Card title="Pipeline by status" className="rise rise-2">
                {summary.loading || !summary.data ? (
                  <SkeletonRows rows={4} />
                ) : (
                  <BarList
                    rows={STATUS_ORDER.filter((s) =>
                      summary.data!.status_funnel.some((f) => f.status === s && f.count > 0),
                    ).map((s) => ({
                      label: STATUS_META[s].label,
                      value: summary.data!.status_funnel.find((f) => f.status === s)?.count ?? 0,
                      color: STATUS_META[s].bar,
                    }))}
                  />
                )}
              </Card>

              <Card title="Grade distribution" className="rise rise-2">
                {summary.loading || !summary.data ? <SkeletonRows rows={4} /> : <GradeChart summary={summary.data} />}
              </Card>

              <Card title="Sector mix" className="rise rise-3">
                {summary.loading || !summary.data ? (
                  <SkeletonRows rows={4} />
                ) : (
                  <BarList
                    rows={[...summary.data.sector_mix]
                      .sort((a, b) => b.amount - a.amount)
                      .map((s) => ({
                        label: s.sector,
                        value: s.count,
                        color: SERIES.green,
                        sub: inr(s.amount),
                      }))}
                  />
                )}
              </Card>

              <Card title="Monthly intake" className="rise rise-3">
                {summary.loading || !summary.data ? <SkeletonRows rows={4} /> : <IntakeChart summary={summary.data} />}
              </Card>
            </div>

            {canSeeAlerts && <AlertsFeed />}
          </div>
        </>
      )}

      {/* Recent applications */}
      <Card
        title="Recent applications"
        aside={
          <Link to="/applications" className="text-[12px] font-semibold text-pine-700 hover:text-pine-800">
            View all →
          </Link>
        }
        className="rise rise-5"
      >
        {recent.loading ? (
          <SkeletonRows rows={6} />
        ) : recent.error ? (
          <ErrorState compact error={recent.error} onRetry={recent.reload} />
        ) : !recent.data || recent.data.items.length === 0 ? (
          <EmptyState
            compact
            title="No applications yet"
            body="Create the first application to begin underwriting."
            action={
              <Link to="/applications/new">
                <Button variant="primary" size="sm">
                  <Icon name="plus" size={13} /> New application
                </Button>
              </Link>
            }
          />
        ) : (
          <div className="mt-2">
            <ApplicationsTable items={recent.data.items} />
          </div>
        )}
      </Card>
    </>
  )
}
