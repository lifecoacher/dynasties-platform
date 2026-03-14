import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { AlertCircle } from "lucide-react";

export function ConfidenceIndicator({ confidence, fieldName }: { confidence?: number | null, fieldName: string }) {
  if (confidence === undefined || confidence === null || confidence >= 0.8) return null;

  const percent = Math.round(confidence * 100);
  
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className="inline-flex items-center justify-center w-4 h-4 ml-2 rounded-full bg-warning/20 text-warning cursor-help">
          <AlertCircle className="w-3 h-3" />
        </span>
      </TooltipTrigger>
      <TooltipContent className="bg-popover border-border text-foreground">
        <p className="text-sm">Low confidence extraction for <strong>{fieldName}</strong>: {percent}%</p>
      </TooltipContent>
    </Tooltip>
  );
}
