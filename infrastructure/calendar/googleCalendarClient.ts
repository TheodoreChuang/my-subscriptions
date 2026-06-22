import { env } from '@/shared/env'
import { logger } from '../logger'
import { GoogleCalendarClient } from './googleCalendar'
import type { CalendarCapability } from '@/shared/capabilities/calendar'

export const googleCalendarClient: CalendarCapability = new GoogleCalendarClient(
  env.GOOGLE_CLIENT_ID,
  env.GOOGLE_CLIENT_SECRET,
  logger,
)
