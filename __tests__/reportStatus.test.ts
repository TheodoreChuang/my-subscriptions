import { describe, it, expect } from 'vitest'
import { checkReportStatus } from '@/modules/report/reportStatus'
import type { StoredReport } from '@/modules/report/reportRepository'
import type { Report } from '@/shared/types/report'

const TODAY = '2026-06-22'
const YESTERDAY = '2026-06-21'

const integrationAt = new Date('2026-06-01T00:00:00Z')
const olderIntegrationAt = new Date('2026-05-31T00:00:00Z')
const newerIntegrationAt = new Date('2026-06-02T00:00:00Z')

function makeReport(windowEnd: string): Report {
  return {
    window: { start: '2026-05-23', end: windowEnd, days: 30, label: 'May 23 – Jun 22' },
    coverageDays: 1,
    connectedSources: ['calendar'],
    executiveSummary: 'Summary.',
    weekHighlights: [],
    daySummaries: [],
    metrics: {},
    findings: [],
    generatedAt: new Date().toISOString(),
  } as unknown as Report
}

function makeStored(windowEnd: string, snapshotAt = integrationAt): StoredReport {
  return { report: makeReport(windowEnd), integrationSnapshotAt: snapshotAt }
}

describe('checkReportStatus', () => {
  describe('no_report', () => {
    it('stored = null → needs_generation with reason no_report', () => {
      expect(checkReportStatus(null, integrationAt, TODAY)).toEqual({
        status: 'needs_generation',
        reason: 'no_report',
      })
    })
  })

  describe('window_drift', () => {
    it('stored window end is yesterday → needs_generation with reason window_drift', () => {
      expect(checkReportStatus(makeStored(YESTERDAY), integrationAt, TODAY)).toEqual({
        status: 'needs_generation',
        reason: 'window_drift',
      })
    })

    it('stored window end matches expected → does NOT return window_drift', () => {
      const result = checkReportStatus(makeStored(TODAY), integrationAt, TODAY)
      expect(result.status).not.toBe('needs_generation')
    })
  })

  describe('integration_changed', () => {
    it('currentIntegrationAt > stored.integrationSnapshotAt → integration_changed', () => {
      expect(checkReportStatus(makeStored(TODAY, olderIntegrationAt), newerIntegrationAt, TODAY)).toEqual({
        status: 'needs_generation',
        reason: 'integration_changed',
      })
    })

    it('currentIntegrationAt === stored.integrationSnapshotAt → does NOT return integration_changed', () => {
      const result = checkReportStatus(makeStored(TODAY, integrationAt), integrationAt, TODAY)
      expect(result).toEqual({ status: 'current', report: makeStored(TODAY).report })
    })

    it('currentIntegrationAt < stored.integrationSnapshotAt (clock skew) → does NOT return integration_changed', () => {
      const result = checkReportStatus(makeStored(TODAY, newerIntegrationAt), integrationAt, TODAY)
      expect(result).toEqual({ status: 'current', report: makeStored(TODAY, newerIntegrationAt).report })
    })
  })

  describe('current', () => {
    it('window matches and integrationAt not newer → returns current with the report', () => {
      const stored = makeStored(TODAY)
      const result = checkReportStatus(stored, integrationAt, TODAY)
      expect(result).toEqual({ status: 'current', report: stored.report })
    })
  })

  describe('ordering', () => {
    it('window drifted AND integration changed → returns window_drift (first check wins)', () => {
      expect(
        checkReportStatus(makeStored(YESTERDAY, olderIntegrationAt), newerIntegrationAt, TODAY),
      ).toEqual({ status: 'needs_generation', reason: 'window_drift' })
    })
  })
})
