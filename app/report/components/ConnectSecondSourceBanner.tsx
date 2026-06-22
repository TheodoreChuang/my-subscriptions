import type { ConnectedSource } from '@/shared/types/report'
import Link from 'next/link'

const COPY: Partial<Record<ConnectedSource, { heading: string; cta: string }>> = {
  calendar: {
    heading: 'Add WHOOP to unlock recovery correlations.',
    cta: 'Connect WHOOP',
  },
  health: {
    heading: 'Add Google Calendar to unlock schedule correlations.',
    cta: 'Connect Google Calendar',
  },
}

export function ConnectSecondSourceBanner({
  connectedSources,
}: {
  connectedSources: ConnectedSource[]
}) {
  if (connectedSources.length !== 1) return null

  const source = connectedSources[0]
  const copy = COPY[source]
  if (!copy) return null

  return (
    <div className="rounded-xl p-4 flex items-center justify-between gap-4 bg-primary/6 border border-primary/18">
      <p className="text-sm text-muted-foreground">{copy.heading}</p>
      <Link
        href="/onboarding"
        className="text-sm font-semibold whitespace-nowrap text-primary"
      >
        {copy.cta} →
      </Link>
    </div>
  )
}
