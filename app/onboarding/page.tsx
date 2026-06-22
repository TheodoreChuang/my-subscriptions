import { headers } from 'next/headers'
import { authCapability } from '@/infrastructure/auth'
import { postgresCalendarRepository, postgresWhoopRepository } from '@/infrastructure'
import { getConnectionStatus, getWhoopConnectionStatus } from '@/modules'
import { OnboardingPage } from '@/frontend/onboarding/OnboardingPage'

export const dynamic = 'force-dynamic'

export default async function OnboardingRoute() {
  const session = await authCapability.requireSession(await headers())
  const userId = session.user.id

  const [calendarStatus, whoopStatus] = await Promise.all([
    getConnectionStatus(userId, postgresCalendarRepository),
    getWhoopConnectionStatus(userId, postgresWhoopRepository),
  ])

  let selections: Array<{ externalCalendarId: string; name: string }> = []
  if (calendarStatus === 'connected') {
    const rows = await postgresCalendarRepository.getSelections(userId)
    selections = rows.map((r) => ({ externalCalendarId: r.externalCalendarId, name: r.name }))
  }

  return <OnboardingPage calendarStatus={calendarStatus} whoopStatus={whoopStatus} selections={selections} />
}
