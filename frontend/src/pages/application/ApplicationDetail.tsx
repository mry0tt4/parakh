import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { Icon } from '../../components/ui/Icon'
import {
  Button,
  ButtonLink,
  Card,
  Dialog,
  ErrorState,
  Skeleton,
  TextArea,
} from '../../components/ui/primitives'
import {
  DecisionChip,
  GradeChip,
  NtcNtbBadges,
  StatusBadge,
} from '../../components/ui/badges'
import { api, ApiError } from '../../lib/api'
import { fmtDate, fmtDateTime, inr, inrFull, pct, unSnake } from '../../lib/format'
import { useApi } from '../../lib/hooks'
import type { ApplicationDetail, AssessmentDetail, Decision } from '../../lib/types'
import { AssessmentTab } from './AssessmentTab'
import { CashflowTab } from './CashflowTab'
import { ConsentTab } from './ConsentTab'
import { MemoTab } from './MemoTab'
import { StressTab } from './StressTab'
import { VerificationTab } from './VerificationTab'

type TabKey = 'assessment' | 'verification' | 'cashflow' | 'stress' | 'memo' | 'consent'

const DECIDED = ['approved', 'conditional', 'rejected', 'referred'] as const

export function ApplicationDetailPage() {
  const { id = '' } = useParams()
  const app = useApi(() => api.getApplication(id), [id])

  const hasAssessment = app.data?.has_assessment ?? false
  const assessment = useApi<AssessmentDetail | null>(
    () => (hasAssessment ? api.getAssessment(id) : Promise.resolve(null)),
    [id, hasAssessment],
  )

  const dataReady =
    app.data !== null &&
    ['data_ready', 'assessed', ...DECIDED].includes(app.data.status)

  const [tab, setTab] = useState<TabKey>('consent')

  /* land on the most useful tab once data is known */
  useEffect(() => {
    if (!app.data) return
    setTab(app.data.has_assessment ? 'assessment' : 'consent')
  }, [app.data?.id, app.data?.has_assessment]) // eslint-disable-line react-hooks/exhaustive-deps

  if (app.error) {
    return (
      <Card>
        <ErrorState error={app.error} onRetry={app.reload} />
      </Card>
    )
  }

  if (app.loading || !app.data) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-5 w-40" />
        <Skeleton className="h-28 w-full" />
        <Skeleton className="h-10 w-2/3" />
        <Skeleton className="h-80 w-full" />
      </div>
    )
  }

  const a = app.data

  const TABS: { key: TabKey; label: string; enabled: boolean; hint?: string }[] = [
    { key: 'assessment', label: 'Assessment', enabled: hasAssessment, hint: 'Run assessment first' },
    { key: 'verification', label: 'Verification', enabled: hasAssessment, hint: 'Run assessment first' },
    { key: 'cashflow', label: 'Cash Flow', enabled: dataReady, hint: 'Awaiting data pull' },
    { key: 'stress', label: 'Stress Outlook', enabled: hasAssessment, hint: 'Run assessment first' },
    { key: 'memo', label: 'Credit Memo', enabled: hasAssessment, hint: 'Run assessment first' },
    { key: 'consent', label: 'Consent & Data', enabled: true },
  ]

  return (
    <>
      <div className="flex items-center justify-between gap-3 mb-3">
        <Link
          to="/applications"
          className="inline-flex items-center gap-1.5 text-[12.5px] font-medium text-ink-3 hover:text-ink"
        >
          <Icon name="arrow-left" size={13} /> Applications
        </Link>
        {hasAssessment && (
          <ButtonLink to={`/applications/${a.id}/card`} size="sm" title="Borrower-facing MSME Health Card">
            <Icon name="card" size={13} /> Health Card
          </ButtonLink>
        )}
      </div>

      <HeaderBlock app={a} />
      <ActionBar app={a} onChanged={(next) => app.setData(next)} reload={app.reload} />

      {/* Tab bar */}
      <div className="flex items-end gap-0.5 border-b border-line-2 mt-5 mb-4 overflow-x-auto">
        {TABS.map((t) => (
          <button
            key={t.key}
            disabled={!t.enabled}
            title={t.enabled ? undefined : t.hint}
            onClick={() => setTab(t.key)}
            className={`px-3.5 pb-2.5 pt-1.5 text-[13px] font-semibold whitespace-nowrap border-b-2 -mb-px transition-colors ${
              tab === t.key
                ? 'text-pine-800 border-pine-700'
                : t.enabled
                  ? 'text-ink-2 border-transparent hover:text-ink cursor-pointer'
                  : 'text-ink-4 border-transparent cursor-not-allowed'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'assessment' && (
        <AssessmentTab assessment={assessment.data} loading={assessment.loading} error={assessment.error} onRetry={assessment.reload} />
      )}
      {tab === 'verification' && (
        <VerificationTab assessment={assessment.data} loading={assessment.loading} error={assessment.error} onRetry={assessment.reload} />
      )}
      {tab === 'cashflow' && <CashflowTab appId={a.id} />}
      {tab === 'stress' && (
        <StressTab assessment={assessment.data} loading={assessment.loading} error={assessment.error} onRetry={assessment.reload} />
      )}
      {tab === 'memo' && <MemoTab appId={a.id} />}
      {tab === 'consent' && <ConsentTab app={a} />}
    </>
  )
}

/* ── Header: identity + facility + score ─────────────────────────────── */

function HeaderBlock({ app }: { app: ApplicationDetail }) {
  return (
    <Card className="rise rise-1">
      <div className="grid lg:grid-cols-[1.5fr_1fr_auto] gap-x-6 divide-y lg:divide-y-0 lg:divide-x divide-line">
        {/* identity */}
        <div className="px-5 py-4">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="num text-[11.5px] text-ink-3">{app.ref}</span>
            <StatusBadge status={app.status} />
            <NtcNtbBadges isNtc={app.applicant.is_ntc} isNtb={app.applicant.is_ntb} />
          </div>
          <h1 className="font-display text-[24px] font-semibold text-ink leading-tight mt-1.5">
            {app.applicant.business_name}
          </h1>
          <dl className="grid grid-cols-2 sm:grid-cols-3 gap-x-5 gap-y-2 mt-3 text-[12px]">
            <IdField label="GSTIN" value={app.applicant.gstin_masked} mono />
            <IdField label="PAN" value={app.applicant.pan_masked} mono />
            <IdField label="Sector" value={app.applicant.sector} />
            <IdField label="Entity" value={unSnake(app.applicant.entity_type)} />
            <IdField label="Location" value={`${app.applicant.city}, ${app.applicant.state}`} />
            <IdField label="Est." value={fmtDate(app.applicant.incorporation_date)} mono />
          </dl>
        </div>

        {/* facility */}
        <div className="px-5 py-4">
          <p className="overline-label">Facility requested</p>
          <p className="num text-[26px] font-semibold text-ink leading-tight mt-1.5" title={inrFull(app.amount_requested)}>
            {inr(app.amount_requested)}
          </p>
          <p className="text-[12.5px] text-ink-2 mt-0.5">
            {unSnake(app.product)} · {app.tenure_months} months
          </p>
          {app.purpose && (
            <p className="text-[12px] text-ink-3 mt-2.5 leading-relaxed line-clamp-3" title={app.purpose}>
              “{app.purpose}”
            </p>
          )}
        </div>

        {/* score summary */}
        <div className="px-5 py-4 lg:w-52">
          <p className="overline-label">Health score</p>
          {app.health_score !== null && app.grade !== null ? (
            <>
              <div className="flex items-center gap-2.5 mt-1.5">
                <span className="num text-[26px] font-semibold text-ink leading-tight">{app.health_score}</span>
                <GradeChip grade={app.grade} />
              </div>
              <dl className="mt-2.5 space-y-1 text-[12px]">
                <div className="flex justify-between gap-3">
                  <dt className="text-ink-3">Verification</dt>
                  <dd className="num font-semibold text-ink">{app.verification_index ?? '—'}/100</dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt className="text-ink-3">PD 12m</dt>
                  <dd className="num font-semibold text-ink">{pct(app.pd_12m)}</dd>
                </div>
              </dl>
            </>
          ) : (
            <p className="text-[12.5px] text-ink-3 mt-2 leading-relaxed">
              Not yet assessed.
              <br />
              Complete consents, then run the assessment.
            </p>
          )}
        </div>
      </div>
    </Card>
  )
}

function IdField({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  return (
    <div>
      <dt className="text-[10px] uppercase tracking-[0.12em] text-ink-3 font-semibold">{label}</dt>
      <dd className={`text-ink font-medium mt-0.5 ${mono ? 'num text-[11.5px]' : ''}`}>{value}</dd>
    </div>
  )
}

/* ── Status-driven action bar ────────────────────────────────────────── */

function ActionBar({
  app,
  onChanged,
  reload,
}: {
  app: ApplicationDetail
  onChanged: (next: ApplicationDetail) => void
  reload: () => void
}) {
  const [busyKey, setBusyKey] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [decision, setDecision] = useState<Decision | null>(null)

  const run = async (key: string, fn: () => Promise<unknown>) => {
    setBusyKey(key)
    setError(null)
    try {
      await fn()
      reload()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Action failed.')
    } finally {
      setBusyKey(null)
    }
  }

  const pendingConsents = app.consents.filter((c) => c.status === 'PENDING')
  const isDecided = (DECIDED as readonly string[]).includes(app.status)

  return (
    <div className="mt-3">
      {/* draft → request consents */}
      {app.status === 'draft' && (
        <ActionShell
          text="Next step — request borrower consent for Account Aggregator, GST and EPFO data."
        >
          <Button
            variant="primary"
            loading={busyKey === 'consents'}
            onClick={() => run('consents', () => api.requestConsents(app.id, ['AA', 'GST', 'EPFO']))}
          >
            <Icon name="bolt" size={14} /> Request consents
          </Button>
        </ActionShell>
      )}

      {/* consent_pending → approve each */}
      {app.status === 'consent_pending' && (
        <ActionShell
          text={
            pendingConsents.length > 0
              ? `Awaiting borrower approval on ${pendingConsents.length} consent${pendingConsents.length > 1 ? 's' : ''} (demo: approve on their behalf).`
              : 'Consents granted — data pull in progress.'
          }
        >
          {pendingConsents.map((c) => (
            <Button
              key={c.id}
              loading={busyKey === c.id}
              onClick={() => run(c.id, () => api.approveConsent(app.id, c.id))}
            >
              <Icon name="check" size={13} /> Approve {c.source}
            </Button>
          ))}
        </ActionShell>
      )}

      {/* data_ready → assess */}
      {app.status === 'data_ready' && (
        <ActionShell text="All data pulled and hashed. Run the assessment engine — score, verification, stress and memo.">
          <Button
            variant="primary"
            loading={busyKey === 'assess'}
            onClick={() => run('assess', () => api.runAssessment(app.id))}
          >
            <Icon name="gauge" size={14} /> Run assessment
          </Button>
        </ActionShell>
      )}

      {/* assessed → decision buttons + re-run */}
      {app.status === 'assessed' && (
        <ActionShell text="Assessment complete. Record the credit decision.">
          <Button variant="primary" onClick={() => setDecision('approved')}>
            <Icon name="check" size={13} /> Approve
          </Button>
          <Button onClick={() => setDecision('conditional')}>Conditional</Button>
          <Button variant="warn" onClick={() => setDecision('referred')}>
            Refer
          </Button>
          <Button variant="danger" onClick={() => setDecision('rejected')}>
            Reject
          </Button>
          <span className="w-px h-5 bg-line-2 mx-1" />
          <Button
            variant="ghost"
            size="sm"
            loading={busyKey === 'assess'}
            onClick={() => run('assess', () => api.runAssessment(app.id))}
            title="Re-run assessment (creates version+1)"
          >
            <Icon name="refresh" size={13} /> Re-run
          </Button>
        </ActionShell>
      )}

      {/* decided → banner */}
      {isDecided && app.decision && (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2 bg-card border border-line rounded-md px-4 py-3">
          <DecisionChip decision={app.decision} />
          <p className="text-[12.5px] text-ink-2">
            {app.decision_note ? `“${app.decision_note}”` : 'No decision note recorded.'}
            <span className="text-ink-3">
              {' '}
              — {app.decided_by ?? 'unknown'}, {fmtDateTime(app.decided_at)}
            </span>
          </p>
        </div>
      )}

      {error && (
        <div className="flex items-start gap-2 text-[12.5px] text-crit bg-crit-bg border border-crit/25 rounded px-3 py-2.5 mt-2">
          <Icon name="alert" size={14} className="mt-0.5 shrink-0" />
          {error}
        </div>
      )}

      <DecisionDialog
        app={app}
        decision={decision}
        onClose={() => setDecision(null)}
        onDone={(next) => {
          setDecision(null)
          onChanged(next)
        }}
      />
    </div>
  )
}

function ActionShell({ text, children }: { text: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 bg-pine-50 border border-pine-100 rounded-md px-4 py-3">
      <p className="text-[12.5px] text-pine-900 font-medium">{text}</p>
      <div className="flex flex-wrap items-center gap-2">{children}</div>
    </div>
  )
}

/* ── Decision dialog ─────────────────────────────────────────────────── */

const DECISION_LABEL: Record<Decision, string> = {
  approved: 'Approve application',
  conditional: 'Approve with conditions',
  rejected: 'Reject application',
  referred: 'Refer to risk head',
}

function DecisionDialog({
  app,
  decision,
  onClose,
  onDone,
}: {
  app: ApplicationDetail
  decision: Decision | null
  onClose: () => void
  onDone: (next: ApplicationDetail) => void
}) {
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setNote('')
    setError(null)
  }, [decision])

  const submit = async () => {
    if (!decision) return
    setBusy(true)
    setError(null)
    try {
      const next = await api.decide(app.id, decision, note.trim())
      onDone(next)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Decision failed.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog
      open={decision !== null}
      onClose={onClose}
      title={decision ? DECISION_LABEL[decision] : ''}
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button
            variant={decision === 'rejected' ? 'danger' : 'primary'}
            loading={busy}
            onClick={submit}
          >
            Confirm {decision ?? ''}
          </Button>
        </>
      }
    >
      <p className="text-[12.5px] text-ink-2 mb-3">
        {app.ref} · {app.applicant.business_name} ·{' '}
        <span className="num font-semibold">{inr(app.amount_requested)}</span>
      </p>
      <label className="block text-[11.5px] font-semibold text-ink-2 mb-1">Decision note</label>
      <TextArea
        rows={3}
        value={note}
        onChange={(e) => setNote(e.target.value)}
        placeholder="e.g. Approved at reduced limit per assessment recommendation."
        autoFocus
      />
      {error && (
        <div className="flex items-start gap-2 text-[12.5px] text-crit bg-crit-bg border border-crit/25 rounded px-3 py-2.5 mt-3">
          <Icon name="alert" size={14} className="mt-0.5 shrink-0" />
          {error}
        </div>
      )}
    </Dialog>
  )
}
