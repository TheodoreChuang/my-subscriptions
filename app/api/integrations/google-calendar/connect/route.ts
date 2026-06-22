import { NextResponse } from 'next/server'
import { headers } from 'next/headers'
import { authCapability } from '@/infrastructure/auth'
import { env } from '@/shared/env'
import { signState, STATE_COOKIE } from '../stateToken'

const REDIRECT_URI = `${env.BETTER_AUTH_URL}/api/integrations/google-calendar/callback`

export async function GET() {
  const session = await authCapability.requireSession(await headers())

  const state = signState(session.user.id)

  const authUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth')
  authUrl.searchParams.set('response_type', 'code')
  authUrl.searchParams.set('client_id', env.GOOGLE_CLIENT_ID)
  authUrl.searchParams.set('redirect_uri', REDIRECT_URI)
  authUrl.searchParams.set('scope', 'https://www.googleapis.com/auth/calendar.readonly')
  authUrl.searchParams.set('access_type', 'offline')
  authUrl.searchParams.set('prompt', 'consent')
  authUrl.searchParams.set('state', state)

  const response = NextResponse.redirect(authUrl.toString())
  response.cookies.set(STATE_COOKIE, state, {
    httpOnly: true,
    sameSite: 'lax',
    maxAge: 300,
    secure: env.NODE_ENV === 'production',
    path: '/',
  })
  return response
}
