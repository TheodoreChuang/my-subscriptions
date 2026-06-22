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

const mockGetReport = vi.fn()

vi.mock('@/infrastructure', () => ({
  googleCalendarClient: {},
  postgresCalendarRepository: {},
  postgresWhoopRepository: {},
  whoopClient: {},
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}))

vi.mock('@/modules', async (importOriginal) => {
  const original = await importOriginal<typeof import('@/modules')>()
  return {
    ...original,
    getReport: mockGetReport,
  }
})

const { authCapability } = await import('@/infrastructure/auth')
const { GET } = await import('@/app/api/report/route')

const mockGetSession = authCapability.getSession as unknown as ReturnType<typeof vi.fn>

const validSession: AuthSession = {
  user: { id: 'u1', name: 'Alice', email: 'alice@example.com', image: null },
  session: { id: 's1', expiresAt: new Date('2099-01-01'), userId: 'u1' },
}

const FIXTURE_REPORT = { window: {}, coverageDays: 0, daySummaries: [], findings: [] }

beforeEach(() => {
  vi.clearAllMocks()
  mockGetReport.mockResolvedValue(FIXTURE_REPORT)
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

  it('getReport called with correct userId when session is valid', async () => {
    mockGetSession.mockResolvedValue(validSession)
    await GET()
    expect(mockGetReport).toHaveBeenCalledWith('u1', expect.any(Object))
  })

  it('returns 401 when cookie is present but session is null (stale cookie)', async () => {
    mockGetSession.mockResolvedValue(null)
    const res = await GET()
    expect(res.status).toBe(401)
  })
})
