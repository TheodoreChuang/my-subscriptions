import { describe, it, expect, vi } from 'vitest'
import { generateInsights } from '@/modules/report/aiInsights'
import type { AICapability } from '@/shared/capabilities/ai'
import type { EvidencePacket } from '@/modules/report/evidencePacket'
import { aiOutputSchema } from '@/shared/schemas/report'
import type { z } from 'zod'

type AIOutput = z.infer<typeof aiOutputSchema>

const VALID_AI_OUTPUT: AIOutput = {
  executiveSummary: 'Test summary for this period.',
  weekHighlightSummaries: ['Best week was productive.', 'Worst week had lower recovery.'],
  findings: [],
}

function makePacket(overrides: Partial<EvidencePacket> = {}): EvidencePacket {
  return {
    window: { start: '2026-05-23', end: '2026-06-22', days: 30, label: 'May 23 – Jun 22' },
    coverageDays: 20,
    connectedSources: ['calendar', 'health'],
    metrics: {},
    exemplarDays: null,
    weekStats: [],
    candidateSignals: [],
    ...overrides,
  }
}

function makeAIClient(output: AIOutput = VALID_AI_OUTPUT): { client: AICapability; spy: ReturnType<typeof vi.fn> } {
  const spy = vi.fn().mockResolvedValue(output)
  const client: AICapability = { generateObject: spy }
  return { client, spy }
}

describe('generateInsights — tier-gating', () => {
  it('calendar-only: system prompt does not mention recovery, health, WHOOP, or cross-source', async () => {
    const { client, spy } = makeAIClient()
    await generateInsights(makePacket({ connectedSources: ['calendar'] }), client)
    const systemPrompt: string = spy.mock.calls[0][0].system
    expect(systemPrompt.toLowerCase()).not.toMatch(/\brecovery\b/)
    expect(systemPrompt.toLowerCase()).not.toMatch(/\bhealth\b/)
    expect(systemPrompt.toLowerCase()).not.toMatch(/\bwhoop\b/)
    expect(systemPrompt.toLowerCase()).not.toContain('cross-source')
  })

  it('health-only: system prompt does not mention calendar, schedule, or cross-source', async () => {
    const { client, spy } = makeAIClient()
    await generateInsights(makePacket({ connectedSources: ['health'] }), client)
    const systemPrompt: string = spy.mock.calls[0][0].system
    expect(systemPrompt.toLowerCase()).not.toMatch(/\bcalendar\b/)
    expect(systemPrompt.toLowerCase()).not.toMatch(/\bschedule\b/)
    expect(systemPrompt.toLowerCase()).not.toContain('cross-source')
  })

  it('both-connected: system prompt contains cross-source framing', async () => {
    const { client, spy } = makeAIClient()
    await generateInsights(makePacket({ connectedSources: ['calendar', 'health'] }), client)
    const systemPrompt: string = spy.mock.calls[0][0].system
    expect(systemPrompt.toLowerCase()).toContain('cross-source')
    expect(systemPrompt.toLowerCase()).toMatch(/\bcalendar\b/)
    expect(systemPrompt.toLowerCase()).toMatch(/\brecovery\b/)
  })
})

describe('generateInsights — happy path', () => {
  it('resolves with valid AI output when stub returns valid output', async () => {
    const { client } = makeAIClient()
    const result = await generateInsights(makePacket(), client)
    expect(result.executiveSummary).toBe(VALID_AI_OUTPUT.executiveSummary)
    expect(result.findings).toHaveLength(0)
  })

  it('returns all weekHighlightSummaries from the AI output', async () => {
    const output = { ...VALID_AI_OUTPUT, weekHighlightSummaries: ['Week 1', 'Week 2'] }
    const { client } = makeAIClient(output)
    const result = await generateInsights(makePacket(), client)
    expect(result.weekHighlightSummaries).toEqual(['Week 1', 'Week 2'])
  })

  it('accepts empty findings (license to find nothing)', async () => {
    const { client } = makeAIClient({ ...VALID_AI_OUTPUT, findings: [] })
    const result = await generateInsights(makePacket(), client)
    expect(result.findings).toHaveLength(0)
  })

  it('returns 5 findings when stub returns 5 valid findings', async () => {
    const findings = Array.from({ length: 5 }, (_, i) => ({
      id: `f${i}`,
      type: 'finding' as const,
      title: `Finding ${i}`,
      description: 'Description',
      alternativeExplanation: 'Alternative',
      confidence: 'medium' as const,
    }))
    const { client } = makeAIClient({ ...VALID_AI_OUTPUT, findings })
    const result = await generateInsights(makePacket(), client)
    expect(result.findings).toHaveLength(5)
  })
})

describe('generateInsights — edge cases', () => {
  it('propagates error when aiClient.generateObject throws', async () => {
    const spy = vi.fn().mockRejectedValue(new Error('API timeout'))
    const client: AICapability = { generateObject: spy }
    await expect(generateInsights(makePacket(), client)).rejects.toThrow('API timeout')
  })

  it('passes evidence packet as the user prompt JSON', async () => {
    const { client, spy } = makeAIClient()
    const packet = makePacket({ coverageDays: 15 })
    await generateInsights(packet, client)
    const userPrompt: string = spy.mock.calls[0][0].prompt
    const parsed = JSON.parse(userPrompt)
    expect(parsed.coverageDays).toBe(15)
  })
})
