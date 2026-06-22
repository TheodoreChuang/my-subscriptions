import type { WhoopRawData } from '@/shared/types/whoop'

export type HealthTokens = {
  accessToken: string
  refreshToken: string
  expiresAt: Date
}

export interface HealthCapability {
  exchangeCode(code: string, redirectUri: string): Promise<HealthTokens>
  refreshTokens(refreshToken: string): Promise<HealthTokens>
  fetchRawData(tokens: HealthTokens, window: { startDate: Date; endDate: Date }): Promise<WhoopRawData>
}
