import { redirect } from 'next/navigation'
import { headers } from 'next/headers'
import { authCapability } from '@/infrastructure/auth'
import { googleCalendarClient, postgresCalendarRepository, postgresWhoopRepository, whoopClient, logger } from '@/infrastructure'
import { getReport, getConnectionStatus, fetchEventsForWindow, getWhoopConnectionStatus, fetchRawDataForWindow } from '@/modules'
import { resolveReportAccess } from '@/modules/report/reportAccess'
import { OAuthError } from '@/infrastructure/calendar/googleCalendar'
import { ReportPage } from './ReportPage'

export const dynamic = 'force-dynamic'

export default async function ReportRoute() {
  const session = await authCapability.requireSession(await headers())
  const userId = session.user.id

  const [calendarStatus, whoopStatus] = await Promise.all([
    getConnectionStatus(userId, postgresCalendarRepository),
    getWhoopConnectionStatus(userId, postgresWhoopRepository),
  ])

  const selections = await postgresCalendarRepository.getSelections(userId)
  const hasCalendarSelections = selections.length > 0

  const access = resolveReportAccess(calendarStatus, hasCalendarSelections, whoopStatus)

  if (access === 'onboarding') redirect('/onboarding')
  if (access === 'connect-calendar') redirect('/connect/calendar')

  const now = new Date()
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)

  try {
    if (calendarStatus === 'connected' && hasCalendarSelections) {
      await fetchEventsForWindow(
        userId,
        { timeMin: thirtyDaysAgo.toISOString(), timeMax: now.toISOString() },
        postgresCalendarRepository,
        googleCalendarClient,
        logger,
      )
    }

    if (whoopStatus === 'connected') {
      await fetchRawDataForWindow(
        userId,
        { startDate: thirtyDaysAgo, endDate: now },
        postgresWhoopRepository,
        whoopClient,
        logger,
      )
    }
  } catch (err) {
    if (err instanceof OAuthError && err.code === 'invalid_grant') {
      redirect('/onboarding')
    }
    throw err
  }

  const report = await getReport(logger)
  return <ReportPage report={report} />
}
