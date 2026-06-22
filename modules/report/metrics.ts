import type { DaySummary, AnalysisMetrics, ConnectedSource } from '@/shared/types/report'

export const HIGH_RECOVERY_THRESHOLD = 67
export const LOW_RECOVERY_THRESHOLD = 33

const INSUFFICIENT_N = 5
const STRONG_N = 10
const STRONG_DELTA = 5

function mean(values: number[]): number {
  if (values.length === 0) return 0
  return values.reduce((s, v) => s + v, 0) / values.length
}

export function computeMetrics(
  days: DaySummary[],
  connectedSources: ConnectedSource[],
  calendarEventCount = 0,
): AnalysisMetrics {
  const hasCalendar = connectedSources.includes('calendar')
  const hasHealth = connectedSources.includes('health')
  const metrics: AnalysisMetrics = {}

  if (hasCalendar) {
    let totalScheduledHours = 0
    const hoursByCategory = new Map<string, number>()
    const hoursByDate = new Map<string, number>()

    for (const day of days) {
      let dayHours = 0
      for (const [category, hours] of Object.entries(day.activities)) {
        hoursByCategory.set(category, (hoursByCategory.get(category) ?? 0) + hours)
        dayHours += hours
        totalScheduledHours += hours
      }
      hoursByDate.set(day.date, dayHours)
    }

    const topCategories = Array.from(hoursByCategory.entries())
      .filter(([, h]) => h > 0)
      .map(([category, hours]) => ({
        category,
        hours,
        percent: totalScheduledHours > 0 ? Math.round((hours / totalScheduledHours) * 1000) / 10 : 0,
      }))
      .sort((a, b) => b.hours - a.hours)

    // busiestDay: date with highest total hours; earlier date wins on tie
    let busiestDay: string | undefined
    let busiestHours = -1
    for (const [date, hours] of Array.from(hoursByDate.entries()).sort((a, b) => a[0].localeCompare(b[0]))) {
      if (hours > busiestHours) {
        busiestHours = hours
        busiestDay = date
      }
    }

    metrics.totalEvents = calendarEventCount
    metrics.totalScheduledHours = totalScheduledHours
    metrics.topCategories = topCategories
    if (busiestDay) metrics.busiestDay = busiestDay
  }

  if (hasHealth) {
    const recoveryDays = days.filter((d) => d.recovery != null)
    const recoveryValues = recoveryDays.map((d) => d.recovery as number)
    const strainValues = days.filter((d) => d.strain != null).map((d) => d.strain as number)

    metrics.avgRecovery = recoveryValues.length > 0 ? Math.round(mean(recoveryValues)) : 0
    metrics.avgStrain = strainValues.length > 0 ? Math.round(mean(strainValues) * 10) / 10 : 0
    metrics.totalRecoveryCycles = recoveryValues.length
    metrics.highRecoveryDays = recoveryValues.filter((r) => r >= HIGH_RECOVERY_THRESHOLD).length
    metrics.lowRecoveryDays = recoveryValues.filter((r) => r <= LOW_RECOVERY_THRESHOLD).length
  }

  if (hasCalendar && hasHealth) {
    const allCategories = new Set<string>()
    for (const day of days) {
      for (const cat of Object.keys(day.activities)) {
        allCategories.add(cat)
      }
    }

    const deltas = []
    for (const category of allCategories) {
      const withCat = days.filter((d) => (d.activities[category] ?? 0) > 0 && d.recovery != null)
      const withoutCat = days.filter((d) => !(d.activities[category] ?? 0) && d.recovery != null)

      const n = withCat.length
      if (n < INSUFFICIENT_N) continue
      if (withoutCat.length === 0) continue

      const avgWith = mean(withCat.map((d) => d.recovery as number))
      const avgWithout = mean(withoutCat.map((d) => d.recovery as number))

      const deltaPercent = avgWithout !== 0
        ? ((avgWith - avgWithout) / avgWithout) * 100
        : 0

      const confidence =
        n >= STRONG_N && Math.abs(deltaPercent) >= STRONG_DELTA ? 'strong' : 'weak'

      deltas.push({
        activity: category,
        deltaPercent: Math.round(deltaPercent * 10) / 10,
        n,
        confidence: confidence as 'strong' | 'weak',
      })
    }

    deltas.sort((a, b) => Math.abs(b.deltaPercent) - Math.abs(a.deltaPercent))
    metrics.activityRecoveryDeltas = deltas
  }

  return metrics
}
