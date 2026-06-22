import type { HealthCapability, HealthTokens } from '@/shared/capabilities/health'
import type { Logger } from '@/shared/capabilities/logger'
import type { WhoopRawData } from '@/shared/types/whoop'
import { OAuthError } from '@/shared/capabilities/calendar'
import type { WhoopRepository } from './whoopRepository'

export class IntegrationNotFoundError extends Error {
  constructor() {
    super('No WHOOP integration found for this user')
    this.name = 'IntegrationNotFoundError'
  }
}

const REFRESH_BUFFER_MS = 5 * 60 * 1000

export async function getWhoopConnectionStatus(
  userId: string,
  repo: WhoopRepository,
): Promise<'not_connected' | 'needs_reconnect' | 'connected'> {
  const row = await repo.getIntegration(userId)
  if (!row) return 'not_connected'
  if (row.status === 'needs_reconnect') return 'needs_reconnect'
  return 'connected'
}

export async function saveWhoopTokens(
  userId: string,
  tokens: HealthTokens,
  scope: string,
  repo: WhoopRepository,
): Promise<void> {
  await repo.saveIntegration(userId, tokens, scope, 'health')
}

export async function fetchRawDataForWindow(
  userId: string,
  window: { startDate: Date; endDate: Date },
  repo: WhoopRepository,
  client: HealthCapability,
  logger: Logger,
): Promise<WhoopRawData> {
  const integration = await repo.getIntegration(userId)
  if (!integration) throw new IntegrationNotFoundError()

  let accessToken = integration.accessToken
  const timeToExpiry = integration.expiresAt.getTime() - Date.now()

  if (timeToExpiry < REFRESH_BUFFER_MS) {
    const currentRefreshToken = integration.refreshToken
    if (!currentRefreshToken) {
      await repo.markNeedsReconnect(userId)
      throw new OAuthError('No refresh token — reconnect required', 'invalid_grant')
    }

    let newTokens: HealthTokens
    try {
      newTokens = await client.refreshTokens(currentRefreshToken)
    } catch (err) {
      await repo.markNeedsReconnect(userId)
      throw err
    }

    // Compare-and-swap: only update if the stored refresh token hasn't already changed
    // (concurrent request may have refreshed it first — WHOOP rotates refresh tokens)
    const swapped = await repo.updateTokens(userId, currentRefreshToken, newTokens)
    if (swapped) {
      accessToken = newTokens.accessToken
    } else {
      // Concurrent refresh won the race; re-read fresh tokens from DB
      const freshRow = await repo.getIntegration(userId)
      if (!freshRow) throw new IntegrationNotFoundError()
      accessToken = freshRow.accessToken
    }
  }

  const tokens: HealthTokens = {
    accessToken,
    refreshToken: integration.refreshToken ?? '',
    expiresAt: integration.expiresAt,
  }

  let data: WhoopRawData
  try {
    data = await client.fetchRawData(tokens, window)
  } catch (err) {
    // HTTP 401 from any data endpoint signals auth failure
    if (err instanceof Error && err.message.includes('401')) {
      await repo.markNeedsReconnect(userId)
      throw new OAuthError('WHOOP access token rejected', 'invalid_grant')
    }
    throw err
  }

  logger.info('whoop data retrieved', {
    cycleCount: data.cycles.length,
    sleepCount: data.sleeps.length,
    recoveryCount: data.recoveries.length,
  })

  return data
}
