"use client";

import type { ActivityRecoveryDelta } from "@/shared/types/report";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  ReferenceLine,
  Cell,
  Tooltip,
} from "recharts";
import { ChartContainer, type ChartConfig } from "@/components/ui/chart";

const chartConfig = {
  deltaPercent: { label: "Recovery delta (%)" },
} satisfies ChartConfig;

export function ActivityDeltaChart({
  data,
  windowLabel,
}: {
  data: ActivityRecoveryDelta[];
  windowLabel: string;
}) {
  if (data.length === 0) return null;

  return (
    <div
      role="img"
      aria-label={`Activity to recovery delta — ${windowLabel}`}
    >
      <ChartContainer config={chartConfig} className="h-48 w-full">
        <BarChart data={data} layout="vertical" margin={{ left: 8, right: 24 }}>
          <XAxis type="number" tickFormatter={(v) => `${v}%`} />
          <YAxis type="category" dataKey="activity" width={70} />
          <ReferenceLine x={0} stroke="var(--border)" />
          <Tooltip formatter={(value) => [`${value}%`, "Recovery delta"]} />
          <Bar dataKey="deltaPercent" radius={[0, 3, 3, 0]}>
            {data.map((entry, index) => (
              <Cell
                key={index}
                fill={
                  entry.deltaPercent >= 0
                    ? "var(--color-chart-2)"
                    : "var(--color-destructive)"
                }
              />
            ))}
          </Bar>
        </BarChart>
      </ChartContainer>
    </div>
  );
}
