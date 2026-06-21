'use client'

import { useState } from 'react'
import { authClient } from './auth-client'

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
      <path
        fill="#4285F4"
        d="M16.51 8H8.98v3h4.3c-.18 1-.74 1.48-1.6 2.04v2.01h2.6a7.8 7.8 0 0 0 2.38-5.88c0-.57-.05-.66-.15-1.18Z"
      />
      <path
        fill="#34A853"
        d="M8.98 17c2.16 0 3.97-.72 5.3-1.94l-2.6-2.01c-.72.48-1.63.77-2.7.77-2.08 0-3.84-1.41-4.47-3.29H1.83v2.07A8 8 0 0 0 8.98 17Z"
      />
      <path
        fill="#FBBC05"
        d="M4.51 10.53A4.8 4.8 0 0 1 4.26 9c0-.53.09-1.04.25-1.53V5.4H1.83A8 8 0 0 0 .98 9c0 1.29.31 2.51.85 3.6l2.68-2.07Z"
      />
      <path
        fill="#EA4335"
        d="M8.98 3.18c1.17 0 2.23.4 3.06 1.2l2.3-2.3A8 8 0 0 0 .98 9l2.83 2.07c.63-1.88 2.39-3.3 4.47-3.3l.7.41Z"
      />
    </svg>
  )
}

export function SignInPage({ errorParam }: { errorParam?: string | null }) {
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(
    errorParam === 'auth_failed' ? 'Sign-in failed. Please try again.' : null
  )

  async function handleGoogleSignIn() {
    setIsLoading(true)
    setError(null)
    await authClient.signIn.social({
      provider: 'google',
      callbackURL: '/report',
    })
    setIsLoading(false)
  }

  return (
    <main className="min-h-screen flex items-center justify-center px-4 bg-background">
      <div className="w-full max-w-sm flex flex-col items-center gap-8">
        {/* Logo + wordmark */}
        <div className="flex flex-col items-center gap-2">
          <div className="w-10 h-10 rounded-full bg-primary flex items-center justify-center">
            <span className="text-primary-foreground text-lg font-bold">M</span>
          </div>
          <span className="text-xl font-semibold tracking-tight">MySubscriptions</span>
        </div>

        {/* Value proposition */}
        <p className="text-center text-muted-foreground text-sm leading-relaxed">
          Your life, decoded. Connect your calendar and health data to unlock monthly insights that actually mean something.
        </p>

        {/* Error message */}
        {error && (
          <p role="alert" className="text-sm text-destructive text-center">
            {error}
          </p>
        )}

        {/* Google sign-in button */}
        <button
          type="button"
          onClick={handleGoogleSignIn}
          disabled={isLoading}
          className="flex items-center justify-center gap-3 w-full rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500 disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
        >
          {isLoading ? (
            <span className="w-[18px] h-[18px] border-2 border-gray-400 border-t-gray-700 rounded-full animate-spin" aria-hidden="true" />
          ) : (
            <GoogleIcon />
          )}
          {isLoading ? 'Signing in…' : 'Continue with Google'}
        </button>

        {/* Terms */}
        <p className="text-xs text-muted-foreground text-center">
          By continuing you agree to our{' '}
          <a href="#" className="underline underline-offset-2 hover:text-foreground">
            Terms
          </a>{' '}
          &amp;{' '}
          <a href="#" className="underline underline-offset-2 hover:text-foreground">
            Privacy Policy
          </a>
          .
        </p>
      </div>
    </main>
  )
}
