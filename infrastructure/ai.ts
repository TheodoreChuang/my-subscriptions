import { createGateway, generateObject } from 'ai'
import type { AICapability } from '@/shared/capabilities/ai'

const gateway = createGateway()

export class GatewayAIClient implements AICapability {
  async generateObject<T>(config: {
    system: string
    prompt: string
    schema: import('zod').ZodSchema<T>
  }): Promise<T> {
    const { object } = await generateObject({
      model: gateway('anthropic/claude-haiku-4-5'),
      system: config.system,
      prompt: config.prompt,
      schema: config.schema,
      mode: 'json',
    })
    return object
  }
}
