import type { Report } from "@/shared/types/report";

const SOURCE_LABELS: Record<string, string> = {
  calendar: "Google Calendar",
  health: "WHOOP",
};

const SOURCE_STYLES: Record<string, { bg: string; text: string }> = {
  calendar: { bg: "#E8F0FE", text: "#1A56DB" },
  health: { bg: "#F3E8FF", text: "#7E22CE" },
};

const CATEGORY_COLORS: Record<string, string> = {
  Work: "#FF6535",
  Exercise: "#4ECDC4",
  Social: "#FFD166",
};
const DEFAULT_CATEGORY_COLOR = "#D4CCBC";

function categoryColor(category: string): string {
  return CATEGORY_COLORS[category] ?? DEFAULT_CATEGORY_COLOR;
}

export function SummarySection({ report }: { report: Report }) {
  const maxRecovery = Math.max(...report.weekHighlights.map((h) => h.recoveryPercent));

  return (
    <section aria-labelledby="summary-heading">
      <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1">
        {report.window.label}
      </p>
      <h1 id="summary-heading" className="text-3xl font-bold tracking-tight mb-3">
        Your month decoded.
      </h1>

      <p className="text-muted-foreground leading-relaxed mb-6">
        {report.executiveSummary}
      </p>

      <div className="flex flex-wrap gap-2 mb-8">
        {report.connectedSources.map((source) => {
          const style = SOURCE_STYLES[source] ?? { bg: "#EDE8DF", text: "#1C1C1E" };
          return (
            <span
              key={source}
              className="inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold"
              style={{ backgroundColor: style.bg, color: style.text }}
            >
              {SOURCE_LABELS[source] ?? source}
            </span>
          );
        })}
      </div>

      {report.metrics.topCategories && report.metrics.topCategories.length > 0 && (
        <div className="mb-8">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
            Time Allocation
          </h2>
          <div
            className="h-3 rounded-full overflow-hidden flex"
            role="img"
            aria-label="Time allocation by category"
          >
            {report.metrics.topCategories.map(({ category, percent }) => (
              <div
                key={category}
                style={{ width: `${percent}%`, backgroundColor: categoryColor(category) }}
              />
            ))}
          </div>
          <div className="flex flex-wrap gap-x-4 gap-y-1.5 mt-3">
            {report.metrics.topCategories.map(({ category, percent }) => (
              <div key={category} className="flex items-center gap-1.5 text-xs">
                <span
                  className="inline-block w-2.5 h-2.5 rounded-sm flex-shrink-0"
                  style={{ backgroundColor: categoryColor(category) }}
                />
                <span className="text-foreground">{category}</span>
                <span className="text-muted-foreground">{percent}%</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {report.weekHighlights.length > 0 && (
        <div>
          <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
            Week Highlights
          </h2>
          <div className="grid gap-3 sm:grid-cols-2">
            {report.weekHighlights.map((highlight) => {
              const isBest = highlight.recoveryPercent === maxRecovery;
              return (
                <div
                  key={highlight.label}
                  className="rounded-xl p-4"
                  style={
                    isBest
                      ? { backgroundColor: "#EBF7EC", borderLeft: "3px solid #6BCB77" }
                      : { backgroundColor: "#FFF4EC", borderLeft: "3px solid #FF9800" }
                  }
                >
                  <p className="text-xs font-semibold mb-2" style={{ color: isBest ? "#2E7D32" : "#E65100" }}>
                    {isBest ? "🏆 " : "⚡ "}
                    {highlight.label} · {highlight.dateRange}
                  </p>
                  <p
                    className="text-2xl font-bold mb-1"
                    style={{ color: isBest ? "#2E7D32" : "#E65100" }}
                  >
                    {highlight.recoveryPercent}%
                    <span className="text-sm font-normal ml-1" style={{ color: isBest ? "#4CAF50" : "#FF9800" }}>
                      recovery
                    </span>
                  </p>
                  <p className="text-xs text-muted-foreground">{highlight.summary}</p>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </section>
  );
}
