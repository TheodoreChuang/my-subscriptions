import { Suspense } from 'react'
import { redirect } from 'next/navigation'
import { headers } from 'next/headers'
import { authCapability } from '@/infrastructure/auth'
import {
  googleCalendarClient,
  postgresCalendarRepository,
  postgresWhoopRepository,
  whoopClient,
  logger,
  aiClient,
  postgresReportRepository,
} from '@/infrastructure'
import {
  getReport,
  getConnectionStatus,
  getWhoopConnectionStatus,
  getReportPageStatus,
} from '@/modules'
import { resolveReportAccess } from '@/modules/report/reportAccess'
import { IntegrationNotFoundError } from '@/modules/whoop/whoopService'
import { OAuthError } from '@/shared/capabilities/calendar'
import { ReportPage } from './ReportPage'
import { AnalysisScreen } from './components/AnalysisScreen'
export const dynamic = 'force-dynamic'

const reportDeps = {
  calendarRepo: postgresCalendarRepository,
  calendarClient: googleCalendarClient,
  whoopRepo: postgresWhoopRepository,
  whoopClient,
  aiClient,
  reportRepo: postgresReportRepository,
  logger,
}

export async function GenerateReportContent({ userId }: { userId: string }) {
  try {
    const report = await getReport(userId, reportDeps)
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

export default async function ReportRoute() {
  const session = await authCapability.requireSession(await headers())
  const userId = session.user.id

  const [calendarStatus, whoopStatus, selections] = await Promise.all([
    getConnectionStatus(userId, postgresCalendarRepository),
    getWhoopConnectionStatus(userId, postgresWhoopRepository),
    postgresCalendarRepository.getSelections(userId),
  ])
  const hasCalendarSelections = selections.length > 0

  const access = resolveReportAccess(calendarStatus, hasCalendarSelections, whoopStatus)

  if (access === 'onboarding') redirect('/onboarding')
  if (access === 'connect-calendar') redirect('/connect/calendar')

  const pageStatus = await getReportPageStatus(userId, {
    calendarRepo: postgresCalendarRepository,
    whoopRepo: postgresWhoopRepository,
    reportRepo: postgresReportRepository,
  })

  if (pageStatus.status === 'current') {
    return <ReportPage report={pageStatus.report} />
  }

  return (
    <Suspense fallback={<AnalysisScreen staleReport={pageStatus.staleReport} />}>
      <GenerateReportContent userId={userId} />
    </Suspense>
  )
}
