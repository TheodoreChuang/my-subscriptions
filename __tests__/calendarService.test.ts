import { describe, it, expect, vi } from 'vitest'
import {
  getConnectionStatus,
  saveCalendarTokens,
  listOwnedCalendars,
  updateSelections,
  fetchEventsForWindow,
  IntegrationNotFoundError,
  NoSelectionsError,
} from '@/modules/calendar/calendarService'
import { OAuthError } from '@/infrastructure/calendar/googleCalendar'
import type { CalendarRepository, IntegrationRow, CalendarSelectionRow } from '@/modules/calendar/calendarRepository'
import type { CalendarCapability, OwnedCalendar, RawCalendarEvent } from '@/shared/capabilities/calendar'

const makeLogger = () => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn() })

const NOW = new Date()
const FUTURE = new Date(Date.now() + 60 * 60 * 1000)
const PAST = new Date(Date.now() - 10 * 1000)

function makeIntegration(overrides: Partial<IntegrationRow> = {}): IntegrationRow {
  return {
    id: 'int1',
    userId: 'u1',
    provider: 'google_calendar',
    accessToken: 'at',
    refreshToken: 'rt',
    expiresAt: FUTURE,
    scope: 'calendar.readonly',
    status: 'active',
    ...overrides,
  }
}

function makeRepo(overrides: Partial<CalendarRepository> = {}): CalendarRepository {
  return {
    getIntegration: vi.fn().mockResolvedValue(makeIntegration()),
    saveIntegration: vi.fn().mockResolvedValue(undefined),
    markNeedsReconnect: vi.fn().mockResolvedValue(undefined),
    updateTokens: vi.fn().mockResolvedValue(undefined),
    getSelections: vi.fn().mockResolvedValue([]),
    getSelectionsByIntegrationId: vi.fn().mockResolvedValue([]),
    saveSelections: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  }
}

const freshTokens = { accessToken: 'new-at', refreshToken: 'rt', expiresAt: FUTURE }

function makeClient(overrides: Partial<CalendarCapability> = {}): CalendarCapability {
  return {
    exchangeCode: vi.fn().mockResolvedValue(freshTokens),
    listOwnedCalendars: vi.fn().mockResolvedValue([]),
    fetchEvents: vi.fn().mockResolvedValue([]),
    refreshTokens: vi.fn().mockResolvedValue(freshTokens),
    ...overrides,
  }
}

const selections: CalendarSelectionRow[] = [
  { id: 's1', integrationId: 'int1', externalCalendarId: 'cal1', name: 'My Calendar' },
]

// ─── getConnectionStatus ─────────────────────────────────────────────────────

describe('getConnectionStatus', () => {
  it('returns not_connected when no integration row', async () => {
    const repo = makeRepo({ getIntegration: vi.fn().mockResolvedValue(null) })
    expect(await getConnectionStatus('u1', repo)).toBe('not_connected')
  })

  it('returns needs_reconnect when status is needs_reconnect', async () => {
    const repo = makeRepo({ getIntegration: vi.fn().mockResolvedValue(makeIntegration({ status: 'needs_reconnect' })) })
    expect(await getConnectionStatus('u1', repo)).toBe('needs_reconnect')
  })

  it('returns connected when status is active', async () => {
    const repo = makeRepo()
    expect(await getConnectionStatus('u1', repo)).toBe('connected')
  })
})

// ─── saveCalendarTokens ───────────────────────────────────────────────────────

describe('saveCalendarTokens', () => {
  it('calls repo.saveIntegration with userId, tokens, and scope', async () => {
    const repo = makeRepo()
    const tokens = { accessToken: 'at', refreshToken: 'rt', expiresAt: FUTURE }
    await saveCalendarTokens('u1', tokens, 'calendar.readonly', repo)
    expect(repo.saveIntegration).toHaveBeenCalledWith('u1', tokens, 'calendar.readonly', 'calendar')
  })
})

// ─── listOwnedCalendars ───────────────────────────────────────────────────────

describe('listOwnedCalendars', () => {
  const ownedCals: OwnedCalendar[] = [
    { id: 'cal1', name: 'Primary', isPrimary: true },
  ]

  it('happy path: calls client.listOwnedCalendars with stored tokens', async () => {
    const repo = makeRepo()
    const client = makeClient({ listOwnedCalendars: vi.fn().mockResolvedValue(ownedCals) })
    const result = await listOwnedCalendars('u1', repo, client)
    expect(client.listOwnedCalendars).toHaveBeenCalled()
    expect(result).toEqual(ownedCals)
  })

  it('token near expiry: calls refreshTokens, updateTokens, then listOwnedCalendars with refreshed token', async () => {
    const repo = makeRepo({
      getIntegration: vi.fn().mockResolvedValue(makeIntegration({ expiresAt: PAST })),
    })
    const client = makeClient({ listOwnedCalendars: vi.fn().mockResolvedValue(ownedCals) })
    await listOwnedCalendars('u1', repo, client)
    expect(client.refreshTokens).toHaveBeenCalled()
    expect(repo.updateTokens).toHaveBeenCalled()
    const calledTokens = (client.listOwnedCalendars as ReturnType<typeof vi.fn>).mock.calls[0][0]
    expect(calledTokens.accessToken).toBe('new-at')
  })

  it('invalid_grant on refresh: calls markNeedsReconnect and rethrows OAuthError', async () => {
    const repo = makeRepo({
      getIntegration: vi.fn()
        .mockResolvedValueOnce(makeIntegration({ expiresAt: PAST }))
        .mockResolvedValueOnce(makeIntegration({ expiresAt: PAST })),
    })
    const client = makeClient({
      refreshTokens: vi.fn().mockRejectedValue(new OAuthError('rejected', 'invalid_grant')),
    })
    await expect(listOwnedCalendars('u1', repo, client)).rejects.toThrow(OAuthError)
    expect(repo.markNeedsReconnect).toHaveBeenCalledWith('u1')
  })
})

// ─── fetchEventsForWindow ─────────────────────────────────────────────────────

const window = { timeMin: '2024-01-01T00:00:00Z', timeMax: '2024-01-31T00:00:00Z' }

const event1: RawCalendarEvent = { id: 'e1', start: { dateTime: '2024-01-10T09:00:00Z' }, end: { dateTime: '2024-01-10T10:00:00Z' } }
const event2: RawCalendarEvent = { id: 'e2', start: { dateTime: '2024-01-15T09:00:00Z' }, end: { dateTime: '2024-01-15T10:00:00Z' } }

describe('fetchEventsForWindow', () => {
  it('happy path: fetches events per selected calendar, concatenates results', async () => {
    const twoSelections: CalendarSelectionRow[] = [
      { id: 's1', integrationId: 'int1', externalCalendarId: 'cal1', name: 'Cal 1' },
      { id: 's2', integrationId: 'int1', externalCalendarId: 'cal2', name: 'Cal 2' },
    ]
    const repo = makeRepo({ getSelectionsByIntegrationId: vi.fn().mockResolvedValue(twoSelections) })
    const client = makeClient({
      fetchEvents: vi.fn()
        .mockResolvedValueOnce([event1])
        .mockResolvedValueOnce([event2]),
    })
    const result = await fetchEventsForWindow('u1', window, repo, client, makeLogger())
    expect(result).toHaveLength(2)
    expect(result).toContain(event1)
    expect(result).toContain(event2)
  })

  it('token near expiry: calls refreshTokens, updateTokens, then fetchEvents with refreshed token', async () => {
    const repo = makeRepo({
      getIntegration: vi.fn().mockResolvedValue(makeIntegration({ expiresAt: PAST })),
      getSelectionsByIntegrationId: vi.fn().mockResolvedValue(selections),
    })
    const client = makeClient({ fetchEvents: vi.fn().mockResolvedValue([event1]) })
    await fetchEventsForWindow('u1', window, repo, client, makeLogger())
    expect(client.refreshTokens).toHaveBeenCalled()
    expect(repo.updateTokens).toHaveBeenCalled()
    const calledTokens = (client.fetchEvents as ReturnType<typeof vi.fn>).mock.calls[0][1]
    expect(calledTokens.accessToken).toBe('new-at')
  })

  it('throws IntegrationNotFoundError when no row', async () => {
    const repo = makeRepo({ getIntegration: vi.fn().mockResolvedValue(null) })
    const client = makeClient()
    await expect(fetchEventsForWindow('u1', window, repo, client, makeLogger())).rejects.toThrow(IntegrationNotFoundError)
  })

  it('throws NoSelectionsError when no calendars selected', async () => {
    const repo = makeRepo({ getSelectionsByIntegrationId: vi.fn().mockResolvedValue([]) })
    const client = makeClient()
    await expect(fetchEventsForWindow('u1', window, repo, client, makeLogger())).rejects.toThrow(NoSelectionsError)
  })

  it('invalid_grant during refresh: calls markNeedsReconnect and rethrows', async () => {
    const repo = makeRepo({
      getIntegration: vi.fn()
        .mockResolvedValueOnce(makeIntegration({ expiresAt: PAST }))
        .mockResolvedValueOnce(makeIntegration({ expiresAt: PAST })),
      getSelectionsByIntegrationId: vi.fn().mockResolvedValue(selections),
    })
    const client = makeClient({
      refreshTokens: vi.fn().mockRejectedValue(new OAuthError('rejected', 'invalid_grant')),
    })
    await expect(fetchEventsForWindow('u1', window, repo, client, makeLogger())).rejects.toThrow(OAuthError)
    expect(repo.markNeedsReconnect).toHaveBeenCalledWith('u1')
  })

  it('concurrent refresh: uses stored accessToken if row already refreshed (no markNeedsReconnect)', async () => {
    const refreshedRow = makeIntegration({ accessToken: 'already-refreshed', expiresAt: FUTURE })
    const repo = makeRepo({
      getIntegration: vi.fn()
        .mockResolvedValueOnce(makeIntegration({ expiresAt: PAST }))
        .mockResolvedValueOnce(refreshedRow),
      getSelectionsByIntegrationId: vi.fn().mockResolvedValue(selections),
    })
    const client = makeClient({
      refreshTokens: vi.fn().mockRejectedValue(new OAuthError('rejected', 'invalid_grant')),
      fetchEvents: vi.fn().mockResolvedValue([event1]),
    })
    const result = await fetchEventsForWindow('u1', window, repo, client, makeLogger())
    expect(repo.markNeedsReconnect).not.toHaveBeenCalled()
    expect((client.fetchEvents as ReturnType<typeof vi.fn>).mock.calls[0][1].accessToken).toBe('already-refreshed')
    expect(result).toContain(event1)
  })

  it('logs event count and calendar IDs on success', async () => {
    const repo = makeRepo({ getSelectionsByIntegrationId: vi.fn().mockResolvedValue(selections) })
    const client = makeClient({ fetchEvents: vi.fn().mockResolvedValue([event1, event2]) })
    const logger = makeLogger()
    await fetchEventsForWindow('u1', window, repo, client, logger)
    expect(logger.info).toHaveBeenCalledWith('calendar events retrieved', {
      calendarCount: 1,
      totalEvents: 2,
    })
  })
})

// ─── updateSelections ─────────────────────────────────────────────────────────

describe('updateSelections', () => {
  it('calls repo.saveSelections with integrationId and the provided selections', async () => {
    const repo = makeRepo()
    const sels = [{ externalCalendarId: 'cal1', name: 'My Cal' }]
    await updateSelections('u1', sels, repo)
    expect(repo.saveSelections).toHaveBeenCalledWith('int1', sels)
  })
})
