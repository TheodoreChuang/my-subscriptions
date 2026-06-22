import { z } from 'zod'

// postgres.js calls decodeURIComponent on the username, password, and database
// name extracted from the DATABASE_URL. Node.js's WHATWG URL parser accepts
// non-special-scheme URLs (postgresql://) with malformed percent-sequences like
// %wo without re-encoding the %, so the malformed sequence reaches
// decodeURIComponent and throws URIError at build time. This refine catches
// that case at config-load time and produces a clear ZodError instead.
const dbUrl = z.string().url().refine((url) => {
  try {
    const { username, password, pathname } = new URL(url)
    decodeURIComponent(username)
    decodeURIComponent(password)
    decodeURIComponent(pathname.slice(1))
    return true
  } catch {
    return false
  }
}, 'DATABASE_URL contains malformed percent-encoding in credentials or database name — re-encode any literal % in the password as %25')

const serverSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']),
  DATABASE_URL: dbUrl,
  DATABASE_URL_DIRECT: dbUrl,
  BETTER_AUTH_SECRET: z.string().min(32),
  BETTER_AUTH_URL: z.string().url(),
  GOOGLE_CLIENT_ID: z.string().min(1),
  GOOGLE_CLIENT_SECRET: z.string().min(1),
  WHOOP_CLIENT_ID: z.string().min(1),
  WHOOP_CLIENT_SECRET: z.string().min(1),
  AI_GATEWAY_API_KEY: z.string().min(1),
})

// NEXT_PUBLIC_ vars — safe to expose to the browser. Empty for S1.
const clientSchema = z.object({})

export const env = {
  ...serverSchema.parse(process.env),
  ...clientSchema.parse(process.env),
}
