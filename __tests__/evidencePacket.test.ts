import { describe, it, expect } from 'vitest'
import { computeWeekStats, identifyCandidateSignals, buildEvidencePacket } from '@/modules/report/evidencePacket'
import type { DaySummary, AnalysisMetrics } from '@/shared/types/report'

function makeDay(date: string, recovery?: number, activities: Record<string, number> = {}): DaySummary {
  return { date, activities, ...(recovery != null ? { recovery } : {}) }
}

// Build 30 days spanning 5 ISO weeks: Jun 1–30, 2026 (Mon Jun 1 is week 23)
function buildCalendarMonth(): DaySummary[] {
  const days: DaySummary[] = []
  for (let i = 1; i <= 30; i++) {
    const date = `2026-06-${String(i).padStart(2, '0')}`
    // Weeks with recovery:
    // Week 23 (Jun 1-7): recovery 60-70 avg ~65 (>=3 days)
    // Week 24 (Jun 8-14): recovery 80-90 avg ~85 (best)
    // Week 25 (Jun 15-21): recovery 70-75 avg ~72
    // Week 26 (Jun 22-28): recovery 50-55 avg ~52 (worst)
    // Week 27 (Jun 29-30): only 2 days with data
    let recovery: number | undefined
    if (i <= 7) recovery = 60 + (i % 3) * 5  // 60, 65, 70, 60, 65, 70, 60
    else if (i <= 14) recovery = 80 + (i % 3) * 5  // ~85
    else if (i <= 21) recovery = 70 + (i % 2) * 3  // ~72
    else if (i <= 28) recovery = 50 + (i % 2) * 3  // ~52
    // Jun 29-30: no recovery (only 2 days, below threshold of 3)
    days.push(makeDay(date, recovery))
  }
  return days
}

// ─── computeWeekStats ─────────────────────────────────────────────────────────

describe('computeWeekStats', () => {
  it('identifies best and worst week from 30-day data with sufficient weeks', () => {
    const days = buildCalendarMonth()
    const stats = computeWeekStats(days)
    expect(stats.length).toBeGreaterThanOrEqual(2)

    const best = stats.find((w) => w.label === 'Best week')
    const worst = stats.find((w) => w.label === 'Worst week')
    expect(best).toBeDefined()
    expect(worst).toBeDefined()
    // Best week should have higher recovery than worst
    expect(best!.recoveryPercent).toBeGreaterThan(worst!.recoveryPercent)
  })

  it('excludes a week with fewer than 3 days of WHOOP data', () => {
    const days = buildCalendarMonth()
    // Jun 29-30 have no recovery — that "week" has 0 WHOOP days
    // This is already the case in buildCalendarMonth
    const stats = computeWeekStats(days)
    // Week 27 (Jun 29-30) should not appear
    const weekWithFewDays = stats.find((w) => w.dateRange.includes('29') || w.dateRange.includes('30'))
    expect(weekWithFewDays).toBeUndefined()
  })

  it('returns empty array when no days have recovery data', () => {
    const days = [makeDay('2026-06-01'), makeDay('2026-06-02')]
    expect(computeWeekStats(days)).toHaveLength(0)
  })

  it('returns empty array when only one week qualifies', () => {
    const days = Array.from({ length: 7 }, (_, i) =>
      makeDay(`2026-06-${String(i + 1).padStart(2, '0')}`, 70),
    )
    expect(computeWeekStats(days)).toHaveLength(0)
  })

  it('returns best === worst when all recovery scores are identical across two weeks', () => {
    // Week 23 (Jun 1–7) and Week 24 (Jun 8–14), all at recovery 70
    const days = [
      ...Array.from({ length: 4 }, (_, i) => makeDay(`2026-06-${String(i + 1).padStart(2, '0')}`, 70)),
      ...Array.from({ length: 4 }, (_, i) => makeDay(`2026-06-${String(i + 8).padStart(2, '0')}`, 70)),
    ]
    const stats = computeWeekStats(days)
    const best = stats.find((w) => w.label === 'Best week')
    const worst = stats.find((w) => w.label === 'Worst week')
    expect(best!.recoveryPercent).toBe(worst!.recoveryPercent)
  })

  it('dateRange includes first and last data day of the week', () => {
    const days = [
      makeDay('2026-06-01', 70), // Monday — Week 23
      makeDay('2026-06-02', 75), // Tuesday
      makeDay('2026-06-03', 80), // Wednesday
      makeDay('2026-06-08', 65), // Monday — Week 24
      makeDay('2026-06-09', 60), // Tuesday
      makeDay('2026-06-10', 70), // Wednesday
    ]
    const stats = computeWeekStats(days)
    expect(stats).toHaveLength(2)
    expect(stats[0].dateRange).toBeDefined()
    expect(typeof stats[0].dateRange).toBe('string')
  })
})

// ─── identifyCandidateSignals ─────────────────────────────────────────────────

describe('identifyCandidateSignals', () => {
  const mockDeltas = [
    { activity: 'Exercise', deltaPercent: 9.2, n: 14, confidence: 'strong' as const },
    { activity: 'Work', deltaPercent: -8.3, n: 16, confidence: 'strong' as const },
    { activity: 'Social', deltaPercent: 5.5, n: 7, confidence: 'weak' as const },
    { activity: 'Family', deltaPercent: 3.1, n: 6, confidence: 'weak' as const },
    { activity: 'Rest', deltaPercent: 7.4, n: 11, confidence: 'strong' as const },
    { activity: 'Learning', deltaPercent: -4.0, n: 5, confidence: 'weak' as const },
  ]

  it('formats description correctly', () => {
    const signals = identifyCandidateSignals(mockDeltas)
    const exercise = signals.find((s) => s.description.includes('Exercise'))
    expect(exercise?.description).toMatch(/Exercise days show \+9\.2% recovery \(n=14, strong\)/)
  })

  it('formats negative delta with minus sign', () => {
    const signals = identifyCandidateSignals(mockDeltas)
    const work = signals.find((s) => s.description.includes('Work'))
    expect(work?.description).toMatch(/-8\.3%/)
  })

  it('limits output to top 5 by |deltaPercent| descending', () => {
    const signals = identifyCandidateSignals(mockDeltas)
    expect(signals).toHaveLength(5)
    // Exercise (9.2) should be first
    expect(signals[0].description).toContain('Exercise')
  })

  it('returns empty array when no deltas provided', () => {
    expect(identifyCandidateSignals([])).toHaveLength(0)
  })
})

// ─── buildEvidencePacket ──────────────────────────────────────────────────────

describe('buildEvidencePacket', () => {
  const window = { start: '2026-06-01', end: '2026-06-30', days: 30, label: 'Jun 1 – Jun 30' }
  const metricsWithDeltas: AnalysisMetrics = {
    activityRecoveryDeltas: [
      { activity: 'Exercise', deltaPercent: 9.2, n: 14, confidence: 'strong' },
    ],
  }
  const metricsEmpty: AnalysisMetrics = {}

  const healthDays: DaySummary[] = [
    makeDay('2026-06-01', 80),
    makeDay('2026-06-02', 50),
    makeDay('2026-06-03', 70),
  ]

  it('exemplarDays.highest has the max recovery day', () => {
    const pkt = buildEvidencePacket({
      window,
      coverageDays: 3,
      connectedSources: ['health'],
      metrics: metricsEmpty,
      daySummaries: healthDays,
    })
    expect(pkt.exemplarDays?.highest.recovery).toBe(80)
    expect(pkt.exemplarDays?.highest.date).toBe('2026-06-01')
  })

  it('exemplarDays.lowest has the min recovery day', () => {
    const pkt = buildEvidencePacket({
      window,
      coverageDays: 3,
      connectedSources: ['health'],
      metrics: metricsEmpty,
      daySummaries: healthDays,
    })
    expect(pkt.exemplarDays?.lowest.recovery).toBe(50)
  })

  it('exemplarDays is null when health not connected', () => {
    const pkt = buildEvidencePacket({
      window,
      coverageDays: 0,
      connectedSources: ['calendar'],
      metrics: metricsEmpty,
      daySummaries: [],
    })
    expect(pkt.exemplarDays).toBeNull()
  })

  it('weekStats is empty when health not connected', () => {
    const pkt = buildEvidencePacket({
      window,
      coverageDays: 0,
      connectedSources: ['calendar'],
      metrics: metricsEmpty,
      daySummaries: [],
    })
    expect(pkt.weekStats).toHaveLength(0)
  })

  it('candidateSignals built from activityRecoveryDeltas in metrics', () => {
    const pkt = buildEvidencePacket({
      window,
      coverageDays: 3,
      connectedSources: ['calendar', 'health'],
      metrics: metricsWithDeltas,
      daySummaries: healthDays,
    })
    expect(pkt.candidateSignals).toHaveLength(1)
    expect(pkt.candidateSignals[0].description).toContain('Exercise')
  })

  it('exemplarDays.highest === exemplarDays.lowest when only one recovery day', () => {
    const oneDay: DaySummary[] = [makeDay('2026-06-01', 70)]
    const pkt = buildEvidencePacket({
      window,
      coverageDays: 1,
      connectedSources: ['health'],
      metrics: metricsEmpty,
      daySummaries: oneDay,
    })
    expect(pkt.exemplarDays?.highest.date).toBe(pkt.exemplarDays?.lowest.date)
  })
})
