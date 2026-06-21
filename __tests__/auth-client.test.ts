import { describe, it, expect, vi } from 'vitest'

vi.mock('better-auth/react', () => ({
  createAuthClient: vi.fn(() => ({
    signIn: {
      social: vi.fn(),
    },
    signOut: vi.fn(),
    useSession: vi.fn(),
  })),
}))

const { authClient } = await import('@/frontend/auth/auth-client')

describe('authClient', () => {
  it('is defined and not null', () => {
    expect(authClient).toBeDefined()
    expect(authClient).not.toBeNull()
  })

  it('exposes signIn.social as a function', () => {
    expect(typeof authClient.signIn.social).toBe('function')
  })
})
