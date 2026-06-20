import { logger } from '@/infrastructure/logger';
import { getReport } from '@/modules';
import { reportSchema } from '@/shared/schemas/report';

export async function GET() {
  try {
    const report = await getReport(logger);
    reportSchema.parse(report);
    return Response.json(report);
  } catch {
    return Response.json({ error: 'Internal error' }, { status: 500 });
  }
}
