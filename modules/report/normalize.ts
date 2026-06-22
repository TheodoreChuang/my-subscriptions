import type { WhoopRawData, WhoopCycle, WhoopSleep, WhoopRecovery } from '@/shared/types/whoop'
import type { RawCalendarEvent } from '@/shared/capabilities/calendar'
import type { DaySummary } from '@/shared/types/report'

export type WhoopDaySignal = {
  date: string
  recovery: number | null
  sleepHours: number | null
  strain: number | null
}

export type CalendarDaySignal = {
  date: string
  activities: Record<string, number>
  eventCount: number
}

// Keyword→category map evaluated in order; first match wins.
const CATEGORY_KEYWORDS: Array<[string, string[]]> = [
  ['Work', ['meeting', 'standup', 'sync', 'interview', 'review', 'planning', 'sprint', 'office', 'presentation', '1:1', 'onboarding']],
  ['Exercise', ['gym', 'workout', 'run', 'bike', 'swim', 'yoga', 'hike', 'pilates', 'crossfit', 'training', 'lift', 'cycling']],
  ['Family', ['family', 'kids', 'school', 'parent', 'birthday', 'wedding']],
  ['Social', ['lunch', 'coffee', 'happy hour', 'dinner', 'party', 'drinks', 'friend']],
  ['Learning', ['course', 'class', 'study', 'read', 'book club', 'conference', 'workshop', 'lecture']],
  ['Travel', ['flight', 'travel', 'trip', 'hotel', 'airport', 'train']],
  ['Rest', ['rest', 'relax', 'day off', 'vacation', 'holiday', 'pto', 'nap']],
]

function assignCategory(summary: string): string {
  const lower = summary.toLowerCase()
  for (const [category, keywords] of CATEGORY_KEYWORDS) {
    if (keywords.some((kw) => lower.includes(kw))) return category
  }
  return 'Personal'
}

export function normalizeWhoopCycles(raw: WhoopRawData): WhoopDaySignal[] {
  const sleepByCycleId = new Map<number, WhoopSleep>()
  for (const sleep of raw.sleeps) {
    sleepByCycleId.set(sleep.cycle_id, sleep)
  }

  const recoveryByCycleId = new Map<number, WhoopRecovery>()
  for (const rec of raw.recoveries) {
    recoveryByCycleId.set(rec.cycle_id, rec)
  }

  // Best candidate per UTC date: latest cycle.start timestamp wins
  const byDate = new Map<string, { cycle: WhoopCycle; sleep: WhoopSleep | undefined; recovery: WhoopRecovery | undefined }>()

  for (const cycle of raw.cycles) {
    if (cycle.end === null) continue
    if (cycle.score_state !== 'SCORED') continue

    const recovery = recoveryByCycleId.get(cycle.id)
    // Nap exclusion: treat nap sleep as absent (sleepHours: null), keep the cycle
    const rawSleep = sleepByCycleId.get(cycle.id)
    const sleep = rawSleep && !rawSleep.nap ? rawSleep : undefined

    const date = new Date(cycle.start).toISOString().slice(0, 10)
    const existing = byDate.get(date)
    if (existing && existing.cycle.start >= cycle.start) continue

    byDate.set(date, { cycle, sleep, recovery })
  }

  const results: WhoopDaySignal[] = []

  for (const [date, { cycle, sleep, recovery }] of byDate) {
    let sleepHours: number | null = null
    if (sleep && sleep.score?.stage_summary) {
      const inBed = sleep.score.stage_summary.total_in_bed_time_milli ?? 0
      const awake = sleep.score.stage_summary.total_awake_time_milli ?? 0
      sleepHours = (inBed - awake) / 3_600_000
    }

    const recoveryScore =
      recovery?.score_state === 'SCORED' ? (recovery.score?.recovery_score ?? null) : null

    results.push({
      date,
      recovery: recoveryScore,
      sleepHours,
      strain: cycle.score?.strain ?? null,
    })
  }

  return results
}

export function normalizeCalendarEvents(events: RawCalendarEvent[]): CalendarDaySignal[] {
  const byDate = new Map<string, CalendarDaySignal>()

  for (const event of events) {
    if (event.status === 'cancelled') continue

    let date: string
    let hours: number
    let category: string

    if (event.start.date && !event.start.dateTime) {
      // All-day event
      date = event.start.date
      hours = 1
      category = assignCategory(event.summary ?? '')
    } else if (event.start.dateTime && event.end.dateTime) {
      date = new Date(event.start.dateTime).toISOString().slice(0, 10)
      hours = (Date.parse(event.end.dateTime) - Date.parse(event.start.dateTime)) / 3_600_000
      if (hours <= 0) continue
      category = assignCategory(event.summary ?? '')
    } else {
      continue
    }

    let day = byDate.get(date)
    if (!day) {
      day = { date, activities: {}, eventCount: 0 }
      byDate.set(date, day)
    }

    day.activities[category] = (day.activities[category] ?? 0) + hours
    day.eventCount += 1
  }

  return Array.from(byDate.values())
}

export function joinSignals(
  calSignals: CalendarDaySignal[],
  whoopSignals: WhoopDaySignal[],
): DaySummary[] {
  const calByDate = new Map(calSignals.map((s) => [s.date, s]))
  const whoopByDate = new Map(whoopSignals.map((s) => [s.date, s]))

  const allDates = new Set([...calByDate.keys(), ...whoopByDate.keys()])

  const results: DaySummary[] = []

  for (const date of allDates) {
    const cal = calByDate.get(date)
    const whoop = whoopByDate.get(date)

    const summary: DaySummary = {
      date,
      activities: cal?.activities ?? {},
    }

    if (whoop) {
      // Convert null → undefined to satisfy schema (z.number().optional() rejects null)
      if (whoop.recovery !== null) summary.recovery = whoop.recovery
      if (whoop.sleepHours !== null) summary.sleepHours = whoop.sleepHours
      if (whoop.strain !== null) summary.strain = whoop.strain
    }

    results.push(summary)
  }

  results.sort((a, b) => a.date.localeCompare(b.date))
  return results
}
