import { createGateway, generateObject } from 'ai'
import type { AICapability } from '@/shared/capabilities/ai'

let gateway: ReturnType<typeof createGateway> | null = null
function getGateway() {
  return (gateway ??= createGateway())
}

export class GatewayAIClient implements AICapability {
  async generateObject<T>(config: {
    system: string
    prompt: string
    schema: import('zod').ZodSchema<T>
  }): Promise<T> {
    const { object } = await generateObject({
      model: getGateway()('anthropic/claude-haiku-4-5'),
      system: config.system,
      prompt: config.prompt,
      schema: config.schema,
      mode: 'json',
    })
    return object
  }
}
