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
        <h2 id="insights-heading" className="text-2xl font-bold tracking-tight">
          AI Insights
        </h2>
        <p className="text-sm text-muted-foreground mt-1">
          {findings.length} findings. {coverageDays} days of data.
          <span className="ml-1 text-xs">({windowLabel})</span>
        </p>
      </div>

      <div className="space-y-4">
        {findings.map((finding) => (
          <InsightCard key={finding.id} finding={finding} />
        ))}
      </div>
    </section>
  );
}
