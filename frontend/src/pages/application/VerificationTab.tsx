import { Icon } from '../../components/ui/Icon'
import { CheckChip, SeverityChip } from '../../components/ui/badges'
import { Card, EmptyState, ErrorState, SkeletonRows } from '../../components/ui/primitives'
import { unSnake } from '../../lib/format'
import { SERIES } from '../../lib/theme'
import type { AssessmentDetail } from '../../lib/types'
import type { AssessmentTabProps } from './AssessmentTab'

export function VerificationTab({ assessment, loading, error, onRetry }: AssessmentTabProps) {
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
        <EmptyState title="No verification data" body="Verification checks are produced by the assessment run." />
      </Card>
    )
  }

  const t = assessment.triangulation

  return (
    <div className="space-y-3">
      {/* fraud flags — most prominent, first */}
      {t.fraud_flags.length > 0 && (
        <div className="space-y-2 rise rise-1">
          {t.fraud_flags.map((flag) => (
            <div
              key={flag.code}
              className="flex items-start gap-3 bg-crit-bg border border-crit/40 border-l-4 border-l-crit rounded-md px-4 py-3.5"
            >
              <Icon name="alert" size={18} className="text-crit mt-0.5 shrink-0" />
              <div className="flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="num text-[12px] font-bold tracking-wide text-crit">FRAUD FLAG · {flag.code}</span>
                  <SeverityChip severity={flag.severity} />
                </div>
                <p className="text-[13px] text-ink mt-1 leading-relaxed">{flag.description}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* triangulation index hero */}
      <Card className="rise rise-2">
        <div className="flex flex-wrap items-center gap-x-8 gap-y-3 px-5 py-4">
          <div>
            <p className="overline-label">Triangulation index</p>
            <p className="num text-[38px] font-semibold text-ink leading-tight">
              {t.index}
              <span className="text-[15px] text-ink-3 font-normal">/100</span>
            </p>
          </div>
          <div className="flex-1 min-w-55">
            <div className="h-3 bg-well border border-line rounded-sm overflow-hidden">
              <div
                className="h-full rounded-sm"
                style={{ width: `${t.index}%`, backgroundColor: SERIES.green }}
              />
            </div>
            <p className="text-[12px] text-ink-3 mt-2 max-w-xl leading-relaxed">
              Agreement across GST filings, bank statements and EPFO payroll — {passCount(assessment)} of{' '}
              {t.checks.length} independent checks passing.
            </p>
          </div>
        </div>
      </Card>

      {/* six checks */}
      <div className="grid md:grid-cols-2 gap-3">
        {t.checks.map((check, i) => (
          <Card key={check.key} className={`rise rise-${Math.min(5, i + 2)}`}>
            <div className="px-4 py-3.5">
              <div className="flex items-center justify-between gap-2">
                <h3 className="text-[13.5px] font-semibold text-ink">{check.label}</h3>
                <div className="flex items-center gap-1.5 shrink-0">
                  <CheckChip status={check.status} />
                </div>
              </div>
              <p className="text-[10.5px] uppercase tracking-[0.12em] text-ink-3 font-semibold mt-0.5">
                severity {check.severity}
              </p>
              {Object.keys(check.metrics).length > 0 && (
                <dl className="flex flex-wrap gap-x-5 gap-y-1.5 mt-3 border-t border-line pt-2.5">
                  {Object.entries(check.metrics).map(([k, v]) => (
                    <div key={k}>
                      <dt className="text-[10px] uppercase tracking-[0.1em] text-ink-3 font-semibold">
                        {unSnake(k)}
                      </dt>
                      <dd className="num text-[13.5px] font-semibold text-ink mt-0.5">
                        {typeof v === 'number' ? formatCheckMetric(v) : v}
                      </dd>
                    </div>
                  ))}
                </dl>
              )}
              <p className="text-[12px] text-ink-2 leading-relaxed mt-2.5">{check.explanation}</p>
            </div>
          </Card>
        ))}
      </div>
    </div>
  )
}

function passCount(a: AssessmentDetail): number {
  return a.triangulation.checks.filter((c) => c.status === 'PASS').length
}

function formatCheckMetric(v: number): string {
  if (Number.isInteger(v)) return v.toLocaleString('en-IN')
  return v.toFixed(2)
}
