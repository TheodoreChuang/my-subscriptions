import { headers } from 'next/headers'
import { authCapability } from '@/infrastructure/auth'
import { logger, googleCalendarClient, postgresCalendarRepository, postgresWhoopRepository, whoopClient, aiClient, postgresReportRepository } from '@/infrastructure'
import { getReport } from '@/modules'
import { OAuthError } from '@/shared/capabilities/calendar'
import { IntegrationNotFoundError } from '@/modules/whoop/whoopService'

export async function GET() {
  const session = await authCapability.getSession(await headers())
  if (!session) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const report = await getReport(session.user.id, {
      calendarRepo: postgresCalendarRepository,
      calendarClient: googleCalendarClient,
      whoopRepo: postgresWhoopRepository,
      whoopClient,
      aiClient,
      reportRepo: postgresReportRepository,
      logger,
    });
    return Response.json(report);
  } catch (err) {
    if (err instanceof OAuthError && err.code === 'invalid_grant') {
      return Response.json({ error: 'auth_required', provider: 'calendar' }, { status: 401 })
    }
    if (err instanceof IntegrationNotFoundError) {
      return Response.json({ error: 'auth_required', provider: 'health' }, { status: 401 })
    }
    logger.error('GET /api/report failed', { err })
    return Response.json({ error: 'Internal error' }, { status: 500 })
  }
}
