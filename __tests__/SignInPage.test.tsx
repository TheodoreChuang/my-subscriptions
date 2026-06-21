import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react'

vi.mock('@/frontend/auth/auth-client', () => ({
  authClient: {
    signIn: {
      social: vi.fn(),
    },
  },
}))

const { authClient } = await import('@/frontend/auth/auth-client')
const { SignInPage } = await import('@/frontend/auth/SignInPage')

const mockSignIn = authClient.signIn.social as unknown as ReturnType<typeof vi.fn>

beforeEach(() => {
  vi.clearAllMocks()
  mockSignIn.mockResolvedValue(undefined)
})

afterEach(() => {
  cleanup()
})

describe('SignInPage', () => {
  it('renders a "Continue with Google" button', () => {
    render(<SignInPage />)
    expect(screen.getByRole('button', { name: /continue with google/i })).toBeDefined()
  })

  it('does not render email or password inputs', () => {
    render(<SignInPage />)
    expect(screen.queryByRole('textbox', { name: /email/i })).toBeNull()
    expect(document.querySelector('input[type="password"]')).toBeNull()
  })

  it('renders the value proposition text', () => {
    render(<SignInPage />)
    expect(screen.getByText(/your life, decoded/i)).toBeDefined()
  })

  it('renders Terms and Privacy Policy links', () => {
    render(<SignInPage />)
    expect(screen.getByRole('link', { name: /terms/i })).toBeDefined()
    expect(screen.getByRole('link', { name: /privacy policy/i })).toBeDefined()
  })

  it('button has type="button"', () => {
    render(<SignInPage />)
    const btn = screen.getByRole('button', { name: /continue with google/i })
    expect(btn.getAttribute('type')).toBe('button')
  })

  it('button enters disabled state when clicked', async () => {
    mockSignIn.mockReturnValue(new Promise(() => {})) // never resolves
    render(<SignInPage />)
    const btn = screen.getByRole('button', { name: /continue with google/i })
    fireEvent.click(btn)
    await waitFor(() => {
      expect(btn.hasAttribute('disabled')).toBe(true)
    })
  })

  it('calls authClient.signIn.social on button click', async () => {
    render(<SignInPage />)
    fireEvent.click(screen.getByRole('button', { name: /continue with google/i }))
    await waitFor(() => {
      expect(mockSignIn).toHaveBeenCalledWith({
        provider: 'google',
        callbackURL: '/report',
      })
    })
  })

  it('shows error message when errorParam is auth_failed', async () => {
    render(<SignInPage errorParam="auth_failed" />)
    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeDefined()
      expect(screen.getByText(/sign-in failed/i)).toBeDefined()
    })
  })

  it('does not show error when errorParam is absent', () => {
    render(<SignInPage />)
    expect(screen.queryByRole('alert')).toBeNull()
  })
})
