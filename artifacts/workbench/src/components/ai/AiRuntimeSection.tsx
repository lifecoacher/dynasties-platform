import { ShipmentAiPanel } from "./ShipmentAiPanel";
import { AnalysisHistoryPanel } from "./AnalysisHistoryPanel";

export function AiRuntimeSection({ shipmentId }: { shipmentId: string }) {
  return (
    <div className="space-y-6">
      <ShipmentAiPanel shipmentId={shipmentId} />
      <div className="border-t border-border/30 pt-4">
        <AnalysisHistoryPanel shipmentId={shipmentId} />
      </div>
    </div>
  );
}
