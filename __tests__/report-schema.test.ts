import { describe, it, expect } from "vitest";
import { reportSchema, findingSchema } from "@/shared/schemas/report";
import { FIXTURE } from "@/frontend/report/fixture";

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

  it("rejects a finding.experiment with expectedSignal omitted", () => {
    const invalid = {
      id: "x",
      type: "experiment",
      title: "T",
      description: "D",
      alternativeExplanation: "A",
      confidence: "medium",
      experiment: {
        instruction: "Do this",
        // expectedSignal intentionally omitted
        killCondition: "Stop when",
      },
    };
    expect(() => findingSchema.parse(invalid)).toThrow();
  });
});
