import type { IntegrationRow } from '@/modules/calendar/calendarRepository'
import type { HealthTokens } from '@/shared/capabilities/health'

export type { IntegrationRow }

export interface WhoopRepository {
  getIntegration(userId: string): Promise<IntegrationRow | null>
  saveIntegration(userId: string, tokens: HealthTokens, scope: string, category: string): Promise<void>
  markNeedsReconnect(userId: string): Promise<void>
  updateTokens(userId: string, currentRefreshToken: string, newTokens: HealthTokens): Promise<boolean>
}
