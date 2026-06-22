import type { Logger } from '@/shared/capabilities/logger'
import type { CalendarCapability } from '@/shared/capabilities/calendar'
import type { HealthCapability } from '@/shared/capabilities/health'
import type { Report, ConnectedSource, WeekHighlight } from '@/shared/types/report'
import type { CalendarRepository } from '@/modules/calendar/calendarRepository'
import type { WhoopRepository } from '@/modules/whoop/whoopRepository'
import { reportSchema } from '@/shared/schemas/report'
import { getConnectionStatus, fetchEventsForWindow } from '@/modules/calendar/calendarService'
import { getWhoopConnectionStatus, fetchRawDataForWindow } from '@/modules/whoop/whoopService'
import { normalizeCalendarEvents, normalizeWhoopCycles, joinSignals } from './normalize'
import { computeMetrics } from './metrics'
import { buildEvidencePacket } from './evidencePacket'

export type ReportDeps = {
  calendarRepo: CalendarRepository
  calendarClient: CalendarCapability
  whoopRepo: WhoopRepository
  whoopClient: HealthCapability
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

export async function getReport(userId: string, deps: ReportDeps): Promise<Report> {
  const { calendarRepo, calendarClient, whoopRepo, whoopClient, logger } = deps

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

  // Week highlights from evidence packet (AI summary stubbed)
  const weekHighlights: WeekHighlight[] = evidencePacket.weekStats.map((ws) => ({
    label: ws.label,
    dateRange: ws.dateRange,
    recoveryPercent: ws.recoveryPercent,
    summary: '',
  }))

  // Assemble report with AI fields stubbed
  const report = reportSchema.parse({
    window,
    coverageDays,
    connectedSources,
    executiveSummary: '',
    weekHighlights,
    daySummaries,
    metrics,
    findings: [],
    generatedAt: new Date().toISOString(),
  })

  logger.info('getReport complete', { coverageDays, connectedSources })
  return report
}
