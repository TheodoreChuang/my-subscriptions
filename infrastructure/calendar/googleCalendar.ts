import type { CalendarCapability, CalendarTokens, OwnedCalendar, RawCalendarEvent } from '@/shared/capabilities/calendar'
import { OAuthError } from '@/shared/capabilities/calendar'
import type { Logger } from '@/shared/capabilities/logger'

export { OAuthError }

const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token'
const GCAL_API_BASE = 'https://www.googleapis.com/calendar/v3'

export class GoogleCalendarClient implements CalendarCapability {
  constructor(
    private readonly clientId: string,
    private readonly clientSecret: string,
    private readonly logger: Logger,
  ) {}

  async exchangeCode(code: string, redirectUri: string): Promise<CalendarTokens> {
    const body = new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      client_id: this.clientId,
      client_secret: this.clientSecret,
      redirect_uri: redirectUri,
    })
    const res = await fetch(GOOGLE_TOKEN_URL, {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body,
    })
    if (!res.ok) {
      throw new Error(`exchangeCode failed ${res.status}: ${await res.text()}`)
    }
    const data = (await res.json()) as { access_token: string; refresh_token: string; expires_in: number }
    return {
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      expiresAt: new Date(Date.now() + data.expires_in * 1000),
    }
  }

  async listOwnedCalendars(tokens: CalendarTokens): Promise<OwnedCalendar[]> {
    const all: Array<{ id: string; summary?: string; primary?: boolean; accessRole: string }> = []
    let pageToken: string | undefined
    let pages = 0

    do {
      const params = new URLSearchParams({ minAccessRole: 'owner' })
      if (pageToken) params.set('pageToken', pageToken)

      const res = await fetch(`${GCAL_API_BASE}/users/me/calendarList?${params}`, {
        headers: { authorization: `Bearer ${tokens.accessToken}` },
      })
      if (!res.ok) {
        throw new Error(`listOwnedCalendars failed ${res.status}: ${await res.text()}`)
      }
      const page = (await res.json()) as { items?: typeof all; nextPageToken?: string }
      all.push(...(page.items ?? []))
      pageToken = page.nextPageToken
      pages++
    } while (pageToken && pages < 10)

    return all
      .filter((c) => c.accessRole === 'owner')
      .map((c) => ({
        id: c.id,
        name: c.summary ?? c.id,
        isPrimary: c.primary === true,
      }))
  }

  async fetchEvents(
    calendarId: string,
    tokens: CalendarTokens,
    window: { timeMin: string; timeMax: string },
  ): Promise<RawCalendarEvent[]> {
    const events: RawCalendarEvent[] = []
    let pageToken: string | undefined
    let pages = 0

    do {
      const params = new URLSearchParams({
        timeMin: window.timeMin,
        timeMax: window.timeMax,
        singleEvents: 'true',
        orderBy: 'startTime',
        maxResults: '2500',
      })
      if (pageToken) params.set('pageToken', pageToken)

      const res = await fetch(
        `${GCAL_API_BASE}/calendars/${encodeURIComponent(calendarId)}/events?${params}`,
        { headers: { authorization: `Bearer ${tokens.accessToken}` } },
      )
      if (!res.ok) {
        throw new Error(`fetchEvents failed ${res.status}: ${await res.text()}`)
      }
      const page = (await res.json()) as { items?: RawCalendarEvent[]; nextPageToken?: string }
      events.push(...(page.items ?? []).filter((e) => e.status !== 'cancelled'))
      pageToken = page.nextPageToken
      pages++

      if (pages >= 100 && pageToken) {
        this.logger.warn('fetchEvents pagination cap reached', { calendarId, pages: 100 })
        break
      }
    } while (pageToken)

    return events
  }

  async refreshTokens(refreshToken: string): Promise<CalendarTokens> {
    const body = new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
      client_id: this.clientId,
      client_secret: this.clientSecret,
    })
    const res = await fetch(GOOGLE_TOKEN_URL, {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body,
    })

    if (!res.ok) {
      const errData = (await res.json().catch(() => ({}))) as { error?: string }
      if (errData.error === 'invalid_grant') {
        throw new OAuthError('Google refresh token rejected', 'invalid_grant')
      }
      throw new Error(`refreshTokens failed ${res.status}`)
    }

    const data = (await res.json()) as { access_token?: string; expires_in?: number }
    if (!data.access_token) {
      throw new Error('refreshTokens: Google response missing access_token')
    }
    return {
      accessToken: data.access_token,
      refreshToken,
      expiresAt: new Date(Date.now() + (data.expires_in ?? 3600) * 1000),
    }
  }
}
