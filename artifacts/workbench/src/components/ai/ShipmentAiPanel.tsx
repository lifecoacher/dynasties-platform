import { motion } from "framer-motion";
import { Brain, RefreshCw, Loader2, Activity, Zap, Clock, AlertTriangle, CheckCircle2, TrendingUp, Shield } from "lucide-react";
import { useAiState, useAiReanalyze } from "@/hooks/use-ai-runtime";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";

function ScoreRing({ value, label, color }: { value: number; label: string; color: string }) {
  const pct = Math.min(100, Math.max(0, value));
  const r = 22;
  const circ = 2 * Math.PI * r;
  const offset = circ - (pct / 100) * circ;

  return (
    <div className="flex flex-col items-center gap-1">
      <div className="relative w-14 h-14">
        <svg className="w-14 h-14 -rotate-90" viewBox="0 0 52 52">
          <circle cx="26" cy="26" r={r} fill="none" stroke="currentColor" className="text-border/40" strokeWidth="4" />
          <circle cx="26" cy="26" r={r} fill="none" stroke={color} strokeWidth="4"
            strokeDasharray={circ} strokeDashoffset={offset} strokeLinecap="round"
            className="transition-all duration-700" />
        </svg>
        <span className="absolute inset-0 flex items-center justify-center text-[11px] font-bold text-foreground">
          {pct}
        </span>
      </div>
      <span className="text-[9px] font-medium text-muted-foreground uppercase tracking-wider">{label}</span>
    </div>
  );
}

function confidenceColor(c: number) {
  if (c >= 80) return "text-primary";
  if (c >= 60) return "text-[#D4A24C]";
  return "text-[#E05252]";
}

export function ShipmentAiPanel({ shipmentId }: { shipmentId: string }) {
  const { data: aiState, isLoading, error } = useAiState(shipmentId);
  const reanalyze = useAiReanalyze(shipmentId);
  const { toast } = useToast();

  const handleReanalyze = async () => {
    try {
      await reanalyze.mutateAsync();
      toast({ title: "AI reanalysis triggered" });
    } catch (e: any) {
      toast({ title: "Reanalysis failed", description: e.message, variant: "destructive" });
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8 text-muted-foreground">
        <Loader2 className="w-4 h-4 animate-spin mr-2" />
        <span className="text-xs">Loading AI state…</span>
      </div>
    );
  }

  if (error || !aiState) {
    return (
      <div className="p-4 text-center">
        <p className="text-xs text-muted-foreground">No AI analysis available yet.</p>
        <button
          onClick={handleReanalyze}
          disabled={reanalyze.isPending}
          className="mt-2 px-3 py-1.5 text-[11px] font-medium rounded-lg bg-primary/10 text-primary hover:bg-primary/20 border border-primary/20 flex items-center gap-1.5 mx-auto"
        >
          {reanalyze.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <Brain className="w-3 h-3" />}
          Run Initial Analysis
        </button>
      </div>
    );
  }

  const state = aiState;
  const scores = state.aggregatedScores || {};
  const lastRun = state.lastAnalysisAt ? format(new Date(state.lastAnalysisAt), "MMM d, HH:mm") : "Never";
  const confidence = state.overallConfidence ?? 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-4"
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center">
            <Brain className="w-3.5 h-3.5 text-primary" />
          </div>
          <div>
            <h4 className="text-[13px] font-semibold text-foreground">AI Analysis Summary</h4>
            <p className="text-[10px] text-muted-foreground flex items-center gap-1">
              <Clock className="w-2.5 h-2.5" />
              Last analyzed: {lastRun}
              {state.analysisCount > 0 && (
                <span className="ml-2 px-1.5 py-0.5 rounded bg-muted text-[9px]">
                  {state.analysisCount} runs
                </span>
              )}
            </p>
          </div>
        </div>
        <button
          onClick={handleReanalyze}
          disabled={reanalyze.isPending}
          className="px-2 py-1 text-[10px] font-medium rounded bg-primary/10 text-primary hover:bg-primary/20 disabled:opacity-50 flex items-center gap-1 border border-primary/20"
        >
          {reanalyze.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
          Reanalyze
        </button>
      </div>

      <div className={`p-3 rounded-xl border ${
        confidence >= 80 ? "bg-primary/5 border-primary/20" :
        confidence >= 60 ? "bg-[#D4A24C]/5 border-[#D4A24C]/20" :
        "bg-[#E05252]/5 border-[#E05252]/20"
      }`}>
        <div className="flex items-center justify-between mb-2">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Overall Confidence</span>
          <span className={`text-lg font-bold ${confidenceColor(confidence)}`}>{confidence}%</span>
        </div>
        <div className="w-full h-1.5 rounded-full bg-border/30 overflow-hidden">
          <motion.div
            className={`h-full rounded-full ${
              confidence >= 80 ? "bg-primary" : confidence >= 60 ? "bg-[#D4A24C]" : "bg-[#E05252]"
            }`}
            initial={{ width: 0 }}
            animate={{ width: `${confidence}%` }}
            transition={{ duration: 0.8, ease: "easeOut" }}
          />
        </div>
      </div>

      <div className="flex items-center justify-around gap-2 py-2">
        <ScoreRing
          value={scores.complianceScore ?? 0}
          label="Compliance"
          color="hsl(172, 100%, 32%)"
        />
        <ScoreRing
          value={scores.riskScore ? 100 - scores.riskScore : 0}
          label="Risk Safety"
          color={scores.riskScore > 60 ? "#E05252" : scores.riskScore > 30 ? "#D4A24C" : "hsl(172, 100%, 32%)"}
        />
        <ScoreRing
          value={scores.documentReadiness ?? 0}
          label="Doc Ready"
          color="hsl(220, 80%, 55%)"
        />
        <ScoreRing
          value={scores.financialHealth ?? 0}
          label="Financial"
          color="#9B7DFF"
        />
      </div>

      {state.currentSummary && (
        <div className="p-3 rounded-lg bg-muted/50 border border-border/30">
          <p className="text-[11px] text-foreground leading-relaxed">{state.currentSummary}</p>
        </div>
      )}

      {state.activeRecommendationCount > 0 && (
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-[#D4A24C]/5 border border-[#D4A24C]/20">
          <AlertTriangle className="w-3.5 h-3.5 text-[#D4A24C]" />
          <span className="text-[11px] text-[#D4A24C] font-medium">
            {state.activeRecommendationCount} active recommendation{state.activeRecommendationCount !== 1 ? "s" : ""} awaiting action
          </span>
        </div>
      )}
    </motion.div>
  );
}
