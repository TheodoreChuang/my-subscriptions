import { redirect } from 'next/navigation'
import { headers } from 'next/headers'
import { authCapability } from '@/infrastructure/auth'
import { googleCalendarClient, postgresCalendarRepository } from '@/infrastructure'
import { getConnectionStatus, listOwnedCalendars } from '@/modules'
import { OAuthError } from '@/infrastructure/calendar/googleCalendar'
import { CalendarSelectionPage } from '@/frontend/calendar/CalendarSelectionPage'

export const dynamic = 'force-dynamic'

export default async function CalendarSelectRoute() {
  const session = await authCapability.requireSession(await headers())
  const userId = session.user.id

  const status = await getConnectionStatus(userId, postgresCalendarRepository)
  if (status === 'not_connected' || status === 'needs_reconnect') {
    redirect('/onboarding')
  }

  let ownedCalendars
  try {
    ownedCalendars = await listOwnedCalendars(userId, postgresCalendarRepository, googleCalendarClient)
  } catch (err) {
    if (err instanceof OAuthError && err.code === 'invalid_grant') {
      redirect('/onboarding')
    }
    throw err
  }

  const selectionRows = await postgresCalendarRepository.getSelections(userId)

  return (
    <CalendarSelectionPage
      ownedCalendars={ownedCalendars}
      existingSelectionIds={selectionRows.map((s) => s.externalCalendarId)}
    />
  )
}
