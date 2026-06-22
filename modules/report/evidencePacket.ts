import type { DaySummary, AnalysisMetrics, ConnectedSource, ReportWindow } from '@/shared/types/report'

export type WeekStat = {
  label: 'Best week' | 'Worst week'
  dateRange: string
  recoveryPercent: number
}

export type CandidateSignal = {
  description: string
}

export type ExemplarDay = {
  date: string
  recovery: number
  activities: Record<string, number>
}

export type EvidencePacket = {
  window: ReportWindow
  coverageDays: number
  connectedSources: ConnectedSource[]
  metrics: AnalysisMetrics
  exemplarDays: { highest: ExemplarDay; lowest: ExemplarDay } | null
  weekStats: WeekStat[]
  candidateSignals: CandidateSignal[]
}

// Return ISO week number (Mon–Sun, ISO 8601) for a YYYY-MM-DD string.
function isoWeekKey(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00Z')
  // Thursday of the same week determines the year (ISO 8601)
  const thursday = new Date(d)
  thursday.setUTCDate(d.getUTCDate() + (4 - (d.getUTCDay() || 7)))
  const year = thursday.getUTCFullYear()
  const weekStart = new Date(Date.UTC(year, 0, 1))
  const weekNo = Math.ceil(((thursday.getTime() - weekStart.getTime()) / 86_400_000 + 1) / 7)
  return `${year}-W${String(weekNo).padStart(2, '0')}`
}

function formatDateRange(dates: string[]): string {
  if (dates.length === 0) return ''
  const sorted = [...dates].sort()
  const first = new Date(sorted[0] + 'T00:00:00Z')
  const last = new Date(sorted[sorted.length - 1] + 'T00:00:00Z')

  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
  const firstMon = monthNames[first.getUTCMonth()]
  const lastMon = monthNames[last.getUTCMonth()]

  if (firstMon === lastMon) {
    return `${firstMon} ${first.getUTCDate()}–${last.getUTCDate()}`
  }
  return `${firstMon} ${first.getUTCDate()}–${lastMon} ${last.getUTCDate()}`
}

const MIN_WEEK_DAYS = 3

export function computeWeekStats(days: DaySummary[]): WeekStat[] {
  const weekMap = new Map<string, { recoveries: number[]; dates: string[] }>()

  for (const day of days) {
    if (day.recovery == null) continue
    const key = isoWeekKey(day.date)
    let entry = weekMap.get(key)
    if (!entry) {
      entry = { recoveries: [], dates: [] }
      weekMap.set(key, entry)
    }
    entry.recoveries.push(day.recovery)
    entry.dates.push(day.date)
  }

  const qualifyingWeeks = Array.from(weekMap.values())
    .filter((w) => w.recoveries.length >= MIN_WEEK_DAYS)
    .map((w) => ({
      avg: w.recoveries.reduce((s, r) => s + r, 0) / w.recoveries.length,
      dateRange: formatDateRange(w.dates),
    }))

  if (qualifyingWeeks.length < 2) return []

  const maxAvg = Math.max(...qualifyingWeeks.map((w) => w.avg))
  const minAvg = Math.min(...qualifyingWeeks.map((w) => w.avg))

  const best = qualifyingWeeks.find((w) => w.avg === maxAvg)!
  const worst = qualifyingWeeks.find((w) => w.avg === minAvg)!

  return [
    { label: 'Best week', dateRange: best.dateRange, recoveryPercent: Math.round(best.avg) },
    { label: 'Worst week', dateRange: worst.dateRange, recoveryPercent: Math.round(worst.avg) },
  ]
}

export function identifyCandidateSignals(
  deltas: Array<{ activity: string; deltaPercent: number; n: number; confidence: string }>,
): CandidateSignal[] {
  return deltas
    .slice()
    .sort((a, b) => Math.abs(b.deltaPercent) - Math.abs(a.deltaPercent))
    .slice(0, 5)
    .map(({ activity, deltaPercent, n, confidence }) => {
      const sign = deltaPercent >= 0 ? '+' : ''
      return { description: `${activity} days show ${sign}${deltaPercent}% recovery (n=${n}, ${confidence})` }
    })
}

export function buildEvidencePacket(input: {
  window: ReportWindow
  coverageDays: number
  connectedSources: ConnectedSource[]
  metrics: AnalysisMetrics
  daySummaries: DaySummary[]
}): EvidencePacket {
  const { window, coverageDays, connectedSources, metrics, daySummaries } = input
  const hasHealth = connectedSources.includes('health')

  const weekStats = hasHealth ? computeWeekStats(daySummaries) : []

  const candidateSignals = identifyCandidateSignals(metrics.activityRecoveryDeltas ?? [])

  let exemplarDays: EvidencePacket['exemplarDays'] = null
  if (hasHealth) {
    const recoveryDays = daySummaries.filter((d) => d.recovery != null)
    if (recoveryDays.length > 0) {
      const highest = recoveryDays.reduce((best, d) => d.recovery! > best.recovery! ? d : best)
      const lowest = recoveryDays.reduce((worst, d) => d.recovery! < worst.recovery! ? d : worst)
      exemplarDays = {
        highest: { date: highest.date, recovery: highest.recovery!, activities: highest.activities },
        lowest: { date: lowest.date, recovery: lowest.recovery!, activities: lowest.activities },
      }
    }
  }

  return {
    window,
    coverageDays,
    connectedSources,
    metrics,
    exemplarDays,
    weekStats,
    candidateSignals,
  }
}
