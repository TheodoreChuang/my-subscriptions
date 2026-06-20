import type { Finding } from "@/shared/types/report";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

const CONFIDENCE_CLASSES: Record<Finding["confidence"], string> = {
  high: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200",
  medium: "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200",
  low: "bg-muted text-muted-foreground",
};

export function InsightCard({ finding }: { finding: Finding }) {
  const confidenceLabel =
    finding.confidence.charAt(0).toUpperCase() + finding.confidence.slice(1);
  const badgeLabel = finding.n != null
    ? `${confidenceLabel} · n=${finding.n}`
    : confidenceLabel;

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-3">
          <CardTitle className="text-base font-semibold leading-snug">
            {finding.title}
          </CardTitle>
          <Badge className={CONFIDENCE_CLASSES[finding.confidence]}>
            {badgeLabel}
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="space-y-3">
        <p className="text-sm text-foreground">{finding.description}</p>

        <div className="rounded-md border border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-950 px-3 py-2">
          <p className="text-xs font-semibold text-amber-700 dark:text-amber-300 mb-1">
            ⚠ ALTERNATIVE
          </p>
          <p className="text-xs text-amber-700 dark:text-amber-300">
            {finding.alternativeExplanation}
          </p>
        </div>

        {finding.type === "finding" && finding.whatWouldChangeMind && (
          <div className="text-xs text-muted-foreground border-t pt-2">
            <span className="font-medium">What would change my mind: </span>
            {finding.whatWouldChangeMind}
          </div>
        )}

        {finding.type === "experiment" && finding.experiment && (
          <div className="rounded-md bg-muted px-3 py-2 space-y-2">
            <p className="text-xs font-semibold text-foreground">Experiment</p>
            <div>
              <p className="text-xs font-medium text-muted-foreground">Do</p>
              <p className="text-xs">{finding.experiment.instruction}</p>
            </div>
            <div>
              <p className="text-xs font-medium text-muted-foreground">Success looks like</p>
              <p className="text-xs">{finding.experiment.expectedSignal}</p>
            </div>
            <div>
              <p className="text-xs font-medium text-muted-foreground">Stop when</p>
              <p className="text-xs">{finding.experiment.killCondition}</p>
            </div>
            <button
              disabled
              aria-label="Available after Calendar is connected."
              className="mt-1 w-full rounded-md border border-border bg-background px-3 py-1.5 text-xs font-medium text-muted-foreground opacity-50 cursor-not-allowed"
            >
              Add to calendar
            </button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
