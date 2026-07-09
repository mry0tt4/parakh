import { useState } from 'react'
import type { FormEvent } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { ApiError } from '../lib/api'
import { useAuth } from '../lib/auth'
import { Logo } from '../components/Shell'
import { Button, Field, TextInput } from '../components/ui/primitives'
import { Icon } from '../components/ui/Icon'

/** Compact glass score dial: 704 · B+ with a self-drawing arc. */
function ScoreDial({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 200 118" fill="none" className={className} aria-hidden="true">
      <path
        d="M22 104A78 78 0 0 1 178 104"
        stroke="rgba(255,255,255,0.13)"
        strokeWidth="9"
        strokeLinecap="round"
      />
      <path
        d="M22 104A78 78 0 0 1 178 104"
        pathLength={100}
        className="arc-draw"
        stroke="url(#dial-grad)"
        strokeWidth="9"
        strokeLinecap="round"
      />
      <defs>
        <linearGradient id="dial-grad" x1="22" y1="104" x2="178" y2="104" gradientUnits="userSpaceOnUse">
          <stop stopColor="#199365" />
          <stop offset="1" stopColor="#7fd4ac" />
        </linearGradient>
      </defs>
      <text
        x="100"
        y="82"
        textAnchor="middle"
        fill="#ffffff"
        fontSize="38"
        fontWeight="600"
        fontFamily="var(--font-mono)"
      >
        704
      </text>
      <rect x="82" y="92" width="36" height="20" rx="4" fill="#107a52" opacity="0.95" />
      <text
        x="100"
        y="106.5"
        textAnchor="middle"
        fill="#ffffff"
        fontSize="12"
        fontWeight="700"
        fontFamily="var(--font-mono)"
      >
        B+
      </text>
    </svg>
  )
}

const DEMO_ACCOUNTS = [
  { role: 'Credit Officer', email: 'officer@parakh.demo', password: 'Officer@2026', desc: 'Originate, assess & decide up to ₹25L' },
  { role: 'Risk Head', email: 'risk@parakh.demo', password: 'Risk@2026', desc: 'Full decisioning, alerts & audit' },
  { role: 'Admin', email: 'admin@parakh.demo', password: 'Admin@2026', desc: 'Platform administration & audit' },
]

export function LoginPage() {
  const { login, isAuthenticated } = useAuth()
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  if (isAuthenticated) return <Navigate to="/" replace />

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      await login(email, password)
      navigate('/')
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Sign-in failed. Please try again.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="min-h-screen grid lg:grid-cols-[1.1fr_1fr]">
      {/* ── Brand panel ── */}
      <div className="brand-panel-texture noise relative hidden lg:flex flex-col justify-between p-12 text-white overflow-hidden">
        {/* atmosphere: aurora glows behind everything */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none" aria-hidden="true">
          <div className="aurora-blob aurora-emerald w-[560px] h-[560px] -top-40 -left-40" />
          <div className="aurora-blob aurora-gem w-[480px] h-[480px] top-1/3 -right-48" />
          <div className="aurora-blob aurora-brass w-[420px] h-[420px] -bottom-48 left-1/4" />
        </div>

        <div className="relative">
          <Logo height={24} theme="dark" />
        </div>

        <div className="relative max-w-130">
          <h1 className="font-display text-[44px] leading-[1.12] font-medium">
            Credit for MSMEs,
            <br />
            underwritten on <em className="text-[#7fd4ac] not-italic font-semibold">verified</em>
            <br />
            cash flows.
          </h1>
          <p className="mt-5 text-[15px] leading-relaxed text-white/65 max-w-105">
            Parakh triangulates GST filings, bank statements and EPFO payroll to score businesses
            that bureaus can't see — with a forward stress outlook and an audit-ready credit memo,
            drafted in minutes.
          </p>
        </div>

        {/* floating score artifact — the product's own output as the graphic */}
        <div className="absolute right-12 bottom-28 hidden xl:block" aria-hidden="true">
          <div className="glass-dark float-y relative w-[212px] p-3.5 rotate-[-2.5deg]">
            <div className="flex items-center justify-between">
              <p className="text-[9px] font-semibold tracking-[0.14em] uppercase text-white/45">
                Health score
              </p>
              <span className="inline-flex items-center gap-1 rounded-full bg-[#199365]/25 border border-[#7fd4ac]/30 px-1.5 py-0.5 text-[9px] font-semibold text-[#7fd4ac]">
                <Icon name="check" size={8} />
                Verified
              </span>
            </div>

            <ScoreDial className="mt-2 mx-auto w-[150px]" />

            <div className="mt-2 space-y-1.5 border-t border-white/10 pt-2">
              {[
                { k: 'GST ↔ Bank turnover', v: 'match 0.96' },
                { k: 'EPFO payroll', v: 'plausible' },
                { k: 'Circular flows', v: 'none found' },
              ].map((row) => (
                <div key={row.k} className="flex items-center justify-between text-[9.5px]">
                  <span className="text-white/55">{row.k}</span>
                  <span className="num flex items-center gap-1 text-[#7fd4ac]">
                    {row.v}
                    <Icon name="check" size={8} />
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div className="glass-dark float-y-slow absolute -left-24 bottom-3 w-[124px] p-2.5 rotate-[2deg]">
            <p className="text-[8.5px] font-semibold tracking-[0.14em] uppercase text-white/45">
              PD · 12 months
            </p>
            <p className="num mt-0.5 text-[19px] font-semibold text-white leading-none">0.1%</p>
            <svg viewBox="0 0 100 26" className="mt-1.5 w-full" fill="none">
              <path
                d="M0 8C10 8 14 5 24 6S42 14 52 13 70 9 80 11 94 19 100 20"
                stroke="#7fd4ac"
                strokeWidth="1.8"
                strokeLinecap="round"
                opacity="0.9"
              />
              <path
                d="M0 8C10 8 14 5 24 6S42 14 52 13 70 9 80 11 94 19 100 20V26H0Z"
                fill="url(#pd-fade)"
                opacity="0.35"
              />
              <defs>
                <linearGradient id="pd-fade" x1="0" y1="0" x2="0" y2="1">
                  <stop stopColor="#7fd4ac" />
                  <stop offset="1" stopColor="#7fd4ac" stopOpacity="0" />
                </linearGradient>
              </defs>
            </svg>
            <p className="text-[8.5px] text-white/40 mt-1">liquidity buffer · stable</p>
          </div>
        </div>

        <p className="relative text-[11px] text-white/35">
          IDBI Innovate 2026 · Demo environment · Synthetic data only
        </p>
      </div>

      {/* ── Form panel ── */}
      <div className="flex items-center justify-center bg-paper px-6 py-10">
        <div className="w-full max-w-95">
          <div className="lg:hidden mb-8">
            <Logo height={28} theme="light" />
          </div>

          <h2 className="font-display text-[24px] font-semibold text-ink">Officer sign in</h2>
          <p className="text-[13px] text-ink-2 mt-0 mb-7">Underwriting console access</p>

          <form onSubmit={submit} className="space-y-4">
            <Field label="Email" required>
              <TextInput
                type="email"
                autoComplete="username"
                placeholder="you@parakh.demo"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </Field>
            <Field label="Password" required>
              <TextInput
                type="password"
                autoComplete="current-password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </Field>

            {error && (
              <div className="flex items-start gap-2 text-[12.5px] text-crit bg-crit-bg border border-crit/25 rounded px-3 py-2.5">
                <Icon name="alert" size={14} className="mt-0.5 shrink-0" />
                {error}
              </div>
            )}

            <Button type="submit" variant="primary" loading={busy} className="w-full !h-10 text-[14px]">
              Sign in
            </Button>
          </form>

          <div className="mt-8">
            <p className="overline-label mb-2.5">Demo accounts — click to fill</p>
            <div className="border border-line rounded-md divide-y divide-line bg-card">
              {DEMO_ACCOUNTS.map((acc) => (
                <button
                  key={acc.email}
                  type="button"
                  onClick={() => {
                    setEmail(acc.email)
                    setPassword(acc.password)
                    setError(null)
                  }}
                  className="w-full flex items-center justify-between gap-3 px-3.5 py-2.5 text-left hover:bg-well cursor-pointer transition-colors group"
                >
                  <span>
                    <span className="block text-[12.5px] font-semibold text-ink">{acc.role}</span>
                    <span className="block text-[11px] text-ink-3">{acc.desc}</span>
                  </span>
                  <span className="num text-[11px] text-ink-3 group-hover:text-pine-700 shrink-0">
                    {acc.email}
                  </span>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
