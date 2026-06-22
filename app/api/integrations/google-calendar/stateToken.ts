import { createHmac, timingSafeEqual } from 'crypto'
import { env } from '@/shared/env'

const STATE_COOKIE = 'gcal_oauth_state'
const TTL_MS = 300_000

type StatePayload = { userId: string; exp: number }

export function signState(userId: string): string {
  const payload = JSON.stringify({ userId, exp: Date.now() + TTL_MS } satisfies StatePayload)
  const b64 = Buffer.from(payload).toString('base64')
  const hmac = createHmac('sha256', env.BETTER_AUTH_SECRET).update(b64).digest('hex')
  return `${b64}.${hmac}`
}

export function verifyState(cookie: string): StatePayload {
  const dotIdx = cookie.lastIndexOf('.')
  if (dotIdx === -1) throw new Error('Malformed state token')

  const b64 = cookie.slice(0, dotIdx)
  const receivedHmac = cookie.slice(dotIdx + 1)
  const expectedHmac = createHmac('sha256', env.BETTER_AUTH_SECRET).update(b64).digest('hex')

  const a = Buffer.from(receivedHmac)
  const b = Buffer.from(expectedHmac)
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    throw new Error('Invalid state token HMAC')
  }

  const payload = JSON.parse(Buffer.from(b64, 'base64').toString()) as StatePayload
  if (Date.now() > payload.exp) throw new Error('State token expired')
  return payload
}

export { STATE_COOKIE }
