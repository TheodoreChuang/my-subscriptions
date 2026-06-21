import { describe, expect, it } from 'vitest'
import { z } from 'zod'

const serverSchema = z.object({
  DATABASE_URL: z.string().url(),
  DATABASE_URL_DIRECT: z.string().url(),
  BETTER_AUTH_SECRET: z.string().min(32),
  BETTER_AUTH_URL: z.string().url(),
  GOOGLE_CLIENT_ID: z.string().min(1),
  GOOGLE_CLIENT_SECRET: z.string().min(1),
})

const validEnv = {
  DATABASE_URL: 'postgresql://postgres:postgres@localhost:54322/postgres',
  DATABASE_URL_DIRECT: 'postgresql://postgres:postgres@localhost:54322/postgres',
  BETTER_AUTH_SECRET: 'a'.repeat(32),
  BETTER_AUTH_URL: 'http://localhost:3000',
  GOOGLE_CLIENT_ID: 'client-id-123',
  GOOGLE_CLIENT_SECRET: 'client-secret-456',
}

describe('server env schema', () => {
  it('accepts a valid set of env vars', () => {
    expect(() => serverSchema.parse(validEnv)).not.toThrow()
  })

  it('rejects DATABASE_URL when absent', () => {
    const rest = Object.fromEntries(
      Object.entries(validEnv).filter(([k]) => k !== 'DATABASE_URL')
    )
    const result = serverSchema.safeParse(rest)
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.issues.some((i) => i.path.includes('DATABASE_URL'))).toBe(true)
    }
  })

  it('rejects BETTER_AUTH_SECRET shorter than 32 chars', () => {
    const result = serverSchema.safeParse({ ...validEnv, BETTER_AUTH_SECRET: 'short' })
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.issues.some((i) => i.path.includes('BETTER_AUTH_SECRET'))).toBe(true)
    }
  })

  it('rejects BETTER_AUTH_URL that is not a valid URL', () => {
    const result = serverSchema.safeParse({ ...validEnv, BETTER_AUTH_URL: 'not-a-url' })
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.issues.some((i) => i.path.includes('BETTER_AUTH_URL'))).toBe(true)
    }
  })

  it('rejects GOOGLE_CLIENT_ID as empty string', () => {
    const result = serverSchema.safeParse({ ...validEnv, GOOGLE_CLIENT_ID: '' })
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.issues.some((i) => i.path.includes('GOOGLE_CLIENT_ID'))).toBe(true)
    }
  })
})
