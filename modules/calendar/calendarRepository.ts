import type { CalendarTokens } from '@/shared/capabilities/calendar'

export type IntegrationRow = {
  id: string
  userId: string
  provider: string
  accessToken: string
  refreshToken: string | null
  expiresAt: Date
  scope: string | null
  status: string
  updatedAt: Date
}

export type CalendarSelectionRow = {
  id: string
  integrationId: string
  externalCalendarId: string
  name: string
}

export interface CalendarRepository {
  getIntegration(userId: string): Promise<IntegrationRow | null>
  saveIntegration(userId: string, tokens: CalendarTokens, scope: string, category: string): Promise<void>
  markNeedsReconnect(userId: string): Promise<void>
  updateTokens(userId: string, tokens: CalendarTokens): Promise<void>
  getSelections(userId: string): Promise<CalendarSelectionRow[]>
  getSelectionsByIntegrationId(integrationId: string): Promise<CalendarSelectionRow[]>
  saveSelections(
    integrationId: string,
    selections: Array<{ externalCalendarId: string; name: string }>,
  ): Promise<void>
}
