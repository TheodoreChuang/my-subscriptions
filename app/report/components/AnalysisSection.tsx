import type { Report } from "@/shared/types/report";
import { ActivityDeltaChart } from "./ActivityDeltaChart";

type KpiStat = {
  label: string;
  value: string | number;
  unit?: string;
  valueColor?: string;
  cardBg?: string;
  cardFg?: string;
};

const CATEGORY_COLORS: Record<string, string> = {
  Work: "#FF6535",
  Exercise: "#4ECDC4",
  Social: "#FFD166",
};
const DEFAULT_CATEGORY_COLOR = "#D4CCBC";

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
    stats.push({ label: "Avg Recovery", value: metrics.avgRecovery, unit: "%", valueColor: "#6BCB77" });
  }
  if (metrics.avgStrain != null) {
    stats.push({ label: "Avg Strain", value: metrics.avgStrain, valueColor: "#FF6535" });
  }
  if (metrics.highRecoveryDays != null) {
    stats.push({
      label: "High Recovery Days",
      value: metrics.highRecoveryDays,
      cardBg: "#EBF7EC",
      cardFg: "#2E7D32",
    });
  }
  if (metrics.lowRecoveryDays != null) {
    stats.push({
      label: "Low Recovery Days",
      value: metrics.lowRecoveryDays,
      cardBg: "#FFF4EC",
      cardFg: "#E65100",
    });
  }

  return stats;
}

export function AnalysisSection({ report }: { report: Report }) {
  const stats = buildKpiStats(report);
  const { metrics } = report;

  return (
    <section aria-labelledby="analysis-heading">
      <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1">
        Analysis
      </p>
      <h2 id="analysis-heading" className="text-2xl font-bold tracking-tight mb-6">
        Analysis Dashboard
      </h2>

      {stats.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-8">
          {stats.map(({ label, value, unit, valueColor, cardBg, cardFg }) => (
            <div
              key={label}
              className="rounded-xl p-4"
              style={{
                backgroundColor: cardBg ?? "#FFFFFF",
                boxShadow: cardBg ? undefined : "0 1px 3px rgba(0,0,0,0.06)",
              }}
            >
              <p
                className="text-xs font-medium uppercase tracking-wide mb-2"
                style={{ color: cardFg ?? "#888888" }}
              >
                {label}
              </p>
              <p
                className="text-2xl font-bold"
                style={{ color: cardFg ?? valueColor ?? "#1C1C1E" }}
              >
                {value}
                {unit && (
                  <span className="text-sm font-normal ml-0.5" style={{ color: cardFg ? `${cardFg}99` : "#888888" }}>
                    {unit}
                  </span>
                )}
              </p>
            </div>
          ))}
        </div>
      )}

      {metrics.topCategories && metrics.topCategories.length > 0 && (
        <div className="mb-8">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
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
                    className="h-full rounded-full"
                    style={{
                      width: `${percent}%`,
                      backgroundColor: CATEGORY_COLORS[category] ?? DEFAULT_CATEGORY_COLOR,
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {metrics.activityRecoveryDeltas && metrics.activityRecoveryDeltas.length > 0 && (
        <div>
          <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
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
