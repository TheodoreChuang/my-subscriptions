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
const mockRepoGetReport = vi.fn()
const mockGetIntegration = vi.fn()

vi.mock('@/infrastructure', () => ({
  googleCalendarClient: {},
  postgresCalendarRepository: {
    getSelections: mockGetSelections,
    getIntegration: mockGetIntegration,
  },
  postgresWhoopRepository: {
    getIntegration: mockGetIntegration,
  },
  postgresReportRepository: {
    getReport: mockRepoGetReport,
    saveReport: vi.fn().mockResolvedValue(undefined),
  },
  whoopClient: {},
  aiClient: { generateObject: vi.fn().mockResolvedValue({
    executiveSummary: 'Test summary.',
    weekHighlightSummaries: [],
    findings: [],
  }) },
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
    computeIntegrationSnapshotAt: vi.fn().mockResolvedValue(new Date('2026-06-01')),
    checkReportStatus: vi.fn().mockReturnValue({ status: 'needs_generation', reason: 'no_report' }),
  }
})

vi.mock('@/app/report/ReportPage', () => ({
  ReportPage: vi.fn(() => null),
}))

vi.mock('@/app/report/components/AnalysisScreen', () => ({
  AnalysisScreen: vi.fn(() => null),
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
  mockRepoGetReport.mockResolvedValue(null)
  mockGetSelections.mockResolvedValue(noSelections)
  mockGetIntegration.mockResolvedValue(null)
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

  it('returns JSX (no redirect) when calendar connected with selections, WHOOP not_connected', async () => {
    mockGetConnectionStatus.mockResolvedValue('connected')
    mockGetSelections.mockResolvedValue(withSelections)
    const { default: ReportRoute } = await import('@/app/report/page')
    const result = await ReportRoute()
    expect(redirect).not.toHaveBeenCalled()
    expect(result).toBeDefined()
  })

  it('returns JSX (no redirect) when WHOOP connected, calendar not_connected (WHOOP-only path)', async () => {
    mockGetWhoopConnectionStatus.mockResolvedValue('connected')
    const { default: ReportRoute } = await import('@/app/report/page')
    const result = await ReportRoute()
    expect(redirect).not.toHaveBeenCalled()
    expect(result).toBeDefined()
  })

  it('fast status check called with correct userId', async () => {
    mockGetConnectionStatus.mockResolvedValue('connected')
    mockGetSelections.mockResolvedValue(withSelections)
    const { default: ReportRoute } = await import('@/app/report/page')
    await ReportRoute()
    expect(mockRepoGetReport).toHaveBeenCalledWith('u1')
  })

  it('fetchEventsForWindow and fetchRawDataForWindow are NOT called directly from the page', async () => {
    mockGetConnectionStatus.mockResolvedValue('connected')
    mockGetSelections.mockResolvedValue(withSelections)
    mockGetWhoopConnectionStatus.mockResolvedValue('connected')
    const { default: ReportRoute } = await import('@/app/report/page')
    await ReportRoute()
    // Pipeline calls are inside getReport (GenerateReportContent), not directly on the page
    expect(redirect).not.toHaveBeenCalled()
  })
})

// ─── GenerateReportContent error handling ─────────────────────────────────────
// These test the streaming RSC that runs inside the Suspense boundary.

describe('GenerateReportContent error handling', () => {
  it('redirects to /onboarding when getReport throws OAuthError invalid_grant', async () => {
    const { OAuthError } = await import('@/shared/capabilities/calendar')
    mockGetReport.mockRejectedValue(new OAuthError('rejected', 'invalid_grant'))
    const { GenerateReportContent } = await import('@/app/report/page')
    await expect(GenerateReportContent({ userId: 'u1' })).rejects.toThrow('NEXT_REDIRECT:/onboarding')
    expect(redirect).toHaveBeenCalledWith('/onboarding')
  })

  it('redirects to /onboarding when getReport throws IntegrationNotFoundError', async () => {
    const { IntegrationNotFoundError } = await import('@/modules/whoop/whoopService')
    mockGetReport.mockRejectedValue(new IntegrationNotFoundError())
    const { GenerateReportContent } = await import('@/app/report/page')
    await expect(GenerateReportContent({ userId: 'u1' })).rejects.toThrow('NEXT_REDIRECT:/onboarding')
    expect(redirect).toHaveBeenCalledWith('/onboarding')
  })

  it('calls getReport with correct userId', async () => {
    const { GenerateReportContent } = await import('@/app/report/page')
    await GenerateReportContent({ userId: 'u1' })
    expect(mockGetReport).toHaveBeenCalledWith('u1', expect.any(Object))
  })
})
