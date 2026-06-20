import type { z } from "zod";
import type {
  reportSchema,
  findingSchema,
  weekHighlightSchema,
  categoryAllocationSchema,
  activityRecoveryDeltaSchema,
  analysisMetricsSchema,
  daySummarySchema,
  reportWindowSchema,
  connectedSourceSchema,
  findingTypeSchema,
} from "@/shared/schemas/report";

export type ConnectedSource = z.infer<typeof connectedSourceSchema>;
export type FindingType = z.infer<typeof findingTypeSchema>;
export type Finding = z.infer<typeof findingSchema>;
export type WeekHighlight = z.infer<typeof weekHighlightSchema>;
export type CategoryAllocation = z.infer<typeof categoryAllocationSchema>;
export type ActivityRecoveryDelta = z.infer<typeof activityRecoveryDeltaSchema>;
export type AnalysisMetrics = z.infer<typeof analysisMetricsSchema>;
export type DaySummary = z.infer<typeof daySummarySchema>;
export type ReportWindow = z.infer<typeof reportWindowSchema>;
export type Report = z.infer<typeof reportSchema>;
