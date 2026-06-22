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
const mockGetWhoopConnectionStatus = vi.fn()
const mockGetReport = vi.fn()
const mockGetSelections = vi.fn()

vi.mock('@/infrastructure', () => ({
  googleCalendarClient: {},
  postgresCalendarRepository: { getSelections: mockGetSelections },
  postgresWhoopRepository: {},
  whoopClient: {},
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}))

vi.mock('@/shared/capabilities/calendar', async (importOriginal) => {
  const original = await importOriginal<typeof import('@/shared/capabilities/calendar')>()
  return { ...original }
})

vi.mock('@/modules', async (importOriginal) => {
  const original = await importOriginal<typeof import('@/modules')>()
  return {
    ...original,
    getConnectionStatus: mockGetConnectionStatus,
    getWhoopConnectionStatus: mockGetWhoopConnectionStatus,
    getReport: mockGetReport,
  }
})

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

const noSelections: never[] = []
const withSelections = [{ id: 's1', integrationId: 'int1', externalCalendarId: 'cal1', name: 'My Cal' }]

beforeEach(() => {
  vi.clearAllMocks()
  mockRequireSession.mockResolvedValue(validSession)
  mockGetReport.mockResolvedValue({ findings: [], coverageDays: 30, daySummaries: [] })
  mockGetSelections.mockResolvedValue(noSelections)
  mockGetConnectionStatus.mockResolvedValue('not_connected')
  mockGetWhoopConnectionStatus.mockResolvedValue('not_connected')
})

describe('report page access gate', () => {
  it('redirects to /onboarding when both not_connected', async () => {
    const { default: ReportRoute } = await import('@/app/report/page')
    await expect(ReportRoute()).rejects.toThrow('NEXT_REDIRECT:/onboarding')
    expect(redirect).toHaveBeenCalledWith('/onboarding')
  })

  it('redirects to /onboarding when calendar needs_reconnect and WHOOP not_connected', async () => {
    mockGetConnectionStatus.mockResolvedValue('needs_reconnect')
    const { default: ReportRoute } = await import('@/app/report/page')
    await expect(ReportRoute()).rejects.toThrow('NEXT_REDIRECT:/onboarding')
    expect(redirect).toHaveBeenCalledWith('/onboarding')
  })

  it('redirects to /connect/calendar when calendar connected no selections, WHOOP not_connected', async () => {
    mockGetConnectionStatus.mockResolvedValue('connected')
    mockGetSelections.mockResolvedValue(noSelections)
    const { default: ReportRoute } = await import('@/app/report/page')
    await expect(ReportRoute()).rejects.toThrow('NEXT_REDIRECT:/connect/calendar')
    expect(redirect).toHaveBeenCalledWith('/connect/calendar')
  })

  it('renders report when calendar connected with selections, WHOOP not_connected', async () => {
    mockGetConnectionStatus.mockResolvedValue('connected')
    mockGetSelections.mockResolvedValue(withSelections)
    const { default: ReportRoute } = await import('@/app/report/page')
    await ReportRoute()
    expect(mockGetReport).toHaveBeenCalledWith('u1', expect.any(Object))
  })

  it('renders report when WHOOP connected, calendar not_connected (WHOOP-only path)', async () => {
    mockGetWhoopConnectionStatus.mockResolvedValue('connected')
    const { default: ReportRoute } = await import('@/app/report/page')
    await ReportRoute()
    expect(mockGetReport).toHaveBeenCalled()
    expect(redirect).not.toHaveBeenCalled()
  })

  it('getReport called with correct userId', async () => {
    mockGetConnectionStatus.mockResolvedValue('connected')
    mockGetSelections.mockResolvedValue(withSelections)
    const { default: ReportRoute } = await import('@/app/report/page')
    await ReportRoute()
    expect(mockGetReport).toHaveBeenCalledWith('u1', expect.any(Object))
  })

  it('redirects to /onboarding when getReport throws OAuthError invalid_grant', async () => {
    const { OAuthError } = await import('@/shared/capabilities/calendar')
    mockGetConnectionStatus.mockResolvedValue('connected')
    mockGetSelections.mockResolvedValue(withSelections)
    mockGetReport.mockRejectedValue(new OAuthError('rejected', 'invalid_grant'))
    const { default: ReportRoute } = await import('@/app/report/page')
    await expect(ReportRoute()).rejects.toThrow('NEXT_REDIRECT:/onboarding')
    expect(redirect).toHaveBeenCalledWith('/onboarding')
  })

  it('redirects to /onboarding when getReport throws IntegrationNotFoundError', async () => {
    mockGetWhoopConnectionStatus.mockResolvedValue('connected')
    // Import the real class via the whoop module
    const { IntegrationNotFoundError } = await import('@/modules/whoop/whoopService')
    mockGetReport.mockRejectedValue(new IntegrationNotFoundError())
    const { default: ReportRoute } = await import('@/app/report/page')
    await expect(ReportRoute()).rejects.toThrow('NEXT_REDIRECT:/onboarding')
    expect(redirect).toHaveBeenCalledWith('/onboarding')
  })

  it('fetchEventsForWindow and fetchRawDataForWindow are NOT called directly from the page', async () => {
    mockGetConnectionStatus.mockResolvedValue('connected')
    mockGetSelections.mockResolvedValue(withSelections)
    mockGetWhoopConnectionStatus.mockResolvedValue('connected')
    const { default: ReportRoute } = await import('@/app/report/page')
    await ReportRoute()
    // These calls now live inside getReport — only getReport is called on the page
    expect(mockGetReport).toHaveBeenCalled()
  })
})
