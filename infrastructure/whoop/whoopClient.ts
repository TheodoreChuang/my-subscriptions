import type { Logger } from '@/shared/capabilities/logger'
import type { HealthCapability, HealthTokens } from '@/shared/capabilities/health'
import type { WhoopRawData } from '@/shared/types/whoop'
import { WhoopCycleSchema, WhoopSleepSchema, WhoopRecoverySchema, WhoopPageSchema } from '@/shared/types/whoop'

export const WHOOP_AUTH_URL = 'https://api.prod.whoop.com/oauth/oauth2/auth'
export const WHOOP_TOKEN_URL = 'https://api.prod.whoop.com/oauth/oauth2/token'
export const WHOOP_API_BASE = 'https://api.prod.whoop.com/developer'

const PAGE_CAP = 50

export class WhoopClient implements HealthCapability {
  constructor(
    private readonly clientId: string,
    private readonly clientSecret: string,
    private readonly logger: Logger,
  ) {}

  async exchangeCode(code: string, redirectUri: string): Promise<HealthTokens> {
    const body = new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      client_id: this.clientId,
      client_secret: this.clientSecret,
      redirect_uri: redirectUri,
    })
    const res = await fetch(WHOOP_TOKEN_URL, {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body,
    })
    if (!res.ok) {
      throw new Error(`WHOOP exchangeCode failed ${res.status}: ${await res.text()}`)
    }
    const data = (await res.json()) as { access_token: string; refresh_token: string; expires_in: number }
    return {
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      expiresAt: new Date(Date.now() + data.expires_in * 1000),
    }
  }

  async refreshTokens(refreshToken: string): Promise<HealthTokens> {
    const body = new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
      client_id: this.clientId,
      client_secret: this.clientSecret,
    })
    const res = await fetch(WHOOP_TOKEN_URL, {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body,
    })
    if (!res.ok) {
      throw new Error(`WHOOP refreshTokens failed ${res.status}: ${await res.text()}`)
    }
    const data = (await res.json()) as { access_token: string; refresh_token: string; expires_in: number }
    return {
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      expiresAt: new Date(Date.now() + data.expires_in * 1000),
    }
  }

  async paginateAll<T>(
    buildUrl: (nextToken?: string) => string,
    accessToken: string,
  ): Promise<T[]> {
    const all: T[] = []
    let nextToken: string | undefined
    let pages = 0

    do {
      const url = buildUrl(nextToken)
      const res = await fetch(url, {
        headers: { authorization: `Bearer ${accessToken}` },
      })
      if (!res.ok) {
        throw new Error(`WHOOP paginateAll failed ${res.status} ${url}: ${await res.text()}`)
      }
      const page = (await res.json()) as { records: T[]; next_token?: string }
      all.push(...(page.records ?? []))
      nextToken = page.next_token
      pages++
    } while (nextToken && pages < PAGE_CAP)

    return all
  }

  async fetchRawData(tokens: HealthTokens, window: { startDate: Date; endDate: Date }): Promise<WhoopRawData> {
    const { accessToken } = tokens
    const startISO = window.startDate.toISOString()
    const endISO = window.endDate.toISOString()

    const makeUrl = (path: string) => (nextToken?: string) => {
      const params = new URLSearchParams({ start: startISO, end: endISO, limit: '25' })
      if (nextToken) params.set('nextToken', nextToken)
      return `${WHOOP_API_BASE}${path}?${params}`
    }

    const [rawCycles, rawSleeps, rawRecoveries] = await Promise.all([
      this.paginateAll(makeUrl('/v2/cycle'), accessToken),
      this.paginateAll(makeUrl('/v2/activity/sleep'), accessToken),
      this.paginateAll(makeUrl('/v2/recovery'), accessToken),
    ])

    const WhoopCyclePageSchema = WhoopPageSchema(WhoopCycleSchema)
    const WhoopSleepPageSchema = WhoopPageSchema(WhoopSleepSchema)
    const WhoopRecoveryPageSchema = WhoopPageSchema(WhoopRecoverySchema)

    const cyclesParsed = WhoopCyclePageSchema.shape.records.parse(rawCycles)
    const sleepsParsed = WhoopSleepPageSchema.shape.records.parse(rawSleeps)
    const recoveriesParsed = WhoopRecoveryPageSchema.shape.records.parse(rawRecoveries)

    const scoredCycles = cyclesParsed.filter((c) => c.score_state === 'SCORED')
    const scoredSleeps = sleepsParsed.filter((s) => s.score_state === 'SCORED' && !s.nap)
    const scoredRecoveries = recoveriesParsed.filter((r) => r.score_state === 'SCORED')

    const sleepByCycleId = new Map(scoredSleeps.map((s) => [s.cycle_id, s]))
    const recoveryByCycleId = new Map(scoredRecoveries.map((r) => [r.cycle_id, r]))

    const matchedSleeps: typeof scoredSleeps = []
    const matchedRecoveries: typeof scoredRecoveries = []

    for (const cycle of scoredCycles) {
      const sleep = sleepByCycleId.get(cycle.id)
      const recovery = recoveryByCycleId.get(cycle.id)
      if (sleep) matchedSleeps.push(sleep)
      if (recovery) matchedRecoveries.push(recovery)
    }

    this.logger.info('whoop fetchRawData complete', {
      cycles: rawCycles.length,
      sleeps: rawSleeps.length,
      recoveries: rawRecoveries.length,
      scoredCycles: scoredCycles.length,
      matchedSleeps: matchedSleeps.length,
      matchedRecoveries: matchedRecoveries.length,
    })

    return { cycles: scoredCycles, sleeps: matchedSleeps, recoveries: matchedRecoveries }
  }
}
