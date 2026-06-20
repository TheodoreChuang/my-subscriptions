import type { Report } from "@/shared/types/report";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ActivityDeltaChart } from "./ActivityDeltaChart";

type KpiStat = {
  label: string;
  value: string | number;
  unit?: string;
};

function buildKpiStats(report: Report): KpiStat[] {
  const { metrics } = report;
  const stats: KpiStat[] = [];

  if (metrics.totalEvents != null) {
    stats.push({ label: "Total Events", value: metrics.totalEvents });
  }
  if (metrics.totalRecoveryCycles != null) {
    stats.push({ label: "Recovery Cycles", value: metrics.totalRecoveryCycles });
  }
  if (metrics.avgRecovery != null) {
    stats.push({ label: "Avg Recovery", value: metrics.avgRecovery, unit: "%" });
  }
  if (metrics.avgStrain != null) {
    stats.push({ label: "Avg Strain", value: metrics.avgStrain });
  }
  if (metrics.highRecoveryDays != null) {
    stats.push({ label: "High Recovery Days", value: metrics.highRecoveryDays });
  }
  if (metrics.lowRecoveryDays != null) {
    stats.push({ label: "Low Recovery Days", value: metrics.lowRecoveryDays });
  }

  return stats;
}

export function AnalysisSection({ report }: { report: Report }) {
  const stats = buildKpiStats(report);
  const { metrics } = report;

  return (
    <section aria-labelledby="analysis-heading">
      <h2 id="analysis-heading" className="text-2xl font-bold tracking-tight mb-6">
        Analysis Dashboard
      </h2>

      {stats.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-8">
          {stats.map(({ label, value, unit }) => (
            <Card key={label}>
              <CardHeader className="pb-1 pt-4 px-4">
                <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  {label}
                </CardTitle>
              </CardHeader>
              <CardContent className="pb-4 px-4">
                <p className="text-2xl font-bold">
                  {value}
                  {unit && (
                    <span className="text-sm font-normal text-muted-foreground ml-0.5">
                      {unit}
                    </span>
                  )}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {metrics.topCategories && metrics.topCategories.length > 0 && (
        <div className="mb-8">
          <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-3">
            Top Categories
          </h3>
          <div className="space-y-2">
            {metrics.topCategories.map(({ category, percent }) => (
              <div key={category}>
                <div className="flex justify-between text-sm mb-1">
                  <span>{category}</span>
                  <span className="text-muted-foreground">{percent}%</span>
                </div>
                <div className="h-2 bg-muted rounded-full overflow-hidden">
                  <div
                    className="h-full bg-chart-2 rounded-full"
                    style={{ width: `${percent}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {metrics.activityRecoveryDeltas && metrics.activityRecoveryDeltas.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-3">
            Activity → Recovery Delta
          </h3>
          <ActivityDeltaChart
            data={metrics.activityRecoveryDeltas}
            windowLabel={report.window.label}
          />
        </div>
      )}
    </section>
  );
}
