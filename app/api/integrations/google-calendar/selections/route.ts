import { type NextRequest, NextResponse } from 'next/server'
import { headers } from 'next/headers'
import { z } from 'zod'
import { authCapability } from '@/infrastructure/auth'
import { googleCalendarClient, postgresCalendarRepository } from '@/infrastructure'
import { listOwnedCalendars, updateSelections } from '@/modules'

const SelectionsSchema = z.object({
  selectedIds: z.array(z.string()).min(1),
})

export async function POST(request: NextRequest) {
  const session = await authCapability.getSession(await headers())
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const userId = session.user.id

  let selectedIds: string[]
  try {
    const body = SelectionsSchema.parse(await request.json())
    selectedIds = body.selectedIds
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }

  // Re-fetch owned calendars server-side and verify all submitted IDs are owned
  let ownedCalendars
  try {
    ownedCalendars = await listOwnedCalendars(userId, postgresCalendarRepository, googleCalendarClient)
  } catch {
    return NextResponse.json({ error: 'Failed to fetch calendars' }, { status: 500 })
  }

  const ownedIds = new Set(ownedCalendars.map((c) => c.id))
  for (const id of selectedIds) {
    if (!ownedIds.has(id)) {
      return NextResponse.json({ error: `Calendar ${id} is not an owned calendar` }, { status: 400 })
    }
  }

  const verifiedSelections = ownedCalendars.filter((c) => selectedIds.includes(c.id))
  await updateSelections(
    userId,
    verifiedSelections.map((c) => ({ externalCalendarId: c.id, name: c.name })),
    postgresCalendarRepository,
  )

  return NextResponse.json({ ok: true })
}
