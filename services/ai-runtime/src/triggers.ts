import { publishAiRuntimeJob } from "@workspace/queue";
import type { AiTriggerType } from "@workspace/db/schema";

export function triggerAiReanalysis(
  companyId: string,
  shipmentId: string,
  triggerType: AiTriggerType,
  triggerSourceEntityId?: string,
  triggerSourceEntityType?: string,
): void {
  publishAiRuntimeJob({
    companyId,
    shipmentId,
    triggerType,
    triggerSourceEntityId,
    triggerSourceEntityType,
  });
}
