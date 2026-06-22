import { NextResponse } from 'next/server'
import { headers } from 'next/headers'
import { authCapability } from '@/infrastructure/auth'
import { env } from '@/shared/env'
import { signState } from '@/shared/stateToken'

const WHOOP_AUTH_URL = 'https://api.prod.whoop.com/oauth/oauth2/auth'
const WHOOP_STATE_COOKIE = 'whoop_oauth_state'

export async function GET() {
  const session = await authCapability.requireSession(await headers())

  const state = signState(session.user.id)

  const redirectUri = `${env.BETTER_AUTH_URL}/api/integrations/whoop/callback`

  const authUrl = new URL(WHOOP_AUTH_URL)
  authUrl.searchParams.set('response_type', 'code')
  authUrl.searchParams.set('client_id', env.WHOOP_CLIENT_ID)
  authUrl.searchParams.set('redirect_uri', redirectUri)
  authUrl.searchParams.set('scope', 'offline read:profile read:cycles read:sleep read:recovery')
  authUrl.searchParams.set('state', state)

  const response = NextResponse.redirect(authUrl.toString())
  response.cookies.set(WHOOP_STATE_COOKIE, state, {
    httpOnly: true,
    sameSite: 'lax',
    maxAge: 300,
    secure: env.NODE_ENV === 'production',
    path: '/',
  })
  return response
}
