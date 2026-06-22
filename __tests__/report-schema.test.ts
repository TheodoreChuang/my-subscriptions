import { describe, it, expect } from "vitest";
import { reportSchema, findingSchema, activityRecoveryDeltaSchema, aiOutputSchema } from "@/shared/schemas/report";
import { FIXTURE } from "@/frontend/report/fixture";

describe("aiOutputSchema", () => {
  const validFinding = {
    id: "f1",
    type: "finding",
    title: "Test finding",
    description: "A description",
    alternativeExplanation: "An alternative",
    confidence: "medium" as const,
  }

  it("accepts minimal valid output", () => {
    expect(() => aiOutputSchema.parse({
      executiveSummary: "A valid summary.",
      weekHighlightSummaries: [],
      findings: [],
    })).not.toThrow()
  })

  it("accepts output with 1–5 valid findings", () => {
    expect(() => aiOutputSchema.parse({
      executiveSummary: "Summary here.",
      weekHighlightSummaries: ["Best week", "Worst week"],
      findings: [validFinding],
    })).not.toThrow()
  })

  it("rejects when executiveSummary is empty string", () => {
    expect(() => aiOutputSchema.parse({
      executiveSummary: "",
      weekHighlightSummaries: [],
      findings: [],
    })).toThrow()
  })

  it("rejects when executiveSummary exceeds 1200 chars", () => {
    expect(() => aiOutputSchema.parse({
      executiveSummary: "a".repeat(1201),
      weekHighlightSummaries: [],
      findings: [],
    })).toThrow()
  })

  it("rejects when findings has more than 5 entries", () => {
    const manyFindings = Array.from({ length: 6 }, (_, i) => ({ ...validFinding, id: `f${i}` }))
    expect(() => aiOutputSchema.parse({
      executiveSummary: "Summary.",
      weekHighlightSummaries: [],
      findings: manyFindings,
    })).toThrow()
  })

  it("rejects a finding with invalid confidence value", () => {
    expect(() => aiOutputSchema.parse({
      executiveSummary: "Summary.",
      weekHighlightSummaries: [],
      findings: [{ ...validFinding, confidence: "maybe" }],
    })).toThrow()
  })
})

describe("activityRecoveryDeltaSchema", () => {
  const validDelta = { activity: "Exercise", deltaPercent: 9.2, n: 14, confidence: "strong" };

  it("accepts a valid delta with all four fields", () => {
    expect(() => activityRecoveryDeltaSchema.parse(validDelta)).not.toThrow();
  });

  it("rejects a delta missing n", () => {
    const { n: _, ...without } = validDelta;
    expect(() => activityRecoveryDeltaSchema.parse(without)).toThrow();
  });

  it("rejects a delta missing confidence", () => {
    const { confidence: _, ...without } = validDelta;
    expect(() => activityRecoveryDeltaSchema.parse(without)).toThrow();
  });

  it("rejects a delta with confidence outside the allowed enum values", () => {
    expect(() => activityRecoveryDeltaSchema.parse({ ...validDelta, confidence: "maybe" })).toThrow();
  });
});

describe("reportSchema", () => {
  it("parses the full fixture without throwing", () => {
    expect(() => reportSchema.parse(FIXTURE)).not.toThrow();
  });

  it("fixture has daySummaries.length === coverageDays (26, not 30)", () => {
    expect(FIXTURE.daySummaries.length).toBe(FIXTURE.coverageDays);
    expect(FIXTURE.daySummaries.length).toBe(26);
  });

  it("parses each finding type", () => {
    for (const finding of FIXTURE.findings) {
      expect(() => findingSchema.parse(finding)).not.toThrow();
    }
  });

  it("rejects a finding with alternativeExplanation omitted", () => {
    const invalid = {
      id: "x",
      type: "finding",
      title: "T",
      description: "D",
      // alternativeExplanation intentionally omitted
      confidence: "high",
    };
    expect(() => findingSchema.parse(invalid)).toThrow();
  });

  it("rejects a finding.suggestion with expectedSignal omitted", () => {
    const invalid = {
      id: "x",
      type: "suggestion",
      title: "T",
      description: "D",
      alternativeExplanation: "A",
      confidence: "medium",
      suggestion: {
        recommendation: "Do this",
        // expectedSignal intentionally omitted
        killCondition: "Stop when",
      },
    };
    expect(() => findingSchema.parse(invalid)).toThrow();
  });
});
