import { z } from 'zod'

const serverSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']),
})

// NEXT_PUBLIC_ vars — safe to expose to the browser. Empty for S1.
const clientSchema = z.object({})

export const env = {
  ...serverSchema.parse(process.env),
  ...clientSchema.parse(process.env),
}
