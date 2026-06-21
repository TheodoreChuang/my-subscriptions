import { headers } from 'next/headers'
import { authCapability } from '@/infrastructure/auth'
import { FIXTURE } from '@/frontend/report/fixture'

export async function GET() {
  const session = await authCapability.getSession(await headers())
  if (!session) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  return Response.json(FIXTURE)
}
