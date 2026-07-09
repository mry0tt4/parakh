import { useEffect } from 'react'
import { Navigate, useParams } from 'react-router-dom'
import { ScoreArc } from '../../components/ScoreArc'
import { BrandMark, Logo } from '../../components/Shell'
import { Icon } from '../../components/ui/Icon'
import { Chip, Dot } from '../../components/ui/badges'
import { Button, ButtonLink, Card, EmptyState, ErrorState, Skeleton } from '../../components/ui/primitives'
import { api } from '../../lib/api'
import { useAuth } from '../../lib/auth'
import { fmtDate, inr, inrFull, unSnake } from '../../lib/format'
import { useApi } from '../../lib/hooks'
import { METRIC_STATUS_COLOR, SEM } from '../../lib/theme'
import type { ToneName } from '../../lib/theme'
import type { HealthCard, HealthCardBadge, HealthCardPillar, HealthCardPoint, RoadmapItem } from '../../lib/types'

/**
 * Borrower-facing MSME Health Card — a single centered, printable document
 * (deliberately outside the console shell: no sidebar, no tabs, no jargon).
 */
export function HealthCardPage() {
  const { id = '' } = useParams()
  const { isAuthenticated } = useAuth()
  const card = useApi(() => api.getHealthCard(id), [id])

  /* name the browser tab (and the saved PDF) after the card */
  useEffect(() => {
    if (!card.data) return
    const prev = document.title
    document.title = `Health Card · ${card.data.business_name}`
    return () => {
      document.title = prev
    }
  }, [card.data])

  if (!isAuthenticated) return <Navigate to="/login" replace />

  return (
    <div className="min-h-screen bg-paper print-doc">
      <div className="max-w-[780px] mx-auto px-4 sm:px-6 py-6">
        {/* top chrome — never printed */}
        <div className="no-print flex items-center justify-between gap-3 mb-5">
          <ButtonLink to={`/applications/${id}`} variant="ghost" size="sm">
            <Icon name="arrow-left" size={13} /> Back to application
          </ButtonLink>
          {card.data && (
            <Button size="sm" onClick={() => window.print()}>
              <Icon name="printer" size={13} /> Print / Save PDF
            </Button>
          )}
        </div>

        {card.loading && <CardSkeleton />}

        {card.error && card.error.status === 404 && (
          <Card className="rise">
            <EmptyState
              title="Assessment pending"
              body="This business has not been assessed yet. The Health Card is generated automatically after the first assessment run."
              action={
                <ButtonLink to={`/applications/${id}`} size="sm">
                  View application
                </ButtonLink>
              }
            />
          </Card>
        )}
        {card.error && card.error.status !== 404 && (
          <Card className="rise">
            <ErrorState error={card.error} onRetry={card.reload} />
          </Card>
        )}

        {card.data && <CardDocument card={card.data} />}
      </div>
    </div>
  )
}

/* ── The document ────────────────────────────────────────────────────── */

function CardDocument({ card }: { card: HealthCard }) {
  const failed = card.badge === 'VERIFICATION_FAILED'
  const potential = Math.min(900, card.score + card.roadmap.reduce((sum, r) => sum + r.impact_points, 0))

  return (
    <article className="print-card bg-card border border-line-2 rounded-lg overflow-hidden shadow-[0_1px_3px_rgba(28,27,23,0.08),0_16px_40px_-16px_rgba(28,27,23,0.22)]">
      {/* masthead */}
      <header className="brand-panel-texture flex items-center justify-between gap-4 px-8 py-5">
        <div>
          <Logo height={26} theme="dark" />
          <p className="text-[8.5px] uppercase tracking-[0.24em] text-white/45 mt-1.5">
            Consent-verified credit intelligence
          </p>
        </div>
        <span className="num text-[11px] text-white/60">{card.card_id}</span>
      </header>

      {/* title */}
      <div className="text-center px-8 pt-8 pb-7 border-b border-line rise rise-1">
        <p className="text-[11.5px] font-bold uppercase tracking-[0.26em] text-pine-700">
          MSME Financial Health Card
        </p>
        <h1 className="font-display text-[34px] font-semibold text-ink leading-tight mt-2.5">
          {card.business_name}
        </h1>
        <p className="num text-[11.5px] text-ink-3 mt-2.5">
          {card.ref} · generated {fmtDate(card.generated_at)}
        </p>
        <p className="text-[11px] text-ink-3 mt-1">Issued by {card.issued_by}</p>
      </div>

      <div className="px-8 sm:px-10 py-8 space-y-9">
        {/* score hero */}
        <section className="avoid-break rise rise-2">
          <div className="flex flex-wrap items-center justify-center gap-x-16 gap-y-6">
            <ScoreArc score={card.score} grade={card.grade} />
            <div className="flex flex-col items-center gap-2.5">
              <BadgeSeal badge={card.badge} />
              <p className="num text-[11px] text-ink-3">
                Verification index {card.verification_index}/100
              </p>
            </div>
          </div>
          <p className="text-[13.5px] text-ink-2 leading-relaxed text-center max-w-[560px] mx-auto mt-6">
            {card.summary}
          </p>
        </section>

        {/* pillars */}
        <section className="avoid-break rise rise-3">
          <SectionRule label="Five pillars of business health" />
          <div className="mt-4">
            {card.pillars.map((p) => (
              <PillarBar key={p.key} pillar={p} />
            ))}
          </div>
        </section>

        {/* strengths / watch-outs */}
        <section className="avoid-break rise rise-4">
          <SectionRule label="What we saw in your data" />
          <div className="grid sm:grid-cols-2 gap-x-10 gap-y-6 mt-5">
            <PointList
              heading="Strengths"
              icon="check"
              iconClass="text-good"
              points={card.strengths}
              empty="No standout strengths yet — the roadmap below shows where to start."
            />
            <PointList
              heading="Watch-outs"
              icon="alert"
              iconClass="text-warn"
              points={card.watchouts}
              empty="No watch-outs flagged. Keep filing and banking as you are."
            />
          </div>
        </section>

        {/* offer / verification panel */}
        {failed ? (
          <VerificationRequiredPanel />
        ) : card.eligible_offer ? (
          <OfferPanel offer={card.eligible_offer} />
        ) : (
          <p className="text-[12px] text-ink-3 text-center">
            No pre-qualified offer at this time — completing the roadmap below improves eligibility.
          </p>
        )}

        {/* roadmap */}
        <section className="avoid-break rise rise-5">
          <SectionRule label="Improvement roadmap" />
          {card.roadmap.length === 0 ? (
            <p className="text-[12.5px] text-ink-3 text-center mt-4">
              Nothing to fix — this is as good as it gets. Maintain the discipline.
            </p>
          ) : (
            <ol className="mt-2">
              {card.roadmap.map((item, i) => (
                <RoadmapRow key={item.action} index={i + 1} item={item} />
              ))}
            </ol>
          )}
          <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1.5 border-t border-line-2 mt-1 pt-3.5">
            {card.roadmap.length > 0 ? (
              <p className="text-[12.5px] text-ink-2">
                Complete these steps and your score could reach{' '}
                <span className="num text-[15px] font-bold text-pine-700">{potential}</span>
              </p>
            ) : (
              <span />
            )}
            <p className="text-[12px] text-ink-3">
              Next review <span className="num font-semibold text-ink">{fmtDate(card.next_review_date)}</span>
            </p>
          </div>
        </section>
      </div>

      {/* footer */}
      <footer className="bg-well border-t border-line px-8 py-4">
        <p className="text-[10.5px] text-ink-3 leading-relaxed">
          Computed from consent-verified GST, bank (Account Aggregator) and EPFO data · synthetic
          demonstration data for IDBI Innovate 2026. This card is informational and is not a sanction,
          offer or guarantee of credit.
        </p>
        <div className="flex flex-wrap items-center justify-between gap-2 mt-2">
          <span className="num text-[10.5px] text-ink-3">{card.issued_by}</span>
          <span className="num text-[10.5px] text-ink-3">
            engine v{card.engine_version} · {card.card_id}
          </span>
        </div>
      </footer>
    </article>
  )
}

/* ── Verification seal ───────────────────────────────────────────────── */

const BADGE_META: Record<
  HealthCardBadge,
  { label: string; tone: ToneName; color: string; bg: string; glyph: string }
> = {
  VERIFIED: {
    label: 'Verified',
    tone: 'good',
    color: SEM.good,
    bg: SEM.goodBg,
    glyph: 'M27 39.5l7.5 7.5L49.5 31',
  },
  PARTIALLY_VERIFIED: {
    label: 'Partially Verified',
    tone: 'warn',
    color: SEM.warn,
    bg: SEM.warnBg,
    glyph: 'M38 26v15M38 48.5v1.5',
  },
  VERIFICATION_FAILED: {
    label: 'Verification Failed',
    tone: 'bad',
    color: SEM.bad,
    bg: SEM.badBg,
    glyph: 'M31 31l14 14M45 31L31 45',
  },
}

/** Rosette-style seal: dashed outer ring, solid inner disc, status glyph. */
function BadgeSeal({ badge }: { badge: HealthCardBadge }) {
  const meta = BADGE_META[badge]
  return (
    <div className="flex flex-col items-center gap-2.5" aria-label={`Verification badge: ${meta.label}`}>
      <svg width="84" height="84" viewBox="0 0 76 76" aria-hidden="true">
        <circle cx="38" cy="38" r="36" fill="none" stroke={meta.color} strokeWidth="1.4" strokeDasharray="2.6 3.4" />
        <circle cx="38" cy="38" r="29" fill={meta.bg} stroke={meta.color} strokeWidth="1.4" />
        <path
          d={meta.glyph}
          stroke={meta.color}
          strokeWidth="3.2"
          fill="none"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
      <Chip tone={meta.tone} dot>
        {meta.label}
      </Chip>
    </div>
  )
}

/* ── Section pieces ──────────────────────────────────────────────────── */

function SectionRule({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-3.5">
      <span className="h-px flex-1 bg-line-2" aria-hidden="true" />
      <h2 className="overline-label !text-ink-2">{label}</h2>
      <span className="h-px flex-1 bg-line-2" aria-hidden="true" />
    </div>
  )
}

function PillarBar({ pillar }: { pillar: HealthCardPillar }) {
  const color = METRIC_STATUS_COLOR[pillar.status]
  const width = Math.min(100, Math.max(0, pillar.score))
  return (
    <div className="grid grid-cols-[minmax(150px,215px)_1fr_42px] items-center gap-x-3.5 py-2.5 border-b border-line last:border-b-0">
      <span className="flex items-center gap-2 text-[12.5px] font-semibold text-ink leading-tight">
        <Dot color={color} /> {pillar.label}
      </span>
      <span className="h-2 rounded-full bg-well border border-line overflow-hidden">
        <span className="block h-full rounded-full" style={{ width: `${width}%`, backgroundColor: color }} />
      </span>
      <span className="num text-[13px] font-semibold text-ink text-right">
        {pillar.score}
        <span className="text-[10px] text-ink-3 font-normal">/100</span>
      </span>
    </div>
  )
}

function PointList({
  heading,
  icon,
  iconClass,
  points,
  empty,
}: {
  heading: string
  icon: string
  iconClass: string
  points: HealthCardPoint[]
  empty: string
}) {
  return (
    <div>
      <h3 className="text-[11px] font-bold uppercase tracking-[0.14em] text-ink-2 mb-3">{heading}</h3>
      {points.length === 0 ? (
        <p className="text-[12.5px] text-ink-3 leading-relaxed">{empty}</p>
      ) : (
        <ul className="space-y-3.5">
          {points.map((p) => (
            <li key={p.title} className="flex items-start gap-2.5">
              <Icon name={icon} size={14} className={`${iconClass} mt-0.5 shrink-0`} />
              <div>
                <p className="text-[13px] font-semibold text-ink leading-snug">{p.title}</p>
                <p className="text-[12.5px] text-ink-2 leading-relaxed mt-0.5">{p.detail}</p>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

/* ── Offer / verification panels ─────────────────────────────────────── */

function OfferPanel({ offer }: { offer: NonNullable<HealthCard['eligible_offer']> }) {
  return (
    <section className="brand-panel-texture rounded-lg px-7 py-6 avoid-break rise rise-4">
      <div className="flex items-center justify-between gap-3">
        <p className="overline-label !text-white/55">Pre-qualified offer</p>
        <BrandMark size={20} />
      </div>
      <p className="font-display text-[22px] font-semibold text-white mt-1.5">{unSnake(offer.product)}</p>
      <dl className="grid grid-cols-3 gap-4 mt-4 pt-4 border-t border-white/15">
        <div>
          <dt className="text-[10px] uppercase tracking-[0.14em] text-white/50 font-semibold">Limit up to</dt>
          <dd className="num text-[24px] font-semibold text-white mt-1" title={inrFull(offer.limit)}>
            {inr(offer.limit)}
          </dd>
        </div>
        <div>
          <dt className="text-[10px] uppercase tracking-[0.14em] text-white/50 font-semibold">Indicative EMI</dt>
          <dd className="num text-[24px] font-semibold text-white mt-1">
            {inrFull(offer.indicative_emi)}
            <span className="text-[12px] text-white/55 font-normal">/mo</span>
          </dd>
        </div>
        <div>
          <dt className="text-[10px] uppercase tracking-[0.14em] text-white/50 font-semibold">Tenure</dt>
          <dd className="num text-[24px] font-semibold text-white mt-1">
            {offer.tenure_months}
            <span className="text-[12px] text-white/55 font-normal"> months</span>
          </dd>
        </div>
      </dl>
      <p className="text-[11px] text-white/45 mt-4">
        Indicative terms — subject to lender verification, final credit approval and documentation.
      </p>
    </section>
  )
}

function VerificationRequiredPanel() {
  return (
    <section className="border border-crit/30 bg-crit-bg rounded-lg px-6 py-5 avoid-break rise rise-4">
      <div className="flex items-start gap-3.5">
        <div className="size-9 rounded-full bg-white border border-crit/30 flex items-center justify-center text-crit shrink-0">
          <Icon name="alert" size={16} />
        </div>
        <div>
          <p className="text-[14px] font-bold text-ink">Verification required before offers can be shown</p>
          <p className="text-[12.5px] text-ink-2 leading-relaxed mt-1">
            Some of the reported figures could not be corroborated across your GST, bank and EPFO records,
            so this card carries no pre-qualified offer. Please review the filings and statements shared
            under consent with your lender — once the records reconcile, a fresh card can be generated.
          </p>
        </div>
      </div>
    </section>
  )
}

/* ── Roadmap ─────────────────────────────────────────────────────────── */

function timeframe(months: number): string {
  return months === 1 ? 'within 1 month' : `within ${months} months`
}

function RoadmapRow({ index, item }: { index: number; item: RoadmapItem }) {
  return (
    <li className="grid grid-cols-[30px_1fr] gap-x-3.5 py-3.5 border-b border-line last:border-b-0">
      <span className="num size-7 rounded-full border border-line-2 bg-well text-[12px] font-semibold text-ink-2 flex items-center justify-center mt-0.5">
        {index}
      </span>
      <div>
        <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-1.5">
          <p className="text-[13px] font-semibold text-ink leading-snug max-w-[420px]">{item.action}</p>
          <span className="flex items-center gap-1.5 shrink-0">
            <span className="num inline-flex items-center h-5.5 px-2 rounded-full bg-pine-100 text-pine-800 text-[11px] font-bold">
              +{item.impact_points} pts
            </span>
            <span className="inline-flex items-center h-5.5 px-2 rounded-full border border-line-2 bg-well text-[11px] font-medium text-ink-2">
              {timeframe(item.timeframe_months)}
            </span>
          </span>
        </div>
        <p className="text-[12.5px] text-ink-2 leading-relaxed mt-1">{item.why}</p>
      </div>
    </li>
  )
}

/* ── Loading skeleton ────────────────────────────────────────────────── */

function CardSkeleton() {
  return (
    <div className="bg-card border border-line rounded-lg overflow-hidden">
      <Skeleton className="h-[72px] w-full !rounded-none" />
      <div className="px-10 py-8 space-y-7">
        <div className="space-y-3">
          <Skeleton className="h-3.5 w-52 mx-auto" />
          <Skeleton className="h-8 w-72 mx-auto" />
          <Skeleton className="h-3 w-44 mx-auto" />
        </div>
        <Skeleton className="h-40 w-64 mx-auto" />
        <div className="space-y-2.5">
          <Skeleton className="h-4 w-5/6 mx-auto" />
          <Skeleton className="h-4 w-2/3 mx-auto" />
        </div>
        {Array.from({ length: 5 }, (_, i) => (
          <Skeleton key={i} className="h-5 w-full" />
        ))}
        <Skeleton className="h-28 w-full" />
      </div>
    </div>
  )
}
