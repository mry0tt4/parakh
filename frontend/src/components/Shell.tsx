import { useId, type ReactNode } from 'react'
import { Navigate, NavLink, Outlet, useNavigate } from 'react-router-dom'
import { useAuth } from '../lib/auth'
import { Icon } from './ui/Icon'
import { RoleChip } from './ui/badges'

/** Brand icon: the faceted-gem mark cropped from the lockup artwork
 * (/public/logo-{light,dark}.svg — icon occupies the square viewBox
 * 200.37 626.35 222 222). Use on its own for compact spots — nav rails,
 * accent corners — where the full wordmark lockup would be too wide.
 * `theme="dark"` picks the file drawn for placement on dark surfaces. */
export function BrandMark({ size = 28, theme = 'dark' }: { size?: number; theme?: 'light' | 'dark' }) {
  const uid = useId()
  const clip = `pk-icon-clip-${uid}`
  return (
    <svg width={size} height={size} viewBox="0 0 222 222" aria-hidden="true">
      <defs>
        <clipPath id={clip}>
          <rect width="222" height="222" />
        </clipPath>
      </defs>
      <g clipPath={`url(#${clip})`}>
        <image
          href={`/logo-${theme}.svg`}
          x={-200.37}
          y={-626.35}
          width="1088.37"
          height="222"
        />
      </g>
    </svg>
  )
}

/** Full lockup — icon + "Parakh" wordmark, as one image.
 * `theme="light"` (dark ink, for paper/white surfaces) or
 * `theme="dark"` (white ink, for the pine-textured surfaces). */
export function Logo({ height = 28, theme = 'dark', className }: { height?: number; theme?: 'light' | 'dark'; className?: string }) {
  return (
    <img
      src={`/logo-${theme}.svg`}
      alt="Parakh"
      height={height}
      style={{ height, width: 'auto' }}
      className={className}
    />
  )
}

function NavItem({ to, icon, label, end = false }: { to: string; icon: string; label: string; end?: boolean }) {
  return (
    <NavLink
      to={to}
      end={end}
      className={({ isActive }) =>
        `flex items-center gap-2.5 px-3 h-9 rounded text-[13px] font-medium transition-colors duration-100 ${
          isActive
            ? 'bg-white/10 text-white border-l-2 border-pine-500 rounded-l-none'
            : 'text-white/55 hover:text-white/90 hover:bg-white/5 border-l-2 border-transparent rounded-l-none'
        }`
      }
    >
      <Icon name={icon} size={15} />
      {label}
    </NavLink>
  )
}

export function Shell() {
  const { user, isAuthenticated, logout } = useAuth()
  const navigate = useNavigate()

  if (!isAuthenticated) return <Navigate to="/welcome" replace />

  const canAudit = user?.role === 'risk_head' || user?.role === 'admin'

  return (
    <div className="min-h-screen bg-paper">
      {/* ── Sidebar ── */}
      <aside className="fixed inset-y-0 left-0 w-57 bg-pine-950 flex flex-col z-40">
        <div className="flex items-center px-4 h-16">
          <Logo height={22} theme="dark" />
        </div>
        <div className="mx-4 h-px bg-white/8" />

        <nav className="flex-1 px-2.5 py-4 space-y-0.5">
          <p className="overline-label px-3 pb-2 !text-white/35">Underwriting</p>
          <NavItem to="/" icon="grid" label="Portfolio" end />
          <NavItem to="/applications" icon="file" label="Applications" />
          <NavItem to="/applications/new" icon="plus" label="New Application" />
          {canAudit && (
            <>
              <p className="overline-label px-3 pt-5 pb-2 !text-white/35">Oversight</p>
              <NavItem to="/audit" icon="shield" label="Audit Log" />
            </>
          )}
        </nav>

        <div className="mx-4 h-px bg-white/8" />
        <div className="px-3 py-3">
          <div className="flex items-center gap-2.5 px-1">
            <div className="size-8 rounded-full bg-pine-700 text-white flex items-center justify-center text-[12px] font-bold shrink-0">
              {user?.full_name
                ?.split(' ')
                .map((w) => w[0])
                .slice(0, 2)
                .join('') ?? '·'}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[12.5px] font-semibold text-white truncate">{user?.full_name}</p>
              <RoleChip role={user?.role ?? ''} />
            </div>
            <button
              onClick={() => {
                logout()
                navigate('/login')
              }}
              className="text-white/40 hover:text-white cursor-pointer p-1.5 -m-1"
              title="Sign out"
              aria-label="Sign out"
            >
              <Icon name="logout" size={15} />
            </button>
          </div>
        </div>
      </aside>

      {/* ── Content ── */}
      <main className="ml-57 min-h-screen">
        <div className="max-w-300 mx-auto px-7 py-6">
          <Outlet />
        </div>
      </main>
    </div>
  )
}

/** Route guard for role-limited pages (audit). */
export function RequireRole({ roles, children }: { roles: string[]; children: ReactNode }) {
  const { user } = useAuth()
  if (!user || !roles.includes(user.role)) return <Navigate to="/" replace />
  return <>{children}</>
}
