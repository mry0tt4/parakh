/* ── Parakh typed API client ─────────────────────────────────────────────
   Single point of contact with the backend (docs/API-CONTRACT.md v1).
   Every fetch in the app flows through request() below, so contract
   mismatches can be fixed in exactly one place.                          */

import type {
  ApplicationDetail,
  ApplicationListItem,
  ApplicationStatus,
  AssessmentDetail,
  AuditEvent,
  CashflowResponse,
  Consent,
  ConsentSource,
  Decision,
  HealthCard,
  HealthResponse,
  LoginResponse,
  MemoResponse,
  MetaEnums,
  NewApplicationPayload,
  Paginated,
  PortfolioAlert,
  PortfolioSummary,
  TimelineEvent,
  Transaction,
  User,
} from './types'

const BASE = '/api/v1'
const TOKEN_KEY = 'parakh.access_token'
const USER_KEY = 'parakh.user'

export class ApiError extends Error {
  readonly status: number

  constructor(status: number, message: string) {
    super(message)
    this.name = 'ApiError'
    this.status = status
  }
}

/* ── session storage ─────────────────────────────────────────────────── */

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY)
}

export function setSession(token: string, user: User): void {
  localStorage.setItem(TOKEN_KEY, token)
  localStorage.setItem(USER_KEY, JSON.stringify(user))
}

export function clearSession(): void {
  localStorage.removeItem(TOKEN_KEY)
  localStorage.removeItem(USER_KEY)
}

export function getStoredUser(): User | null {
  const raw = localStorage.getItem(USER_KEY)
  if (!raw) return null
  try {
    return JSON.parse(raw) as User
  } catch {
    return null
  }
}

/* ── core request ────────────────────────────────────────────────────── */

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'
  body?: unknown
  /** Skip the automatic redirect-to-login on 401 (used by the login call itself). */
  noAuthRedirect?: boolean
}

async function request<T>(path: string, opts: RequestOptions = {}): Promise<T> {
  const headers: Record<string, string> = { Accept: 'application/json' }
  const token = getToken()
  if (token) headers['Authorization'] = `Bearer ${token}`
  if (opts.body !== undefined) headers['Content-Type'] = 'application/json'

  let res: Response
  try {
    res = await fetch(`${BASE}${path}`, {
      method: opts.method ?? 'GET',
      headers,
      body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
    })
  } catch {
    throw new ApiError(0, 'Network error — is the Parakh API running on :8000?')
  }

  if (res.status === 401 && !opts.noAuthRedirect) {
    clearSession()
    if (window.location.pathname !== '/login') {
      window.location.assign('/login')
    }
    throw new ApiError(401, 'Session expired. Please sign in again.')
  }

  if (!res.ok) {
    let detail = `Request failed (${res.status})`
    try {
      const payload = (await res.json()) as { detail?: unknown }
      if (typeof payload.detail === 'string') detail = payload.detail
      else if (payload.detail !== undefined) detail = JSON.stringify(payload.detail)
    } catch {
      /* non-JSON error body — keep default message */
    }
    throw new ApiError(res.status, detail)
  }

  if (res.status === 204) return undefined as T
  return (await res.json()) as T
}

function qs(params: Record<string, string | number | undefined>): string {
  const search = new URLSearchParams()
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== '') search.set(key, String(value))
  }
  const s = search.toString()
  return s ? `?${s}` : ''
}

/* ── endpoints ───────────────────────────────────────────────────────── */

export const api = {
  /* auth */
  login(email: string, password: string): Promise<LoginResponse> {
    return request<LoginResponse>('/auth/login', {
      method: 'POST',
      body: { email, password },
      noAuthRedirect: true,
    })
  },
  me(): Promise<User> {
    return request<User>('/auth/me')
  },

  /* applications */
  listApplications(params: {
    status?: ApplicationStatus | ''
    search?: string
    page?: number
    page_size?: number
  } = {}): Promise<Paginated<ApplicationListItem>> {
    return request<Paginated<ApplicationListItem>>(`/applications${qs(params)}`)
  },
  createApplication(payload: NewApplicationPayload): Promise<ApplicationDetail> {
    return request<ApplicationDetail>('/applications', { method: 'POST', body: payload })
  },
  getApplication(id: string): Promise<ApplicationDetail> {
    return request<ApplicationDetail>(`/applications/${id}`)
  },
  requestConsents(id: string, sources: ConsentSource[]): Promise<{ consents: Consent[] }> {
    return request<{ consents: Consent[] }>(`/applications/${id}/consents`, {
      method: 'POST',
      body: { sources },
    })
  },
  approveConsent(id: string, consentId: string): Promise<Consent> {
    return request<Consent>(`/applications/${id}/consents/${consentId}/approve`, {
      method: 'POST',
    })
  },
  runAssessment(id: string): Promise<AssessmentDetail> {
    return request<AssessmentDetail>(`/applications/${id}/assess`, { method: 'POST' })
  },
  getAssessment(id: string): Promise<AssessmentDetail> {
    return request<AssessmentDetail>(`/applications/${id}/assessment`)
  },
  getMemo(id: string): Promise<MemoResponse> {
    return request<MemoResponse>(`/applications/${id}/memo`)
  },
  decide(id: string, decision: Decision, note: string): Promise<ApplicationDetail> {
    return request<ApplicationDetail>(`/applications/${id}/decision`, {
      method: 'POST',
      body: { decision, note },
    })
  },
  getCashflow(id: string): Promise<CashflowResponse> {
    return request<CashflowResponse>(`/applications/${id}/cashflow`)
  },
  getTransactions(
    id: string,
    params: { month?: string; page?: number; page_size?: number } = {},
  ): Promise<Paginated<Transaction>> {
    return request<Paginated<Transaction>>(`/applications/${id}/transactions${qs(params)}`)
  },
  getTimeline(id: string): Promise<{ items: TimelineEvent[] }> {
    return request<{ items: TimelineEvent[] }>(`/applications/${id}/timeline`)
  },
  getHealthCard(id: string): Promise<HealthCard> {
    return request<HealthCard>(`/applications/${id}/healthcard`)
  },

  /* portfolio */
  portfolioSummary(): Promise<PortfolioSummary> {
    return request<PortfolioSummary>('/portfolio/summary')
  },
  portfolioAlerts(): Promise<{ items: PortfolioAlert[] }> {
    return request<{ items: PortfolioAlert[] }>('/portfolio/alerts')
  },

  /* audit */
  audit(params: {
    page?: number
    page_size?: number
    action?: string
    actor?: string
  } = {}): Promise<Paginated<AuditEvent>> {
    return request<Paginated<AuditEvent>>(`/audit${qs(params)}`)
  },

  /* meta */
  health(): Promise<HealthResponse> {
    return request<HealthResponse>('/health')
  },
  enums(): Promise<MetaEnums> {
    return request<MetaEnums>('/meta/enums')
  },
}
