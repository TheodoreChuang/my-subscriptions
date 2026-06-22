import { describe, it, expect } from 'vitest'
import { computeMetrics, HIGH_RECOVERY_THRESHOLD, LOW_RECOVERY_THRESHOLD } from '@/modules/report/metrics'
import type { DaySummary } from '@/shared/types/report'

function makeDay(overrides: Partial<DaySummary> & { date: string }): DaySummary {
  return {
    activities: {},
    ...overrides,
  }
}

describe('threshold constants', () => {
  it('HIGH_RECOVERY_THRESHOLD is 67', () => {
    expect(HIGH_RECOVERY_THRESHOLD).toBe(67)
  })

  it('LOW_RECOVERY_THRESHOLD is 33', () => {
    expect(LOW_RECOVERY_THRESHOLD).toBe(33)
  })
})

describe('computeMetrics — calendar-only', () => {
  const days: DaySummary[] = [
    makeDay({ date: '2026-06-01', activities: { Work: 4, Exercise: 1 }, recovery: undefined }),
    makeDay({ date: '2026-06-02', activities: { Work: 6 }, recovery: undefined }),
    makeDay({ date: '2026-06-03', activities: { Exercise: 2 } }),
  ]

  it('omits activityRecoveryDeltas when only calendar connected', () => {
    const metrics = computeMetrics(days, ['calendar'])
    expect(metrics.activityRecoveryDeltas).toBeUndefined()
  })

  it('omits avgRecovery when only calendar connected', () => {
    const metrics = computeMetrics(days, ['calendar'])
    expect(metrics.avgRecovery).toBeUndefined()
  })

  it('uses the passed calendarEventCount for totalEvents', () => {
    const daysWithCounts: DaySummary[] = [
      makeDay({ date: '2026-06-01', activities: { Work: 4 } }),
      makeDay({ date: '2026-06-02', activities: { Work: 2, Exercise: 1 } }),
    ]
    const metrics = computeMetrics(daysWithCounts, ['calendar'], 42)
    expect(metrics.totalEvents).toBe(42)
  })

  it('computes totalScheduledHours as sum of all activity hours', () => {
    const metrics = computeMetrics(days, ['calendar'])
    // 4+1+6+2 = 13
    expect(metrics.totalScheduledHours).toBeCloseTo(13)
  })

  it('includes only categories with hours > 0 in topCategories', () => {
    const metrics = computeMetrics(days, ['calendar'])
    expect(metrics.topCategories?.every((c) => c.hours > 0)).toBe(true)
  })

  it('computes busiestDay as date with highest total activity hours', () => {
    const metrics = computeMetrics(days, ['calendar'])
    // Jun 2 has 6h Work, Jun 1 has 5h, Jun 3 has 2h
    expect(metrics.busiestDay).toBe('2026-06-02')
  })

  it('busiestDay tie: earlier date wins', () => {
    const tied: DaySummary[] = [
      makeDay({ date: '2026-06-02', activities: { Work: 5 } }),
      makeDay({ date: '2026-06-01', activities: { Work: 5 } }),
    ]
    const metrics = computeMetrics(tied, ['calendar'])
    expect(metrics.busiestDay).toBe('2026-06-01')
  })

  it('totalScheduledHours is 0 when all days have empty activities', () => {
    const empty: DaySummary[] = [makeDay({ date: '2026-06-01', activities: {} })]
    const metrics = computeMetrics(empty, ['calendar'])
    expect(metrics.totalScheduledHours).toBe(0)
  })
})

describe('computeMetrics — WHOOP-only', () => {
  const days: DaySummary[] = [
    makeDay({ date: '2026-06-01', recovery: 80, strain: 12, sleepHours: 7.5 }),
    makeDay({ date: '2026-06-02', recovery: 30, strain: 14, sleepHours: 6 }),
    makeDay({ date: '2026-06-03', recovery: 67, strain: 10, sleepHours: 8 }),
  ]

  it('omits topCategories and totalEvents when only health connected', () => {
    const metrics = computeMetrics(days, ['health'])
    expect(metrics.topCategories).toBeUndefined()
    expect(metrics.totalEvents).toBeUndefined()
  })

  it('computes avgRecovery rounded to nearest integer', () => {
    // (80+30+67)/3 = 59
    const metrics = computeMetrics(days, ['health'])
    expect(metrics.avgRecovery).toBe(59)
  })

  it('counts highRecoveryDays: recovery >= 67 (boundary inclusive)', () => {
    const metrics = computeMetrics(days, ['health'])
    // 80 and 67 qualify
    expect(metrics.highRecoveryDays).toBe(2)
  })

  it('counts lowRecoveryDays: recovery <= 33 (boundary inclusive)', () => {
    const metrics = computeMetrics(days, ['health'])
    // 30 qualifies
    expect(metrics.lowRecoveryDays).toBe(1)
  })

  it('totalRecoveryCycles equals count of days with non-null recovery', () => {
    const metrics = computeMetrics(days, ['health'])
    expect(metrics.totalRecoveryCycles).toBe(3)
  })
})

describe('computeMetrics — both sources', () => {
  // 12 days with Exercise → strong correlation
  const buildDays = (): DaySummary[] => {
    const days: DaySummary[] = []
    for (let i = 1; i <= 12; i++) {
      days.push(makeDay({
        date: `2026-06-${String(i).padStart(2, '0')}`,
        activities: { Exercise: 1 },
        recovery: 80,
      }))
    }
    // 8 days without Exercise
    for (let i = 13; i <= 20; i++) {
      days.push(makeDay({
        date: `2026-06-${String(i).padStart(2, '0')}`,
        activities: {},
        recovery: 60,
      }))
    }
    return days
  }

  it('computes strong correlation for exercise on 12 days with |delta| >= 5%', () => {
    const metrics = computeMetrics(buildDays(), ['calendar', 'health'])
    const delta = metrics.activityRecoveryDeltas?.find((d) => d.activity === 'Exercise')
    expect(delta).toBeDefined()
    expect(delta?.n).toBe(12)
    expect(delta?.confidence).toBe('strong')
  })

  it('excludes categories with n < 5 from activityRecoveryDeltas', () => {
    // Travel only on 3 days
    const days: DaySummary[] = [
      makeDay({ date: '2026-06-01', activities: { Travel: 2 }, recovery: 70 }),
      makeDay({ date: '2026-06-02', activities: { Travel: 2 }, recovery: 72 }),
      makeDay({ date: '2026-06-03', activities: { Travel: 2 }, recovery: 68 }),
    ]
    const metrics = computeMetrics(days, ['calendar', 'health'])
    expect(metrics.activityRecoveryDeltas?.some((d) => d.activity === 'Travel')).toBeFalsy()
  })
})

describe('computeMetrics — empty input', () => {
  it('returns 0 / empty arrays when DaySummary[] is empty with both sources', () => {
    const metrics = computeMetrics([], ['calendar', 'health'])
    expect(metrics.totalEvents).toBe(0)
    expect(metrics.totalScheduledHours).toBe(0)
    expect(metrics.topCategories).toEqual([])
    expect(metrics.activityRecoveryDeltas).toEqual([])
  })
})
