/* ── Indian-market formatting helpers ────────────────────────────────── */

/** ₹ in compact lakh/crore notation: 1500000 → "₹15.0L", 21500000 → "₹2.15Cr". */
export function inr(value: number | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(value)) return '—'
  const sign = value < 0 ? '−' : ''
  const abs = Math.abs(value)
  if (abs >= 1_00_00_000) return `${sign}₹${trimZeros((abs / 1_00_00_000).toFixed(2))}Cr`
  if (abs >= 1_00_000) return `${sign}₹${trimZeros((abs / 1_00_000).toFixed(1))}L`
  if (abs >= 1_000) return `${sign}₹${(abs / 1_000).toFixed(1)}K`
  return `${sign}₹${abs.toLocaleString('en-IN')}`
}

/** Full Indian-grouped rupees: 1500000 → "₹15,00,000". */
export function inrFull(value: number | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(value)) return '—'
  const sign = value < 0 ? '−' : ''
  return `${sign}₹${Math.abs(Math.round(value)).toLocaleString('en-IN')}`
}

function trimZeros(s: string): string {
  return s.replace(/\.?0+$/, '')
}

/** 0.11 → "11.0%" */
export function pct(fraction: number | null | undefined, digits = 1): string {
  if (fraction === null || fraction === undefined || Number.isNaN(fraction)) return '—'
  return `${(fraction * 100).toFixed(digits)}%`
}

const MONTHS_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

/** ISO date/datetime → "01 Jul 2026". */
export function fmtDate(iso: string | null | undefined): string {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return `${String(d.getUTCDate()).padStart(2, '0')} ${MONTHS_SHORT[d.getUTCMonth()]} ${d.getUTCFullYear()}`
}

/** ISO datetime → "01 Jul 2026, 06:14 UTC". */
export function fmtDateTime(iso: string | null | undefined): string {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  const hh = String(d.getUTCHours()).padStart(2, '0')
  const mm = String(d.getUTCMinutes()).padStart(2, '0')
  return `${fmtDate(iso)}, ${hh}:${mm} UTC`
}

/** "2026-08" → "Aug ’26". */
export function fmtMonth(ym: string | null | undefined): string {
  if (!ym) return '—'
  const [y, m] = ym.split('-')
  const mi = Number(m) - 1
  if (!y || mi < 0 || mi > 11) return ym
  return `${MONTHS_SHORT[mi]} ’${y.slice(2)}`
}

/** Relative time for feeds: "4h ago", "3d ago". */
export function timeAgo(iso: string): string {
  const then = new Date(iso).getTime()
  if (Number.isNaN(then)) return iso
  const secs = Math.max(0, Math.floor((Date.now() - then) / 1000))
  if (secs < 60) return 'just now'
  const mins = Math.floor(secs / 60)
  if (mins < 60) return `${mins}m ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  if (days < 30) return `${days}d ago`
  return fmtDate(iso)
}

/** Title-case a snake_case token: "working_capital" → "Working Capital".
 * Null-safe: system events (e.g. failed logins) carry no actor role. */
export function unSnake(s: string | null | undefined): string {
  if (!s) return '—'
  return s
    .split('_')
    .map((w) => (w ? w[0]!.toUpperCase() + w.slice(1) : w))
    .join(' ')
}

/** Truncate a hash for display: "ab12cd…" (first 12 chars). */
export function shortHash(hash: string, len = 12): string {
  return hash.length <= len ? hash : `${hash.slice(0, len)}…`
}

/** Format a metric value with its unit ("INR" gets lakh/crore treatment). */
export function metricValue(value: number | string | null, unit: string | null): string {
  if (value === null || value === undefined) return '—'
  if (typeof value === 'string') return value
  if (unit === 'INR') return inr(value)
  if (unit === '%' || unit === 'percent') return `${value.toFixed(1)}%`
  if (unit === 'ratio' || unit === 'x') return `${value.toFixed(2)}×`
  const num = Number.isInteger(value) ? value.toLocaleString('en-IN') : value.toFixed(2)
  return unit ? `${num} ${unit}` : num
}
