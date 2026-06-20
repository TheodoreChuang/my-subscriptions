import type { Report } from "@/shared/types/report";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const SOURCE_LABELS: Record<string, string> = {
  calendar: "Google Calendar",
  health: "WHOOP",
};

export function SummarySection({ report }: { report: Report }) {
  return (
    <section aria-labelledby="summary-heading">
      <h1 id="summary-heading" className="text-3xl font-bold tracking-tight mb-3">
        Your month decoded.
      </h1>

      <p className="text-muted-foreground leading-relaxed mb-6">
        {report.executiveSummary}
      </p>

      <div className="flex flex-wrap gap-2 mb-8">
        {report.connectedSources.map((source) => (
          <Badge key={source} variant="secondary">
            {SOURCE_LABELS[source] ?? source}
          </Badge>
        ))}
      </div>

      {report.metrics.topCategories && report.metrics.topCategories.length > 0 && (
        <div className="mb-8">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-3">
            Time Allocation
          </h2>
          <div className="space-y-2">
            {report.metrics.topCategories.map(({ category, percent }) => (
              <div key={category}>
                <div className="flex justify-between text-sm mb-1">
                  <span>{category}</span>
                  <span className="text-muted-foreground">{percent}%</span>
                </div>
                <div className="h-2 bg-muted rounded-full overflow-hidden">
                  <div
                    className="h-full bg-primary rounded-full"
                    style={{ width: `${percent}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {report.weekHighlights.length > 0 && (
        <div>
          <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-3">
            Week Highlights
          </h2>
          <div className="grid gap-3 sm:grid-cols-2">
            {report.weekHighlights.map((highlight) => (
              <Card key={highlight.label}>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium">
                    {highlight.label}
                    <span className="ml-2 text-muted-foreground font-normal">
                      {highlight.dateRange}
                    </span>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-2xl font-bold mb-1">
                    {highlight.recoveryPercent}%
                    <span className="text-sm font-normal text-muted-foreground ml-1">
                      recovery
                    </span>
                  </p>
                  <p className="text-sm text-muted-foreground">{highlight.summary}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
