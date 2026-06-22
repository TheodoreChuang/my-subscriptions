import { describe, it, expect, vi } from 'vitest'
import { getReport } from '@/modules/report/reportService'
import { reportSchema } from '@/shared/schemas/report'
import type { CalendarRepository, IntegrationRow, CalendarSelectionRow } from '@/modules/calendar/calendarRepository'
import type { CalendarCapability, RawCalendarEvent } from '@/shared/capabilities/calendar'
import type { WhoopRepository } from '@/modules/whoop/whoopRepository'
import type { HealthCapability } from '@/shared/capabilities/health'
import type { WhoopRawData, WhoopCycle, WhoopSleep, WhoopRecovery } from '@/shared/types/whoop'

const makeLogger = () => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn() })

const FUTURE = new Date(Date.now() + 60 * 60 * 1000)

function makeIntegration(overrides: Partial<IntegrationRow> = {}): IntegrationRow {
  return {
    id: 'int1', userId: 'u1', provider: 'google_calendar',
    accessToken: 'at', refreshToken: 'rt', expiresAt: FUTURE,
    scope: null, status: 'active', ...overrides,
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
      logger: makeLogger(),
    })
    expect(() => reportSchema.parse(r)).not.toThrow()
    expect(r.executiveSummary).toBe('')
    expect(r.findings).toHaveLength(0)
  })

  it('daySummaries.length === coverageDays', async () => {
    const { cycle, sleep, recovery } = scoredCycle(1, '2026-06-01')
    const r = await getReport('u1', {
      calendarRepo: makeCalRepo(),
      calendarClient: makeCalClient([timedEvent('e1', '2026-06-01')]),
      whoopRepo: makeWhoopRepo(),
      whoopClient: makeWhoopClient({ cycles: [cycle], sleeps: [sleep], recoveries: [recovery] }),
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
      calendarClient: makeCalClient([]), // no events
      whoopRepo: makeWhoopRepo(),
      whoopClient: makeWhoopClient({ cycles: [cycle], sleeps: [sleep], recoveries: [recovery] }),
      logger: makeLogger(),
    })
    expect(r.coverageDays).toBe(r.daySummaries.length)
    expect(r.coverageDays).toBeGreaterThan(0)
  })

  it('logger called at least once', async () => {
    const logger = makeLogger()
    await getReport('u1', {
      calendarRepo: makeCalRepo(),
      calendarClient: makeCalClient(),
      whoopRepo: makeWhoopRepo({ getIntegration: vi.fn().mockResolvedValue(null) }),
      whoopClient: makeWhoopClient(),
      logger,
    })
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
      logger: makeLogger(),
    })
    expect(calClient.fetchEvents).not.toHaveBeenCalled()
    expect(whoopClient.fetchRawData).toHaveBeenCalled()
  })
})
