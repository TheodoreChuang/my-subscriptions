import type { Report } from "@/shared/types/report";

export const FIXTURE: Report = {
  window: {
    start: "2026-05-22",
    end: "2026-06-20",
    days: 30,
    label: "May 22 – Jun 20",
  },
  coverageDays: 26,
  connectedSources: ["calendar", "health"],
  executiveSummary:
    "Over the last 30 days, your highest recovery periods were associated with consistent sleep timing and lower evening commitment density. Exercise was present on a majority of high-recovery days, while recovery declines often followed periods of elevated strain and multiple back-to-back commitments. Your work blocks are heavily concentrated on Tuesday and Wednesday, which correlates with the lowest average recovery scores of the week.",
  weekHighlights: [
    {
      label: "Best week",
      dateRange: "Jun 2–8",
      recoveryPercent: 81,
      summary:
        "Consistent sleep schedule, two exercise sessions, and minimal evening commitments.",
    },
    {
      label: "Worst week",
      dateRange: "May 26–Jun 1",
      recoveryPercent: 54,
      summary:
        "Elevated strain from back-to-back commitments and irregular sleep timing.",
    },
  ],
  daySummaries: [
    { date: "2026-05-22", activities: { work: 6, exercise: 1, rest: 2 }, recovery: 72, sleepHours: 7.5, strain: 11.2 },
    { date: "2026-05-23", activities: { work: 4, social: 2, rest: 3 }, recovery: 68, sleepHours: 7.0, strain: 9.8 },
    { date: "2026-05-24", activities: { work: 2, exercise: 1.5, family: 2 }, recovery: 75, sleepHours: 8.0, strain: 12.1 },
    { date: "2026-05-25", activities: { rest: 4, social: 3, personal: 2 }, recovery: 79, sleepHours: 8.5, strain: 8.4 },
    { date: "2026-05-26", activities: { work: 7, learning: 1 }, recovery: 61, sleepHours: 6.5, strain: 13.5 },
    { date: "2026-05-27", activities: { work: 8, social: 1 }, recovery: 55, sleepHours: 6.0, strain: 14.2 },
    { date: "2026-05-28", activities: { work: 6, exercise: 1 }, recovery: 58, sleepHours: 6.5, strain: 13.8 },
    { date: "2026-05-29", activities: { work: 5, family: 2, rest: 1 }, recovery: 62, sleepHours: 7.0, strain: 11.9 },
    { date: "2026-05-30", activities: { exercise: 2, social: 3, rest: 2 }, recovery: 70, sleepHours: 7.5, strain: 10.2 },
    { date: "2026-05-31", activities: { rest: 5, personal: 2 }, recovery: 74, sleepHours: 8.0, strain: 7.6 },
    { date: "2026-06-01", activities: { work: 5, social: 2 }, recovery: 54, sleepHours: 6.0, strain: 14.8 },
    { date: "2026-06-02", activities: { work: 6, exercise: 1 }, recovery: 78, sleepHours: 7.8, strain: 11.4 },
    { date: "2026-06-03", activities: { work: 5, learning: 2 }, recovery: 80, sleepHours: 8.0, strain: 10.8 },
    { date: "2026-06-04", activities: { work: 4, exercise: 1.5, family: 1 }, recovery: 81, sleepHours: 8.2, strain: 12.0 },
    { date: "2026-06-05", activities: { work: 6, rest: 2 }, recovery: 76, sleepHours: 7.5, strain: 11.1 },
    { date: "2026-06-06", activities: { social: 3, exercise: 1, rest: 2 }, recovery: 82, sleepHours: 8.3, strain: 9.5 },
    { date: "2026-06-07", activities: { rest: 4, family: 2, personal: 1 }, recovery: 84, sleepHours: 8.5, strain: 7.2 },
    { date: "2026-06-08", activities: { rest: 3, social: 2, exercise: 1 }, recovery: 79, sleepHours: 8.0, strain: 9.8 },
    { date: "2026-06-09", activities: { work: 7, learning: 1 }, recovery: 65, sleepHours: 6.8, strain: 13.1 },
    { date: "2026-06-10", activities: { work: 7, social: 1 }, recovery: 60, sleepHours: 6.5, strain: 13.9 },
    { date: "2026-06-11", activities: { work: 5, exercise: 1.5 }, recovery: 72, sleepHours: 7.5, strain: 12.3 },
    { date: "2026-06-12", activities: { work: 4, family: 2, rest: 1 }, recovery: 69, sleepHours: 7.2, strain: 10.5 },
    { date: "2026-06-13", activities: { social: 3, rest: 3 }, recovery: 73, sleepHours: 7.8, strain: 8.9 },
    { date: "2026-06-14", activities: { rest: 4, personal: 2 }, recovery: 77, sleepHours: 8.2, strain: 7.8 },
    { date: "2026-06-15", activities: { work: 6, exercise: 1 }, recovery: 68, sleepHours: 7.0, strain: 12.6 },
    { date: "2026-06-16", activities: { work: 6, learning: 1, social: 1 }, recovery: 66, sleepHours: 6.9, strain: 12.8 },
  ],
  metrics: {
    totalEvents: 87,
    totalScheduledHours: 42,
    topCategories: [
      { category: "Work", hours: 83, percent: 48 },
      { category: "Exercise", hours: 38, percent: 22 },
      { category: "Social", hours: 21, percent: 12 },
      { category: "Family", hours: 12, percent: 7 },
      { category: "Rest", hours: 10, percent: 6 },
      { category: "Learning", hours: 9, percent: 5 },
    ],
    busiestDay: "2026-06-10",
    avgRecovery: 68,
    avgStrain: 12.4,
    totalRecoveryCycles: 30,
    highRecoveryDays: 8,
    lowRecoveryDays: 6,
    activityRecoveryDeltas: [
      { activity: "Exercise", deltaPercent: 9.2 },
      { activity: "Rest", deltaPercent: 7.4 },
      { activity: "Family", deltaPercent: 3.1 },
      { activity: "Social", deltaPercent: 1.8 },
      { activity: "Learning", deltaPercent: -0.5 },
      { activity: "Work", deltaPercent: -8.3 },
    ],
  },
  findings: [
    {
      id: "finding-1",
      type: "finding",
      title: "Sleep Consistency Predicts Recovery Better Than Duration",
      description:
        "Recovery varied significantly despite relatively stable sleep duration. Sleep timing — going to bed within a 30-minute window — was present on 7 of your 8 high-recovery days and absent on 5 of 6 low-recovery days.",
      alternativeExplanation:
        "Sleep timing and recovery may both be downstream of overall stress levels. On calmer days you may naturally go to bed on time and recover better, making timing a marker rather than a driver.",
      confidence: "high",
      n: 26,
      whatWouldChangeMind:
        "If you maintained consistent sleep timing during a high-stress week and still recovered well, it would suggest timing is independently protective.",
    },
    {
      id: "finding-2",
      type: "surprise",
      title: "Social Events Don't Drain Recovery",
      description:
        "Social calendar events showed a small positive association with next-day recovery (+1.8%), which contradicts the common assumption that social obligations are draining. This may reflect that your social events tend to be enjoyable rather than obligatory.",
      alternativeExplanation:
        "The sample is small (n=26) and the effect size is within noise. Social events may correlate with weekends, when work stress is already lower — making the work reduction the true driver.",
      confidence: "medium",
      n: 26,
    },
    {
      id: "finding-3",
      type: "experiment",
      title: "Protect Tuesday–Wednesday Evenings",
      description:
        "Your two lowest average recovery scores occur after Tuesday and Wednesday, your heaviest work days. Scheduling evening commitments on those nights compounds the strain. Clearing them for one week would test whether the recovery dip is work-load driven or evening-load driven.",
      alternativeExplanation:
        "The pattern may reflect cumulative weekly fatigue peaking mid-week rather than anything specific to Tuesday–Wednesday evenings. Clearing evenings mid-week might show no improvement if the real driver is accumulated strain.",
      confidence: "medium",
      n: 26,
      experiment: {
        instruction:
          "For the next 7 days, decline or reschedule any non-essential evening commitments on Tuesday and Wednesday.",
        expectedSignal:
          "Thursday recovery scores improve by 5+ percentage points compared to your current average.",
        killCondition:
          "Stop if three consecutive weeks show no improvement in Thursday recovery despite cleared evenings.",
      },
    },
  ],
  generatedAt: "2026-06-21T00:00:00.000Z",
};
