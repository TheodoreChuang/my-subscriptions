import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('next/headers', () => ({
  headers: vi.fn().mockResolvedValue(new Headers()),
}))

vi.mock('next/navigation', () => ({
  redirect: vi.fn((url: string) => { throw new Error(`NEXT_REDIRECT:${url}`) }),
}))

vi.mock('@/infrastructure/auth', () => ({
  authCapability: { requireSession: vi.fn(), getSession: vi.fn(), signOut: vi.fn() },
  auth: {},
}))

const mockGetConnectionStatus = vi.fn()
const mockFetchEventsForWindow = vi.fn()
const mockGetReport = vi.fn()
const mockGetSelections = vi.fn()

vi.mock('@/infrastructure', () => ({
  googleCalendarClient: {},
  postgresCalendarRepository: { getSelections: mockGetSelections },
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}))

vi.mock('@/modules', async (importOriginal) => {
  const original = await importOriginal<typeof import('@/modules')>()
  return {
    ...original,
    getConnectionStatus: mockGetConnectionStatus,
    fetchEventsForWindow: mockFetchEventsForWindow,
    getReport: mockGetReport,
  }
})

// Must be mocked before importing the page
vi.mock('./ReportPage', () => ({
  ReportPage: vi.fn(() => null),
}), { virtual: true })

vi.mock('@/app/report/ReportPage', () => ({
  ReportPage: vi.fn(() => null),
}))

const { authCapability } = await import('@/infrastructure/auth')
const mockRequireSession = authCapability.requireSession as ReturnType<typeof vi.fn>
const { redirect } = await import('next/navigation')

const validSession = {
  user: { id: 'u1', name: 'Alice', email: 'a@a.com' },
  session: { id: 's1', expiresAt: new Date(), userId: 'u1' },
}

beforeEach(() => {
  vi.clearAllMocks()
  mockRequireSession.mockResolvedValue(validSession)
  mockGetReport.mockResolvedValue({ findings: [], coverageDays: 30, daySummaries: [] })
  mockFetchEventsForWindow.mockResolvedValue([])
})

describe('report page access gate', () => {
  it('redirects to /onboarding when not_connected', async () => {
    mockGetConnectionStatus.mockResolvedValue('not_connected')
    const { default: ReportRoute } = await import('@/app/report/page')
    await expect(ReportRoute()).rejects.toThrow('NEXT_REDIRECT:/onboarding')
    expect(redirect).toHaveBeenCalledWith('/onboarding')
  })

  it('redirects to /onboarding when needs_reconnect', async () => {
    mockGetConnectionStatus.mockResolvedValue('needs_reconnect')
    const { default: ReportRoute } = await import('@/app/report/page')
    await expect(ReportRoute()).rejects.toThrow('NEXT_REDIRECT:/onboarding')
    expect(redirect).toHaveBeenCalledWith('/onboarding')
  })

  it('redirects to /connect/calendar when connected but no selections', async () => {
    mockGetConnectionStatus.mockResolvedValue('connected')
    mockGetSelections.mockResolvedValue([])
    const { default: ReportRoute } = await import('@/app/report/page')
    await expect(ReportRoute()).rejects.toThrow('NEXT_REDIRECT:/connect/calendar')
    expect(redirect).toHaveBeenCalledWith('/connect/calendar')
  })

  it('calls fetchEventsForWindow and renders report when connected with selections', async () => {
    mockGetConnectionStatus.mockResolvedValue('connected')
    mockGetSelections.mockResolvedValue([{
      id: 's1', integrationId: 'int1', externalCalendarId: 'cal1', name: 'My Cal',
    }])
    const { default: ReportRoute } = await import('@/app/report/page')
    await ReportRoute()
    expect(mockFetchEventsForWindow).toHaveBeenCalled()
    expect(mockGetReport).toHaveBeenCalled()
  })
})
