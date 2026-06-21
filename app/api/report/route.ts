import { headers } from 'next/headers'
import { authCapability } from '@/infrastructure/auth'
import { logger } from '@/infrastructure/logger';
import { getReport } from '@/modules';
import { reportSchema } from '@/shared/schemas/report';

export async function GET() {
  const session = await authCapability.getSession(await headers())
  if (!session) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const report = await getReport(logger);
    reportSchema.parse(report);
    return Response.json(report);
  } catch (err) {
    logger.error('GET /api/report failed', { err });
    return Response.json({ error: 'Internal error' }, { status: 500 });
  }
}
