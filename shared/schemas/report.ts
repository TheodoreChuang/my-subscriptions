import { z } from "zod";

export const connectedSourceSchema = z.enum(["calendar", "health"]);

export const findingTypeSchema = z.enum(["finding", "surprise", "experiment"]);

export const findingSchema = z.object({
  id: z.string(),
  type: findingTypeSchema,
  title: z.string(),
  description: z.string(),
  alternativeExplanation: z.string(),
  confidence: z.enum(["high", "medium", "low"]),
  n: z.number().optional(),
  whatWouldChangeMind: z.string().optional(),
  experiment: z
    .object({
      instruction: z.string(),
      expectedSignal: z.string(),
      killCondition: z.string(),
    })
    .optional(),
});

export const weekHighlightSchema = z.object({
  label: z.string(),
  dateRange: z.string(),
  recoveryPercent: z.number(),
  summary: z.string(),
});

export const categoryAllocationSchema = z.object({
  category: z.string(),
  hours: z.number(),
  percent: z.number(),
});

export const activityRecoveryDeltaSchema = z.object({
  activity: z.string(),
  deltaPercent: z.number(),
});

export const analysisMetricsSchema = z.object({
  totalEvents: z.number().optional(),
  totalScheduledHours: z.number().optional(),
  topCategories: z.array(categoryAllocationSchema).optional(),
  busiestDay: z.string().optional(),

  avgRecovery: z.number().optional(),
  avgStrain: z.number().optional(),
  totalRecoveryCycles: z.number().optional(),
  highRecoveryDays: z.number().optional(),
  lowRecoveryDays: z.number().optional(),

  activityRecoveryDeltas: z.array(activityRecoveryDeltaSchema).optional(),
});

export const daySummarySchema = z.object({
  date: z.string(),
  activities: z.record(z.string(), z.number()),
  recovery: z.number().optional(),
  sleepHours: z.number().optional(),
  strain: z.number().optional(),
});

export const reportWindowSchema = z.object({
  start: z.string(),
  end: z.string(),
  days: z.number(),
  label: z.string(),
});

export const reportSchema = z.object({
  window: reportWindowSchema,
  coverageDays: z.number(),
  connectedSources: z.array(connectedSourceSchema),
  executiveSummary: z.string(),
  weekHighlights: z.array(weekHighlightSchema),
  daySummaries: z.array(daySummarySchema),
  metrics: analysisMetricsSchema,
  findings: z.array(findingSchema),
  generatedAt: z.string(),
});
