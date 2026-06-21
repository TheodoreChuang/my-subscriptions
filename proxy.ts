import { NextRequest, NextResponse } from 'next/server'
import { getSessionCookie } from 'better-auth/cookies'

export async function proxy(request: NextRequest) {
  const sessionCookie = getSessionCookie(request)
  const isSignIn = request.nextUrl.pathname.startsWith('/sign-in')

  // Only redirect unauthenticated requests away from protected routes.
  // Authenticated /sign-in is handled by the RSC page's real DB check
  // to avoid stale-cookie infinite redirect loops.
  if (!sessionCookie && !isSignIn) {
    return NextResponse.redirect(new URL('/sign-in', request.url))
  }
  return NextResponse.next()
}

export const config = {
  matcher: [
    '/((?!api|_next/static|_next/image|favicon\\.ico|sitemap\\.xml|robots\\.txt|.*\\.png$).*)',
  ],
}
