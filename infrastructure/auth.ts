import { betterAuth } from 'better-auth'
import { drizzleAdapter } from 'better-auth/adapters/drizzle'
import { nextCookies } from 'better-auth/next-js'
import { redirect } from 'next/navigation'
import { env } from '@/shared/env'
import { db } from './db/client'
import * as schema from './db/schema'
import type { AuthCapability, AuthSession } from '@/shared/capabilities/auth'

export const auth = betterAuth({
  secret: env.BETTER_AUTH_SECRET,
  baseURL: env.BETTER_AUTH_URL,
  database: drizzleAdapter(db, { provider: 'pg', schema }),
  socialProviders: {
    google: {
      clientId: env.GOOGLE_CLIENT_ID,
      clientSecret: env.GOOGLE_CLIENT_SECRET,
    },
  },
  errorCallbackURL: '/sign-in?error=auth_failed',
  plugins: [nextCookies()],
})

export const authCapability: AuthCapability = {
  async getSession(headers: Headers): Promise<AuthSession | null> {
    const result = await auth.api.getSession({ headers })
    if (!result) return null
    return {
      user: {
        id: result.user.id,
        name: result.user.name,
        email: result.user.email,
        image: result.user.image,
      },
      session: {
        id: result.session.id,
        expiresAt: result.session.expiresAt,
        userId: result.session.userId,
      },
    }
  },

  async requireSession(headers: Headers): Promise<AuthSession> {
    const session = await authCapability.getSession(headers)
    if (!session) {
      redirect('/sign-in')
    }
    return session
  },

  async signOut(headers: Headers): Promise<void> {
    await auth.api.signOut({ headers })
  },
}
