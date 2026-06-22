import { describe, it, expect } from 'vitest'
import { resolveReportAccess } from '@/modules/report/reportAccess'

describe('resolveReportAccess', () => {
  it('both not_connected → onboarding', () => {
    expect(resolveReportAccess('not_connected', false, 'not_connected')).toBe('onboarding')
  })

  it('calendar needs_reconnect, WHOOP not_connected → onboarding', () => {
    expect(resolveReportAccess('needs_reconnect', false, 'not_connected')).toBe('onboarding')
  })

  it('calendar connected no selections, WHOOP not_connected → connect-calendar', () => {
    expect(resolveReportAccess('connected', false, 'not_connected')).toBe('connect-calendar')
  })

  it('calendar connected with selections, WHOOP not_connected → render', () => {
    expect(resolveReportAccess('connected', true, 'not_connected')).toBe('render')
  })

  it('WHOOP connected, calendar not_connected → render (WHOOP-only path)', () => {
    expect(resolveReportAccess('not_connected', false, 'connected')).toBe('render')
  })

  it('WHOOP connected, calendar needs_reconnect → render (WHOOP still active)', () => {
    expect(resolveReportAccess('needs_reconnect', false, 'connected')).toBe('render')
  })

  it('WHOOP connected, calendar connected no selections → render (WHOOP is the active path)', () => {
    expect(resolveReportAccess('connected', false, 'connected')).toBe('render')
  })

  it('both connected, calendar has selections → render', () => {
    expect(resolveReportAccess('connected', true, 'connected')).toBe('render')
  })

  it('calendar connected with selections, WHOOP needs_reconnect → render', () => {
    expect(resolveReportAccess('connected', true, 'needs_reconnect')).toBe('render')
  })

  it('WHOOP connected, calendar connected with selections → render', () => {
    expect(resolveReportAccess('connected', true, 'connected')).toBe('render')
  })
})
