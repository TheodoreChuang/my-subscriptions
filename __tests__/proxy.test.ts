import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('better-auth/cookies', () => ({
  getSessionCookie: vi.fn(),
}))

const { getSessionCookie } = await import('better-auth/cookies')
const { proxy } = await import('@/proxy')

const mockGetSessionCookie = getSessionCookie as unknown as ReturnType<typeof vi.fn>

function makeRequest(pathname: string) {
  return new NextRequest(new URL(`http://localhost:3000${pathname}`))
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('proxy', () => {
  it('redirects to /sign-in when no session cookie on protected route', async () => {
    mockGetSessionCookie.mockReturnValue(null)
    const res = await proxy(makeRequest('/report'))
    expect(res.status).toBe(307)
    expect(res.headers.get('location')).toContain('/sign-in')
  })

  it('allows through when session cookie is present on protected route', async () => {
    mockGetSessionCookie.mockReturnValue('session-token')
    const res = await proxy(makeRequest('/report'))
    expect(res.status).toBe(200)
  })

  it('allows through /sign-in with no session cookie', async () => {
    mockGetSessionCookie.mockReturnValue(null)
    const res = await proxy(makeRequest('/sign-in'))
    expect(res.status).toBe(200)
  })

  it('allows through /sign-in with a session cookie (RSC page handles redirect)', async () => {
    mockGetSessionCookie.mockReturnValue('session-token')
    const res = await proxy(makeRequest('/sign-in'))
    expect(res.status).toBe(200)
  })

  it('redirects / with no session cookie to /sign-in', async () => {
    mockGetSessionCookie.mockReturnValue(null)
    const res = await proxy(makeRequest('/'))
    expect(res.status).toBe(307)
    expect(res.headers.get('location')).toContain('/sign-in')
  })
})

// Matcher regex tests (pure function)
describe('proxy matcher', () => {
  const pattern = /^\/((?!api|_next\/static|_next\/image|favicon\.ico|sitemap\.xml|robots\.txt|.*\.png$).*)$/

  it('matches /report', () => expect(pattern.test('/report')).toBe(true))
  it('matches /', () => expect(pattern.test('/')).toBe(true))
  it('matches /sign-in', () => expect(pattern.test('/sign-in')).toBe(true))
  it('does not match /api/report', () => expect(pattern.test('/api/report')).toBe(false))
  it('does not match /api/auth/callback/google', () => expect(pattern.test('/api/auth/callback/google')).toBe(false))
  it('does not match /_next/static/main.js', () => expect(pattern.test('/_next/static/main.js')).toBe(false))
  it('does not match /favicon.ico', () => expect(pattern.test('/favicon.ico')).toBe(false))
})
