import { headers } from 'next/headers'
import { authCapability } from '@/infrastructure/auth'
import { logger, googleCalendarClient, postgresCalendarRepository, postgresWhoopRepository, whoopClient } from '@/infrastructure';
import { getReport } from '@/modules';

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
      logger,
    });
    return Response.json(report);
  } catch (err) {
    logger.error('GET /api/report failed', { err });
    return Response.json({ error: 'Internal error' }, { status: 500 });
  }
}
