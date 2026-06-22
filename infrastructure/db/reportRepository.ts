import { desc, eq } from 'drizzle-orm'
import { db } from './client'
import { reports } from './schema'
import type { ReportRepository, StoredReport } from '@/modules/report/reportRepository'
import type { Report } from '@/shared/types/report'

export class PostgresReportRepository implements ReportRepository {
  async getReport(userId: string): Promise<StoredReport | null> {
    const rows = await db
      .select()
      .from(reports)
      .where(eq(reports.userId, userId))
      .orderBy(desc(reports.generatedAt))
      .limit(1)
    if (rows.length === 0) return null
    const r = rows[0]
    return {
      report: r.data as Report,
      integrationSnapshotAt: r.integrationSnapshotAt,
    }
  }

  async saveReport(userId: string, report: Report, integrationSnapshotAt: Date): Promise<void> {
    const now = new Date()
    await db
      .insert(reports)
      .values({
        userId,
        data: report,
        windowStart: report.window.start,
        windowEnd: report.window.end,
        generatedAt: new Date(report.generatedAt),
        integrationSnapshotAt,
        createdAt: now,
      })
  }
}
