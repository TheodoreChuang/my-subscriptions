import type { Finding } from "@/shared/types/report";
import { Card, CardContent } from "@/components/ui/card";

const TYPE_BADGE: Record<Finding["type"], { bg: string; text: string; label: string }> = {
  finding: { bg: "#E8F0FE", text: "#1A56DB", label: "Finding" },
  surprise: { bg: "#FFF3E0", text: "#E65100", label: "Surprise" },
  experiment: { bg: "rgba(255,101,53,0.2)", text: "#FF6535", label: "Try this" },
};

const CONFIDENCE_COLOR: Record<Finding["confidence"], string> = {
  high: "#6BCB77",
  medium: "#FF9800",
  low: "#888888",
};

const CONFIDENCE_FILLED: Record<Finding["confidence"], number> = {
  high: 3,
  medium: 2,
  low: 1,
};

function ConfidenceDots({ confidence, darkMode = false }: { confidence: Finding["confidence"]; darkMode?: boolean }) {
  const filled = CONFIDENCE_FILLED[confidence];
  const emptyColor = darkMode ? "#3C3C3E" : "#E0DAD0";
  return (
    <span
      aria-label={`Confidence: ${confidence}`}
      className="flex items-center gap-0.5 flex-shrink-0"
    >
      {[...Array(3)].map((_, i) => (
        <span
          key={i}
          className="inline-block w-2 h-2 rounded-sm"
          style={{ backgroundColor: i < filled ? CONFIDENCE_COLOR[confidence] : emptyColor }}
        />
      ))}
    </span>
  );
}

function AlternativeBlock({
  text,
  darkMode = false,
}: {
  text: string;
  darkMode?: boolean;
}) {
  if (darkMode) {
    return (
      <div className="rounded-md px-3 py-2" style={{ backgroundColor: "#2C2C2E" }}>
        <p className="text-xs font-semibold mb-1" style={{ color: "#888888" }}>
          ALTERNATIVE
        </p>
        <p className="text-xs" style={{ color: "#888888" }}>
          {text}
        </p>
      </div>
    );
  }
  return (
    <div className="rounded-md px-3 py-2" style={{ backgroundColor: "#F5F0E8" }}>
      <p className="text-xs font-semibold mb-1" style={{ color: "#888888" }}>
        ALTERNATIVE
      </p>
      <p className="text-xs" style={{ color: "#888888" }}>
        {text}
      </p>
    </div>
  );
}

export function InsightCard({ finding }: { finding: Finding }) {
  const badge = TYPE_BADGE[finding.type];

  if (finding.type === "experiment") {
    return (
      <div className="rounded-xl p-5 space-y-3" style={{ backgroundColor: "#1C1C1E" }}>
        <div className="flex items-start justify-between gap-3">
          <span
            className="inline-block text-xs font-semibold px-2.5 py-1 rounded-full"
            style={{ backgroundColor: badge.bg, color: badge.text }}
          >
            {badge.label}
          </span>
          <ConfidenceDots confidence={finding.confidence} darkMode />
        </div>

        <h3 className="text-base font-semibold" style={{ color: "#F4EFE6" }}>
          {finding.title}
        </h3>

        <p className="text-sm" style={{ color: "#AAAAAA" }}>
          {finding.description}
        </p>

        {finding.alternativeExplanation && (
          <AlternativeBlock text={finding.alternativeExplanation} darkMode />
        )}

        {finding.experiment && (
          <div className="space-y-2 pt-1">
            <div>
              <p className="text-xs font-medium mb-0.5" style={{ color: "#888888" }}>Do</p>
              <p className="text-xs" style={{ color: "#CCCCCC" }}>{finding.experiment.instruction}</p>
            </div>
            <div>
              <p className="text-xs font-medium mb-0.5" style={{ color: "#888888" }}>Success looks like</p>
              <p className="text-xs" style={{ color: "#CCCCCC" }}>{finding.experiment.expectedSignal}</p>
            </div>
            <div>
              <p className="text-xs font-medium mb-0.5" style={{ color: "#888888" }}>Stop when</p>
              <p className="text-xs" style={{ color: "#CCCCCC" }}>{finding.experiment.killCondition}</p>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <Card>
      <CardContent className="pt-5 space-y-3">
        <div className="flex items-start gap-3">
          <div className="flex-1 space-y-1.5">
            <span
              className="inline-block text-xs font-semibold px-2.5 py-1 rounded-full"
              style={{ backgroundColor: badge.bg, color: badge.text }}
            >
              {badge.label}
            </span>
            <h3 className="text-base font-semibold leading-snug">{finding.title}</h3>
          </div>
          <ConfidenceDots confidence={finding.confidence} />
        </div>

        <p className="text-sm text-foreground">{finding.description}</p>

        {finding.alternativeExplanation && (
          <AlternativeBlock text={finding.alternativeExplanation} />
        )}

        {finding.type === "finding" && finding.whatWouldChangeMind && (
          <div className="text-xs text-muted-foreground border-t pt-2">
            <span className="font-medium">What would change my mind: </span>
            {finding.whatWouldChangeMind}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
