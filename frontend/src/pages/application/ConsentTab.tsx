import { ConsentChip } from '../../components/ui/badges'
import { Card, EmptyState, ErrorState, SkeletonRows } from '../../components/ui/primitives'
import { api } from '../../lib/api'
import { fmtDate, fmtDateTime, shortHash, unSnake } from '../../lib/format'
import { useApi } from '../../lib/hooks'
import type { ApplicationDetail, Consent, ConsentSource } from '../../lib/types'

const SOURCE_META: Record<ConsentSource, { title: string; desc: string }> = {
  AA: { title: 'Account Aggregator', desc: 'Bank statements via AA framework (RBI)' },
  GST: { title: 'GST Network', desc: 'GSTR-1 / GSTR-3B filings & turnover' },
  EPFO: { title: 'EPFO', desc: 'Provident fund payroll & headcount' },
}

export function ConsentTab({ app }: { app: ApplicationDetail }) {
  return (
    <div className="space-y-3">
      {/* consent trail */}
      {app.consents.length === 0 ? (
        <Card className="rise rise-1">
          <EmptyState
            title="No consents requested yet"
            body="Use “Request consents” in the action bar to start the AA / GST / EPFO data trail."
          />
        </Card>
      ) : (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-3 rise rise-1">
          {app.consents.map((c) => (
            <ConsentCard key={c.id} consent={c} />
          ))}
        </div>
      )}

      <TimelineCard appId={app.id} />
    </div>
  )
}

function ConsentCard({ consent }: { consent: Consent }) {
  const meta = SOURCE_META[consent.source]
  return (
    <Card>
      <div className="px-4 py-3.5">
        <div className="flex items-start justify-between gap-2">
          <div>
            <div className="flex items-center gap-2">
              <span className="num inline-flex items-center justify-center h-6 min-w-11 px-1.5 rounded bg-pine-950 text-[11px] font-bold text-white tracking-wider">
                {consent.source}
              </span>
              <span className="text-[13px] font-semibold text-ink">{meta.title}</span>
            </div>
            <p className="text-[11px] text-ink-3 mt-1">{meta.desc}</p>
          </div>
          <ConsentChip status={consent.status} />
        </div>

        <dl className="mt-3.5 space-y-1.5 text-[12px] border-t border-line pt-3">
          <KV k="Artefact" v={consent.artefact_id} mono />
          <KV k="Purpose code" v={consent.purpose_code} mono />
          <KV k="Data range" v={`${fmtDate(consent.data_from)} → ${fmtDate(consent.data_to)}`} mono />
          <KV k="Requested" v={fmtDateTime(consent.requested_at)} mono />
          <KV k="Granted" v={consent.granted_at ? fmtDateTime(consent.granted_at) : '—'} mono />
          <KV k="Expires" v={consent.expires_at ? fmtDateTime(consent.expires_at) : '—'} mono />
        </dl>

        <div className="mt-3 rounded-md border border-line bg-well px-3 py-2.5">
          <p className="overline-label">Data pull</p>
          {consent.data_pull ? (
            <dl className="mt-1.5 space-y-1 text-[12px]">
              <KV k="Records" v={consent.data_pull.record_count.toLocaleString('en-IN')} mono />
              <KV k="Fetched" v={fmtDateTime(consent.data_pull.fetched_at)} mono />
              <KV k="SHA-256" v={shortHash(consent.data_pull.sha256)} mono title={consent.data_pull.sha256} />
            </dl>
          ) : (
            <p className="text-[11.5px] text-ink-3 mt-1">Awaiting borrower approval — no data pulled.</p>
          )}
        </div>
      </div>
    </Card>
  )
}

function KV({ k, v, mono = false, title }: { k: string; v: string; mono?: boolean; title?: string }) {
  return (
    <div className="flex justify-between gap-3">
      <dt className="text-ink-3 shrink-0">{k}</dt>
      <dd className={`text-ink text-right ${mono ? 'num text-[11px]' : ''}`} title={title}>
        {v}
      </dd>
    </div>
  )
}

/* ── Application timeline ────────────────────────────────────────────── */

function TimelineCard({ appId }: { appId: string }) {
  const timeline = useApi(() => api.getTimeline(appId), [appId])

  return (
    <Card title="Application timeline" className="rise rise-3">
      {timeline.loading ? (
        <SkeletonRows rows={6} />
      ) : timeline.error ? (
        <ErrorState compact error={timeline.error} onRetry={timeline.reload} />
      ) : !timeline.data || timeline.data.items.length === 0 ? (
        <EmptyState compact title="No activity yet" body="Actions on this application will appear here." />
      ) : (
        <ol className="px-5 pb-5 pt-3 relative">
          {timeline.data.items.map((ev, i) => (
            <li key={ev.id} className="relative pl-6 pb-4 last:pb-0">
              {/* rail */}
              {i < timeline.data!.items.length - 1 && (
                <span className="absolute left-[5px] top-4 bottom-0 w-px bg-line-2" aria-hidden="true" />
              )}
              <span
                className="absolute left-0 top-1.5 size-2.5 rounded-full border-2 border-pine-600 bg-card"
                aria-hidden="true"
              />
              <div className="flex flex-wrap items-baseline gap-x-2.5 gap-y-0.5">
                <span className="num inline-flex items-center h-5 px-1.5 rounded-sm bg-well border border-line text-[10.5px] font-semibold text-ink">
                  {ev.action}
                </span>
                <span className="text-[12px] text-ink-2">
                  {ev.actor_email}
                  <span className="text-ink-3"> · {unSnake(ev.actor_role)}</span>
                </span>
                <span className="num text-[11px] text-ink-3">{fmtDateTime(ev.ts)}</span>
              </div>
              {ev.detail && Object.keys(ev.detail).length > 0 && (
                <p className="num text-[11px] text-ink-3 mt-1 break-all">
                  {Object.entries(ev.detail)
                    .map(([k, v]) => `${k}: ${typeof v === 'object' ? JSON.stringify(v) : String(v)}`)
                    .join(' · ')}
                </p>
              )}
            </li>
          ))}
        </ol>
      )}
    </Card>
  )
}
