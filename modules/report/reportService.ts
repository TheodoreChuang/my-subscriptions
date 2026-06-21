import type { Logger } from '@/shared/capabilities/logger';
import type { Report } from '@/shared/types/report';
import { FIXTURE } from '@/frontend/report/fixture';

export async function getReport(logger: Logger): Promise<Report> {
  logger.info('getReport called');
  return FIXTURE;
}
