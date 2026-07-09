import { useEffect, useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { Logo } from '../components/Shell'
import { Icon } from '../components/ui/Icon'

/* ── Parakh landing — "cinematic ledger" ─────────────────────────────────
   Dark-first pine with aurora atmosphere; the working product as the hero
   visual; paper editorial interludes; a bento tour of the real console.
   All imagery under /landing/ is captured from the live prototype.      */

function useReveal() {
  useEffect(() => {
    const els = document.querySelectorAll<HTMLElement>('.reveal')
    const io = new IntersectionObserver(
      (entries) =>
        entries.forEach((e) => {
          if (e.isIntersecting) {
            const el = e.target
            el.classList.add('in')
            io.unobserve(el)
            // drop the reveal transition once played so it can't fight
            // the cards' own hover transitions
            window.setTimeout(() => el.classList.remove('reveal', 'in'), 1200)
          }
        }),
      { threshold: 0.12 },
    )
    els.forEach((el) => io.observe(el))
    return () => io.disconnect()
  }, [])
}

/** Grid cells lighting up like droplets on the hero blueprint grid.
    Spawn intensity breathes: starts at 5, rises, falls, rises again. */
function GridDroplets() {
  const [drops, setDrops] = useState<{ id: number; x: number; y: number; delay: number }[]>([])
  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    const CELL = 56
    let nextId = 0
    let t = 0
    const spawn = (n: number) => {
      const cols = Math.ceil(window.innerWidth / CELL)
      const rows = 16
      setDrops((d) => {
        const next = [...d]
        for (let i = 0; i < n; i++) {
          next.push({
            id: nextId++,
            x: Math.floor(Math.random() * cols) * CELL,
            y: Math.floor(Math.random() * rows) * CELL,
            delay: Math.random() * 0.7,
          })
        }
        return next.slice(-48)
      })
    }
    spawn(5)
    const iv = setInterval(() => {
      t += 1
      // breathing intensity: rise → fall → rise
      const intensity = 2.5 + 2.5 * Math.sin(t * 0.55)
      spawn(Math.max(1, Math.round(intensity)))
    }, 520)
    return () => clearInterval(iv)
  }, [])
  return (
    <div className="grid-mask pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
      {drops.map((d) => (
        <span
          key={d.id}
          className="cell-drop absolute"
          style={{ left: d.x, top: d.y, animationDelay: `${d.delay}s` }}
        />
      ))}
    </div>
  )
}

const TAPE_ITEMS = [
  'consent artefact 101 ✓',
  'sha-256 pull integrity ✓',
  'gst ↔ bank match 0.96',
  'epfo payroll plausible ✓',
  'verification index 92/100',
  'dscr 2.47×',
  'pd-12m 0.1%',
  'circular-flow scan clear ✓',
  'window-dressing scan clear ✓',
  'score 704 · grade B+',
  'buffer depletion — stable',
  'append-only audit ✓',
]

const RAILS = [
  {
    tag: 'GST network',
    proves: 'Declared revenue',
    desc: 'GSTR-1 and 3B filings show what the business tells the taxman — turnover, filing discipline, growth.',
    art: RailGstArt,
  },
  {
    tag: 'Bank rails',
    proves: 'Cash reality',
    desc: 'Account Aggregator statements show what actually lands — inflows, bounces, balances, obligations.',
    art: RailBankArt,
  },
  {
    tag: 'EPFO payroll',
    proves: 'Real operations',
    desc: 'Provident-fund contributions show the payroll a real business of that size must carry.',
    art: RailEpfoArt,
  },
]

/* ── gap-section rail illustrations — instrument line-art in brand inks ── */

function RailGstArt({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 220 96" fill="none" className={className} aria-hidden="true">
      {/* filing document */}
      <rect x="24" y="12" width="58" height="72" rx="5" fill="#edf5f0" stroke="#135c3e" strokeWidth="1.5" />
      <text x="33" y="27" fill="#135c3e" fontSize="8" fontWeight="700" fontFamily="var(--font-mono)">GSTR-3B</text>
      <rect x="33" y="34" width="40" height="4" rx="2" fill="#d9eae0" />
      <rect x="33" y="43" width="32" height="4" rx="2" fill="#d9eae0" />
      <rect x="33" y="52" width="40" height="4" rx="2" fill="#d9eae0" />
      <rect x="33" y="64" width="24" height="7" rx="2" fill="#135c3e" />
      <text x="62" y="70.5" fill="#57534a" fontSize="7" fontFamily="var(--font-mono)">₹84L</text>
      {/* network of filings */}
      <path d="M82 32C110 22 128 20 148 24" pathLength={300} className="gfx-draw" stroke="#8a8578" strokeWidth="1" strokeDasharray="3 4" />
      <path d="M82 52C112 54 132 58 152 56" pathLength={300} className="gfx-draw" stroke="#8a8578" strokeWidth="1" strokeDasharray="3 4" />
      <path d="M82 70C108 80 126 82 146 78" pathLength={300} className="gfx-draw" stroke="#8a8578" strokeWidth="1" strokeDasharray="3 4" />
      <g className="gfx-pop gfx-d1">
        <circle cx="158" cy="24" r="9" fill="#d9eae0" stroke="#135c3e" strokeWidth="1.5" />
        <path d="M154 24l3 3 5-6" stroke="#135c3e" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
        <text x="176" y="27" fill="#8a8578" fontSize="7" fontFamily="var(--font-mono)">Q1 ✓</text>
      </g>
      <g className="gfx-pop gfx-d3">
        <circle cx="163" cy="56" r="9" fill="#d9eae0" stroke="#135c3e" strokeWidth="1.5" />
        <path d="M159 56l3 3 5-6" stroke="#135c3e" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
        <text x="181" y="59" fill="#8a8578" fontSize="7" fontFamily="var(--font-mono)">Q2 ✓</text>
      </g>
      <g className="gfx-pop gfx-d5">
        <circle cx="156" cy="78" r="9" fill="#faf1e0" stroke="#9a5b00" strokeWidth="1.5" />
        <text x="153" y="81.5" fill="#9a5b00" fontSize="9" fontWeight="700" fontFamily="var(--font-mono)">!</text>
        <text x="174" y="81" fill="#8a8578" fontSize="7" fontFamily="var(--font-mono)">Q3 late</text>
      </g>
    </svg>
  )
}

function RailBankArt({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 220 96" fill="none" className={className} aria-hidden="true">
      {/* credits above the line, debits below */}
      <line x1="20" y1="56" x2="200" y2="56" stroke="#d8d4c6" strokeWidth="1.5" />
      {[
        { x: 36, h: 26 }, { x: 58, h: 16 }, { x: 80, h: 32 }, { x: 102, h: 12 },
        { x: 124, h: 22 }, { x: 146, h: 30 }, { x: 168, h: 18 },
      ].map((b, i) => (
        <rect key={b.x} x={b.x} y={56 - b.h} width="10" height={b.h} rx="2" fill="#107a52" opacity="0.85"
          className="gfx-bar" style={{ animationDelay: `${i * 0.05}s` }} />
      ))}
      {[
        { x: 47, h: 12 }, { x: 69, h: 20 }, { x: 91, h: 8 }, { x: 113, h: 16 },
        { x: 135, h: 10 }, { x: 157, h: 14 }, { x: 179, h: 9 },
      ].map((b, i) => (
        <rect key={b.x} x={b.x} y={57} width="10" height={b.h} rx="2" fill="#b3aea0" opacity="0.8"
          className="gfx-bar !origin-top" style={{ animationDelay: `${0.05 + i * 0.05}s` }} />
      ))}
      {/* running balance */}
      <path d="M22 40C50 36 76 28 104 32S162 26 198 20" pathLength={300} className="gfx-draw" stroke="#9a5b00" strokeWidth="1.5" strokeDasharray="4 4" />
      <circle cx="198" cy="20" r="3" fill="#9a5b00" className="gfx-pop gfx-d6" />
      <text x="20" y="90" fill="#8a8578" fontSize="7" fontFamily="var(--font-mono)">CREDITS ▲</text>
      <text x="82" y="90" fill="#8a8578" fontSize="7" fontFamily="var(--font-mono)">DEBITS ▼</text>
      <text x="146" y="90" fill="#9a5b00" fontSize="7" fontFamily="var(--font-mono)">BALANCE ---</text>
    </svg>
  )
}

function RailEpfoArt({ className }: { className?: string }) {
  // 3 employees × 12 months of PF contributions — a payroll punch-grid
  const rows = [32, 50, 68]
  const cols = Array.from({ length: 12 }, (_, j) => 58 + j * 12)
  return (
    <svg viewBox="0 0 220 96" fill="none" className={className} aria-hidden="true">
      <text x="22" y="14" fill="#8a8578" fontSize="7" fontFamily="var(--font-mono)">
        EST · PF/MH/41225
      </text>
      <text x="198" y="14" textAnchor="end" fill="#135c3e" fontSize="7" fontWeight="700" fontFamily="var(--font-mono)">
        23 ON PAYROLL
      </text>
      {/* current month highlight */}
      <rect x="182" y="22" width="12" height="56" rx="6" fill="#d9eae0" opacity="0.6" />
      {/* employee rows */}
      {rows.map((y, i) => (
        <g key={y} opacity={1 - i * 0.06}>
          <circle cx="28" cy={y - 5.5} r="3.8" fill="#edf5f0" stroke="#135c3e" strokeWidth="1.3" />
          <path
            d={`M21.8 ${y + 7}c1.2-4.2 3.8-6 6.2-6s5 1.8 6.2 6`}
            fill="none"
            stroke="#135c3e"
            strokeWidth="1.3"
            strokeLinecap="round"
          />
          {cols.map((x, j) => (
            <circle
              key={x}
              cx={x}
              cy={y}
              r="3.2"
              fill="#107a52"
              opacity={j === 11 ? 1 : 0.55 + ((i + j) % 3) * 0.15}
              className="gfx-wave"
              style={{ animationDelay: `${j * 0.07}s` }}
            />
          ))}
        </g>
      ))}
      {/* quarter ticks */}
      {[
        { x: 58, t: 'J' },
        { x: 94, t: 'A' },
        { x: 130, t: 'J' },
        { x: 166, t: 'O' },
        { x: 188, t: 'D' },
      ].map((m) => (
        <text key={m.x} x={m.x} y="86" textAnchor="middle" fill="#b3aea0" fontSize="6" fontFamily="var(--font-mono)">
          {m.t}
        </text>
      ))}
      <text x="22" y="95" fill="#8a8578" fontSize="7" fontFamily="var(--font-mono)">
        PF FILED · EVERY MONTH
      </text>
      <text x="198" y="95" textAnchor="end" fill="#135c3e" fontSize="7" fontWeight="700" fontFamily="var(--font-mono)">
        12/12 ✓
      </text>
    </svg>
  )
}

const STEPS = [
  {
    n: '01',
    t: 'Consent',
    d: 'DEPA-style artefacts for each rail — purpose-bound, time-bound, revocable. Every pull is hashed for integrity.',
  },
  {
    n: '02',
    t: 'Triangulate',
    d: 'Six cross-source fraud checks gate the pipeline. Inflated GST, circular flows and window dressing die here — before any score exists.',
  },
  {
    n: '03',
    t: 'Score & stress',
    d: 'Five pillars fold into an explainable 300–900 score, then a 12-month liquidity-buffer projection names the risks ahead.',
  },
  {
    n: '04',
    t: 'Decide',
    d: 'A right-sized limit the cash flows can service, a credit memo citing every figure — and a Health Card for the borrower either way.',
  },
]

const PERSONAS = [
  { name: 'Saraswati Kirana', sector: 'Retail trade', verdict: 'APPROVE', tone: 'good', stat: '704 · B+ — cash under-declaration priced in' },
  { name: 'Rathore Textiles', sector: 'Textiles', verdict: 'DECLINE', tone: 'crit', stat: 'VI 19 — GST inflated 2.9×, circular flows caught' },
  { name: 'Meher Foods', sector: 'Food products', verdict: 'APPROVE', tone: 'good', stat: '723 · B+ — seasonality correctly deseasonalised' },
  { name: 'Nexus Digital', sector: 'IT services', verdict: 'APPROVE', tone: 'good', stat: '782 · A — new-to-credit, scored anyway' },
  { name: 'Balaji Auto', sector: 'Auto components', verdict: 'DECLINE', tone: 'crit', stat: 'PD-12m 99% — 4 early-warning signals fired' },
  { name: 'GreenLeaf Organics', sector: 'FMCG / D2C', verdict: 'CONDITIONAL', tone: 'warn', stat: '₹8L asked → ₹3L right-sized, step-up path set' },
]

const VERDICT_STYLES: Record<string, string> = {
  good: 'bg-good-bg text-good border-good/25',
  crit: 'bg-crit-bg text-crit border-crit/25',
  warn: 'bg-warn-bg text-warn border-warn/25',
}

export function LandingPage() {
  useReveal()
  const [scrolled, setScrolled] = useState(false)
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  return (
    <div className="bg-pine-950 text-white">
      {/* ── Nav ── */}
      <header
        className={`fixed inset-x-0 top-0 z-50 transition-all duration-300 ${
          scrolled ? 'bg-pine-950/80 backdrop-blur-md border-b border-white/8' : 'bg-transparent'
        }`}
      >
        <nav className="mx-auto max-w-[1360px] flex items-center justify-between px-6 h-16">
          <Logo height={26} theme="dark" />
          <div className="hidden md:flex items-center gap-8 text-[13px] text-white/60">
            <a href="#gap" className="hover:text-white transition-colors">The gap</a>
            <a href="#how" className="hover:text-white transition-colors">How it works</a>
            <a href="#console" className="hover:text-white transition-colors">Inside the console</a>
            <a href="#outcomes" className="hover:text-white transition-colors">Outcomes</a>
          </div>
          <div className="flex items-center gap-3">
            <Link
              to="/login"
              className="hidden sm:block text-[13px] text-white/70 hover:text-white transition-colors"
            >
              Sign in
            </Link>
            <Link
              to="/login"
              className="rounded-md bg-[#7fd4ac] text-pine-950 text-[13px] font-semibold px-4 py-2 hover:bg-[#a5e3c6] transition-colors"
            >
              Open the console
            </Link>
          </div>
        </nav>
      </header>

      {/* ── Hero ── */}
      <section className="noise relative overflow-hidden">
        <div className="grid-lines absolute inset-0" aria-hidden="true" />
        <GridDroplets />
        <div className="absolute inset-0 overflow-hidden pointer-events-none" aria-hidden="true">
          <div className="aurora-blob aurora-emerald w-[720px] h-[720px] -top-72 left-1/2 -translate-x-1/2" />
          <div className="aurora-blob aurora-gem w-[560px] h-[560px] top-40 -left-64" />
          <div className="aurora-blob aurora-brass w-[520px] h-[520px] top-64 -right-56" />
        </div>

        <div className="relative mx-auto max-w-[1360px] px-6 pt-36 pb-10 text-center">
          <p className="reveal inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3.5 py-1.5 text-[11.5px] text-white/65">
            <span className="size-1.5 rounded-full bg-[#7fd4ac]" />
            IDBI Innovate 2026 · Track 3 · MSME financial health
          </p>

          <h1 className="reveal d1 font-display font-medium leading-[1.04] tracking-[-0.015em] mt-7 text-[clamp(46px,7.2vw,96px)]">
            Lend on <em className="text-aurora not-italic">proof</em>,
            <br />
            not paperwork.
          </h1>

          <p className="reveal d2 mx-auto mt-7 max-w-152 text-[16.5px] leading-relaxed text-white/60">
            Parakh triangulates a business's GST filings, bank statements and EPFO payroll into an
            explainable 300–900 health score, a 12-month stress outlook and an audit-ready credit
            memo — about a minute after consent.
          </p>

          <div className="reveal d3 mt-9 flex items-center justify-center gap-3.5">
            <Link
              to="/login"
              className="group inline-flex items-center gap-2 rounded-md bg-[#7fd4ac] text-pine-950 text-[14.5px] font-semibold px-6 py-3 hover:bg-[#a5e3c6] transition-colors"
            >
              Open the console
              <Icon name="chevron-right" size={15} className="transition-transform group-hover:translate-x-0.5" />
            </Link>
            <a
              href="#how"
              className="inline-flex items-center rounded-md border border-white/20 text-white/85 text-[14.5px] px-6 py-3 hover:bg-white/5 hover:border-white/35 transition-colors"
            >
              How it works
            </a>
          </div>

          <div className="reveal d4 mx-auto mt-12 grid max-w-3xl grid-cols-2 sm:grid-cols-4">
            {[
              ['3 rails', 'triangulated per file'],
              ['300–900', 'explainable score'],
              ['6 checks', 'gate every score'],
              ['≈60 s', 'consent → memo'],
            ].map(([k, v], i) => (
              <div key={k} className="relative px-4 py-4">
                {i > 0 && (
                  <span
                    className="absolute inset-y-0 left-0 hidden w-px bg-gradient-to-b from-transparent via-white/30 to-transparent sm:block"
                    aria-hidden="true"
                  />
                )}
                <p className="num text-[19px] font-semibold text-[#7fd4ac]">{k}</p>
                <p className="text-[11px] text-white/45 mt-0.5">{v}</p>
              </div>
            ))}
          </div>
        </div>

        {/* product frame */}
        <div className="relative mx-auto max-w-[1360px] px-6 md:px-10 pb-28" style={{ perspective: '1600px' }}>
          <div
            className="reveal relative rounded-xl border border-white/15 bg-pine-900 shadow-[0_60px_120px_-40px_rgba(0,0,0,0.8)] overflow-hidden"
            style={{ transform: 'rotateX(4deg)', transformOrigin: 'center top' }}
          >
            <div className="flex items-center gap-2 border-b border-white/10 bg-pine-950/80 px-4 py-2.5">
              <span className="size-2.5 rounded-full bg-white/15" />
              <span className="size-2.5 rounded-full bg-white/15" />
              <span className="size-2.5 rounded-full bg-white/15" />
              <span className="num ml-3 rounded bg-white/5 px-3 py-0.5 text-[10.5px] text-white/40">
                parakh.demo/console
              </span>
            </div>
            <img
              src="/landing/dashboard.png"
              alt="Parakh underwriting console — portfolio dashboard"
              className="block w-full"
            />
            <div
              className="pointer-events-none absolute inset-0"
              style={{ background: 'linear-gradient(180deg, transparent 55%, rgba(12,31,25,0.55) 100%)' }}
              aria-hidden="true"
            />
          </div>

          {/* floating verdict chips */}
          <div className="glass-dark float-y absolute -left-2 sm:left-8 bottom-40 hidden md:flex items-center gap-2.5 px-3.5 py-2.5 rotate-[-2deg]" aria-hidden="true">
            <span className="size-2 rounded-full bg-[#7fd4ac]" />
            <span className="num text-[12px] text-white/85">
              health score <span className="font-semibold text-[#7fd4ac]">704 · B+</span>
            </span>
            <span className="inline-flex items-center gap-1 text-[10.5px] text-[#7fd4ac]">
              <Icon name="check" size={10} /> verified
            </span>
          </div>
          <div className="glass-dark float-y-slow absolute -right-2 sm:right-10 -top-4 hidden md:flex items-center gap-2.5 px-3.5 py-2.5 rotate-[2deg]" aria-hidden="true">
            <span className="relative flex size-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-400 opacity-60" />
              <span className="relative inline-flex size-2 rounded-full bg-red-400" />
            </span>
            <span className="num text-[12px] text-white/85">fraud flag — circular routing detected</span>
          </div>
        </div>
      </section>

      {/* ── ledger tape ── */}
      <div className="relative overflow-hidden border-y border-white/8 bg-pine-900/70 py-3" aria-hidden="true">
        <div className="tape-track">
          {[0, 1].map((half) => (
            <div key={half} className="flex shrink-0 items-center">
              {TAPE_ITEMS.map((item) => (
                <span key={`${half}-${item}`} className="num whitespace-nowrap px-7 text-[11px] uppercase tracking-[0.16em] text-white/35">
                  {item}
                </span>
              ))}
            </div>
          ))}
        </div>
      </div>

      {/* ── The gap (paper) ── */}
      <section id="gap" className="relative bg-paper text-ink scroll-mt-16">
        <div className="mx-auto max-w-[1360px] px-6 py-24">
          <p className="reveal overline-label">The gap</p>
          <h2 className="reveal d1 font-display text-[clamp(32px,4.4vw,54px)] leading-[1.1] font-medium mt-4 max-w-3xl">
            Most MSMEs aren't unviable.
            <br />
            They're <span className="text-pine-700">invisible</span>.
          </h2>
          <p className="reveal d2 mt-6 max-w-2xl text-[15.5px] leading-relaxed text-ink-2">
            No audited financials. No bureau file. No score. So the lending system defaults to
            collateral and paperwork — and working businesses get a no. But the proof of their
            health already exists, written every month onto three rails they can consent to share.
            Parakh reads all three, and makes them agree with each other.
          </p>
          <div className="mt-12">
            <div className="grid gap-5 sm:grid-cols-3">
              {RAILS.map((rail, i) => (
                <div
                  key={rail.tag}
                  className={`reveal d${i + 1} group overflow-hidden rounded-xl border border-line bg-card shadow-[0_1px_2px_rgba(28,27,23,0.05)] transition-all duration-500 ease-[cubic-bezier(0.22,0.61,0.36,1)] hover:-translate-y-1 hover:shadow-[0_18px_38px_-20px_rgba(19,92,62,0.35)]`}
                >
                  <div className="border-b border-line bg-well px-7 pt-6 pb-3">
                    <rail.art className="w-full transition-transform duration-500 group-hover:scale-[1.03]" />
                  </div>
                  <div className="p-6">
                    <p className="num text-[10.5px] uppercase tracking-[0.14em] text-ink-3">{rail.tag}</p>
                    <p className="font-display text-[18px] font-semibold mt-1.5">{rail.proves}</p>
                    <p className="text-[13px] leading-relaxed text-ink-2 mt-2">{rail.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── How it works (paper) ── */}
      <section id="how" className="relative bg-paper text-ink scroll-mt-16 border-t border-line">
        <div className="mx-auto max-w-[1360px] px-6 py-24">
          <p className="reveal overline-label">How it works</p>
          <h2 className="reveal d1 font-display text-[clamp(30px,3.8vw,46px)] leading-[1.12] font-medium mt-4">
            Consent to credit decision in four moves.
          </h2>
          <div className="mt-12 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {STEPS.map((step, i) => (
              <div
                key={step.n}
                className={`reveal d${i + 1} group relative rounded-lg border border-line bg-card p-6 transition-all duration-500 ease-[cubic-bezier(0.22,0.61,0.36,1)] hover:-translate-y-1 hover:border-pine-600/50 hover:shadow-[0_16px_36px_-18px_rgba(19,92,62,0.35)]`}
              >
                <p className="num text-[26px] font-semibold text-pine-700/35 transition-colors group-hover:text-pine-700">
                  {step.n}
                </p>
                <h3 className="font-display text-[18px] font-semibold mt-3">{step.t}</h3>
                <p className="text-[13px] leading-relaxed text-ink-2 mt-2">{step.d}</p>
              </div>
            ))}
          </div>
          <p className="reveal d4 num mt-10 text-[12px] text-ink-3">
            Every transition is validated server-side and written to an append-only audit trail.
            Declines exit with an improvement roadmap and a re-review date.
          </p>
        </div>
      </section>

      {/* ── Inside the console (dark bento) ── */}
      <section id="console" className="noise relative bg-pine-950 scroll-mt-16 overflow-hidden">
        <div className="absolute inset-0 overflow-hidden pointer-events-none" aria-hidden="true">
          <div className="aurora-blob aurora-emerald w-[640px] h-[640px] -top-80 -right-64" />
        </div>
        <div className="relative mx-auto max-w-[1360px] px-6 py-24">
          <p className="reveal overline-label !text-white/40">Inside the console</p>
          <div className="mt-4 flex flex-wrap items-end justify-between gap-6">
            <h2 className="reveal d1 font-display text-[clamp(30px,3.8vw,46px)] leading-[1.12] font-medium text-white max-w-xl">
              The console, not a concept.
            </h2>
            <p className="reveal d2 max-w-sm text-[13.5px] leading-relaxed text-white/50">
              Every screen below is the working prototype running on synthetic rails — every number
              computed live by deterministic engines.
            </p>
          </div>

          <div className="mt-12 grid gap-4 lg:grid-cols-3">
            <FeatureCard
              delay="d1"
              title="Fraud checks before any score exists"
              sub="Six cross-source checks gate the pipeline — inflated turnover, circular flows and window dressing are caught before scoring begins."
            >
              <TriangulationGraphic />
            </FeatureCard>
            <FeatureCard
              delay="d2"
              title="A defensible decision, one screen"
              sub="Five pillars fold into an explainable 300–900 score with the engine's recommendation and a right-sized limit."
            >
              <DecisionGraphic />
            </FeatureCard>
            <FeatureCard
              delay="d3"
              title="Stress, seen 12 months out"
              sub="Liquidity-buffer depletion with named drivers — early warning before the first missed EMI."
            >
              <StressGraphic />
            </FeatureCard>
          </div>
          <div className="mt-4 grid gap-4 lg:grid-cols-2">
            <FeatureCard
              delay="d1"
              zone="h-52 pt-9"
              title="Memos that cite every number"
              sub="An audit-ready appraisal note drafted by the engine and reviewed by the officer — every figure traceable to its consented pull."
            >
              <MemoGraphic />
            </FeatureCard>
            <FeatureCard
              delay="d2"
              zone="h-52 pt-9"
              title="The borrower gets a Health Card"
              sub="Plain-language and printable — a pre-qualified offer when it clears, an improvement roadmap with a re-review date when it doesn't."
            >
              <HealthCardGraphic />
            </FeatureCard>
          </div>
        </div>
      </section>

      {/* ── Outcomes (paper) ── */}
      <section id="outcomes" className="relative bg-paper text-ink scroll-mt-16">
        <div className="mx-auto max-w-[1360px] px-6 py-24">
          <p className="reveal overline-label">Benchmarked on ground truth</p>
          <h2 className="reveal d1 font-display text-[clamp(30px,3.8vw,46px)] leading-[1.12] font-medium mt-4">
            Six personas in. Six right calls.
          </h2>
          <p className="reveal d2 mt-4 max-w-2xl text-[14.5px] leading-relaxed text-ink-2">
            The demo seeds six synthetic MSMEs with known ground truth — honest, fraudulent,
            seasonal, stressed, thin-file. The engine lands on the right side of every one.
          </p>
          <div className="mt-10 grid gap-3.5 sm:grid-cols-2 lg:grid-cols-3">
            {PERSONAS.map((p, i) => (
              <div
                key={p.name}
                className={`reveal d${(i % 3) + 1} rounded-lg border border-line bg-card p-5 transition-all duration-500 ease-[cubic-bezier(0.22,0.61,0.36,1)] hover:-translate-y-0.5 hover:shadow-[0_12px_28px_-16px_rgba(28,27,23,0.25)]`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-display text-[15.5px] font-semibold">{p.name}</p>
                    <p className="text-[11.5px] text-ink-3 mt-0.5">{p.sector}</p>
                  </div>
                  <span className={`num shrink-0 rounded border px-2 py-0.5 text-[10px] font-bold tracking-wide ${VERDICT_STYLES[p.tone]}`}>
                    {p.verdict}
                  </span>
                </div>
                <p className="num text-[12px] text-ink-2 mt-3.5 border-t border-line pt-3">{p.stat}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Final CTA ── */}
      <section className="noise relative overflow-hidden bg-pine-950">
        <div className="absolute inset-0 overflow-hidden pointer-events-none" aria-hidden="true">
          <div className="aurora-blob aurora-emerald w-[700px] h-[700px] -bottom-80 left-1/2 -translate-x-1/2" />
          <div className="aurora-blob aurora-gem w-[440px] h-[440px] -top-40 -right-40" />
        </div>
        <div className="relative mx-auto max-w-[1360px] px-6 py-28 text-center">
          <h2 className="reveal font-display text-[clamp(36px,5.2vw,68px)] leading-[1.06] font-medium text-white">
            See every rupee
            <br />
            before you <em className="text-aurora not-italic">lend</em>.
          </h2>
          <div className="reveal d1 mt-9 flex items-center justify-center">
            <Link
              to="/login"
              className="group inline-flex items-center gap-2 rounded-md bg-[#7fd4ac] text-pine-950 text-[15px] font-semibold px-7 py-3.5 hover:bg-[#a5e3c6] transition-colors"
            >
              Open the console
              <Icon name="chevron-right" size={15} className="transition-transform group-hover:translate-x-0.5" />
            </Link>
          </div>
          <p className="reveal d2 num mt-6 text-[11.5px] text-white/40">
            demo access — officer@parakh.demo · Officer@2026
          </p>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className="border-t border-white/8 bg-pine-950">
        <div className="mx-auto max-w-[1360px] px-6 py-10 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
          <div>
            <Logo height={22} theme="dark" />
            <p className="text-[11.5px] text-white/35 mt-2.5">
              परख — to assay, to test. · IDBI Innovate 2026 · Track 3
            </p>
          </div>
          <p className="num text-[11px] text-white/30">
            Demo environment · synthetic data only · no real credit decisions
          </p>
        </div>
      </footer>
    </div>
  )
}

/* ── bento shell: graphic stage on top, copy below (all graphics are
      hand-built miniatures of the real console components) ────────────── */

function FeatureCard({
  title,
  sub,
  delay,
  zone = 'h-60 pt-10',
  children,
}: {
  title: string
  sub: string
  delay?: string
  /** fixed graphic window (height + top offset) — identical per row so every
      panel shows the exact same visible height before the separator clips it */
  zone?: string
  children: ReactNode
}) {
  return (
    <div
      className={`reveal ${delay ?? ''} group relative overflow-hidden rounded-2xl border border-white/10 bg-white/[0.04] transition-colors duration-500 hover:border-white/22`}
    >
      <div className={`bento-tex relative flex justify-center overflow-hidden px-6 ${zone}`}>
        <div className="relative h-fit transition-transform duration-500 ease-out group-hover:-translate-y-2">
          {children}
        </div>
      </div>
      <div className="relative border-t border-white/8 p-7 pt-5">
        <h3 className="font-display text-[19px] font-semibold text-white">{title}</h3>
        <p className="mt-2 text-[13px] leading-relaxed text-white/50">{sub}</p>
      </div>
    </div>
  )
}

const PANEL_SHADOW = 'shadow-[0_24px_50px_-20px_rgba(0,0,0,0.7)]'

/** Verification tab in miniature — fraud flags + gated index. */
function TriangulationGraphic() {
  return (
    <div className={`relative w-[300px] rounded-lg border border-line bg-card p-3.5 ${PANEL_SHADOW}`}>
      <p className="num text-[9px] uppercase tracking-[0.13em] text-ink-3">
        Triangulation · Rathore Textiles
      </p>
      <div className="gfx-pop gfx-d1 mt-2.5 rounded-r border-l-2 border-crit bg-crit-bg px-2.5 py-1.5">
        <div className="flex items-center justify-between">
          <p className="num text-[9.5px] font-bold text-crit">FRAUD FLAG — CIRCULAR_ROUTING</p>
          <span className="num rounded bg-crit px-1 py-px text-[8px] font-bold text-white">HIGH</span>
        </div>
        <p className="text-[9px] text-ink-2 mt-0.5">18% of credited value returns to counterparties</p>
      </div>
      <div className="gfx-pop gfx-d2 mt-1.5 rounded-r border-l-2 border-warn bg-warn-bg px-2.5 py-1.5">
        <div className="flex items-center justify-between">
          <p className="num text-[9.5px] font-bold text-warn">WINDOW_DRESSING</p>
          <span className="num rounded bg-warn px-1 py-px text-[8px] font-bold text-white">MED</span>
        </div>
      </div>
      <div className="mt-2.5 flex items-center gap-2 border-t border-line pt-2.5">
        <p className="num text-[9px] text-ink-3 shrink-0">VERIFICATION INDEX</p>
        <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-line">
          <div className="gfx-fill gfx-d3 h-full w-[19%] rounded-full bg-crit" />
        </div>
        <p className="num text-[10px] font-bold text-crit shrink-0">19/100</p>
      </div>
      <div className="mt-2.5 space-y-1.5 border-t border-line pt-2.5">
        {[
          { k: 'GST ↔ BANK RATIO', v: '2.9× inflated', bad: true },
          { k: 'PAYROLL PLAUSIBILITY', v: 'clear ✓', bad: false },
          { k: 'BALANCE & FILING DRIFT', v: 'clear ✓', bad: false },
        ].map((row, i) => (
          <div key={row.k} className={`gfx-pop gfx-d${i + 4} flex items-center justify-between`}>
            <p className="num text-[9px] text-ink-3">{row.k}</p>
            <p className={`num text-[9px] font-semibold ${row.bad ? 'text-crit' : 'text-good'}`}>{row.v}</p>
          </div>
        ))}
      </div>
      <div className="gfx-pop gfx-d6 absolute -top-3 -right-3.5 rotate-2 rounded border border-line bg-card px-2 py-1 shadow-[0_10px_24px_-10px_rgba(0,0,0,0.5)]">
        <p className="num text-[9px] font-bold text-crit">score gated ✕</p>
      </div>
    </div>
  )
}

/** Assessment header in miniature — dial, checks, decision row. */
function DecisionGraphic() {
  return (
    <div className={`w-[300px] rounded-lg border border-line bg-card p-3.5 ${PANEL_SHADOW}`}>
      <div className="flex items-center justify-between">
        <p className="num text-[9px] uppercase tracking-[0.13em] text-ink-3">
          Business health · 300–900
        </p>
        <span className="num rounded-full bg-good-bg px-1.5 py-0.5 text-[8.5px] font-bold text-good">
          Low risk
        </span>
      </div>
      <div className="mt-1.5 flex items-center gap-4">
        <MiniDialLight className="w-24 shrink-0" />
        <div className="min-w-0 flex-1 space-y-1.5">
          <div>
            <p className="num text-[8.5px] text-ink-3">VERIFICATION 92/100</p>
            <div className="mt-0.5 h-1 overflow-hidden rounded-full bg-line">
              <div className="gfx-fill gfx-d1 h-full w-[92%] rounded-full bg-pine-600" />
            </div>
          </div>
          <div>
            <p className="num text-[8.5px] text-ink-3">PD · 12 MONTHS</p>
            <p className="num text-[13px] font-semibold text-ink leading-tight">0.1%</p>
          </div>
        </div>
      </div>
      <div className="mt-2.5 flex items-center gap-1.5 border-t border-line pt-2.5">
        <span className="gfx-pop gfx-d2 num whitespace-nowrap rounded bg-pine-700 px-2 py-1 text-[9px] font-semibold text-white">
          ✓ Approve
        </span>
        <span className="gfx-pop gfx-d3 num whitespace-nowrap rounded border border-line-2 px-2 py-1 text-[9px] text-ink-2">
          Conditional
        </span>
        <span className="gfx-pop gfx-d4 num whitespace-nowrap rounded bg-warn px-2 py-1 text-[9px] font-semibold text-white">Refer</span>
        <span className="gfx-pop gfx-d5 num whitespace-nowrap rounded bg-crit px-2 py-1 text-[9px] font-semibold text-white">Reject</span>
      </div>
      <p className="num mt-2 text-[8.5px] text-ink-3">engine: approve · limit ₹6L · DSCR 2.47×</p>
    </div>
  )
}

/** Stress tab in miniature — depletion curve crossing the threshold. */
function StressGraphic() {
  return (
    <div className={`w-[300px] rounded-lg border border-line bg-card p-3.5 ${PANEL_SHADOW}`}>
      <div className="flex items-center justify-between">
        <p className="num text-[9px] uppercase tracking-[0.13em] text-ink-3">
          Stress outlook · Balaji Auto
        </p>
        <span className="num rounded-full bg-warn-bg px-1.5 py-0.5 text-[8.5px] font-bold text-warn">
          4 EWS signals
        </span>
      </div>
      <div className="mt-2 grid grid-cols-2 gap-2">
        <div className="gfx-pop gfx-d1 rounded border border-line bg-well px-2 py-1.5">
          <p className="num text-[8px] text-ink-3">PD · 12M</p>
          <p className="num text-[14px] font-semibold text-crit leading-tight">99.0%</p>
        </div>
        <div className="gfx-pop gfx-d2 rounded border border-line bg-well px-2 py-1.5">
          <p className="num text-[8px] text-ink-3">FIRST BREACH</p>
          <p className="num text-[14px] font-semibold text-warn leading-tight">Jul '26</p>
        </div>
      </div>
      <svg viewBox="0 0 240 74" fill="none" className="mt-2 w-full">
        <line x1="0" y1="52" x2="240" y2="52" stroke="#b42318" strokeWidth="1" strokeDasharray="4 4" opacity="0.6" />
        <text x="184" y="48" fill="#b42318" fontSize="7" fontFamily="var(--font-mono)" opacity="0.8">
          buffer floor
        </text>
        <path
          d="M0 14C24 16 44 20 68 24S116 34 140 41 196 56 240 66"
          pathLength={300}
          className="gfx-draw"
          stroke="#9a5b00"
          strokeWidth="2"
          strokeLinecap="round"
        />
        <path
          d="M0 14C24 16 44 20 68 24S116 34 140 41 196 56 240 66V74H0Z"
          fill="url(#stress-fade)"
          opacity="0.3"
        />
        <circle cx="182" cy="52" r="3.5" fill="#b42318" className="gfx-pop gfx-d5" />
        <defs>
          <linearGradient id="stress-fade" x1="0" y1="0" x2="0" y2="1">
            <stop stopColor="#9a5b00" />
            <stop offset="1" stopColor="#9a5b00" stopOpacity="0" />
          </linearGradient>
        </defs>
      </svg>
      <p className="num mt-1 text-[8.5px] text-ink-3">
        drivers: declining inflows · EMI bounces · GST filing delays
      </p>
    </div>
  )
}

/** Credit memo in miniature — prose skeleton with live citation chips. */
function MemoGraphic() {
  const chip = (t: string, d: string) => (
    <span className={`${d} gfx-pop num rounded border border-pine-100 bg-pine-50 px-1 text-[8.5px] font-semibold text-pine-700`}>
      {t}
    </span>
  )
  const bar = (w: string) => <span className={`h-1.5 ${w} rounded-full bg-line`} />
  return (
    <div className={`w-[380px] rounded-lg border border-line bg-card p-4 ${PANEL_SHADOW}`}>
      <p className="num text-[10.5px] font-bold text-ink">
        Credit Assessment Memo — PRK-2026-000001
      </p>
      <p className="num mt-0.5 text-[8.5px] text-ink-3">
        auto-drafted · engine v1.0.0 · 04 Jun 2026, 00:54 UTC
      </p>
      <div className="mt-3 space-y-2">
        <p className="num text-[8.5px] font-bold uppercase tracking-[0.1em] text-ink-2">
          2. Verified cash flows
        </p>
        <div className="flex items-center gap-1.5">{bar('w-20')}{chip('aa.stmt.7', 'gfx-d1')}{bar('w-14')}{bar('w-24')}</div>
        <div className="flex items-center gap-1.5">{bar('w-32')}{chip('gst.3b.q3', 'gfx-d2')}{bar('w-10')}</div>
        <div className="flex items-center gap-1.5">{bar('w-16')}{bar('w-12')}{chip('epfo.m12', 'gfx-d3')}{bar('w-20')}</div>
        <div className="flex items-center gap-1.5">{bar('w-28')}{bar('w-16')}</div>
      </div>
      <div className="mt-3 flex items-center justify-between border-t border-line pt-2.5">
        <p className="num text-[9px] text-good font-semibold">✓ every figure cited to its consented pull</p>
        <span className="gfx-pop gfx-d4 num rotate-[-2deg] rounded border border-good/40 bg-good-bg px-1.5 py-0.5 text-[8px] font-bold text-good">
          AUDIT-READY
        </span>
      </div>
    </div>
  )
}

/** Borrower Health Card in miniature — masthead, dial, seal, offer. */
function HealthCardGraphic() {
  return (
    <div className={`w-[340px] overflow-hidden rounded-lg border border-line bg-card ${PANEL_SHADOW}`}>
      <div className="px-4 pb-3.5 pt-4 text-center">
        <p className="num text-[8px] uppercase tracking-[0.16em] text-pine-700">
          MSME Financial Health Card
        </p>
        <p className="font-display mt-1 text-[14px] font-semibold text-ink">
          Saraswati Kirana &amp; General Stores
        </p>
        <div className="mt-2 flex items-center justify-center gap-7">
          <MiniDialLight className="w-22" />
          <div className="flex flex-col items-center gap-1">
            <span className="gfx-pop gfx-d2 flex size-9 items-center justify-center rounded-full border border-dashed border-pine-600 bg-good-bg">
              <Icon name="check" size={14} className="text-good" />
            </span>
            <p className="num text-[8px] text-good font-semibold">● Verified</p>
          </div>
        </div>
        <p className="gfx-pop gfx-d3 num mx-auto mt-2 w-fit rounded-full border border-good/30 bg-good-bg px-2.5 py-1 text-[9px] font-semibold text-good">
          Pre-qualified · ₹6L working capital
        </p>
        <div className="mt-3 grid grid-cols-2 gap-2 border-t border-line pt-2.5 text-left">
          <div>
            <p className="num text-[8px] uppercase tracking-[0.12em] text-ink-3">Top strength</p>
            <p className="text-[9.5px] text-ink-2 mt-0.5">Cash flows cover obligations 2.4×</p>
          </div>
          <div>
            <p className="num text-[8px] uppercase tracking-[0.12em] text-ink-3">Watch-out</p>
            <p className="text-[9.5px] text-ink-2 mt-0.5">Top customer is 34% of revenue</p>
          </div>
        </div>
      </div>
    </div>
  )
}

/** Ink-on-paper score dial used inside the light miniatures. */
function MiniDialLight({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 200 118" fill="none" className={className} aria-hidden="true">
      <path
        d="M22 104A78 78 0 0 1 178 104"
        stroke="#e7e4da"
        strokeWidth="11"
        strokeLinecap="round"
      />
      <path
        d="M22 104A78 78 0 0 1 178 104"
        pathLength={100}
        strokeDasharray="100"
        strokeDashoffset="32.6"
        className="gfx-dial"
        stroke="url(#mini-dial-grad)"
        strokeWidth="11"
        strokeLinecap="round"
      />
      <defs>
        <linearGradient id="mini-dial-grad" x1="22" y1="104" x2="178" y2="104" gradientUnits="userSpaceOnUse">
          <stop stopColor="#135c3e" />
          <stop offset="1" stopColor="#199365" />
        </linearGradient>
      </defs>
      <text
        x="100"
        y="84"
        textAnchor="middle"
        fill="#1c1b17"
        fontSize="40"
        fontWeight="600"
        fontFamily="var(--font-mono)"
      >
        704
      </text>
      <rect x="80" y="93" width="40" height="21" rx="4" fill="#107a52" />
      <text
        x="100"
        y="108.5"
        textAnchor="middle"
        fill="#ffffff"
        fontSize="13"
        fontWeight="700"
        fontFamily="var(--font-mono)"
      >
        B+
      </text>
    </svg>
  )
}
