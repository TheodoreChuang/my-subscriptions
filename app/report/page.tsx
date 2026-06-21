import { reportSchema } from '@/shared/schemas/report';
import { getInternalBaseUrl } from '@/shared/getInternalBaseUrl';
import { ReportPage } from './ReportPage';

export const dynamic = 'force-dynamic';

export default async function ReportRoute() {
  const res = await fetch(`${getInternalBaseUrl()}/api/report`);
  if (!res.ok) throw new Error(`Failed to fetch report: ${res.status}`);
  const report = reportSchema.parse(await res.json());
  return <ReportPage report={report} />;
}
