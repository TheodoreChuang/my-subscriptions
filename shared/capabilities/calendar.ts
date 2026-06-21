export type CalendarTokens = {
  accessToken: string
  refreshToken: string
  expiresAt: Date
}

export type OwnedCalendar = {
  id: string
  name: string
  isPrimary: boolean
}

export type RawCalendarEvent = {
  id: string
  summary?: string
  status?: string
  start: { date?: string; dateTime?: string; timeZone?: string }
  end: { date?: string; dateTime?: string }
  recurringEventId?: string
}

export interface CalendarCapability {
  exchangeCode(code: string, redirectUri: string): Promise<CalendarTokens>
  listOwnedCalendars(tokens: CalendarTokens): Promise<OwnedCalendar[]>
  fetchEvents(
    calendarId: string,
    tokens: CalendarTokens,
    window: { timeMin: string; timeMax: string },
  ): Promise<RawCalendarEvent[]>
  refreshTokens(refreshToken: string): Promise<CalendarTokens>
}
