import { type NextRequest, NextResponse } from 'next/server'
import { headers } from 'next/headers'
import { authCapability } from '@/infrastructure/auth'
import { googleCalendarClient, postgresCalendarRepository, logger } from '@/infrastructure'
import { saveCalendarTokens } from '@/modules'
import { env } from '@/shared/env'
import { verifyState, STATE_COOKIE } from '../stateToken'

const REDIRECT_URI = `${env.BETTER_AUTH_URL}/api/integrations/google-calendar/callback`

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl

  if (searchParams.get('error') === 'access_denied') {
    return NextResponse.redirect(new URL('/onboarding?calendar_error=denied', env.BETTER_AUTH_URL))
  }

  const code = searchParams.get('code')
  if (!code) {
    return new NextResponse('Missing authorization code', { status: 400 })
  }

  const stateCookie = request.cookies.get(STATE_COOKIE)?.value
  if (!stateCookie) {
    return NextResponse.redirect(new URL('/onboarding?error=session_lost', env.BETTER_AUTH_URL))
  }

  let userId: string
  try {
    const payload = verifyState(stateCookie)
    userId = payload.userId
  } catch {
    return new NextResponse('Invalid or expired state token', { status: 403 })
  }

  // Verify the user still has an active session
  const session = await authCapability.getSession(await headers())
  if (!session || session.user.id !== userId) {
    return NextResponse.redirect(new URL('/sign-in', env.BETTER_AUTH_URL))
  }

  let tokens
  try {
    tokens = await googleCalendarClient.exchangeCode(code, REDIRECT_URI)
  } catch (err) {
    logger.error('Google Calendar token exchange failed', { err })
    return NextResponse.redirect(new URL('/onboarding?calendar_error=failed', env.BETTER_AUTH_URL))
  }

  if (!tokens.refreshToken) {
    logger.error('Google Calendar OAuth response missing refresh_token — OAuth client misconfiguration', { tokens })
    return NextResponse.redirect(new URL('/onboarding?calendar_error=config_error', env.BETTER_AUTH_URL))
  }

  await saveCalendarTokens(userId, tokens, 'https://www.googleapis.com/auth/calendar.readonly', postgresCalendarRepository)

  const response = NextResponse.redirect(new URL('/connect/calendar', env.BETTER_AUTH_URL))
  response.cookies.set(STATE_COOKIE, '', { maxAge: 0, path: '/' })
  return response
}
