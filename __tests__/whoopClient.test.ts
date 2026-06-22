import { describe, it, expect, vi, beforeEach } from 'vitest'
import { WhoopClient } from '@/infrastructure/whoop/whoopClient'

const makeLogger = () => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn() })

function mockFetch(responses: Array<{ ok: boolean; body: unknown; status?: number }>) {
  let call = 0
  return vi.fn().mockImplementation(async () => {
    const r = responses[call++] ?? responses[responses.length - 1]
    return {
      ok: r.ok,
      status: r.status ?? (r.ok ? 200 : 400),
      text: async () => JSON.stringify(r.body),
      json: async () => r.body,
    }
  })
}

// ─── exchangeCode ─────────────────────────────────────────────────────────────

describe('WhoopClient.exchangeCode', () => {
  beforeEach(() => { vi.unstubAllGlobals() })

  it('sends form-urlencoded body with Content-Type header', async () => {
    const client = new WhoopClient('cid', 'csecret', makeLogger())
    const fetchSpy = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      text: async () => '{}',
      json: async () => ({ access_token: 'at', refresh_token: 'rt', expires_in: 3600 }),
    })
    vi.stubGlobal('fetch', fetchSpy)
    await client.exchangeCode('code123', 'http://localhost/callback')
    const [, init] = fetchSpy.mock.calls[0] as [string, RequestInit]
    expect((init.headers as Record<string, string>)['content-type']).toBe('application/x-www-form-urlencoded')
    expect(init.body).toBeInstanceOf(URLSearchParams)
    const params = init.body as URLSearchParams
    expect(params.get('grant_type')).toBe('authorization_code')
    expect(params.get('code')).toBe('code123')
  })

  it('returns HealthTokens on 200', async () => {
    const client = new WhoopClient('cid', 'csecret', makeLogger())
    vi.stubGlobal('fetch', mockFetch([{
      ok: true,
      body: { access_token: 'at', refresh_token: 'rt', expires_in: 3600 },
    }]))
    const result = await client.exchangeCode('code', 'http://localhost/callback')
    expect(result.accessToken).toBe('at')
    expect(result.refreshToken).toBe('rt')
    expect(result.expiresAt.getTime()).toBeGreaterThan(Date.now())
  })

  it('throws with HTTP status on non-200', async () => {
    const client = new WhoopClient('cid', 'csecret', makeLogger())
    vi.stubGlobal('fetch', mockFetch([{ ok: false, status: 400, body: 'bad request' }]))
    await expect(client.exchangeCode('bad', 'http://localhost/callback')).rejects.toThrow('400')
  })
})

// ─── refreshTokens ────────────────────────────────────────────────────────────

describe('WhoopClient.refreshTokens', () => {
  beforeEach(() => { vi.unstubAllGlobals() })

  it('sends form-urlencoded body with refresh_token grant', async () => {
    const client = new WhoopClient('cid', 'csecret', makeLogger())
    const fetchSpy = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      text: async () => '{}',
      json: async () => ({ access_token: 'new-at', refresh_token: 'new-rt', expires_in: 3600 }),
    })
    vi.stubGlobal('fetch', fetchSpy)
    await client.refreshTokens('old-rt')
    const [, init] = fetchSpy.mock.calls[0] as [string, RequestInit]
    expect((init.headers as Record<string, string>)['content-type']).toBe('application/x-www-form-urlencoded')
    expect(init.body).toBeInstanceOf(URLSearchParams)
    const params = init.body as URLSearchParams
    expect(params.get('grant_type')).toBe('refresh_token')
    expect(params.get('refresh_token')).toBe('old-rt')
  })

  it('returns HealthTokens with new access and refresh tokens on success', async () => {
    const client = new WhoopClient('cid', 'csecret', makeLogger())
    vi.stubGlobal('fetch', mockFetch([{
      ok: true,
      body: { access_token: 'new-at', refresh_token: 'new-rt', expires_in: 1800 },
    }]))
    const result = await client.refreshTokens('old-rt')
    expect(result.accessToken).toBe('new-at')
    expect(result.refreshToken).toBe('new-rt')
    expect(result.expiresAt.getTime()).toBeGreaterThan(Date.now())
  })

  it('throws with HTTP status on non-200', async () => {
    const client = new WhoopClient('cid', 'csecret', makeLogger())
    vi.stubGlobal('fetch', mockFetch([{ ok: false, status: 401, body: { error: 'invalid_token' } }]))
    await expect(client.refreshTokens('bad-rt')).rejects.toThrow('401')
  })
})

// ─── paginateAll ──────────────────────────────────────────────────────────────

describe('WhoopClient.paginateAll', () => {
  beforeEach(() => { vi.unstubAllGlobals() })

  it('fetches a single page when next_token is absent', async () => {
    const client = new WhoopClient('cid', 'csecret', makeLogger())
    vi.stubGlobal('fetch', mockFetch([{
      ok: true,
      body: { records: [{ id: 1 }, { id: 2 }] },
    }]))
    const result = await client.paginateAll(() => 'https://example.com/page', 'tok')
    expect(result).toHaveLength(2)
  })

  it('follows next_token across multiple pages and accumulates records', async () => {
    const client = new WhoopClient('cid', 'csecret', makeLogger())
    vi.stubGlobal('fetch', mockFetch([
      { ok: true, body: { records: [{ id: 1 }], next_token: 'tok2' } },
      { ok: true, body: { records: [{ id: 2 }], next_token: 'tok3' } },
      { ok: true, body: { records: [{ id: 3 }] } },
    ]))
    const result = await client.paginateAll(() => 'https://example.com', 'at')
    expect(result).toHaveLength(3)
  })

  it('passes nextToken (camelCase) to the URL builder on subsequent pages', async () => {
    const client = new WhoopClient('cid', 'csecret', makeLogger())
    const capturedTokens: Array<string | undefined> = []
    vi.stubGlobal('fetch', mockFetch([
      { ok: true, body: { records: [{ id: 1 }], next_token: 'abc' } },
      { ok: true, body: { records: [{ id: 2 }] } },
    ]))
    await client.paginateAll((nextToken) => {
      capturedTokens.push(nextToken)
      return 'https://example.com'
    }, 'at')
    expect(capturedTokens[0]).toBeUndefined()
    expect(capturedTokens[1]).toBe('abc')
  })

  it('stops at 50 pages and returns accumulated records', async () => {
    const client = new WhoopClient('cid', 'csecret', makeLogger())
    const pageResponse = { ok: true, body: { records: [{ id: 1 }], next_token: 'more' } }
    vi.stubGlobal('fetch', mockFetch(Array(60).fill(pageResponse)))
    const result = await client.paginateAll(() => 'https://example.com', 'at')
    expect(result).toHaveLength(50)
  })

  it('throws with HTTP status and URL on non-200 response', async () => {
    const client = new WhoopClient('cid', 'csecret', makeLogger())
    vi.stubGlobal('fetch', mockFetch([{ ok: false, status: 503, body: 'unavailable' }]))
    await expect(client.paginateAll(() => 'https://api.example.com/v2/cycle', 'at')).rejects.toThrow('503')
  })
})

// ─── fetchRawData ─────────────────────────────────────────────────────────────

const FUTURE = new Date(Date.now() + 60 * 60 * 1000)
const tokens = { accessToken: 'at', refreshToken: 'rt', expiresAt: FUTURE }
const window = { startDate: new Date('2026-05-22'), endDate: new Date('2026-06-22') }

function makeCycle(id: number, score_state = 'SCORED', end: string | null = '2026-05-23T06:00:00Z') {
  return { id, start: '2026-05-22T20:00:00Z', end, timezone_offset: '+10:00', score_state, score: { strain: 10 } }
}

function makeSleep(id: string, cycle_id: number, nap = false, score_state = 'SCORED') {
  return { id, cycle_id, nap, score_state, score: { stage_summary: {}, sleep_needed: {} } }
}

function makeRecovery(cycle_id: number, sleep_id: string, score_state = 'SCORED') {
  return { cycle_id, sleep_id, score_state, score: { recovery_score: 75, hrv_rmssd_milli: 40 } }
}

describe('WhoopClient.fetchRawData', () => {
  beforeEach(() => { vi.unstubAllGlobals() })

  it('happy path: returns WhoopRawData with scored cycles, non-nap sleeps, and recoveries', async () => {
    const client = new WhoopClient('cid', 'csecret', makeLogger())
    const cycle = makeCycle(100)
    const sleep = makeSleep('s1', 100)
    const recovery = makeRecovery(100, 's1')
    vi.stubGlobal('fetch', mockFetch([
      { ok: true, body: { records: [cycle] } },
      { ok: true, body: { records: [sleep] } },
      { ok: true, body: { records: [recovery] } },
    ]))
    const result = await client.fetchRawData(tokens, window)
    expect(result.cycles).toHaveLength(1)
    expect(result.sleeps).toHaveLength(1)
    expect(result.recoveries).toHaveLength(1)
  })

  it('excludes cycles with score_state !== SCORED', async () => {
    const client = new WhoopClient('cid', 'csecret', makeLogger())
    vi.stubGlobal('fetch', mockFetch([
      { ok: true, body: { records: [makeCycle(1, 'PENDING_SCORE'), makeCycle(2, 'SCORED')] } },
      { ok: true, body: { records: [] } },
      { ok: true, body: { records: [] } },
    ]))
    const result = await client.fetchRawData(tokens, window)
    expect(result.cycles).toHaveLength(1)
    expect(result.cycles[0].id).toBe(2)
  })

  it('excludes sleep records with nap === true even when SCORED', async () => {
    const client = new WhoopClient('cid', 'csecret', makeLogger())
    const nap = makeSleep('nap1', 200, true, 'SCORED')
    const main = makeSleep('main1', 200, false, 'SCORED')
    vi.stubGlobal('fetch', mockFetch([
      { ok: true, body: { records: [makeCycle(200)] } },
      { ok: true, body: { records: [nap, main] } },
      { ok: true, body: { records: [] } },
    ]))
    const result = await client.fetchRawData(tokens, window)
    expect(result.sleeps).toHaveLength(1)
    expect(result.sleeps[0].id).toBe('main1')
  })

  it('excludes sleep records with score_state !== SCORED', async () => {
    const client = new WhoopClient('cid', 'csecret', makeLogger())
    vi.stubGlobal('fetch', mockFetch([
      { ok: true, body: { records: [makeCycle(300)] } },
      { ok: true, body: { records: [makeSleep('s1', 300, false, 'PENDING_SCORE')] } },
      { ok: true, body: { records: [] } },
    ]))
    const result = await client.fetchRawData(tokens, window)
    expect(result.sleeps).toHaveLength(0)
  })

  it('handles mismatched counts via cycle_id join (31 cycles / 30 sleeps / 29 recoveries)', async () => {
    const client = new WhoopClient('cid', 'csecret', makeLogger())
    const cycles = Array.from({ length: 31 }, (_, i) => makeCycle(i + 1))
    const sleeps = Array.from({ length: 30 }, (_, i) => makeSleep(`s${i + 1}`, i + 1))
    const recoveries = Array.from({ length: 29 }, (_, i) => makeRecovery(i + 1, `s${i + 1}`))
    vi.stubGlobal('fetch', mockFetch([
      { ok: true, body: { records: cycles } },
      { ok: true, body: { records: sleeps } },
      { ok: true, body: { records: recoveries } },
    ]))
    const result = await client.fetchRawData(tokens, window)
    expect(result.cycles).toHaveLength(31)
    expect(result.sleeps).toHaveLength(30)
    expect(result.recoveries).toHaveLength(29)
  })

  it('includes in-progress cycle (end: null) when SCORED', async () => {
    const client = new WhoopClient('cid', 'csecret', makeLogger())
    const openCycle = makeCycle(999, 'SCORED', null)
    vi.stubGlobal('fetch', mockFetch([
      { ok: true, body: { records: [openCycle] } },
      { ok: true, body: { records: [] } },
      { ok: true, body: { records: [] } },
    ]))
    const result = await client.fetchRawData(tokens, window)
    expect(result.cycles).toHaveLength(1)
    expect(result.cycles[0].end).toBeNull()
  })

  it('throws on non-200 from any WHOOP data endpoint', async () => {
    const client = new WhoopClient('cid', 'csecret', makeLogger())
    vi.stubGlobal('fetch', mockFetch([
      { ok: false, status: 401, body: 'Unauthorized' },
    ]))
    await expect(client.fetchRawData(tokens, window)).rejects.toThrow('401')
  })
})
