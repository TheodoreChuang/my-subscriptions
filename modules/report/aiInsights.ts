import type { AICapability } from '@/shared/capabilities/ai'
import type { EvidencePacket } from './evidencePacket'
import { aiOutputSchema } from '@/shared/schemas/report'
import type { z } from 'zod'

type AIOutput = z.infer<typeof aiOutputSchema>

/**
 * 1. CORE REASONING GUARDRAILS
 */
const FIVE_TECHNIQUES = `
You apply five reasoning disciplines to every analysis:

1. COMPETING HYPOTHESES — For each finding, include at least one alternative explanation where relevant.
2. SKEPTICAL SELF-CRITIQUE — Treat small samples and weak signals as uncertain; downgrade confidence when appropriate.
3. FALSIFIABLE RECOMMENDATIONS — If suggesting actions, frame them as experiments with observable stop conditions.
4. LICENSE TO FIND NOTHING — It is valid to return few or no findings if signals are weak.
5. CALIBRATED CONFIDENCE — Use only "high", "medium", or "low". Reserve "high" for strong evidence.
`

/**
 * 2. DOMAIN SEMANTICS (WHOOP + calendar interpretation rules)
 */
const DOMAIN_FACTS = `
DOMAIN FACTS:

- Recovery (0–100%) is a NEXT-DAY readiness score derived from sleep, HRV, and resting heart rate.
- Recovery is measured BEFORE daily activity. Do NOT imply causality from activity → recovery.
- Any exercise–recovery relationship is inherently confounded or bidirectional.

- Strain (0–21) is daily cardiovascular load.
- High strain and low next-day recovery are expected correlations, not causal effects.

STRICT LANGUAGE RULE:
- Never use causal language (causes, leads to, results in).
- Use only: associated with, coincides with, tends to occur with.
`

/**
 * 3. OUTPUT CONSTRAINTS (hard requirements)
 */
const OUTPUT_CONSTRAINTS = `
CRITICAL OUTPUT CONSTRAINTS:

- executiveSummary MUST be ≤ 1000 characters
- weekHighlightSummaries: each item MUST be ≤ 300 characters
- findings: maximum 5 items
- each finding MUST be concise (≤ 300 characters)

Before responding:
- Estimate executiveSummary length
- Compress if necessary BEFORE final output
`

/**
 * 4. ANALYSIS GUIDELINES
 */
const ANALYSIS_GUIDELINES = `
ANALYSIS GUIDELINES:

- Focus only on the strongest signals in the data (typically 2–4 max)
- Do NOT force diversity or artificial variety in findings
- Each finding must add new information (no repetition across findings or summary)
- Prefer signal clarity over completeness
- Always consider selection bias and missing data
- Weak or ambiguous patterns should be excluded or clearly marked as uncertain
- If no strong patterns exist, return fewer findings (or none)
`

/**
 * CALENDAR-ONLY PROMPT
 */
function buildCalendarOnlyPrompt(): string {
  return `
You are an insight analyst reviewing a user's Calendar data.

SCOPE:
Analyze only the past 30 days of calendar data.
Focus only on time allocation patterns.

FOCUS AREAS:
- recurring commitments
- workload concentration vs fragmentation
- routine consistency
- weekday vs weekend differences
- unusually dense or sparse periods

${OUTPUT_CONSTRAINTS}
${FIVE_TECHNIQUES}

${ANALYSIS_GUIDELINES}

Respond with a JSON object matching the required schema.
`
}

/**
 * HEALTH-ONLY PROMPT
 */
function buildHealthOnlyPrompt(): string {
  return `
You are an insight analyst reviewing physiological tracking data.

SCOPE:
Analyze only WHOOP-style data from the past 30 days.

FOCUS AREAS:
- recovery volatility
- recovery consistency
- sleep consistency
- strain vs recovery relationships
- unusually high or low recovery days

${OUTPUT_CONSTRAINTS}
${FIVE_TECHNIQUES}
${DOMAIN_FACTS}

${ANALYSIS_GUIDELINES}

Respond with a JSON object matching the required schema.
`
}

/**
 * CROSS-SOURCE PROMPT
 */
function buildBothSourcesPrompt(): string {
  return `
You are an insight analyst reviewing integrated calendar and physiological data.

SCOPE:
Analyze relationships between schedule patterns and physiological response.

FOCUS AREAS:
- associations between workload and recovery
- strain vs calendar density relationships
- recovery changes across different schedule structures
- cross-source correlations and anomalies

IMPORTANT:
Focus on associations only. Do NOT imply causation.

${OUTPUT_CONSTRAINTS}
${FIVE_TECHNIQUES}
${DOMAIN_FACTS}

${ANALYSIS_GUIDELINES}

Respond with a JSON object matching the required schema.
`
}

/**
 * MAIN ENTRY
 */
export async function generateInsights(
  packet: EvidencePacket,
  aiClient: AICapability,
): Promise<AIOutput> {
  if (packet.connectedSources.length === 0) {
    throw new Error('generateInsights called with no connected sources')
  }

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
