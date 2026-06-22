import type { Logger } from '@/shared/capabilities/logger'
import type { CalendarCapability } from '@/shared/capabilities/calendar'
import type { HealthCapability } from '@/shared/capabilities/health'
import type { AICapability } from '@/shared/capabilities/ai'
import type { Report, ConnectedSource, WeekHighlight } from '@/shared/types/report'
import type { CalendarRepository } from '@/modules/calendar/calendarRepository'
import type { WhoopRepository } from '@/modules/whoop/whoopRepository'
import type { ReportRepository } from './reportRepository'
import { reportSchema } from '@/shared/schemas/report'
import { getConnectionStatus, fetchEventsForWindow } from '@/modules/calendar/calendarService'
import { getWhoopConnectionStatus, fetchRawDataForWindow } from '@/modules/whoop/whoopService'
import { normalizeCalendarEvents, normalizeWhoopCycles, joinSignals } from './normalize'
import { computeMetrics } from './metrics'
import { buildEvidencePacket } from './evidencePacket'
import { generateInsights } from './aiInsights'
import { checkReportStatus } from './reportStatus'

export type ReportDeps = {
  calendarRepo: CalendarRepository
  calendarClient: CalendarCapability
  whoopRepo: WhoopRepository
  whoopClient: HealthCapability
  aiClient: AICapability
  reportRepo: ReportRepository
  logger: Logger
}

function formatWindowLabel(start: Date, end: Date): string {
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
  const s = `${months[start.getUTCMonth()]} ${start.getUTCDate()}`
  const e = `${months[end.getUTCMonth()]} ${end.getUTCDate()}`
  return `${s} – ${e}`
}

function toDateStr(d: Date): string {
  return d.toISOString().slice(0, 10)
}

/** Reads both integration rows unconditionally; returns max updatedAt, or now() if neither exists. */
export async function computeIntegrationSnapshotAt(
  userId: string,
  repos: { calendarRepo: CalendarRepository; whoopRepo: WhoopRepository },
): Promise<Date> {
  const [calIntegration, whoopIntegration] = await Promise.all([
    repos.calendarRepo.getIntegration(userId),
    repos.whoopRepo.getIntegration(userId),
  ])
  const dates: Date[] = []
  if (calIntegration) dates.push(calIntegration.updatedAt)
  if (whoopIntegration) dates.push(whoopIntegration.updatedAt)
  return dates.length > 0 ? new Date(Math.max(...dates.map((d) => d.getTime()))) : new Date()
}

async function generateReport(userId: string, deps: ReportDeps): Promise<Report> {
  const { calendarRepo, calendarClient, whoopRepo, whoopClient, aiClient, reportRepo, logger } = deps

  // Window: rolling last 30 days
  const windowEnd = new Date()
  const windowStart = new Date(windowEnd.getTime() - 30 * 24 * 60 * 60 * 1000)

  // Connection check
  const [calendarStatus, whoopStatus] = await Promise.all([
    getConnectionStatus(userId, calendarRepo),
    getWhoopConnectionStatus(userId, whoopRepo),
  ])

  const connectedSources: ConnectedSource[] = []
  if (whoopStatus === 'connected') connectedSources.push('health')

  // Calendar is only an active source when OAuth'd AND calendars are selected
  let hasCalendarSelections = false
  if (calendarStatus === 'connected') {
    const selections = await calendarRepo.getSelections(userId)
    hasCalendarSelections = selections.length > 0
    if (hasCalendarSelections) connectedSources.push('calendar')
  }

  // Parallel fetch — tier-gated
  const fetchWindow = {
    timeMin: windowStart.toISOString(),
    timeMax: windowEnd.toISOString(),
  }

  const [rawEvents, rawWhoop] = await Promise.all([
    calendarStatus === 'connected' && hasCalendarSelections
      ? fetchEventsForWindow(userId, fetchWindow, calendarRepo, calendarClient, logger)
      : Promise.resolve([] as import('@/shared/capabilities/calendar').RawCalendarEvent[]),
    whoopStatus === 'connected'
      ? fetchRawDataForWindow(userId, { startDate: windowStart, endDate: windowEnd }, whoopRepo, whoopClient, logger)
      : Promise.resolve({ cycles: [], sleeps: [], recoveries: [] }),
  ])

  // Normalize
  const calSignals = normalizeCalendarEvents(rawEvents)
  const whoopSignals = normalizeWhoopCycles(rawWhoop)

  // Join
  const daySummaries = joinSignals(calSignals, whoopSignals)

  // Event count for metrics (from pre-join signals)
  const totalCalendarEvents = calSignals.reduce((sum, s) => sum + s.eventCount, 0)

  // Metrics
  const metrics = computeMetrics(daySummaries, connectedSources, totalCalendarEvents)

  // Evidence packet
  const window = {
    start: toDateStr(windowStart),
    end: toDateStr(windowEnd),
    days: 30,
    label: formatWindowLabel(windowStart, windowEnd),
  }
  const coverageDays = daySummaries.length
  const evidencePacket = buildEvidencePacket({
    window,
    coverageDays,
    connectedSources,
    metrics,
    daySummaries,
  })

  // Capture integration snapshot AFTER the parallel fetch — fetchEventsForWindow and
  // fetchRawDataForWindow may call updateTokens (setting integration.updatedAt = now).
  // Capturing before the fetch would persist a stale snapshot, causing spurious
  // integration_changed regenerations on every load that crosses a token-expiry boundary.
  const integrationSnapshotAt = await computeIntegrationSnapshotAt(userId, { calendarRepo, whoopRepo })

  // Generate AI insights — propagates error on failure (R8: no persist on failure)
  const aiOutput = await generateInsights(evidencePacket, aiClient)

  // Assemble report — merge deterministic + AI fields
  const weekHighlights: WeekHighlight[] = evidencePacket.weekStats.map((ws, i) => ({
    label: ws.label,
    dateRange: ws.dateRange,
    recoveryPercent: ws.recoveryPercent,
    summary: aiOutput.weekHighlightSummaries[i] ?? '',
  }))

  const report = reportSchema.parse({
    window,
    coverageDays,
    connectedSources,
    executiveSummary: aiOutput.executiveSummary,
    weekHighlights,
    daySummaries,
    metrics,
    findings: aiOutput.findings,
    generatedAt: new Date().toISOString(),
  })

  // Persist — after successful assembly and validation
  await reportRepo.saveReport(userId, report, integrationSnapshotAt)

  logger.info('getReport complete', { coverageDays, connectedSources })
  return report
}

export async function getReport(userId: string, deps: ReportDeps): Promise<Report> {
  const { calendarRepo, whoopRepo, reportRepo } = deps

  const [stored, currentIntegrationAt] = await Promise.all([
    reportRepo.getReport(userId),
    computeIntegrationSnapshotAt(userId, { calendarRepo, whoopRepo }),
  ])

  const windowEndExpected = new Date().toISOString().slice(0, 10)
  const status = checkReportStatus(stored, currentIntegrationAt, windowEndExpected)

  if (status.status === 'current') {
    return status.report
  }

  return generateReport(userId, deps)
}
