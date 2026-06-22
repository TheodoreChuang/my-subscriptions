import type { Report } from '@/shared/types/report'

export type StoredReport = {
  report: Report
  integrationSnapshotAt: Date
}

export interface ReportRepository {
  getReport(userId: string): Promise<StoredReport | null>
  saveReport(userId: string, report: Report, integrationSnapshotAt: Date): Promise<void>
}
