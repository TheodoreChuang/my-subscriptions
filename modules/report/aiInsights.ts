import type { AICapability } from '@/shared/capabilities/ai'
import type { EvidencePacket } from './evidencePacket'
import { aiOutputSchema } from '@/shared/schemas/report'
import type { z } from 'zod'

type AIOutput = z.infer<typeof aiOutputSchema>

const FIVE_TECHNIQUES = `
You apply five reasoning disciplines to every analysis:

1. COMPETING HYPOTHESES — For each finding, present one alternative explanation that could equally explain the observed pattern.
2. SKEPTICAL SELF-CRITIQUE — Downgrade or cut any claim that is indistinguishable from noise given the sample size. Small samples require stated uncertainty.
3. FALSIFIABLE RECOMMENDATIONS — Frame suggestions as experiments with a specific kill condition (what observable outcome would tell you to stop).
4. LICENSE TO FIND NOTHING — An empty findings array is a valid, honest output. Do not manufacture findings to fill space.
5. CALIBRATED CONFIDENCE — Use the confidence levels "high", "medium", or "low" literally and conservatively. Reserve "high" for patterns with sufficient n and strong effect size.
`

const DOMAIN_FACTS = `
DOMAIN FACTS (structural constraints — not negotiable):
- Recovery (0–100%) is a morning readiness score reflecting the PREVIOUS night's HRV, resting heart rate, and sleep. It is measured BEFORE that day's activities occur. Activity→recovery correlations are therefore associational; the default competing hypothesis for any exercise–recovery finding is "high recovery may enable exercise rather than exercise causing high recovery."
- Strain (0–21) is cumulative cardiovascular load for the day. High strain and low next-day recovery are correlated short-term; this is a training tradeoff, not simply negative.
- NEVER claim causation. Use directional language only: "associated with", "tends to coincide with". NEVER use: "causes", "leads to", "results in".
`

function buildCalendarOnlyPrompt(): string {
  return `You are an insight analyst reviewing a user's Google Calendar data.

Your task: surface insights from the user's time allocation and scheduling patterns over the past 30 days.

Scope: activity allocation, meeting density, time-use distribution, scheduling patterns, fragmentation of focus time.

Analyze only the calendar data provided. Draw insights solely from how the user allocates time.
${FIVE_TECHNIQUES}
Respond with a JSON object matching the required schema.`
}

function buildHealthOnlyPrompt(): string {
  return `You are an insight analyst reviewing a user's physiological tracking data.

Your task: surface insights from the user's readiness scores, sleep, and daily strain over the past 30 days.

Scope: readiness trends, sleep quality, strain variation, day-to-day physiological patterns.

Analyze only the physiological data provided. Draw insights solely from the body metrics in the evidence packet.
${FIVE_TECHNIQUES}
${DOMAIN_FACTS}
Respond with a JSON object matching the required schema.`
}

function buildBothSourcesPrompt(): string {
  return `You are an insight analyst reviewing a user's integrated calendar and health data.

Your task: analyze relationships between how this user spends time and how their body responds — specifically how schedule patterns relate to recovery and strain.

Focus areas: cross-source correlations between activity types and recovery scores, schedule load and its relationship to physiological readiness, recovery trends in context of calendar structure.

Both data sources are connected, so cross-source relationship framing is appropriate (e.g. "how your schedule affects recovery").
${FIVE_TECHNIQUES}
${DOMAIN_FACTS}
Respond with a JSON object matching the required schema.`
}

export async function generateInsights(
  packet: EvidencePacket,
  aiClient: AICapability,
): Promise<AIOutput> {
  const hasCalendar = packet.connectedSources.includes('calendar')
  const hasHealth = packet.connectedSources.includes('health')

  let systemPrompt: string
  if (hasCalendar && hasHealth) {
    systemPrompt = buildBothSourcesPrompt()
  } else if (hasHealth) {
    systemPrompt = buildHealthOnlyPrompt()
  } else {
    systemPrompt = buildCalendarOnlyPrompt()
  }

  const userPrompt = JSON.stringify(packet, null, 2)

  return aiClient.generateObject({
    system: systemPrompt,
    prompt: userPrompt,
    schema: aiOutputSchema,
  })
}
