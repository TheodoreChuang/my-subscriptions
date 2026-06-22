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
  ['Work', ['work', 'meeting', 'standup', 'stand-up', 'sync', 'interview', 'review', 'planning', 'sprint', 'office', 'presentation', '1:1', '1-1', 'onboarding', 'retrospective', 'retro', 'all hands', 'all-hands', 'okr', 'kickoff', 'demo', 'debrief', 'alignment', 'check-in', 'check in']],
  ['Exercise', ['gym', 'workout', 'run', 'bike', 'swim', 'yoga', 'hike', 'pilates', 'crossfit', 'training', 'lift', 'cycling']],
  ['Family', ['family', 'kids', 'school', 'parent', 'birthday', 'wedding']],
  ['Social', ['lunch', 'coffee', 'happy hour', 'dinner', 'party', 'drinks', 'friend']],
  ['Learning', ['course', 'class', 'study', 'read', 'book club', 'conference', 'workshop', 'lecture']],
  ['Travel', ['flight', 'travel', 'trip', 'hotel', 'airport', 'train']],
  ['Rest', ['rest', 'relax', 'day off', 'vacation', 'holiday', 'pto', 'nap']],
]

// Patterns that require whole-word matching (substring match would produce false positives)
const WORD_BOUNDARY_KEYWORDS = new Set(['work', 'run', 'class', 'read', 'nap', 'train'])

function assignCategory(summary: string): string {
  const lower = summary.toLowerCase()
  for (const [category, keywords] of CATEGORY_KEYWORDS) {
    if (keywords.some((kw) =>
      WORD_BOUNDARY_KEYWORDS.has(kw)
        ? new RegExp(`\\b${kw}\\b`).test(lower)
        : lower.includes(kw),
    )) return category
  }
  return 'Personal'
}

export function normalizeWhoopCycles(raw: WhoopRawData): WhoopDaySignal[] {
  // Prefer non-nap sleep over nap when both exist for the same cycle_id
  const sleepByCycleId = new Map<number, WhoopSleep>()
  for (const sleep of raw.sleeps) {
    const existing = sleepByCycleId.get(sleep.cycle_id)
    if (!existing || (existing.nap && !sleep.nap)) {
      sleepByCycleId.set(sleep.cycle_id, sleep)
    }
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
      sleepHours = Math.max(0, (inBed - awake) / 3_600_000)
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

// Merge a sorted list of [startMs, endMs] intervals into non-overlapping spans.
function mergeIntervals(intervals: Array<[number, number]>): Array<[number, number]> {
  if (intervals.length === 0) return []
  const sorted = [...intervals].sort((a, b) => a[0] - b[0])
  const merged: Array<[number, number]> = [sorted[0]]
  for (let i = 1; i < sorted.length; i++) {
    const last = merged[merged.length - 1]
    if (sorted[i][0] <= last[1]) {
      last[1] = Math.max(last[1], sorted[i][1])
    } else {
      merged.push(sorted[i])
    }
  }
  return merged
}

export function normalizeCalendarEvents(events: RawCalendarEvent[]): CalendarDaySignal[] {
  // Collect timed intervals per (date, category) for overlap resolution.
  // All-day events have no real timestamps so they're tracked separately as flat hours.
  const timedByDateCategory = new Map<string, Map<string, Array<[number, number]>>>()
  const allDayByDateCategory = new Map<string, Map<string, number>>()
  const eventCountByDate = new Map<string, number>()

  for (const event of events) {
    if (event.status === 'cancelled') continue

    const category = assignCategory(event.summary ?? '')

    if (event.start.date && !event.start.dateTime) {
      // All-day event — no real timestamps; count as 1h flat
      const date = event.start.date
      let byCategory = allDayByDateCategory.get(date)
      if (!byCategory) { byCategory = new Map(); allDayByDateCategory.set(date, byCategory) }
      byCategory.set(category, (byCategory.get(category) ?? 0) + 1)
      eventCountByDate.set(date, (eventCountByDate.get(date) ?? 0) + 1)
    } else if (event.start.dateTime && event.end.dateTime) {
      const startMs = Date.parse(event.start.dateTime)
      const endMs = Date.parse(event.end.dateTime)
      if (endMs <= startMs) continue
      const date = new Date(startMs).toISOString().slice(0, 10)

      let byCategory = timedByDateCategory.get(date)
      if (!byCategory) { byCategory = new Map(); timedByDateCategory.set(date, byCategory) }
      const intervals = byCategory.get(category) ?? []
      intervals.push([startMs, endMs])
      byCategory.set(category, intervals)
      eventCountByDate.set(date, (eventCountByDate.get(date) ?? 0) + 1)
    }
  }

  // Union all dates from both sources
  const allDates = new Set([...timedByDateCategory.keys(), ...allDayByDateCategory.keys()])
  const result: CalendarDaySignal[] = []

  for (const date of allDates) {
    const activities: Record<string, number> = {}

    // Timed events: merge overlapping intervals per category, then sum durations
    const timedCats = timedByDateCategory.get(date)
    if (timedCats) {
      for (const [category, intervals] of timedCats) {
        const merged = mergeIntervals(intervals)
        activities[category] = (activities[category] ?? 0) +
          merged.reduce((sum, [s, e]) => sum + (e - s) / 3_600_000, 0)
      }
    }

    // All-day events: add flat hours (no interval to merge)
    const allDayCats = allDayByDateCategory.get(date)
    if (allDayCats) {
      for (const [category, hours] of allDayCats) {
        activities[category] = (activities[category] ?? 0) + hours
      }
    }

    result.push({ date, activities, eventCount: eventCountByDate.get(date) ?? 0 })
  }

  return result
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
