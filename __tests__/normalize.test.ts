import { describe, it, expect } from 'vitest'
import { normalizeWhoopCycles, normalizeCalendarEvents, joinSignals } from '@/modules/report/normalize'
import type { WhoopRawData, WhoopCycle, WhoopSleep, WhoopRecovery } from '@/shared/types/whoop'
import type { RawCalendarEvent } from '@/shared/capabilities/calendar'

// ─── WHOOP helpers ────────────────────────────────────────────────────────────

function makeCycle(overrides: Partial<WhoopCycle> = {}): WhoopCycle {
  return {
    id: 1,
    start: '2026-06-01T04:00:00Z',
    end: '2026-06-02T04:00:00Z',
    timezone_offset: '+00:00',
    score_state: 'SCORED',
    score: { strain: 11.0 },
    ...overrides,
  }
}

function makeSleep(overrides: Partial<WhoopSleep> = {}): WhoopSleep {
  return {
    id: 'sleep-1',
    cycle_id: 1,
    nap: false,
    score_state: 'SCORED',
    score: {
      stage_summary: {
        total_in_bed_time_milli: 28_800_000, // 8h
        total_awake_time_milli: 1_800_000,   // 0.5h
      },
    },
    ...overrides,
  }
}

function makeRecovery(overrides: Partial<WhoopRecovery> = {}): WhoopRecovery {
  return {
    cycle_id: 1,
    sleep_id: 'sleep-1',
    score_state: 'SCORED',
    score: { recovery_score: 75 },
    ...overrides,
  }
}

function makeRaw(
  cycles: WhoopCycle[],
  sleeps: WhoopSleep[],
  recoveries: WhoopRecovery[],
): WhoopRawData {
  return { cycles, sleeps, recoveries }
}

// ─── Calendar helpers ─────────────────────────────────────────────────────────

function makeTimedEvent(overrides: Partial<RawCalendarEvent> & {
  startDT?: string
  endDT?: string
  summary?: string
} = {}): RawCalendarEvent {
  const { startDT = '2026-06-01T09:00:00Z', endDT = '2026-06-01T10:00:00Z', summary = 'Meeting', ...rest } = overrides
  return {
    id: 'evt-1',
    summary,
    status: 'confirmed',
    start: { dateTime: startDT },
    end: { dateTime: endDT },
    ...rest,
  }
}

function makeAllDayEvent(date: string, summary = 'Vacation'): RawCalendarEvent {
  return {
    id: 'evt-allday',
    summary,
    status: 'confirmed',
    start: { date },
    end: { date },
  }
}

// ─── normalizeWhoopCycles ─────────────────────────────────────────────────────

describe('normalizeWhoopCycles', () => {
  it('returns correct date, recovery, sleepHours, strain for a fully scored cycle', () => {
    const raw = makeRaw([makeCycle()], [makeSleep()], [makeRecovery()])
    const [day] = normalizeWhoopCycles(raw)
    expect(day.date).toBe('2026-06-01')
    expect(day.recovery).toBe(75)
    expect(day.strain).toBe(11.0)
    // sleepHours = (28_800_000 - 1_800_000) / 3_600_000 = 7.5
    expect(day.sleepHours).toBeCloseTo(7.5)
  })

  it('sleepHours formula: (in_bed_milli - awake_milli) / 3_600_000', () => {
    const sleep = makeSleep({
      score: {
        stage_summary: {
          total_in_bed_time_milli: 36_000_000, // 10h
          total_awake_time_milli: 3_600_000,   // 1h
        },
      },
    })
    const raw = makeRaw([makeCycle()], [sleep], [makeRecovery()])
    const [day] = normalizeWhoopCycles(raw)
    expect(day.sleepHours).toBeCloseTo(9.0)
  })

  it('excludes an in-progress cycle (end: null)', () => {
    const raw = makeRaw([makeCycle({ end: null })], [makeSleep()], [makeRecovery()])
    expect(normalizeWhoopCycles(raw)).toHaveLength(0)
  })

  it('excludes an unscored cycle (score_state !== SCORED)', () => {
    const raw = makeRaw([makeCycle({ score_state: 'PENDING' })], [makeSleep()], [makeRecovery()])
    expect(normalizeWhoopCycles(raw)).toHaveLength(0)
  })

  it('includes a SCORED cycle with an unscored recovery, setting recovery: null', () => {
    const raw = makeRaw(
      [makeCycle()],
      [makeSleep()],
      [makeRecovery({ score_state: 'PENDING', score: undefined })],
    )
    const [day] = normalizeWhoopCycles(raw)
    expect(day).toBeDefined()
    expect(day.recovery).toBeNull()
  })

  it('includes a cycle with a nap sleep, setting sleepHours: null', () => {
    const napSleep = makeSleep({ nap: true })
    const raw = makeRaw([makeCycle()], [napSleep], [makeRecovery()])
    const [day] = normalizeWhoopCycles(raw)
    expect(day).toBeDefined()
    expect(day.sleepHours).toBeNull()
  })

  it('includes a cycle with no matching sleep, setting sleepHours: null', () => {
    const raw = makeRaw([makeCycle()], [], [makeRecovery()])
    const [day] = normalizeWhoopCycles(raw)
    expect(day).toBeDefined()
    expect(day.sleepHours).toBeNull()
  })

  it('keeps the later cycle when two SCORED cycles share a UTC date', () => {
    const earlier = makeCycle({ id: 1, start: '2026-06-01T04:00:00Z', end: '2026-06-01T12:00:00Z' })
    const later = makeCycle({ id: 2, start: '2026-06-01T14:00:00Z', end: '2026-06-02T00:00:00Z' })
    const sleep2 = makeSleep({ id: 'sleep-2', cycle_id: 2, score: { stage_summary: { total_in_bed_time_milli: 21_600_000, total_awake_time_milli: 0 } } })
    const recovery2 = makeRecovery({ cycle_id: 2, sleep_id: 'sleep-2', score: { recovery_score: 80 } })
    const raw = makeRaw([earlier, later], [makeSleep(), sleep2], [makeRecovery(), recovery2])
    const results = normalizeWhoopCycles(raw)
    expect(results).toHaveLength(1)
    expect(results[0].recovery).toBe(80)
  })

  it('sets strain: null when cycle has no score object', () => {
    const raw = makeRaw([makeCycle({ score: undefined })], [makeSleep()], [makeRecovery()])
    const [day] = normalizeWhoopCycles(raw)
    expect(day.strain).toBeNull()
  })

  it('returns empty array for empty input', () => {
    expect(normalizeWhoopCycles({ cycles: [], sleeps: [], recoveries: [] })).toHaveLength(0)
  })
})

// ─── normalizeCalendarEvents ──────────────────────────────────────────────────

describe('normalizeCalendarEvents', () => {
  it('excludes a cancelled event', () => {
    const event = makeTimedEvent({ status: 'cancelled' })
    expect(normalizeCalendarEvents([event])).toHaveLength(0)
  })

  it('processes an all-day event: date = start.date, 1 hour, eventCount 1', () => {
    const event = makeAllDayEvent('2026-06-01')
    const [day] = normalizeCalendarEvents([event])
    expect(day.date).toBe('2026-06-01')
    expect(day.eventCount).toBe(1)
    const totalHours = Object.values(day.activities).reduce((s, h) => s + h, 0)
    expect(totalHours).toBe(1)
  })

  it('assigns keyword-matched category for a timed event', () => {
    const event = makeTimedEvent({ summary: 'Team standup', startDT: '2026-06-01T09:00:00Z', endDT: '2026-06-01T10:00:00Z' })
    const [day] = normalizeCalendarEvents([event])
    expect(day.activities['Work']).toBeCloseTo(1.0)
  })

  it('assigns Personal category when no keyword matches', () => {
    const event = makeTimedEvent({ summary: 'Random event', startDT: '2026-06-01T09:00:00Z', endDT: '2026-06-01T10:00:00Z' })
    const [day] = normalizeCalendarEvents([event])
    expect(day.activities['Personal']).toBeCloseTo(1.0)
  })

  it('accumulates hours for multiple events on the same day and same category', () => {
    const ev1 = makeTimedEvent({ id: 'e1', summary: 'gym', startDT: '2026-06-01T07:00:00Z', endDT: '2026-06-01T08:00:00Z' })
    const ev2 = makeTimedEvent({ id: 'e2', summary: 'workout', startDT: '2026-06-01T18:00:00Z', endDT: '2026-06-01T19:00:00Z' })
    const [day] = normalizeCalendarEvents([ev1, ev2])
    expect(day.activities['Exercise']).toBeCloseTo(2.0)
    expect(day.eventCount).toBe(2)
  })

  it('creates separate category entries for different categories on the same day', () => {
    const ev1 = makeTimedEvent({ id: 'e1', summary: 'gym', startDT: '2026-06-01T07:00:00Z', endDT: '2026-06-01T08:00:00Z' })
    const ev2 = makeTimedEvent({ id: 'e2', summary: 'Meeting', startDT: '2026-06-01T09:00:00Z', endDT: '2026-06-01T10:00:00Z' })
    const [day] = normalizeCalendarEvents([ev1, ev2])
    expect(day.activities['Exercise']).toBeCloseTo(1.0)
    expect(day.activities['Work']).toBeCloseTo(1.0)
  })

  it('excludes a timed event with zero or negative duration', () => {
    const event = makeTimedEvent({ startDT: '2026-06-01T10:00:00Z', endDT: '2026-06-01T09:00:00Z' })
    expect(normalizeCalendarEvents([event])).toHaveLength(0)
  })

  it('returns empty array for empty input', () => {
    expect(normalizeCalendarEvents([])).toHaveLength(0)
  })
})

// ─── joinSignals ──────────────────────────────────────────────────────────────

describe('joinSignals', () => {
  const calSignal = {
    date: '2026-06-01',
    activities: { Work: 4 },
    eventCount: 2,
  }
  const whoopSignal = {
    date: '2026-06-01',
    recovery: 75,
    sleepHours: 7.5,
    strain: 11.0,
  }

  it('calendar-only day: recovery, sleepHours, strain absent from DaySummary', () => {
    const [day] = joinSignals([calSignal], [])
    expect(day.date).toBe('2026-06-01')
    expect(day.activities).toEqual({ Work: 4 })
    expect(day.recovery).toBeUndefined()
    expect(day.sleepHours).toBeUndefined()
    expect(day.strain).toBeUndefined()
  })

  it('WHOOP-only day: recovery present, activities is empty object', () => {
    const [day] = joinSignals([], [whoopSignal])
    expect(day.date).toBe('2026-06-01')
    expect(day.recovery).toBe(75)
    expect(day.activities).toEqual({})
  })

  it('day with both sources: all fields present', () => {
    const [day] = joinSignals([calSignal], [whoopSignal])
    expect(day.activities).toEqual({ Work: 4 })
    expect(day.recovery).toBe(75)
    expect(day.sleepHours).toBe(7.5)
    expect(day.strain).toBe(11.0)
  })

  it('output is sorted ascending by date', () => {
    const cal1 = { date: '2026-06-03', activities: {}, eventCount: 0 }
    const cal2 = { date: '2026-06-01', activities: {}, eventCount: 0 }
    const result = joinSignals([cal1, cal2], [])
    expect(result[0].date).toBe('2026-06-01')
    expect(result[1].date).toBe('2026-06-03')
  })

  it('result length equals union of unique dates from both sources', () => {
    const cal1 = { date: '2026-06-01', activities: {}, eventCount: 0 }
    const cal2 = { date: '2026-06-02', activities: {}, eventCount: 0 }
    const whoop1 = { date: '2026-06-03', recovery: 70, sleepHours: 7, strain: 10 }
    const result = joinSignals([cal1, cal2], [whoop1])
    expect(result).toHaveLength(3)
  })
})
