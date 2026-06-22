type ConnectionStatus = 'not_connected' | 'needs_reconnect' | 'connected'

export function resolveReportAccess(
  calendarStatus: ConnectionStatus,
  hasCalendarSelections: boolean,
  whoopStatus: ConnectionStatus,
): 'onboarding' | 'connect-calendar' | 'render' {
  // At least one active data source — WHOOP alone is sufficient
  if (whoopStatus === 'connected') return 'render'

  // WHOOP not active; fall back to calendar-only checks
  if (calendarStatus === 'not_connected' || calendarStatus === 'needs_reconnect') {
    return 'onboarding'
  }

  // Calendar connected
  if (!hasCalendarSelections) return 'connect-calendar'

  return 'render'
}
