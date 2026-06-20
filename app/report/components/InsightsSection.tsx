import type { Finding } from "@/shared/types/report";
import { InsightCard } from "./InsightCard";

export function InsightsSection({
  findings,
  coverageDays,
  windowLabel,
}: {
  findings: Finding[];
  coverageDays: number;
  windowLabel: string;
}) {
  return (
    <section aria-labelledby="insights-heading">
      <div className="mb-6">
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1">
          AI Insights · {windowLabel}
        </p>
        <div className="flex items-baseline justify-between">
          <h2 id="insights-heading" className="text-2xl font-bold tracking-tight">
            {findings.length} findings.
          </h2>
          <span className="text-sm text-muted-foreground">{coverageDays} days of data</span>
        </div>
      </div>

      <div className="space-y-4">
        {findings.map((finding) => (
          <InsightCard key={finding.id} finding={finding} />
        ))}
      </div>
    </section>
  );
}
