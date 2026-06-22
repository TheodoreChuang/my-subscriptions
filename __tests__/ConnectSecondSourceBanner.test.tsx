import { describe, it, expect, afterEach, vi } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'

vi.mock('next/link', () => ({
  default: ({ href, children, ...props }: { href: string; children: React.ReactNode; [key: string]: unknown }) => (
    <a href={href} {...props}>{children}</a>
  ),
}))

import { ConnectSecondSourceBanner } from '@/app/report/components/ConnectSecondSourceBanner'

afterEach(() => cleanup())

describe('ConnectSecondSourceBanner', () => {
  it('renders WHOOP prompt when only calendar is connected', () => {
    render(<ConnectSecondSourceBanner connectedSources={['calendar']} />)
    expect(screen.getByText(/add whoop/i)).toBeDefined()
    const link = screen.getByRole('link')
    expect((link as HTMLAnchorElement).href).toContain('/onboarding')
  })

  it('renders Google Calendar prompt when only health is connected', () => {
    render(<ConnectSecondSourceBanner connectedSources={['health']} />)
    expect(screen.getByText(/add google calendar/i)).toBeDefined()
  })

  it('renders nothing when both sources are connected', () => {
    const { container } = render(
      <ConnectSecondSourceBanner connectedSources={['calendar', 'health']} />,
    )
    expect(container.firstChild).toBeNull()
  })

  it('renders nothing when no sources are connected', () => {
    const { container } = render(
      <ConnectSecondSourceBanner connectedSources={[]} />,
    )
    expect(container.firstChild).toBeNull()
  })
})
