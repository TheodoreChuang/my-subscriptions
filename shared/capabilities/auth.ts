export type AuthUser = {
  id: string
  name: string
  email: string
  image?: string | null
}

export type AuthSession = {
  user: AuthUser
  session: { id: string; expiresAt: Date; userId: string }
}

export interface AuthCapability {
  getSession(headers: Headers): Promise<AuthSession | null>
  requireSession(headers: Headers): Promise<AuthSession>
  signOut(headers: Headers): Promise<void>
}
