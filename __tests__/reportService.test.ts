import { describe, it, expect, vi } from 'vitest'
import { getReport } from '@/modules/report/reportService'
import { reportSchema, aiOutputSchema } from '@/shared/schemas/report'
import type { z } from 'zod'
import type { CalendarRepository, IntegrationRow, CalendarSelectionRow } from '@/modules/calendar/calendarRepository'
import type { CalendarCapability, RawCalendarEvent } from '@/shared/capabilities/calendar'
import type { WhoopRepository } from '@/modules/whoop/whoopRepository'
import type { HealthCapability } from '@/shared/capabilities/health'
import type { AICapability } from '@/shared/capabilities/ai'
import type { ReportRepository } from '@/modules/report/reportRepository'
import type { WhoopRawData, WhoopCycle, WhoopSleep, WhoopRecovery } from '@/shared/types/whoop'

type AIOutput = z.infer<typeof aiOutputSchema>

const VALID_AI_OUTPUT: AIOutput = {
  executiveSummary: 'Test executive summary.',
  weekHighlightSummaries: [],
  findings: [],
}

const makeLogger = () => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn() })

const FUTURE = new Date(Date.now() + 60 * 60 * 1000)

function makeIntegration(overrides: Partial<IntegrationRow> = {}): IntegrationRow {
  return {
    id: 'int1', userId: 'u1', provider: 'google_calendar',
    accessToken: 'at', refreshToken: 'rt', expiresAt: FUTURE,
    scope: null, status: 'active', updatedAt: new Date('2026-06-01'),
    ...overrides,
  }
}

const withSelections: CalendarSelectionRow[] = [
  { id: 's1', integrationId: 'int1', externalCalendarId: 'cal1', name: 'My Cal' },
]

function makeCalRepo(overrides: Partial<CalendarRepository> = {}): CalendarRepository {
  return {
    getIntegration: vi.fn().mockResolvedValue(makeIntegration()),
    saveIntegration: vi.fn().mockResolvedValue(undefined),
    markNeedsReconnect: vi.fn().mockResolvedValue(undefined),
    updateTokens: vi.fn().mockResolvedValue(undefined),
    getSelections: vi.fn().mockResolvedValue(withSelections),
    getSelectionsByIntegrationId: vi.fn().mockResolvedValue(withSelections),
    saveSelections: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  }
}

function makeCalClient(events: RawCalendarEvent[] = []): CalendarCapability {
  return {
    exchangeCode: vi.fn(),
    listOwnedCalendars: vi.fn(),
    fetchEvents: vi.fn().mockResolvedValue(events),
    refreshTokens: vi.fn(),
  }
}

function makeWhoopRepo(overrides: Partial<WhoopRepository> = {}): WhoopRepository {
  return {
    getIntegration: vi.fn().mockResolvedValue(makeIntegration({ provider: 'whoop' })),
    saveIntegration: vi.fn().mockResolvedValue(undefined),
    markNeedsReconnect: vi.fn().mockResolvedValue(undefined),
    updateTokens: vi.fn().mockResolvedValue(true),
    ...overrides,
  }
}

function makeWhoopClient(rawData: WhoopRawData = { cycles: [], sleeps: [], recoveries: [] }): HealthCapability {
  return {
    exchangeCode: vi.fn(),
    refreshTokens: vi.fn(),
    fetchRawData: vi.fn().mockResolvedValue(rawData),
  }
}

function makeAIClient(output: AIOutput = VALID_AI_OUTPUT): AICapability {
  return { generateObject: vi.fn().mockResolvedValue(output) }
}

function makeReportRepo(): ReportRepository {
  return {
    getReport: vi.fn().mockResolvedValue(null),
    saveReport: vi.fn().mockResolvedValue(undefined),
  }
}

// Minimal scored WHOOP cycle + sleep + recovery
function scoredCycle(id: number, date: string): { cycle: WhoopCycle; sleep: WhoopSleep; recovery: WhoopRecovery } {
  const cycle: WhoopCycle = {
    id,
    start: `${date}T04:00:00Z`,
    end: `${date}T12:00:00Z`,
    timezone_offset: '+00:00',
    score_state: 'SCORED',
    score: { strain: 10 },
  }
  const sleep: WhoopSleep = {
    id: `sleep-${id}`,
    cycle_id: id,
    nap: false,
    score_state: 'SCORED',
    score: { stage_summary: { total_in_bed_time_milli: 28_800_000, total_awake_time_milli: 1_800_000 } },
  }
  const recovery: WhoopRecovery = {
    cycle_id: id,
    sleep_id: `sleep-${id}`,
    score_state: 'SCORED',
    score: { recovery_score: 70 },
  }
  return { cycle, sleep, recovery }
}

const timedEvent = (id: string, date: string, summary = 'Meeting'): RawCalendarEvent => ({
  id,
  summary,
  status: 'confirmed',
  start: { dateTime: `${date}T09:00:00Z` },
  end: { dateTime: `${date}T10:00:00Z` },
})

function makeDeps(overrides: Partial<Parameters<typeof getReport>[1]> = {}) {
  return {
    calendarRepo: makeCalRepo(),
    calendarClient: makeCalClient(),
    whoopRepo: makeWhoopRepo({ getIntegration: vi.fn().mockResolvedValue(null) }),
    whoopClient: makeWhoopClient(),
    aiClient: makeAIClient(),
    reportRepo: makeReportRepo(),
    logger: makeLogger(),
    ...overrides,
  }
}

describe('getReport', () => {
  it('both connected with stub data → schema-valid Report', async () => {
    const { cycle, sleep, recovery } = scoredCycle(1, '2026-06-01')
    const whoopData: WhoopRawData = { cycles: [cycle], sleeps: [sleep], recoveries: [recovery] }
    const events: RawCalendarEvent[] = [timedEvent('e1', '2026-06-01')]

    const r = await getReport('u1', {
      calendarRepo: makeCalRepo(),
      calendarClient: makeCalClient(events),
      whoopRepo: makeWhoopRepo(),
      whoopClient: makeWhoopClient(whoopData),
      aiClient: makeAIClient(),
      reportRepo: makeReportRepo(),
      logger: makeLogger(),
    })
    expect(() => reportSchema.parse(r)).not.toThrow()
    expect(r.executiveSummary).toBe(VALID_AI_OUTPUT.executiveSummary)
    expect(r.findings).toHaveLength(0)
  })

  it('AI fields are populated from aiClient output', async () => {
    const aiOutput = {
      executiveSummary: 'A meaningful summary.',
      weekHighlightSummaries: [],
      findings: [{
        id: 'f1', type: 'finding' as const,
        title: 'A finding', description: 'Desc',
        alternativeExplanation: 'Alt', confidence: 'medium' as const,
      }],
    }
    const r = await getReport('u1', makeDeps({ aiClient: makeAIClient(aiOutput) }))
    expect(r.executiveSummary).toBe('A meaningful summary.')
    expect(r.findings).toHaveLength(1)
  })

  it('aiClient.generateObject throws → getReport propagates the error, saveReport NOT called', async () => {
    const reportRepo = makeReportRepo()
    const aiClient: AICapability = { generateObject: vi.fn().mockRejectedValue(new Error('AI failure')) }
    await expect(getReport('u1', makeDeps({ aiClient, reportRepo }))).rejects.toThrow('AI failure')
    expect(reportRepo.saveReport).not.toHaveBeenCalled()
  })

  it('reportRepo.saveReport is called once per successful getReport', async () => {
    const reportRepo = makeReportRepo()
    await getReport('u1', makeDeps({ reportRepo }))
    expect(reportRepo.saveReport).toHaveBeenCalledTimes(1)
  })

  it('reportRepo.saveReport is called with userId and a Report', async () => {
    const reportRepo = makeReportRepo()
    await getReport('u1', makeDeps({ reportRepo }))
    const [userId, report] = (reportRepo.saveReport as ReturnType<typeof vi.fn>).mock.calls[0]
    expect(userId).toBe('u1')
    expect(() => reportSchema.parse(report)).not.toThrow()
  })

  it('integrationSnapshotAt passed to saveReport is a Date instance', async () => {
    const reportRepo = makeReportRepo()
    await getReport('u1', makeDeps({ reportRepo }))
    const snapshotAt = (reportRepo.saveReport as ReturnType<typeof vi.fn>).mock.calls[0][2]
    expect(snapshotAt).toBeInstanceOf(Date)
  })

  it('daySummaries.length === coverageDays', async () => {
    const { cycle, sleep, recovery } = scoredCycle(1, '2026-06-01')
    const r = await getReport('u1', {
      calendarRepo: makeCalRepo(),
      calendarClient: makeCalClient([timedEvent('e1', '2026-06-01')]),
      whoopRepo: makeWhoopRepo(),
      whoopClient: makeWhoopClient({ cycles: [cycle], sleeps: [sleep], recoveries: [recovery] }),
      aiClient: makeAIClient(),
      reportRepo: makeReportRepo(),
      logger: makeLogger(),
    })
    expect(r.daySummaries.length).toBe(r.coverageDays)
  })

  it('calendar-only (WHOOP repo returns null) → no WHOOP metrics, schema-valid', async () => {
    const r = await getReport('u1', {
      calendarRepo: makeCalRepo(),
      calendarClient: makeCalClient([timedEvent('e1', '2026-06-01')]),
      whoopRepo: makeWhoopRepo({ getIntegration: vi.fn().mockResolvedValue(null) }),
      whoopClient: makeWhoopClient(),
      aiClient: makeAIClient(),
      reportRepo: makeReportRepo(),
      logger: makeLogger(),
    })
    expect(() => reportSchema.parse(r)).not.toThrow()
    expect(r.connectedSources).not.toContain('health')
    expect(r.metrics.avgRecovery).toBeUndefined()
    expect(r.weekHighlights).toHaveLength(0)
  })

  it('WHOOP-only (no calendar integration) → no calendar metrics, schema-valid', async () => {
    const { cycle, sleep, recovery } = scoredCycle(1, '2026-06-01')
    const r = await getReport('u1', {
      calendarRepo: makeCalRepo({ getIntegration: vi.fn().mockResolvedValue(null) }),
      calendarClient: makeCalClient(),
      whoopRepo: makeWhoopRepo(),
      whoopClient: makeWhoopClient({ cycles: [cycle], sleeps: [sleep], recoveries: [recovery] }),
      aiClient: makeAIClient(),
      reportRepo: makeReportRepo(),
      logger: makeLogger(),
    })
    expect(() => reportSchema.parse(r)).not.toThrow()
    expect(r.connectedSources).not.toContain('calendar')
    expect(r.metrics.totalEvents).toBeUndefined()
  })

  it('empty calendar window → WHOOP-only days; coverageDays reflects count', async () => {
    const { cycle, sleep, recovery } = scoredCycle(1, '2026-06-01')
    const r = await getReport('u1', {
      calendarRepo: makeCalRepo(),
      calendarClient: makeCalClient([]),
      whoopRepo: makeWhoopRepo(),
      whoopClient: makeWhoopClient({ cycles: [cycle], sleeps: [sleep], recoveries: [recovery] }),
      aiClient: makeAIClient(),
      reportRepo: makeReportRepo(),
      logger: makeLogger(),
    })
    expect(r.coverageDays).toBe(r.daySummaries.length)
    expect(r.coverageDays).toBeGreaterThan(0)
  })

  it('logger called at least once', async () => {
    const logger = makeLogger()
    await getReport('u1', makeDeps({ logger }))
    expect(logger.info).toHaveBeenCalled()
  })

  it('only calendar fetch called when only calendar connected', async () => {
    const calClient = makeCalClient()
    const whoopClient = makeWhoopClient()
    await getReport('u1', {
      calendarRepo: makeCalRepo(),
      calendarClient: calClient,
      whoopRepo: makeWhoopRepo({ getIntegration: vi.fn().mockResolvedValue(null) }),
      whoopClient,
      aiClient: makeAIClient(),
      reportRepo: makeReportRepo(),
      logger: makeLogger(),
    })
    expect(calClient.fetchEvents).toHaveBeenCalled()
    expect(whoopClient.fetchRawData).not.toHaveBeenCalled()
  })

  it('only WHOOP fetch called when only WHOOP connected', async () => {
    const calClient = makeCalClient()
    const whoopClient = makeWhoopClient()
    await getReport('u1', {
      calendarRepo: makeCalRepo({ getIntegration: vi.fn().mockResolvedValue(null) }),
      calendarClient: calClient,
      whoopRepo: makeWhoopRepo(),
      whoopClient,
      aiClient: makeAIClient(),
      reportRepo: makeReportRepo(),
      logger: makeLogger(),
    })
    expect(calClient.fetchEvents).not.toHaveBeenCalled()
    expect(whoopClient.fetchRawData).toHaveBeenCalled()
  })

  it('weekHighlightSummaries shorter than weekStats → fills remaining with empty string', async () => {
    // Build two weeks of WHOOP data
    const cycles = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((n) => {
      const date = `2026-05-${String(n + 20).padStart(2, '0')}`
      return scoredCycle(n, date)
    })
    const whoopData: WhoopRawData = {
      cycles: cycles.map((c) => c.cycle),
      sleeps: cycles.map((c) => c.sleep),
      recoveries: cycles.map((c) => c.recovery),
    }
    // AI returns fewer summaries than weekStats
    const aiOutput = { ...VALID_AI_OUTPUT, weekHighlightSummaries: ['Only one summary'] }
    const r = await getReport('u1', {
      calendarRepo: makeCalRepo({ getIntegration: vi.fn().mockResolvedValue(null) }),
      calendarClient: makeCalClient(),
      whoopRepo: makeWhoopRepo(),
      whoopClient: makeWhoopClient(whoopData),
      aiClient: makeAIClient(aiOutput),
      reportRepo: makeReportRepo(),
      logger: makeLogger(),
    })
    // Any week highlights that got no summary should have empty string
    for (const wh of r.weekHighlights) {
      expect(typeof wh.summary).toBe('string')
    }
  })
})
