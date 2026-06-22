import { redirect } from 'next/navigation'
import { headers } from 'next/headers'
import { authCapability } from '@/infrastructure/auth'
import { googleCalendarClient, postgresCalendarRepository, postgresWhoopRepository, whoopClient, logger } from '@/infrastructure'
import { getReport, getConnectionStatus, getWhoopConnectionStatus } from '@/modules'
import { resolveReportAccess } from '@/modules/report/reportAccess'
import { IntegrationNotFoundError } from '@/modules/whoop/whoopService'
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

  try {
    const report = await getReport(userId, {
      calendarRepo: postgresCalendarRepository,
      calendarClient: googleCalendarClient,
      whoopRepo: postgresWhoopRepository,
      whoopClient,
      logger,
    })
    return <ReportPage report={report} />
  } catch (err) {
    if (err instanceof OAuthError && err.code === 'invalid_grant') {
      redirect('/onboarding')
    }
    if (err instanceof IntegrationNotFoundError) {
      redirect('/onboarding')
    }
    throw err
  }
}
