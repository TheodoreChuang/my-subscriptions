import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { AuthSession } from '@/shared/capabilities/auth'

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

const { authCapability } = await import('@/infrastructure/auth')
const { GET } = await import('@/app/api/report/route')

const mockGetSession = authCapability.getSession as unknown as ReturnType<typeof vi.fn>

const validSession: AuthSession = {
  user: { id: 'u1', name: 'Alice', email: 'alice@example.com', image: null },
  session: { id: 's1', expiresAt: new Date('2099-01-01'), userId: 'u1' },
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('GET /api/report', () => {
  it('returns 401 when no session', async () => {
    mockGetSession.mockResolvedValue(null)
    const res = await GET()
    expect(res.status).toBe(401)
    const body = await res.json()
    expect(body).toEqual({ error: 'Unauthorized' })
  })

  it('returns 200 with report data when session is valid', async () => {
    mockGetSession.mockResolvedValue(validSession)
    const res = await GET()
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body).toBeDefined()
    expect(typeof body).toBe('object')
  })

  it('returns 401 when cookie is present but session is null (stale cookie)', async () => {
    mockGetSession.mockResolvedValue(null)
    const res = await GET()
    expect(res.status).toBe(401)
  })
})
