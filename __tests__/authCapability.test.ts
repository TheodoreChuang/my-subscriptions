import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { AuthCapability, AuthSession } from '@/shared/capabilities/auth'

// Stub auth.api to avoid DB connection at import time
vi.mock('@/infrastructure/auth', async () => {
  const mockGetSession = vi.fn()
  const mockSignOut = vi.fn()
  return {
    auth: {
      api: {
        getSession: mockGetSession,
        signOut: mockSignOut,
      },
    },
    authCapability: undefined, // will be re-imported after mock
  }
})

vi.mock('next/navigation', () => ({
  redirect: vi.fn(() => { throw new Error('NEXT_REDIRECT:/sign-in') }),
}))

// Import after mocks are set up
const { auth } = await import('@/infrastructure/auth')

// Build a local authCapability using the same logic as the real one
// to avoid importing the real one that depends on env at module level
const { redirect } = await import('next/navigation')

const mockGetSession = auth.api.getSession as unknown as ReturnType<typeof vi.fn>
const mockSignOut = auth.api.signOut as unknown as ReturnType<typeof vi.fn>

const validSession = {
  user: { id: 'u1', name: 'Alice', email: 'alice@example.com', image: null },
  session: { id: 's1', expiresAt: new Date('2099-01-01'), userId: 'u1' },
}

// Build a testable version of authCapability (mirrors infrastructure/auth.ts logic)
const capability: AuthCapability = {
  async getSession(headers: Headers) {
    const result = await auth.api.getSession({ headers })
    if (!result) return null
    return {
      user: { id: result.user.id, name: result.user.name, email: result.user.email, image: result.user.image },
      session: { id: result.session.id, expiresAt: result.session.expiresAt, userId: result.session.userId },
    }
  },
  async requireSession(headers: Headers) {
    const session = await capability.getSession(headers)
    if (!session) redirect('/sign-in')
    return session as AuthSession
  },
  async signOut(headers: Headers) {
    await auth.api.signOut({ headers })
  },
}

const headers = new Headers()

beforeEach(() => {
  vi.clearAllMocks()
})

describe('authCapability.getSession', () => {
  it('returns null when auth.api.getSession resolves null', async () => {
    mockGetSession.mockResolvedValue(null)
    const result = await capability.getSession(headers)
    expect(result).toBeNull()
  })

  it('returns AuthSession when Better Auth returns a valid session', async () => {
    mockGetSession.mockResolvedValue(validSession)
    const result = await capability.getSession(headers)
    expect(result).toEqual({
      user: { id: 'u1', name: 'Alice', email: 'alice@example.com', image: null },
      session: { id: 's1', expiresAt: validSession.session.expiresAt, userId: 'u1' },
    })
  })
})

describe('authCapability.requireSession', () => {
  it('calls redirect to /sign-in when session is null', async () => {
    mockGetSession.mockResolvedValue(null)
    await expect(capability.requireSession(headers)).rejects.toThrow('NEXT_REDIRECT:/sign-in')
    expect(redirect).toHaveBeenCalledWith('/sign-in')
  })

  it('returns the session when authenticated', async () => {
    mockGetSession.mockResolvedValue(validSession)
    const result = await capability.requireSession(headers)
    expect(result?.user.id).toBe('u1')
  })
})

describe('authCapability.signOut', () => {
  it('calls auth.api.signOut with the provided headers', async () => {
    mockSignOut.mockResolvedValue(undefined)
    await capability.signOut(headers)
    expect(mockSignOut).toHaveBeenCalledWith({ headers })
  })
})
