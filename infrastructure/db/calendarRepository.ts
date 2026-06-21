import { eq, and } from 'drizzle-orm'
import { db } from './client'
import { integration, calendarSelection } from './schema'
import type { CalendarRepository, IntegrationRow, CalendarSelectionRow } from '@/modules/calendar/calendarRepository'
import type { CalendarTokens } from '@/shared/capabilities/calendar'

export class PostgresCalendarRepository implements CalendarRepository {
  async getIntegration(userId: string): Promise<IntegrationRow | null> {
    const row = await db
      .select()
      .from(integration)
      .where(and(eq(integration.userId, userId), eq(integration.provider, 'google_calendar')))
      .limit(1)
    if (row.length === 0) return null
    const r = row[0]
    return {
      id: r.id,
      userId: r.userId,
      provider: r.provider,
      accessToken: r.accessToken,
      refreshToken: r.refreshToken,
      expiresAt: r.expiresAt,
      scope: r.scope,
      status: r.status,
    }
  }

  async saveIntegration(
    userId: string,
    tokens: CalendarTokens,
    scope: string,
    category: string,
  ): Promise<void> {
    const now = new Date()
    await db
      .insert(integration)
      .values({
        id: crypto.randomUUID(),
        userId,
        category,
        provider: 'google_calendar',
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
        expiresAt: tokens.expiresAt,
        scope,
        status: 'active',
        createdAt: now,
        updatedAt: now,
      })
      .onConflictDoUpdate({
        target: [integration.userId, integration.provider],
        set: {
          accessToken: tokens.accessToken,
          refreshToken: tokens.refreshToken,
          expiresAt: tokens.expiresAt,
          scope,
          status: 'active',
          updatedAt: now,
        },
      })
  }

  async markNeedsReconnect(userId: string): Promise<void> {
    await db
      .update(integration)
      .set({ status: 'needs_reconnect', updatedAt: new Date() })
      .where(and(eq(integration.userId, userId), eq(integration.provider, 'google_calendar')))
  }

  async updateTokens(userId: string, tokens: CalendarTokens): Promise<void> {
    await db
      .update(integration)
      .set({
        accessToken: tokens.accessToken,
        expiresAt: tokens.expiresAt,
        updatedAt: new Date(),
      })
      .where(and(eq(integration.userId, userId), eq(integration.provider, 'google_calendar')))
  }

  async getSelections(userId: string): Promise<CalendarSelectionRow[]> {
    const integration_row = await this.getIntegration(userId)
    if (!integration_row) return []
    const rows = await db
      .select()
      .from(calendarSelection)
      .where(eq(calendarSelection.integrationId, integration_row.id))
    return rows.map((r) => ({
      id: r.id,
      integrationId: r.integrationId,
      externalCalendarId: r.externalCalendarId,
      name: r.name,
    }))
  }

  async saveSelections(
    integrationId: string,
    selections: Array<{ externalCalendarId: string; name: string }>,
  ): Promise<void> {
    await db.transaction(async (tx) => {
      await tx
        .delete(calendarSelection)
        .where(eq(calendarSelection.integrationId, integrationId))
      if (selections.length > 0) {
        await tx.insert(calendarSelection).values(
          selections.map((s) => ({
            id: crypto.randomUUID(),
            integrationId,
            externalCalendarId: s.externalCalendarId,
            name: s.name,
            createdAt: new Date(),
          })),
        )
      }
    })
  }
}
