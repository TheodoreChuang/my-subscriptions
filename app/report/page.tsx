import { redirect } from 'next/navigation'
import { headers } from 'next/headers'
import { authCapability } from '@/infrastructure/auth'
import { googleCalendarClient, postgresCalendarRepository, logger } from '@/infrastructure'
import { getReport, getConnectionStatus, fetchEventsForWindow } from '@/modules'
import { ReportPage } from './ReportPage'

export const dynamic = 'force-dynamic'

export default async function ReportRoute() {
  const session = await authCapability.requireSession(await headers())
  const userId = session.user.id

  const connectionStatus = await getConnectionStatus(userId, postgresCalendarRepository)

  if (connectionStatus === 'not_connected' || connectionStatus === 'needs_reconnect') {
    redirect('/onboarding')
  }

  const selections = await postgresCalendarRepository.getSelections(userId)
  if (selections.length === 0) {
    redirect('/connect/calendar')
  }

  const now = new Date()
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
  await fetchEventsForWindow(
    userId,
    { timeMin: thirtyDaysAgo.toISOString(), timeMax: now.toISOString() },
    postgresCalendarRepository,
    googleCalendarClient,
    logger,
  )

  const report = await getReport(logger)
  return <ReportPage report={report} />
}
