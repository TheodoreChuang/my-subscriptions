import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('next/headers', () => ({
  headers: vi.fn().mockResolvedValue(new Headers()),
}))

vi.mock('@/infrastructure/auth', () => ({
  authCapability: { getSession: vi.fn(), requireSession: vi.fn(), signOut: vi.fn() },
  auth: {},
}))

const mockExchangeCode = vi.fn()
const mockSaveCalendarTokens = vi.fn()

vi.mock('@/infrastructure', () => ({
  googleCalendarClient: { exchangeCode: mockExchangeCode },
  postgresCalendarRepository: {},
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}))

vi.mock('@/modules', () => ({
  saveCalendarTokens: mockSaveCalendarTokens,
}))

vi.mock('@/shared/env', () => ({
  env: {
    NODE_ENV: 'test',
    BETTER_AUTH_URL: 'http://localhost:3000',
    BETTER_AUTH_SECRET: 'a-very-long-secret-for-testing-purposes-only-32ch',
    GOOGLE_CLIENT_ID: 'test-client-id',
    GOOGLE_CLIENT_SECRET: 'test-client-secret',
  },
}))

const { authCapability } = await import('@/infrastructure/auth')
const mockGetSession = authCapability.getSession as ReturnType<typeof vi.fn>

// Import stateToken so we can generate valid state cookies for tests
const { signState, STATE_COOKIE } = await import('@/app/api/integrations/google-calendar/stateToken')
const { GET } = await import('@/app/api/integrations/google-calendar/callback/route')

const FUTURE = new Date(Date.now() + 3600 * 1000)
const validTokens = {
  accessToken: 'at',
  refreshToken: 'rt',
  expiresAt: FUTURE,
}

const validSession = {
  user: { id: 'u1', name: 'Alice', email: 'a@a.com' },
  session: { id: 's1', expiresAt: FUTURE, userId: 'u1' },
}

function makeRequest(params: Record<string, string>, stateCookieValue?: string): NextRequest {
  const url = new URL('http://localhost:3000/api/integrations/google-calendar/callback')
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v)
  const req = new NextRequest(url)
  if (stateCookieValue !== undefined) {
    Object.defineProperty(req, 'cookies', {
      value: {
        get: (name: string) => name === STATE_COOKIE ? { value: stateCookieValue } : undefined,
      },
    })
  } else {
    Object.defineProperty(req, 'cookies', {
      value: { get: () => undefined },
    })
  }
  return req
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('GET /api/integrations/google-calendar/callback', () => {
  it('redirects to /onboarding?calendar_error=denied on access_denied', async () => {
    const req = makeRequest({ error: 'access_denied' })
    const res = await GET(req)
    expect(res.headers.get('location')).toContain('/onboarding?calendar_error=denied')
  })

  it('returns 400 when code is missing', async () => {
    const state = signState('u1')
    const req = makeRequest({}, state)
    const res = await GET(req)
    expect(res.status).toBe(400)
  })

  it('redirects to /onboarding?error=session_lost when state cookie is absent', async () => {
    const req = makeRequest({ code: 'code123' })
    const res = await GET(req)
    expect(res.headers.get('location')).toContain('/onboarding?error=session_lost')
  })

  it('returns 403 on tampered state', async () => {
    const req = makeRequest({ code: 'code' }, 'tampered.deadbeef')
    const res = await GET(req)
    expect(res.status).toBe(403)
  })

  it('returns 403 on expired state TTL', async () => {
    // Simulate expired state by mocking Date.now temporarily
    const originalNow = Date.now
    const state = signState('u1')
    Date.now = () => originalNow() + 400_000 // advance past 300s TTL
    try {
      const req = makeRequest({ code: 'code' }, state)
      const res = await GET(req)
      expect(res.status).toBe(403)
    } finally {
      Date.now = originalNow
    }
  })

  it('redirects to /sign-in when session is revoked between connect and callback', async () => {
    const state = signState('u1')
    mockGetSession.mockResolvedValue(null)
    const req = makeRequest({ code: 'code' }, state)
    const res = await GET(req)
    expect(res.headers.get('location')).toContain('/sign-in')
  })

  it('redirects to /onboarding?calendar_error=config_error when refresh_token is absent', async () => {
    const state = signState('u1')
    mockGetSession.mockResolvedValue(validSession)
    mockExchangeCode.mockResolvedValue({ accessToken: 'at', refreshToken: undefined, expiresAt: FUTURE })
    const req = makeRequest({ code: 'code' }, state)
    const res = await GET(req)
    expect(res.headers.get('location')).toContain('/onboarding?calendar_error=config_error')
    expect(mockSaveCalendarTokens).not.toHaveBeenCalled()
  })

  it('valid flow: verifies state, exchanges code, saves tokens, clears cookie, redirects to /connect/calendar', async () => {
    const state = signState('u1')
    mockGetSession.mockResolvedValue(validSession)
    mockExchangeCode.mockResolvedValue(validTokens)
    mockSaveCalendarTokens.mockResolvedValue(undefined)

    const req = makeRequest({ code: 'valid-code', state }, state)
    const res = await GET(req)
    expect(mockExchangeCode).toHaveBeenCalled()
    expect(mockSaveCalendarTokens).toHaveBeenCalled()
    expect(res.headers.get('location')).toContain('/connect/calendar')
    // State cookie cleared (max-age=0)
    const setCookie = res.headers.get('set-cookie') ?? ''
    expect(setCookie).toContain('gcal_oauth_state=')
    expect(setCookie).toContain('Max-Age=0')
  })
})
