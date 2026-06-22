import { env } from '@/shared/env'
import { logger } from '../logger'
import { WhoopClient } from './whoopClient'
import type { HealthCapability } from '@/shared/capabilities/health'

export const whoopClient: HealthCapability = new WhoopClient(
  env.WHOOP_CLIENT_ID,
  env.WHOOP_CLIENT_SECRET,
  logger,
)
