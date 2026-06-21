import { z } from 'zod'

const serverSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']),
  DATABASE_URL: z.string().url(),
  DATABASE_URL_DIRECT: z.string().url(),
  BETTER_AUTH_SECRET: z.string().min(32),
  BETTER_AUTH_URL: z.string().url(),
  GOOGLE_CLIENT_ID: z.string().min(1),
  GOOGLE_CLIENT_SECRET: z.string().min(1),
})

// NEXT_PUBLIC_ vars — safe to expose to the browser. Empty for S1.
const clientSchema = z.object({})

export const env = {
  ...serverSchema.parse(process.env),
  ...clientSchema.parse(process.env),
}
