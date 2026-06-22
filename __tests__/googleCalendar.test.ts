import { describe, it, expect, vi, beforeEach } from 'vitest'
import { GoogleCalendarClient, OAuthError } from '@/infrastructure/calendar/googleCalendar'

const makeLogger = () => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn() })

const tokens = {
  accessToken: 'access-token',
  refreshToken: 'refresh-token',
  expiresAt: new Date(Date.now() + 3600 * 1000),
}

function mockFetch(responses: Array<{ ok: boolean; body: unknown; status?: number }>) {
  let call = 0
  return vi.fn().mockImplementation(async () => {
    const r = responses[call++] ?? responses[responses.length - 1]
    return {
      ok: r.ok,
      status: r.status ?? (r.ok ? 200 : 400),
      text: async () => JSON.stringify(r.body),
      json: async () => r.body,
    }
  })
}

describe('GoogleCalendarClient.exchangeCode', () => {
  beforeEach(() => { vi.unstubAllGlobals() })

  it('returns CalendarTokens on 200', async () => {
    const client = new GoogleCalendarClient('cid', 'csecret', makeLogger())
    vi.stubGlobal('fetch', mockFetch([{
      ok: true,
      body: { access_token: 'at', refresh_token: 'rt', expires_in: 3600 },
    }]))
    const result = await client.exchangeCode('code', 'http://localhost/callback')
    expect(result.accessToken).toBe('at')
    expect(result.refreshToken).toBe('rt')
    expect(result.expiresAt.getTime()).toBeGreaterThan(Date.now())
  })

  it('throws on non-200', async () => {
    const client = new GoogleCalendarClient('cid', 'csecret', makeLogger())
    vi.stubGlobal('fetch', mockFetch([{ ok: false, status: 400, body: 'bad request' }]))
    await expect(client.exchangeCode('bad', 'http://localhost/callback')).rejects.toThrow('exchangeCode failed 400')
  })
})

describe('GoogleCalendarClient.listOwnedCalendars', () => {
  beforeEach(() => { vi.unstubAllGlobals() })

  it('includes only calendars with accessRole === owner', async () => {
    const client = new GoogleCalendarClient('cid', 'csecret', makeLogger())
    vi.stubGlobal('fetch', mockFetch([{
      ok: true,
      body: {
        items: [
          { id: 'cal1', summary: 'My Cal', accessRole: 'owner', primary: true },
          { id: 'cal2', summary: 'Shared', accessRole: 'reader' },
        ],
      },
    }]))
    const result = await client.listOwnedCalendars(tokens)
    expect(result).toHaveLength(1)
    expect(result[0].id).toBe('cal1')
    expect(result[0].isPrimary).toBe(true)
  })

  it('marks isPrimary true for the primary calendar', async () => {
    const client = new GoogleCalendarClient('cid', 'csecret', makeLogger())
    vi.stubGlobal('fetch', mockFetch([{
      ok: true,
      body: {
        items: [
          { id: 'primary', summary: 'Primary', accessRole: 'owner', primary: true },
          { id: 'work', summary: 'Work', accessRole: 'owner' },
        ],
      },
    }]))
    const result = await client.listOwnedCalendars(tokens)
    expect(result.find((c) => c.id === 'primary')?.isPrimary).toBe(true)
    expect(result.find((c) => c.id === 'work')?.isPrimary).toBe(false)
  })

  it('follows nextPageToken across pages before applying owner filter', async () => {
    const client = new GoogleCalendarClient('cid', 'csecret', makeLogger())
    vi.stubGlobal('fetch', mockFetch([
      {
        ok: true,
        body: {
          items: [{ id: 'cal1', summary: 'A', accessRole: 'owner' }],
          nextPageToken: 'tok2',
        },
      },
      {
        ok: true,
        body: {
          items: [
            { id: 'cal2', summary: 'B', accessRole: 'owner' },
            { id: 'cal3', summary: 'C', accessRole: 'freeBusyReader' },
          ],
        },
      },
    ]))
    const result = await client.listOwnedCalendars(tokens)
    expect(result).toHaveLength(2)
    expect(result.map((c) => c.id)).toEqual(['cal1', 'cal2'])
  })

  it('throws with status code on non-200', async () => {
    const client = new GoogleCalendarClient('cid', 'csecret', makeLogger())
    vi.stubGlobal('fetch', mockFetch([{ ok: false, status: 403, body: 'forbidden' }]))
    await expect(client.listOwnedCalendars(tokens)).rejects.toThrow('403')
  })
})

describe('GoogleCalendarClient.fetchEvents', () => {
  beforeEach(() => { vi.unstubAllGlobals() })

  it('includes singleEvents=true and orderBy=startTime in request', async () => {
    const client = new GoogleCalendarClient('cid', 'csecret', makeLogger())
    const fetchSpy = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      text: async () => '{}',
      json: async () => ({ items: [] }),
    })
    vi.stubGlobal('fetch', fetchSpy)
    await client.fetchEvents('cal1', tokens, { timeMin: '2024-01-01T00:00:00Z', timeMax: '2024-01-31T00:00:00Z' })
    const url = fetchSpy.mock.calls[0][0] as string
    expect(url).toContain('singleEvents=true')
    expect(url).toContain('orderBy=startTime')
  })

  it('filters out cancelled events', async () => {
    const client = new GoogleCalendarClient('cid', 'csecret', makeLogger())
    vi.stubGlobal('fetch', mockFetch([{
      ok: true,
      body: {
        items: [
          { id: 'e1', status: 'confirmed', start: {}, end: {} },
          { id: 'e2', status: 'cancelled', start: {}, end: {} },
        ],
      },
    }]))
    const events = await client.fetchEvents('cal1', tokens, { timeMin: '', timeMax: '' })
    expect(events).toHaveLength(1)
    expect(events[0].id).toBe('e1')
  })

  it('follows nextPageToken until exhausted', async () => {
    const client = new GoogleCalendarClient('cid', 'csecret', makeLogger())
    vi.stubGlobal('fetch', mockFetch([
      { ok: true, body: { items: [{ id: 'e1', start: {}, end: {} }], nextPageToken: 'tok2' } },
      { ok: true, body: { items: [{ id: 'e2', start: {}, end: {} }] } },
    ]))
    const events = await client.fetchEvents('cal1', tokens, { timeMin: '', timeMax: '' })
    expect(events).toHaveLength(2)
  })

  it('stops at 100 pages and logs a warning', async () => {
    const logger = makeLogger()
    const client = new GoogleCalendarClient('cid', 'csecret', logger)
    const pageResponse = { ok: true, body: { items: [{ id: 'e', start: {}, end: {} }], nextPageToken: 'more' } }
    vi.stubGlobal('fetch', mockFetch(Array(100).fill(pageResponse)))
    const events = await client.fetchEvents('cal1', tokens, { timeMin: '', timeMax: '' })
    expect(events).toHaveLength(100)
    expect(logger.warn).toHaveBeenCalledWith('fetchEvents pagination cap reached', { calendarId: 'cal1', pages: 100 })
  })
})

describe('GoogleCalendarClient.refreshTokens', () => {
  beforeEach(() => { vi.unstubAllGlobals() })

  it('returns new CalendarTokens with updated accessToken and expiresAt on success', async () => {
    const client = new GoogleCalendarClient('cid', 'csecret', makeLogger())
    vi.stubGlobal('fetch', mockFetch([{
      ok: true,
      body: { access_token: 'new-at', expires_in: 3600 },
    }]))
    const result = await client.refreshTokens('refresh-token')
    expect(result.accessToken).toBe('new-at')
    expect(result.refreshToken).toBe('refresh-token')
    expect(result.expiresAt.getTime()).toBeGreaterThan(Date.now())
  })

  it('throws OAuthError with code invalid_grant when Google responds with that error', async () => {
    const client = new GoogleCalendarClient('cid', 'csecret', makeLogger())
    vi.stubGlobal('fetch', mockFetch([{
      ok: false,
      status: 400,
      body: { error: 'invalid_grant' },
    }]))
    await expect(client.refreshTokens('bad-token')).rejects.toThrow(OAuthError)
    try {
      await client.refreshTokens('bad-token')
    } catch (e) {
      expect((e as OAuthError).code).toBe('invalid_grant')
    }
  })

  it('throws generic error on other non-200 failures', async () => {
    const client = new GoogleCalendarClient('cid', 'csecret', makeLogger())
    vi.stubGlobal('fetch', mockFetch([{ ok: false, status: 500, body: { error: 'server_error' } }]))
    await expect(client.refreshTokens('token')).rejects.toThrow()
    await expect(client.refreshTokens('token')).rejects.not.toBeInstanceOf(OAuthError)
  })
})
