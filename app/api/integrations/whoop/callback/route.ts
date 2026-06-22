import { type NextRequest, NextResponse } from 'next/server'
import { headers } from 'next/headers'
import { authCapability } from '@/infrastructure/auth'
import { postgresWhoopRepository, logger } from '@/infrastructure'
import { saveWhoopTokens } from '@/modules'
import { env } from '@/shared/env'
import { signState, verifyState } from '@/app/api/integrations/google-calendar/stateToken'
import { WHOOP_TOKEN_URL } from '@/infrastructure/whoop/whoopClient'

const WHOOP_STATE_COOKIE = 'whoop_oauth_state'

export { signState }

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl

  if (searchParams.get('error') === 'access_denied') {
    return NextResponse.redirect(new URL('/onboarding?whoop_error=denied', env.BETTER_AUTH_URL))
  }

  const code = searchParams.get('code')
  if (!code) {
    return new NextResponse('Missing authorization code', { status: 400 })
  }

  const stateCookie = request.cookies.get(WHOOP_STATE_COOKIE)?.value
  if (!stateCookie) {
    return NextResponse.redirect(new URL('/onboarding?error=session_lost', env.BETTER_AUTH_URL))
  }

  if (searchParams.get('state') !== stateCookie) {
    return new NextResponse('State mismatch', { status: 403 })
  }

  let userId: string
  try {
    const payload = verifyState(stateCookie)
    userId = payload.userId
  } catch {
    return new NextResponse('Invalid or expired state token', { status: 403 })
  }

  const session = await authCapability.getSession(await headers())
  if (!session || session.user.id !== userId) {
    return NextResponse.redirect(new URL('/sign-in', env.BETTER_AUTH_URL))
  }

  const redirectUri = `${env.BETTER_AUTH_URL}/api/integrations/whoop/callback`

  let tokens: { access_token: string; refresh_token: string; expires_in: number; scope?: string }
  try {
    const body = new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      client_id: env.WHOOP_CLIENT_ID,
      client_secret: env.WHOOP_CLIENT_SECRET,
      redirect_uri: redirectUri,
    })
    const res = await fetch(WHOOP_TOKEN_URL, {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body,
    })
    if (!res.ok) {
      logger.error('WHOOP token exchange failed', { status: res.status })
      const response = NextResponse.redirect(new URL('/onboarding?whoop_error=failed', env.BETTER_AUTH_URL))
      response.cookies.set(WHOOP_STATE_COOKIE, '', { maxAge: 0, path: '/' })
      return response
    }
    tokens = (await res.json()) as typeof tokens
  } catch (err) {
    logger.error('WHOOP token exchange network error', { err })
    const response = NextResponse.redirect(new URL('/onboarding?whoop_error=failed', env.BETTER_AUTH_URL))
    response.cookies.set(WHOOP_STATE_COOKIE, '', { maxAge: 0, path: '/' })
    return response
  }

  const healthTokens = {
    accessToken: tokens.access_token,
    refreshToken: tokens.refresh_token,
    expiresAt: new Date(Date.now() + tokens.expires_in * 1000),
  }
  const scope = tokens.scope ?? 'offline read:profile read:cycles read:sleep read:recovery'

  try {
    await saveWhoopTokens(userId, healthTokens, scope, postgresWhoopRepository)
  } catch (err) {
    logger.error('Failed to save WHOOP tokens', { err })
    const response = NextResponse.redirect(new URL('/onboarding?whoop_error=failed', env.BETTER_AUTH_URL))
    response.cookies.set(WHOOP_STATE_COOKIE, '', { maxAge: 0, path: '/' })
    return response
  }

  const response = NextResponse.redirect(new URL('/onboarding', env.BETTER_AUTH_URL))
  response.cookies.set(WHOOP_STATE_COOKIE, '', { maxAge: 0, path: '/' })
  return response
}
