import { headers } from 'next/headers'
import { authCapability } from '@/infrastructure/auth'
import { postgresCalendarRepository } from '@/infrastructure'
import { getConnectionStatus } from '@/modules'
import { OnboardingPage } from '@/frontend/onboarding/OnboardingPage'

export const dynamic = 'force-dynamic'

export default async function OnboardingRoute() {
  const session = await authCapability.requireSession(await headers())
  const userId = session.user.id

  const connectionStatus = await getConnectionStatus(userId, postgresCalendarRepository)

  let selections: Array<{ externalCalendarId: string; name: string }> = []
  if (connectionStatus === 'connected') {
    const rows = await postgresCalendarRepository.getSelections(userId)
    selections = rows.map((r) => ({ externalCalendarId: r.externalCalendarId, name: r.name }))
  }

  return <OnboardingPage connectionStatus={connectionStatus} selections={selections} />
}
