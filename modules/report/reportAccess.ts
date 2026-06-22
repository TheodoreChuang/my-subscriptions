type ConnectionStatus = 'not_connected' | 'needs_reconnect' | 'connected'

export function resolveReportAccess(
  calendarStatus: ConnectionStatus,
  hasCalendarSelections: boolean,
  whoopStatus: ConnectionStatus,
): 'onboarding' | 'connect-calendar' | 'render' {
  // Both disconnected or calendar needs reconnect with no WHOOP fallback
  if (whoopStatus !== 'connected') {
    if (calendarStatus === 'not_connected' || calendarStatus === 'needs_reconnect') {
      return 'onboarding'
    }
    // Calendar connected but no selections and WHOOP not available
    if (!hasCalendarSelections) {
      return 'connect-calendar'
    }
  }

  // WHOOP connected, or calendar connected with selections
  // At least one active data source
  if (whoopStatus === 'connected' || (calendarStatus === 'connected' && hasCalendarSelections)) {
    return 'render'
  }

  // Calendar connected with selections, regardless of WHOOP status
  if (calendarStatus === 'connected' && hasCalendarSelections) {
    return 'render'
  }

  return 'onboarding'
}
