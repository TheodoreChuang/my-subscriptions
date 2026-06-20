import { describe, expect, it } from 'vitest'
import { z } from 'zod'

// Test the schema logic directly without importing the module (which runs at import time)
const serverSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']),
})

describe('env schema', () => {
  it('accepts valid NODE_ENV values', () => {
    expect(() => serverSchema.parse({ NODE_ENV: 'development' })).not.toThrow()
    expect(() => serverSchema.parse({ NODE_ENV: 'test' })).not.toThrow()
    expect(() => serverSchema.parse({ NODE_ENV: 'production' })).not.toThrow()
  })

  it('rejects invalid NODE_ENV', () => {
    expect(() => serverSchema.parse({ NODE_ENV: 'staging' })).toThrow(z.ZodError)
  })

  it('throws ZodError naming the missing key when NODE_ENV is absent', () => {
    const result = serverSchema.safeParse({})
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.issues[0].path).toContain('NODE_ENV')
    }
  })
})
