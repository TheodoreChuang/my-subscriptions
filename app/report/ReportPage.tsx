import type { Report } from "@/shared/types/report";
import { SummarySection } from "./components/SummarySection";
import { AnalysisSection } from "./components/AnalysisSection";
import { InsightsSection } from "./components/InsightsSection";
import { ConnectSecondSourceBanner } from "./components/ConnectSecondSourceBanner";

export function ReportPage({ report }: { report: Report }) {
  return (
    <main className="mx-auto max-w-3xl px-4 py-8 space-y-12">
      <SummarySection report={report} />
      <AnalysisSection report={report} />
      <InsightsSection findings={report.findings} coverageDays={report.coverageDays} windowLabel={report.window.label} />
      <ConnectSecondSourceBanner connectedSources={report.connectedSources} />
    </main>
  );
}
