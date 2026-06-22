import { eq, and, sql } from 'drizzle-orm'
import { db } from './client'
import { integration } from './schema'
import type { WhoopRepository } from '@/modules/whoop/whoopRepository'
import type { IntegrationRow } from '@/modules/calendar/calendarRepository'
import type { HealthTokens } from '@/shared/capabilities/health'

export class PostgresWhoopRepository implements WhoopRepository {
  async getIntegration(userId: string): Promise<IntegrationRow | null> {
    const row = await db
      .select()
      .from(integration)
      .where(and(eq(integration.userId, userId), eq(integration.provider, 'whoop')))
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
    tokens: HealthTokens,
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
        provider: 'whoop',
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
          refreshToken: sql`COALESCE(EXCLUDED."refreshToken", "integration"."refreshToken")`,
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
      .where(and(eq(integration.userId, userId), eq(integration.provider, 'whoop')))
  }

  async updateTokens(
    userId: string,
    currentRefreshToken: string,
    newTokens: HealthTokens,
  ): Promise<boolean> {
    const updated = await db
      .update(integration)
      .set({
        accessToken: newTokens.accessToken,
        refreshToken: newTokens.refreshToken,
        expiresAt: newTokens.expiresAt,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(integration.userId, userId),
          eq(integration.provider, 'whoop'),
          eq(integration.refreshToken, currentRefreshToken),
        ),
      )
      .returning({ id: integration.id })
    return updated.length > 0
  }
}
