## Report Page

Three Sections:
1. Executive Summary
2. Analysis Dashboard
3. AI Insights

## 1. Executive Summary

Purpose:

Tell me the answer in 30 seconds.

Content:

AI-generated narrative
1-3 paragraphs
High-level observations
Cross-provider insights when available

Example:

Over the last 30 days, your highest recovery periods were associated with consistent sleep timing and lower evening commitment density. Exercise was present on many high-recovery days, while recovery declines often followed periods of elevated strain.

## 2. Analysis Dashboard

Purpose:

Show me the evidence.

Content should be deterministic and computed by the application.

Examples:

Calendar Only:
```
87 Events
42 Scheduled Hours

Top Categories
- Work
- Exercise
- Social

Busiest Day
Tuesday
```

WHOOP Only:
```
Average Recovery
68%

Average Strain
12.4

Best Recovery
81%

Worst Recovery
28%
```

Calendar + WHOOP:
```
87 Events
30 Recovery Cycles

Average Recovery
68%

Average Strain
12.4

High Recovery Days
8

Low Recovery Days
6
```

The dashboard may contain:

KPI cards
Lightweight charts
Timeline visualizations
Comparisons

The dashboard should support the findings rather than become the focus of the page.

## 3. AI Insights

Purpose:

Explain the patterns and opportunities.

This becomes the main section of the report.

Target: 3-5 insights

Each insight contains:
```
interface Insight {
  title: string
  description: string
  confidence: "high" | "medium" | "low"
}
```

Example cards:

Sleep Consistency Matters

Recovery varied significantly despite relatively stable sleep duration. Sleep timing appears to be a stronger predictor of recovery than total sleep quantity.

Confidence: High

Exercise Correlates With Higher Recovery

Exercise appeared on a majority of high-recovery days, suggesting it may contribute positively to recovery outcomes.

Confidence: Medium

Best vs Worst Day

Your highest recovery day included a scheduled Pilates session and minimal evening commitments. Your lowest recovery day followed elevated strain and multiple commitments.

Confidence: Medium

Suggested Experiment

Try maintaining the same sleep schedule for the next 7 days and compare recovery outcomes.

Confidence: Low

## Information Architecture
```
flowchart TD

    Home["Home / Integrations"]

    Home --> Report["Insight Report"]

    Report --> Executive["Executive Summary"]

    Report --> Dashboard["Analysis Dashboard"]

    Report --> Insights["AI Insights"]
```    

## Design Philosophy

The report now follows a simple progression:

Executive Summary
    ↓
Analysis Dashboard
    ↓
AI Insights

or:

Tell me
    ↓
Show me
    ↓
Explain it