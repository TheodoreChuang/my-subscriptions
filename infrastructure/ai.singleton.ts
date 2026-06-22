import type { AICapability } from '@/shared/capabilities/ai'
import { GatewayAIClient } from './ai'

export const aiClient: AICapability = new GatewayAIClient()
