import { type NextRequest, NextResponse } from 'next/server'
import { headers } from 'next/headers'
import { authCapability } from '@/infrastructure/auth'
import { postgresWhoopRepository, whoopClient, logger } from '@/infrastructure'
import { saveWhoopTokens } from '@/modules'
import { env } from '@/shared/env'
import { verifyState } from '@/shared/stateToken'

const WHOOP_STATE_COOKIE = 'whoop_oauth_state'

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

  let tokens
  try {
    tokens = await whoopClient.exchangeCode(code, redirectUri)
  } catch (err) {
    logger.error('WHOOP token exchange failed', { err })
    const response = NextResponse.redirect(new URL('/onboarding?whoop_error=failed', env.BETTER_AUTH_URL))
    response.cookies.set(WHOOP_STATE_COOKIE, '', { maxAge: 0, path: '/' })
    return response
  }

  try {
    await saveWhoopTokens(
      userId,
      tokens,
      'offline read:profile read:cycles read:sleep read:recovery',
      postgresWhoopRepository,
    )
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
