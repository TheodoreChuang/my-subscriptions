import { headers } from 'next/headers'
import { authCapability } from '@/infrastructure/auth'
import { FIXTURE } from '@/frontend/report/fixture'
import { ReportPage } from './ReportPage'

export default async function ReportRoute() {
  await authCapability.requireSession(await headers())
  return <ReportPage report={FIXTURE} />
}
