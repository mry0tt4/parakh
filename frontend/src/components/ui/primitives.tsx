import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode, SelectHTMLAttributes, TextareaHTMLAttributes } from 'react'
import { useEffect } from 'react'
import { Link } from 'react-router-dom'
import { ApiError } from '../../lib/api'
import { Icon } from './Icon'

/* ── Button ──────────────────────────────────────────────────────────── */

type ButtonVariant = 'primary' | 'outline' | 'ghost' | 'danger' | 'warn'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant
  size?: 'sm' | 'md'
  loading?: boolean
}

const VARIANT_CLS: Record<ButtonVariant, string> = {
  primary:
    'bg-pine-700 text-white border border-pine-700 hover:bg-pine-800 hover:border-pine-800 disabled:bg-ink-4 disabled:border-ink-4',
  outline:
    'bg-card text-ink border border-line-2 hover:border-ink-3 hover:bg-well disabled:text-ink-4',
  ghost: 'bg-transparent text-ink-2 border border-transparent hover:bg-black/5 disabled:text-ink-4',
  danger: 'bg-crit text-white border border-crit hover:brightness-90 disabled:opacity-50',
  warn: 'bg-warn text-white border border-warn hover:brightness-90 disabled:opacity-50',
}

export function Button({
  variant = 'outline',
  size = 'md',
  loading = false,
  className = '',
  children,
  disabled,
  ...rest
}: ButtonProps) {
  return (
    <button
      {...rest}
      disabled={disabled || loading}
      className={`inline-flex items-center justify-center gap-1.5 rounded font-semibold transition-colors duration-100 cursor-pointer disabled:cursor-not-allowed ${
        size === 'sm' ? 'h-7 px-2.5 text-[12px]' : 'h-8.5 px-3.5 text-[13px]'
      } ${VARIANT_CLS[variant]} ${className}`}
    >
      {loading && <Spinner className="size-3.5" />}
      {children}
    </button>
  )
}

/** A react-router Link dressed as a Button (for navigation actions). */
export function ButtonLink({
  to,
  variant = 'outline',
  size = 'md',
  className = '',
  title,
  children,
}: {
  to: string
  variant?: ButtonVariant
  size?: 'sm' | 'md'
  className?: string
  title?: string
  children: ReactNode
}) {
  return (
    <Link
      to={to}
      title={title}
      className={`inline-flex items-center justify-center gap-1.5 rounded font-semibold transition-colors duration-100 ${
        size === 'sm' ? 'h-7 px-2.5 text-[12px]' : 'h-8.5 px-3.5 text-[13px]'
      } ${VARIANT_CLS[variant]} ${className}`}
    >
      {children}
    </Link>
  )
}

export function Spinner({ className = 'size-4' }: { className?: string }) {
  return (
    <svg viewBox="0 0 16 16" fill="none" className={`animate-spin ${className}`} aria-hidden="true">
      <circle cx="8" cy="8" r="6.5" stroke="currentColor" strokeOpacity="0.25" strokeWidth="2" />
      <path d="M14.5 8A6.5 6.5 0 008 1.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  )
}

/* ── Card / layout ───────────────────────────────────────────────────── */

export function Card({
  children,
  className = '',
  title,
  aside,
}: {
  children: ReactNode
  className?: string
  title?: ReactNode
  aside?: ReactNode
}) {
  return (
    <section className={`bg-card border border-line rounded-md ${className}`}>
      {(title !== undefined || aside !== undefined) && (
        <header className="flex items-center justify-between gap-3 px-4 pt-3.5 pb-0">
          {typeof title === 'string' ? <h2 className="overline-label">{title}</h2> : title}
          {aside}
        </header>
      )}
      {children}
    </section>
  )
}

export function PageHeader({
  title,
  subtitle,
  actions,
}: {
  title: string
  subtitle?: ReactNode
  actions?: ReactNode
}) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-3 mb-5">
      <div>
        <h1 className="font-display text-[26px] font-semibold leading-tight text-ink">{title}</h1>
        {subtitle && <p className="text-[13px] text-ink-2 mt-0.5">{subtitle}</p>}
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  )
}

/* ── Skeleton / empty / error states ─────────────────────────────────── */

export function Skeleton({ className = 'h-4 w-full' }: { className?: string }) {
  return <div className={`skeleton ${className}`} aria-hidden="true" />
}

export function SkeletonRows({ rows = 5, className = '' }: { rows?: number; className?: string }) {
  return (
    <div className={`space-y-2.5 p-4 ${className}`}>
      {Array.from({ length: rows }, (_, i) => (
        <Skeleton key={i} className={`h-4 ${i % 3 === 0 ? 'w-full' : i % 3 === 1 ? 'w-5/6' : 'w-2/3'}`} />
      ))}
    </div>
  )
}

export function EmptyState({
  title,
  body,
  action,
  compact = false,
}: {
  title: string
  body?: string
  action?: ReactNode
  compact?: boolean
}) {
  return (
    <div className={`flex flex-col items-center justify-center text-center px-6 ${compact ? 'py-8' : 'py-16'}`}>
      <div className="size-10 rounded-md border border-line-2 bg-well flex items-center justify-center text-ink-3 mb-3">
        <Icon name="layers" size={18} />
      </div>
      <p className="text-[14px] font-semibold text-ink">{title}</p>
      {body && <p className="text-[12.5px] text-ink-3 mt-1 max-w-90">{body}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  )
}

export function ErrorState({
  error,
  onRetry,
  compact = false,
}: {
  error: ApiError | Error | string
  onRetry?: () => void
  compact?: boolean
}) {
  const message = typeof error === 'string' ? error : error.message
  const status = error instanceof ApiError ? error.status : null
  return (
    <div className={`flex flex-col items-center justify-center text-center px-6 ${compact ? 'py-8' : 'py-16'}`}>
      <div className="size-10 rounded-md border border-crit/30 bg-crit-bg flex items-center justify-center text-crit mb-3">
        <Icon name="alert" size={18} />
      </div>
      <p className="text-[14px] font-semibold text-ink">
        {status === 403 ? 'Not permitted' : 'Could not load data'}
      </p>
      <p className="text-[12.5px] text-ink-3 mt-1 max-w-90">{message}</p>
      {onRetry && (
        <div className="mt-4">
          <Button size="sm" onClick={onRetry}>
            <Icon name="refresh" size={13} /> Retry
          </Button>
        </div>
      )}
    </div>
  )
}

/* ── Dialog ──────────────────────────────────────────────────────────── */

export function Dialog({
  open,
  onClose,
  title,
  children,
  footer,
  width = 'max-w-md',
}: {
  open: boolean
  onClose: () => void
  title: string
  children: ReactNode
  footer?: ReactNode
  width?: string
}) {
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 p-4"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      <div className={`w-full ${width} bg-card border border-line-2 rounded-lg shadow-xl rise`}>
        <header className="flex items-center justify-between px-5 pt-4 pb-3 border-b border-line">
          <h2 className="font-display text-[17px] font-semibold text-ink">{title}</h2>
          <button
            onClick={onClose}
            className="text-ink-3 hover:text-ink cursor-pointer p-1 -m-1"
            aria-label="Close dialog"
          >
            <Icon name="x" size={14} />
          </button>
        </header>
        <div className="px-5 py-4">{children}</div>
        {footer && <footer className="flex justify-end gap-2 px-5 pb-4">{footer}</footer>}
      </div>
    </div>
  )
}

/* ── Form controls ───────────────────────────────────────────────────── */

export const inputCls =
  'w-full h-8.5 px-2.5 rounded border border-line-2 bg-card text-[13px] text-ink placeholder:text-ink-4 outline-none focus:border-pine-600 focus:ring-2 focus:ring-pine-600/15 transition-shadow'

export function Field({
  label,
  children,
  hint,
  required,
}: {
  label: string
  children: ReactNode
  hint?: string
  required?: boolean
}) {
  return (
    <label className="block">
      <span className="block text-[11.5px] font-semibold text-ink-2 mb-1">
        {label}
        {required && <span className="text-crit ml-0.5">*</span>}
      </span>
      {children}
      {hint && <span className="block text-[11px] text-ink-3 mt-1">{hint}</span>}
    </label>
  )
}

export function TextInput(props: InputHTMLAttributes<HTMLInputElement>) {
  const { className = '', ...rest } = props
  return <input {...rest} className={`${inputCls} ${className}`} />
}

export function Select(props: SelectHTMLAttributes<HTMLSelectElement>) {
  const { className = '', children, ...rest } = props
  return (
    <select {...rest} className={`${inputCls} appearance-none cursor-pointer ${className}`}>
      {children}
    </select>
  )
}

export function TextArea(props: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  const { className = '', ...rest } = props
  return (
    <textarea
      {...rest}
      className={`w-full px-2.5 py-2 rounded border border-line-2 bg-card text-[13px] text-ink placeholder:text-ink-4 outline-none focus:border-pine-600 focus:ring-2 focus:ring-pine-600/15 transition-shadow ${className}`}
    />
  )
}

/* ── Pagination ──────────────────────────────────────────────────────── */

export function Pagination({
  page,
  pageSize,
  total,
  onPage,
}: {
  page: number
  pageSize: number
  total: number
  onPage: (p: number) => void
}) {
  const pages = Math.max(1, Math.ceil(total / pageSize))
  const from = total === 0 ? 0 : (page - 1) * pageSize + 1
  const to = Math.min(total, page * pageSize)
  return (
    <div className="flex items-center justify-between px-4 py-2.5 border-t border-line text-[12px] text-ink-3">
      <span className="num">
        {from}–{to} of {total}
      </span>
      <div className="flex items-center gap-1">
        <Button size="sm" variant="ghost" disabled={page <= 1} onClick={() => onPage(page - 1)}>
          <Icon name="chevron-left" size={13} /> Prev
        </Button>
        <span className="num px-2">
          {page} / {pages}
        </span>
        <Button size="sm" variant="ghost" disabled={page >= pages} onClick={() => onPage(page + 1)}>
          Next <Icon name="chevron-right" size={13} />
        </Button>
      </div>
    </div>
  )
}

/* ── Table shell ─────────────────────────────────────────────────────── */

export function Th({ children, className = '' }: { children?: ReactNode; className?: string }) {
  return (
    <th
      className={`text-left text-[10.5px] font-semibold uppercase tracking-[0.12em] text-ink-3 px-3 py-2 border-b border-line-2 whitespace-nowrap ${className}`}
    >
      {children}
    </th>
  )
}

export function Td({ children, className = '' }: { children?: ReactNode; className?: string }) {
  return <td className={`px-3 py-2.5 border-b border-line align-middle ${className}`}>{children}</td>
}
