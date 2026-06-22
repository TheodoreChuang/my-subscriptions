import type { z } from 'zod'

export interface AICapability {
  generateObject<T>(config: {
    system: string
    prompt: string
    schema: z.ZodSchema<T>
  }): Promise<T>
}
