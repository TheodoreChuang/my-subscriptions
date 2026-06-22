import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('next/headers', () => ({
  headers: vi.fn().mockResolvedValue(new Headers()),
}))

vi.mock('@/infrastructure/auth', () => ({
  authCapability: { getSession: vi.fn(), requireSession: vi.fn(), signOut: vi.fn() },
  auth: {},
}))

const mockSaveWhoopTokens = vi.fn()

vi.mock('@/infrastructure', () => ({
  postgresWhoopRepository: {},
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}))

vi.mock('@/modules', () => ({
  saveWhoopTokens: mockSaveWhoopTokens,
}))

vi.mock('@/shared/env', () => ({
  env: {
    NODE_ENV: 'test',
    BETTER_AUTH_URL: 'http://localhost:3000',
    BETTER_AUTH_SECRET: 'a-very-long-secret-for-testing-purposes-only-32ch',
    WHOOP_CLIENT_ID: 'whoop-client-id',
    WHOOP_CLIENT_SECRET: 'whoop-client-secret',
  },
}))

const { authCapability } = await import('@/infrastructure/auth')
const mockRequireSession = authCapability.requireSession as ReturnType<typeof vi.fn>
const mockGetSession = authCapability.getSession as ReturnType<typeof vi.fn>

const { signState } = await import('@/app/api/integrations/google-calendar/stateToken')

const WHOOP_STATE_COOKIE = 'whoop_oauth_state'
const FUTURE = new Date(Date.now() + 3600 * 1000)

const validSession = {
  user: { id: 'u1', name: 'Alice', email: 'a@a.com' },
  session: { id: 's1', expiresAt: FUTURE, userId: 'u1' },
}

function makeCallbackRequest(
  params: Record<string, string>,
  stateCookieValue?: string,
): NextRequest {
  const url = new URL('http://localhost:3000/api/integrations/whoop/callback')
  const stateParam = stateCookieValue !== undefined && params.state === undefined
    ? { ...params, state: stateCookieValue }
    : params
  for (const [k, v] of Object.entries(stateParam)) url.searchParams.set(k, v)
  const req = new NextRequest(url)
  Object.defineProperty(req, 'cookies', {
    value: {
      get: (name: string) =>
        name === WHOOP_STATE_COOKIE && stateCookieValue !== undefined
          ? { value: stateCookieValue }
          : undefined,
    },
  })
  return req
}

beforeEach(() => {
  vi.clearAllMocks()
})

// ─── /connect ────────────────────────────────────────────────────────────────

describe('GET /api/integrations/whoop/connect', () => {
  it('redirects to api.prod.whoop.com/oauth/oauth2/auth', async () => {
    mockRequireSession.mockResolvedValue(validSession)
    const { GET } = await import('@/app/api/integrations/whoop/connect/route')
    const res = await GET()
    const location = res.headers.get('location') ?? ''
    expect(location).toContain('api.prod.whoop.com/oauth/oauth2/auth')
  })

  it('includes WHOOP scopes and derived redirect_uri in the authorization URL', async () => {
    mockRequireSession.mockResolvedValue(validSession)
    const { GET } = await import('@/app/api/integrations/whoop/connect/route')
    const res = await GET()
    const location = res.headers.get('location') ?? ''
    const parsed = new URL(location)
    expect(parsed.searchParams.get('scope')).toBe('offline read:profile read:cycles read:sleep read:recovery')
    expect(parsed.searchParams.get('redirect_uri')).toBe('http://localhost:3000/api/integrations/whoop/callback')
  })

  it('sets whoop_oauth_state cookie in base64.hmac format', async () => {
    mockRequireSession.mockResolvedValue(validSession)
    const { GET } = await import('@/app/api/integrations/whoop/connect/route')
    const res = await GET()
    const setCookie = res.headers.get('set-cookie') ?? ''
    expect(setCookie).toContain(`${WHOOP_STATE_COOKIE}=`)
    const cookieVal = decodeURIComponent(setCookie.split(`${WHOOP_STATE_COOKIE}=`)[1].split(';')[0])
    expect(cookieVal).toMatch(/^[A-Za-z0-9+/=]+\.[0-9a-f]+$/)
  })

  it('throws redirect to /sign-in when not authenticated', async () => {
    mockRequireSession.mockImplementation(() => { throw new Error('NEXT_REDIRECT:/sign-in') })
    const { GET } = await import('@/app/api/integrations/whoop/connect/route')
    await expect(GET()).rejects.toThrow('NEXT_REDIRECT:/sign-in')
  })
})

// ─── /callback ────────────────────────────────────────────────────────────────

describe('GET /api/integrations/whoop/callback', () => {
  it('redirects to /onboarding?whoop_error=denied on access_denied', async () => {
    const req = makeCallbackRequest({ error: 'access_denied' })
    const { GET } = await import('@/app/api/integrations/whoop/callback/route')
    const res = await GET(req)
    expect(res.headers.get('location')).toContain('/onboarding?whoop_error=denied')
  })

  it('returns 400 when code is missing', async () => {
    const state = signState('u1')
    const req = makeCallbackRequest({}, state)
    const { GET } = await import('@/app/api/integrations/whoop/callback/route')
    const res = await GET(req)
    expect(res.status).toBe(400)
  })

  it('redirects to /onboarding?error=session_lost when state cookie is absent', async () => {
    const req = makeCallbackRequest({ code: 'code123' })
    const { GET } = await import('@/app/api/integrations/whoop/callback/route')
    const res = await GET(req)
    expect(res.headers.get('location')).toContain('/onboarding?error=session_lost')
  })

  it('returns 403 on tampered state cookie', async () => {
    const req = makeCallbackRequest({ code: 'code' }, 'tampered.deadbeef')
    const { GET } = await import('@/app/api/integrations/whoop/callback/route')
    const res = await GET(req)
    expect(res.status).toBe(403)
  })

  it('returns 403 on expired state TTL', async () => {
    const originalNow = Date.now
    const state = signState('u1')
    Date.now = () => originalNow() + 400_000
    try {
      const req = makeCallbackRequest({ code: 'code' }, state)
      const { GET } = await import('@/app/api/integrations/whoop/callback/route')
      const res = await GET(req)
      expect(res.status).toBe(403)
    } finally {
      Date.now = originalNow
    }
  })

  it('valid flow: verifies state, exchanges code with form-urlencoded body, saves tokens, clears cookie, redirects to /onboarding', async () => {
    const state = signState('u1')
    mockGetSession.mockResolvedValue(validSession)
    mockSaveWhoopTokens.mockResolvedValue(undefined)

    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ access_token: 'at', refresh_token: 'rt', expires_in: 3600, scope: 'offline' }),
    }))

    const req = makeCallbackRequest({ code: 'valid-code', state }, state)
    const { GET } = await import('@/app/api/integrations/whoop/callback/route')
    const res = await GET(req)

    // Verify fetch was called with URLSearchParams body
    const [, init] = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0] as [string, RequestInit]
    expect((init.headers as Record<string, string>)['content-type']).toBe('application/x-www-form-urlencoded')
    expect(init.body).toBeInstanceOf(URLSearchParams)
    const params = init.body as URLSearchParams
    expect(params.get('grant_type')).toBe('authorization_code')

    expect(mockSaveWhoopTokens).toHaveBeenCalled()
    expect(res.headers.get('location')).toContain('/onboarding')
    expect(res.headers.get('location')).not.toContain('whoop_error')

    const setCookie = res.headers.get('set-cookie') ?? ''
    expect(setCookie).toContain(WHOOP_STATE_COOKIE)
    expect(setCookie).toContain('Max-Age=0')

    vi.unstubAllGlobals()
  })

  it('redirects to /onboarding?whoop_error=failed when WHOOP token exchange returns non-200', async () => {
    const state = signState('u1')
    mockGetSession.mockResolvedValue(validSession)

    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: false,
      status: 400,
      json: async () => ({}),
    }))

    const req = makeCallbackRequest({ code: 'bad-code', state }, state)
    const { GET } = await import('@/app/api/integrations/whoop/callback/route')
    const res = await GET(req)
    expect(res.headers.get('location')).toContain('/onboarding?whoop_error=failed')

    vi.unstubAllGlobals()
  })

  it('redirects to /sign-in when session is revoked between connect and callback', async () => {
    const state = signState('u1')
    mockGetSession.mockResolvedValue(null)
    const req = makeCallbackRequest({ code: 'code' }, state)
    const { GET } = await import('@/app/api/integrations/whoop/callback/route')
    const res = await GET(req)
    expect(res.headers.get('location')).toContain('/sign-in')
  })
})
