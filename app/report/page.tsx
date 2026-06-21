import { headers } from 'next/headers'
import { authCapability } from '@/infrastructure/auth'
import { logger } from '@/infrastructure/logger';
import { getReport } from '@/modules';
import { ReportPage } from './ReportPage';

export const dynamic = 'force-dynamic';

export default async function ReportRoute() {
  await authCapability.requireSession(await headers())
  const report = await getReport(logger);
  return <ReportPage report={report} />;
}
