import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('next/headers', () => ({
  headers: vi.fn().mockResolvedValue(new Headers()),
}))

vi.mock('@/infrastructure/auth', () => ({
  authCapability: {
    getSession: vi.fn(),
    requireSession: vi.fn(),
    signOut: vi.fn(),
  },
  auth: {},
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
const mockRequireSession = authCapability.requireSession as ReturnType<typeof vi.fn>

beforeEach(() => { vi.clearAllMocks() })

describe('GET /api/integrations/google-calendar/connect', () => {
  it('redirects to accounts.google.com with correct OAuth params', async () => {
    mockRequireSession.mockResolvedValue({
      user: { id: 'u1', name: 'Alice', email: 'a@a.com' },
      session: { id: 's1', expiresAt: new Date(), userId: 'u1' },
    })
    const { GET } = await import('@/app/api/integrations/google-calendar/connect/route')
    const res = await GET()
    const location = res.headers.get('location') ?? ''
    expect(location).toContain('accounts.google.com')
    expect(location).toContain('access_type=offline')
    expect(location).toContain('prompt=consent')
    expect(location).toContain('calendar.readonly')
  })

  it('sets state cookie with base64.hmac format', async () => {
    mockRequireSession.mockResolvedValue({
      user: { id: 'u1', name: 'Alice', email: 'a@a.com' },
      session: { id: 's1', expiresAt: new Date(), userId: 'u1' },
    })
    const { GET } = await import('@/app/api/integrations/google-calendar/connect/route')
    const res = await GET()
    const setCookie = res.headers.get('set-cookie') ?? ''
    expect(setCookie).toContain('gcal_oauth_state=')
    const cookieVal = decodeURIComponent(setCookie.split('gcal_oauth_state=')[1].split(';')[0])
    // format: base64(payload).hmac-hex
    expect(cookieVal).toMatch(/^[A-Za-z0-9+/=]+\.[0-9a-f]+$/)
  })

  it('returns 401 (redirect to sign-in) without a session', async () => {
    mockRequireSession.mockImplementation(() => { throw new Error('NEXT_REDIRECT:/sign-in') })
    const { GET } = await import('@/app/api/integrations/google-calendar/connect/route')
    await expect(GET()).rejects.toThrow('NEXT_REDIRECT:/sign-in')
  })
})
