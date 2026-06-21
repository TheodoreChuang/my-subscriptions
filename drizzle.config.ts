import { config } from 'dotenv'
import { z } from 'zod'
import { defineConfig } from 'drizzle-kit'

config({ path: '.env.local' })

const databaseUrlDirect = z.string().url().parse(process.env.DATABASE_URL_DIRECT)

export default defineConfig({
  schema: './infrastructure/db/schema.ts',
  out: './infrastructure/db/migrations',
  dialect: 'postgresql',
  dbCredentials: { url: databaseUrlDirect },
})
