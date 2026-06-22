import type { CalendarCapability, CalendarTokens, OwnedCalendar, RawCalendarEvent } from '@/shared/capabilities/calendar'
import { OAuthError } from '@/shared/capabilities/calendar'
import type { Logger } from '@/shared/capabilities/logger'
import type { CalendarRepository } from './calendarRepository'

export class IntegrationNotFoundError extends Error {
  constructor() {
    super('No Google Calendar integration found for this user')
    this.name = 'IntegrationNotFoundError'
  }
}

export class NoSelectionsError extends Error {
  constructor() {
    super('No calendars selected for this user')
    this.name = 'NoSelectionsError'
  }
}

const REFRESH_BUFFER_MS = 5 * 60 * 1000

async function refreshTokensIfNeeded(
  userId: string,
  integration: { accessToken: string; refreshToken: string | null; expiresAt: Date },
  repo: CalendarRepository,
  client: CalendarCapability,
): Promise<string> {
  const timeToExpiry = integration.expiresAt.getTime() - Date.now()
  if (timeToExpiry >= REFRESH_BUFFER_MS) {
    return integration.accessToken
  }

  const refreshToken = integration.refreshToken
  if (!refreshToken) {
    await repo.markNeedsReconnect(userId)
    throw new OAuthError('No refresh token — reconnect required', 'invalid_grant')
  }

  try {
    const newTokens = await client.refreshTokens(refreshToken)
    await repo.updateTokens(userId, newTokens)
    return newTokens.accessToken
  } catch (err) {
    if (err instanceof OAuthError && err.code === 'invalid_grant') {
      // Optimistic concurrency: re-read the row in case a concurrent request refreshed it
      const freshRow = await repo.getIntegration(userId)
      if (freshRow && freshRow.expiresAt.getTime() > Date.now()) {
        return freshRow.accessToken
      }
      await repo.markNeedsReconnect(userId)
      throw err
    }
    throw err
  }
}

export async function getConnectionStatus(
  userId: string,
  repo: CalendarRepository,
): Promise<'not_connected' | 'needs_reconnect' | 'connected'> {
  const row = await repo.getIntegration(userId)
  if (!row) return 'not_connected'
  if (row.status === 'needs_reconnect') return 'needs_reconnect'
  return 'connected'
}

export async function saveCalendarTokens(
  userId: string,
  tokens: CalendarTokens,
  scope: string,
  repo: CalendarRepository,
): Promise<void> {
  await repo.saveIntegration(userId, tokens, scope, 'calendar')
}

export async function listOwnedCalendars(
  userId: string,
  repo: CalendarRepository,
  client: CalendarCapability,
): Promise<OwnedCalendar[]> {
  const integration = await repo.getIntegration(userId)
  if (!integration) throw new IntegrationNotFoundError()

  const accessToken = await refreshTokensIfNeeded(userId, integration, repo, client)
  try {
    return await client.listOwnedCalendars({ ...integration, accessToken, refreshToken: integration.refreshToken ?? '' })
  } catch (err) {
    if (err instanceof OAuthError && err.code === 'invalid_grant') {
      await repo.markNeedsReconnect(userId)
      throw err
    }
    throw err
  }
}

export async function updateSelections(
  userId: string,
  selections: Array<{ externalCalendarId: string; name: string }>,
  repo: CalendarRepository,
): Promise<void> {
  const integration = await repo.getIntegration(userId)
  if (!integration) throw new IntegrationNotFoundError()
  await repo.saveSelections(integration.id, selections)
  await repo.touchIntegration(userId)
}

export async function fetchEventsForWindow(
  userId: string,
  window: { timeMin: string; timeMax: string },
  repo: CalendarRepository,
  client: CalendarCapability,
  logger: Logger,
): Promise<RawCalendarEvent[]> {
  const integration = await repo.getIntegration(userId)
  if (!integration) throw new IntegrationNotFoundError()

  const selectionRows = await repo.getSelectionsByIntegrationId(integration.id)
  if (selectionRows.length === 0) throw new NoSelectionsError()

  const accessToken = await refreshTokensIfNeeded(userId, integration, repo, client)
  const tokens = { ...integration, accessToken, refreshToken: integration.refreshToken ?? '' }

  try {
    const eventsByCalendar = await Promise.all(
      selectionRows.map((sel) => client.fetchEvents(sel.externalCalendarId, tokens, window)),
    )
    const allEvents = eventsByCalendar.flat()
    logger.info('calendar events retrieved', {
      calendarCount: selectionRows.length,
      totalEvents: allEvents.length,
    })
    return allEvents
  } catch (err) {
    if (err instanceof OAuthError && err.code === 'invalid_grant') {
      await repo.markNeedsReconnect(userId)
      throw err
    }
    throw err
  }
}
