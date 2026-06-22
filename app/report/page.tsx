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
  computeIntegrationSnapshotAt,
  checkReportStatus,
} from '@/modules'
import { resolveReportAccess } from '@/modules/report/reportAccess'
import { IntegrationNotFoundError } from '@/modules/whoop/whoopService'
import { OAuthError } from '@/shared/capabilities/calendar'
import { ReportPage } from './ReportPage'
import { AnalysisScreen } from './components/AnalysisScreen'
import type { Report } from '@/shared/types/report'

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
  let report: Report
  try {
    report = await getReport(userId, reportDeps)
  } catch (err) {
    if (err instanceof OAuthError && err.code === 'invalid_grant') {
      redirect('/onboarding')
    }
    if (err instanceof IntegrationNotFoundError) {
      redirect('/onboarding')
    }
    throw err
  }
  return <ReportPage report={report} />
}

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

  // Fast status check — 2–3 DB reads, no pipeline
  const windowEndExpected = new Date().toISOString().slice(0, 10)
  const [stored, currentIntegrationAt] = await Promise.all([
    postgresReportRepository.getReport(userId),
    computeIntegrationSnapshotAt(userId, {
      calendarRepo: postgresCalendarRepository,
      whoopRepo: postgresWhoopRepository,
    }),
  ])

  const status = checkReportStatus(stored, currentIntegrationAt, windowEndExpected)

  // Fast path: report is current — no loading flash
  if (status.status === 'current') {
    return <ReportPage report={status.report} />
  }

  // Slow path: stream AnalysisScreen fallback while GenerateReportContent runs
  const staleReport = stored?.report ?? null
  return (
    <Suspense fallback={<AnalysisScreen staleReport={staleReport} />}>
      <GenerateReportContent userId={userId} />
    </Suspense>
  )
}
