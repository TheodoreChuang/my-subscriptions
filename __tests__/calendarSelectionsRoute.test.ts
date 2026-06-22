import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('next/headers', () => ({
  headers: vi.fn().mockResolvedValue(new Headers()),
}))

vi.mock('@/infrastructure/auth', () => ({
  authCapability: { getSession: vi.fn(), requireSession: vi.fn(), signOut: vi.fn() },
  auth: {},
}))

const mockListOwnedCalendars = vi.fn()
const mockUpdateSelections = vi.fn()

vi.mock('@/infrastructure', () => ({
  googleCalendarClient: {},
  postgresCalendarRepository: {},
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}))

vi.mock('@/modules', async (importOriginal) => {
  const original = await importOriginal<typeof import('@/modules')>()
  return {
    ...original,
    listOwnedCalendars: mockListOwnedCalendars,
    updateSelections: mockUpdateSelections,
  }
})

const { authCapability } = await import('@/infrastructure/auth')
const mockGetSession = authCapability.getSession as ReturnType<typeof vi.fn>
const { POST } = await import('@/app/api/integrations/google-calendar/selections/route')

const validSession = {
  user: { id: 'u1', name: 'Alice', email: 'a@a.com' },
  session: { id: 's1', expiresAt: new Date(), userId: 'u1' },
}

const ownedCalendars = [
  { id: 'cal1', name: 'Primary', isPrimary: true },
  { id: 'cal2', name: 'Work', isPrimary: false },
]

function makeRequest(body: unknown): NextRequest {
  return new NextRequest('http://localhost:3000/api/integrations/google-calendar/selections', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
}

beforeEach(() => { vi.clearAllMocks() })

describe('POST /api/integrations/google-calendar/selections', () => {
  it('returns 401 when no session', async () => {
    mockGetSession.mockResolvedValue(null)
    const res = await POST(makeRequest({ selectedIds: ['cal1'] }))
    expect(res.status).toBe(401)
  })

  it('returns 400 on empty selectedIds array', async () => {
    mockGetSession.mockResolvedValue(validSession)
    const res = await POST(makeRequest({ selectedIds: [] }))
    expect(res.status).toBe(400)
  })

  it('returns 400 when selectedId not in server-fetched calendar list', async () => {
    mockGetSession.mockResolvedValue(validSession)
    mockListOwnedCalendars.mockResolvedValue(ownedCalendars)
    const res = await POST(makeRequest({ selectedIds: ['not-owned'] }))
    expect(res.status).toBe(400)
  })

  it('valid request: persists selections and returns 200', async () => {
    mockGetSession.mockResolvedValue(validSession)
    mockListOwnedCalendars.mockResolvedValue(ownedCalendars)
    mockUpdateSelections.mockResolvedValue(undefined)
    const res = await POST(makeRequest({ selectedIds: ['cal1'] }))
    expect(res.status).toBe(200)
    expect(mockUpdateSelections).toHaveBeenCalledWith(
      'u1',
      [{ externalCalendarId: 'cal1', name: 'Primary' }],
      expect.anything(),
    )
  })

  it('re-POST replaces previous selection by calling updateSelections again', async () => {
    mockGetSession.mockResolvedValue(validSession)
    mockListOwnedCalendars.mockResolvedValue(ownedCalendars)
    mockUpdateSelections.mockResolvedValue(undefined)

    await POST(makeRequest({ selectedIds: ['cal1'] }))
    await POST(makeRequest({ selectedIds: ['cal2'] }))

    expect(mockUpdateSelections).toHaveBeenCalledTimes(2)
    const lastCall = (mockUpdateSelections as ReturnType<typeof vi.fn>).mock.calls[1]
    expect(lastCall[1]).toEqual([{ externalCalendarId: 'cal2', name: 'Work' }])
  })
})
