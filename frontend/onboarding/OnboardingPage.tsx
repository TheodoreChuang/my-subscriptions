'use client'

import { useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { Suspense } from 'react'

type ConnectionStatus = 'not_connected' | 'needs_reconnect' | 'connected'

type SelectedCalendar = { externalCalendarId: string; name: string }

function OnboardingContent({
  connectionStatus,
  selections,
}: {
  connectionStatus: ConnectionStatus
  selections: SelectedCalendar[]
}) {
  const searchParams = useSearchParams()
  const calendarError = searchParams.get('calendar_error')
  const generalError = searchParams.get('error')
  const [calendarAlertDismissed, setCalendarAlertDismissed] = useState(false)
  const [generalAlertDismissed, setGeneralAlertDismissed] = useState(false)

  const isConnected = connectionStatus === 'connected'

  return (
    <main className="min-h-screen flex items-center justify-center px-4 bg-background">
      <div className="w-full max-w-md space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Connect your world.</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Connect your services to unlock monthly insights about how you spend your time.
          </p>
        </div>

        {/* General error alert */}
        {generalError === 'session_lost' && !generalAlertDismissed && (
          <div role="alert" className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
            <span className="flex-1">Something went wrong during sign-in. Please try connecting again.</span>
            <button type="button" onClick={() => setGeneralAlertDismissed(true)} aria-label="Dismiss" className="text-destructive/70 hover:text-destructive">✕</button>
          </div>
        )}

        {/* Google Calendar card */}
        <div
          className={`rounded-xl p-4 space-y-3 ${
            connectionStatus === 'not_connected'
              ? 'border-2 border-dashed border-border'
              : 'border border-border bg-card shadow-sm'
          }`}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-sm">📅</div>
              <span className="font-medium">Google Calendar</span>
            </div>
            {connectionStatus !== 'not_connected' && (
              <span className="text-xs text-green-600 font-medium">✓ Connected</span>
            )}
          </div>

          {/* Calendar-specific error alert */}
          {calendarError && !calendarAlertDismissed && (
            <div role="alert" className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
              <span className="flex-1">
                {calendarError === 'denied'
                  ? 'Google Calendar access was not granted. Try again.'
                  : calendarError === 'config_error'
                    ? 'Calendar connection failed due to a configuration error. Please contact support.'
                    : 'Calendar connection failed. Please try again.'}
              </span>
              <button type="button" onClick={() => setCalendarAlertDismissed(true)} aria-label="Dismiss" className="text-destructive/70 hover:text-destructive">✕</button>
            </div>
          )}

          {connectionStatus === 'needs_reconnect' && (
            <p className="text-xs text-amber-600">Connection expired — reconnect to continue.</p>
          )}

          {connectionStatus === 'connected' && selections.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {selections.map((s) => (
                <span
                  key={s.externalCalendarId}
                  className="inline-flex items-center gap-1 rounded-full bg-green-50 border border-green-200 px-2 py-0.5 text-xs text-green-700"
                >
                  ✓ {s.name}
                </span>
              ))}
            </div>
          )}

          <div className="flex items-center gap-2">
            {connectionStatus === 'connected' ? (
              <a
                href="/connect/calendar"
                className="text-sm text-muted-foreground hover:text-foreground underline underline-offset-2"
              >
                Edit calendars
              </a>
            ) : (
              <a
                href="/api/integrations/google-calendar/connect"
                className="inline-flex items-center gap-2 rounded-lg bg-foreground text-background px-4 py-2 text-sm font-medium hover:bg-foreground/90 transition-colors"
              >
                Connect with Google →
              </a>
            )}
          </div>
        </div>

        {/* WHOOP card — placeholder for S6 */}
        <div className="rounded-xl border-2 border-dashed border-border p-4 opacity-50 space-y-3">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-red-100 flex items-center justify-center text-sm">💪</div>
            <span className="font-medium">WHOOP</span>
            <span className="ml-auto text-xs text-muted-foreground rounded-full bg-muted px-2 py-0.5">Coming soon</span>
          </div>
          <button
            type="button"
            disabled
            tabIndex={-1}
            title="WHOOP integration coming soon"
            className="inline-flex items-center gap-2 rounded-lg border border-border bg-muted px-4 py-2 text-sm font-medium text-muted-foreground cursor-not-allowed"
          >
            Connect with WHOOP →
          </button>
        </div>

        {/* Tier hint */}
        <p className="text-xs text-muted-foreground text-center">
          1 service → time or recovery view · Both → schedule ↔ recovery insights
        </p>

        {/* Primary CTA */}
        {isConnected ? (
          <a
            href="/report"
            className="block w-full rounded-lg bg-orange-500 text-white text-center px-4 py-3 text-sm font-semibold hover:bg-orange-600 transition-colors"
          >
            Start with Calendar →
          </a>
        ) : (
          <button
            type="button"
            disabled
            title="Connect a service to get started"
            className="w-full rounded-lg bg-orange-500 text-white px-4 py-3 text-sm font-semibold opacity-30 cursor-not-allowed"
          >
            Get started →
          </button>
        )}
      </div>
    </main>
  )
}

export function OnboardingPage({
  connectionStatus,
  selections,
}: {
  connectionStatus: ConnectionStatus
  selections: SelectedCalendar[]
}) {
  return (
    <Suspense>
      <OnboardingContent connectionStatus={connectionStatus} selections={selections} />
    </Suspense>
  )
}
