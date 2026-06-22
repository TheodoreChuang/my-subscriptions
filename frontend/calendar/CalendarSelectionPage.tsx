'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import type { OwnedCalendar } from '@/shared/capabilities/calendar'

export function CalendarSelectionPage({
  ownedCalendars,
  existingSelectionIds,
}: {
  ownedCalendars: OwnedCalendar[]
  existingSelectionIds: string[]
}) {
  const router = useRouter()
  const [selected, setSelected] = useState<Set<string>>(
    () => new Set(
      ownedCalendars.length > 0 && existingSelectionIds.length === 0
        ? ownedCalendars.filter((c) => c.isPrimary).map((c) => c.id)
        : existingSelectionIds,
    ),
  )
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (ownedCalendars.length === 0) {
    return (
      <main className="min-h-screen flex items-center justify-center px-4 bg-background">
        <div className="max-w-md text-center space-y-4">
          <h1 className="text-2xl font-semibold">No owned calendars found</h1>
          <p className="text-muted-foreground">
            We couldn&apos;t find any calendars you own on this Google account.
          </p>
          <a
            href="/api/integrations/google-calendar/connect"
            className="inline-block rounded-lg bg-primary text-primary-foreground px-4 py-2 text-sm font-medium hover:bg-primary/90"
          >
            Try a different account
          </a>
        </div>
      </main>
    )
  }

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  async function handleSave() {
    setIsSaving(true)
    setError(null)
    try {
      const res = await fetch('/api/integrations/google-calendar/selections', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ selectedIds: Array.from(selected) }),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        setError((body as { error?: string }).error ?? 'Failed to save. Please try again.')
        return
      }
      router.push('/onboarding')
    } catch {
      setError('Network error. Please try again.')
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <main className="min-h-screen flex items-center justify-center px-4 bg-background">
      <div className="w-full max-w-md space-y-6">
        <div>
          <h1 className="text-2xl font-semibold">Choose your calendars</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Select the calendars that reflect how you actually spend your time.
          </p>
        </div>

        <ul className="space-y-2">
          {ownedCalendars.map((cal) => (
            <li key={cal.id}>
              <label className="flex items-center gap-3 rounded-lg border border-border p-3 cursor-pointer hover:bg-accent/50 transition-colors">
                <input
                  type="checkbox"
                  checked={selected.has(cal.id)}
                  onChange={() => toggle(cal.id)}
                  className="h-4 w-4 rounded"
                />
                <span className="text-sm font-medium">{cal.name}</span>
                {cal.isPrimary && (
                  <span className="ml-auto text-xs text-muted-foreground">Primary</span>
                )}
              </label>
            </li>
          ))}
        </ul>

        {error && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}

        <button
          type="button"
          onClick={handleSave}
          disabled={selected.size === 0 || isSaving}
          className="w-full rounded-lg bg-primary text-primary-foreground px-4 py-2.5 text-sm font-medium hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {isSaving ? 'Saving…' : 'Save and continue'}
        </button>
      </div>
    </main>
  )
}
