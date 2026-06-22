import { describe, it, expect, vi } from 'vitest'
import {
  getWhoopConnectionStatus,
  saveWhoopTokens,
  fetchRawDataForWindow,
  IntegrationNotFoundError,
} from '@/modules/whoop/whoopService'
import { OAuthError } from '@/shared/capabilities/calendar'
import type { WhoopRepository, IntegrationRow } from '@/modules/whoop/whoopRepository'
import type { HealthCapability, HealthTokens } from '@/shared/capabilities/health'
import type { WhoopRawData } from '@/shared/types/whoop'

const makeLogger = () => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn() })

const FUTURE = new Date(Date.now() + 60 * 60 * 1000)
const NEAR_EXPIRY = new Date(Date.now() + 2 * 60 * 1000) // 2 min — below 5 min buffer

function makeIntegration(overrides: Partial<IntegrationRow> = {}): IntegrationRow {
  return {
    id: 'int1',
    userId: 'u1',
    provider: 'whoop',
    accessToken: 'at',
    refreshToken: 'rt',
    expiresAt: FUTURE,
    scope: 'offline read:cycles',
    status: 'active',
    ...overrides,
  }
}

function makeRepo(overrides: Partial<WhoopRepository> = {}): WhoopRepository {
  return {
    getIntegration: vi.fn().mockResolvedValue(makeIntegration()),
    saveIntegration: vi.fn().mockResolvedValue(undefined),
    markNeedsReconnect: vi.fn().mockResolvedValue(undefined),
    updateTokens: vi.fn().mockResolvedValue(true),
    ...overrides,
  }
}

const freshTokens: HealthTokens = { accessToken: 'new-at', refreshToken: 'new-rt', expiresAt: FUTURE }
const emptyData: WhoopRawData = { cycles: [], sleeps: [], recoveries: [] }

function makeClient(overrides: Partial<HealthCapability> = {}): HealthCapability {
  return {
    exchangeCode: vi.fn().mockResolvedValue(freshTokens),
    refreshTokens: vi.fn().mockResolvedValue(freshTokens),
    fetchRawData: vi.fn().mockResolvedValue(emptyData),
    ...overrides,
  }
}

const window = { startDate: new Date('2026-05-22'), endDate: new Date('2026-06-22') }

// ─── getWhoopConnectionStatus ────────────────────────────────────────────────

describe('getWhoopConnectionStatus', () => {
  it('returns not_connected when no row', async () => {
    const repo = makeRepo({ getIntegration: vi.fn().mockResolvedValue(null) })
    expect(await getWhoopConnectionStatus('u1', repo)).toBe('not_connected')
  })

  it('returns needs_reconnect when status is needs_reconnect', async () => {
    const repo = makeRepo({ getIntegration: vi.fn().mockResolvedValue(makeIntegration({ status: 'needs_reconnect' })) })
    expect(await getWhoopConnectionStatus('u1', repo)).toBe('needs_reconnect')
  })

  it('returns connected when status is active', async () => {
    const repo = makeRepo()
    expect(await getWhoopConnectionStatus('u1', repo)).toBe('connected')
  })
})

// ─── saveWhoopTokens ──────────────────────────────────────────────────────────

describe('saveWhoopTokens', () => {
  it('calls repo.saveIntegration with userId, tokens, scope, and health category', async () => {
    const repo = makeRepo()
    const tokens: HealthTokens = { accessToken: 'at', refreshToken: 'rt', expiresAt: FUTURE }
    await saveWhoopTokens('u1', tokens, 'offline read:cycles', repo)
    expect(repo.saveIntegration).toHaveBeenCalledWith('u1', tokens, 'offline read:cycles', 'health')
  })
})

// ─── fetchRawDataForWindow ────────────────────────────────────────────────────

describe('fetchRawDataForWindow', () => {
  it('(tokens valid) calls client.fetchRawData with stored tokens, does not call refreshTokens', async () => {
    const repo = makeRepo()
    const client = makeClient()
    await fetchRawDataForWindow('u1', window, repo, client, makeLogger())
    expect(client.refreshTokens).not.toHaveBeenCalled()
    expect(client.fetchRawData).toHaveBeenCalledWith(
      expect.objectContaining({ accessToken: 'at' }),
      window,
    )
  })

  it('(tokens near expiry) calls refreshTokens and updateTokens with currentRefreshToken', async () => {
    const repo = makeRepo({
      getIntegration: vi.fn().mockResolvedValue(makeIntegration({ expiresAt: NEAR_EXPIRY })),
    })
    const client = makeClient()
    await fetchRawDataForWindow('u1', window, repo, client, makeLogger())
    expect(client.refreshTokens).toHaveBeenCalledWith('rt')
    expect(repo.updateTokens).toHaveBeenCalledWith('u1', 'rt', freshTokens)
  })

  it('(tokens near expiry) uses new accessToken after successful updateTokens', async () => {
    const repo = makeRepo({
      getIntegration: vi.fn().mockResolvedValue(makeIntegration({ expiresAt: NEAR_EXPIRY })),
      updateTokens: vi.fn().mockResolvedValue(true),
    })
    const client = makeClient()
    await fetchRawDataForWindow('u1', window, repo, client, makeLogger())
    const calledTokens = (client.fetchRawData as ReturnType<typeof vi.fn>).mock.calls[0][0] as HealthTokens
    expect(calledTokens.accessToken).toBe('new-at')
  })

  it('(concurrent refresh — updateTokens returns false) re-reads integration and uses fresh token', async () => {
    const freshRow = makeIntegration({ accessToken: 'concurrent-at', expiresAt: FUTURE })
    const repo = makeRepo({
      getIntegration: vi.fn()
        .mockResolvedValueOnce(makeIntegration({ expiresAt: NEAR_EXPIRY }))
        .mockResolvedValueOnce(freshRow),
      updateTokens: vi.fn().mockResolvedValue(false),
    })
    const client = makeClient()
    await fetchRawDataForWindow('u1', window, repo, client, makeLogger())
    expect(repo.getIntegration).toHaveBeenCalledTimes(2)
    const calledTokens = (client.fetchRawData as ReturnType<typeof vi.fn>).mock.calls[0][0] as HealthTokens
    expect(calledTokens.accessToken).toBe('concurrent-at')
  })

  it('(refresh throws) calls markNeedsReconnect and rethrows', async () => {
    const repo = makeRepo({
      getIntegration: vi.fn().mockResolvedValue(makeIntegration({ expiresAt: NEAR_EXPIRY })),
    })
    const client = makeClient({
      refreshTokens: vi.fn().mockRejectedValue(new Error('WHOOP refreshTokens failed 401')),
    })
    await expect(fetchRawDataForWindow('u1', window, repo, client, makeLogger())).rejects.toThrow()
    expect(repo.markNeedsReconnect).toHaveBeenCalledWith('u1')
  })

  it('(no integration row) throws IntegrationNotFoundError', async () => {
    const repo = makeRepo({ getIntegration: vi.fn().mockResolvedValue(null) })
    await expect(fetchRawDataForWindow('u1', window, repo, makeClient(), makeLogger())).rejects.toThrow(
      IntegrationNotFoundError,
    )
  })

  it('(success) calls logger.info with whoop data retrieved and correct counts', async () => {
    const repo = makeRepo()
    const data: WhoopRawData = {
      cycles: [{ id: 1, start: '', end: null, timezone_offset: '+00:00', score_state: 'SCORED' }],
      sleeps: [{ id: 's1', cycle_id: 1, nap: false, score_state: 'SCORED' }],
      recoveries: [{ cycle_id: 1, sleep_id: 's1', score_state: 'SCORED' }],
    }
    const client = makeClient({ fetchRawData: vi.fn().mockResolvedValue(data) })
    const logger = makeLogger()
    await fetchRawDataForWindow('u1', window, repo, client, logger)
    expect(logger.info).toHaveBeenCalledWith('whoop data retrieved', {
      cycleCount: 1,
      sleepCount: 1,
      recoveryCount: 1,
    })
  })

  it('(HTTP 401 from data endpoint) marks needs_reconnect and rethrows OAuthError', async () => {
    const repo = makeRepo()
    const client = makeClient({
      fetchRawData: vi.fn().mockRejectedValue(new Error('WHOOP paginateAll failed 401 https://example.com: Unauthorized')),
    })
    await expect(fetchRawDataForWindow('u1', window, repo, client, makeLogger())).rejects.toBeInstanceOf(OAuthError)
    expect(repo.markNeedsReconnect).toHaveBeenCalledWith('u1')
  })
})
