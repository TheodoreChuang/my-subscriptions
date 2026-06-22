import type { Report } from '@/shared/types/report'
import type { StoredReport } from './reportRepository'

export type ReportStatus =
  | { status: 'current'; report: Report }
  | { status: 'needs_generation'; reason: 'no_report' | 'window_drift' | 'integration_changed' }

export function checkReportStatus(
  stored: StoredReport | null,
  currentIntegrationAt: Date,
  windowEndExpected: string, // YYYY-MM-DD UTC
): ReportStatus {
  if (!stored) {
    return { status: 'needs_generation', reason: 'no_report' }
  }
  if (stored.report.window.end !== windowEndExpected) {
    return { status: 'needs_generation', reason: 'window_drift' }
  }
  if (currentIntegrationAt.getTime() > stored.integrationSnapshotAt.getTime()) {
    return { status: 'needs_generation', reason: 'integration_changed' }
  }
  return { status: 'current', report: stored.report }
}
