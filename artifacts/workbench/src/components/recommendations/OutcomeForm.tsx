import { useState } from "react";
import { motion } from "framer-motion";
import { ClipboardCheck, X } from "lucide-react";

interface Props {
  recommendationId: string;
  onSubmit: (id: string, data: OutcomeData) => void;
  onCancel: () => void;
}

export interface OutcomeData {
  actualDelayDays?: number;
  actualClaimOccurred?: "YES" | "NO" | "PENDING";
  actualCostDelta?: number;
  actualMarginDelta?: number;
  postDecisionNotes?: string;
  outcomeEvaluation?: "POSITIVE" | "NEUTRAL" | "NEGATIVE";
}

export function OutcomeForm({ recommendationId, onSubmit, onCancel }: Props) {
  const [form, setForm] = useState<OutcomeData>({});

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const cleaned: OutcomeData = {};
    if (form.actualDelayDays != null && !isNaN(form.actualDelayDays)) cleaned.actualDelayDays = form.actualDelayDays;
    if (form.actualClaimOccurred) cleaned.actualClaimOccurred = form.actualClaimOccurred;
    if (form.actualCostDelta != null && !isNaN(form.actualCostDelta)) cleaned.actualCostDelta = form.actualCostDelta;
    if (form.actualMarginDelta != null && !isNaN(form.actualMarginDelta)) cleaned.actualMarginDelta = form.actualMarginDelta;
    if (form.postDecisionNotes?.trim()) cleaned.postDecisionNotes = form.postDecisionNotes.trim();
    if (form.outcomeEvaluation) cleaned.outcomeEvaluation = form.outcomeEvaluation;
    onSubmit(recommendationId, cleaned);
  };

  const hasAnyField =
    form.outcomeEvaluation ||
    form.postDecisionNotes?.trim() ||
    form.actualDelayDays != null ||
    form.actualClaimOccurred ||
    form.actualCostDelta != null ||
    form.actualMarginDelta != null;

  return (
    <motion.form
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      onSubmit={handleSubmit}
      className="rounded-lg border border-border bg-card p-4 space-y-3"
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-primary">
          <ClipboardCheck size={16} />
          <h4 className="text-[13px] font-semibold text-foreground">Record Outcome</h4>
        </div>
        <button type="button" onClick={onCancel} className="text-muted-foreground hover:text-foreground">
          <X size={14} />
        </button>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider block mb-1">
            Actual Delay (days)
          </label>
          <input
            type="number"
            step="0.5"
            className="w-full px-2.5 py-1.5 rounded bg-background border border-border text-[12px] text-foreground outline-none focus:border-primary/40"
            value={form.actualDelayDays ?? ""}
            onChange={(e) => setForm({ ...form, actualDelayDays: e.target.value ? Number(e.target.value) : undefined })}
          />
        </div>
        <div>
          <label className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider block mb-1">
            Claim Occurred
          </label>
          <select
            className="w-full px-2.5 py-1.5 rounded bg-background border border-border text-[12px] text-foreground outline-none focus:border-primary/40"
            value={form.actualClaimOccurred ?? ""}
            onChange={(e) => setForm({ ...form, actualClaimOccurred: (e.target.value || undefined) as any })}
          >
            <option value="">-</option>
            <option value="YES">Yes</option>
            <option value="NO">No</option>
            <option value="PENDING">Pending</option>
          </select>
        </div>
        <div>
          <label className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider block mb-1">
            Cost Delta ($)
          </label>
          <input
            type="number"
            step="0.01"
            className="w-full px-2.5 py-1.5 rounded bg-background border border-border text-[12px] text-foreground outline-none focus:border-primary/40"
            value={form.actualCostDelta ?? ""}
            onChange={(e) => setForm({ ...form, actualCostDelta: e.target.value ? Number(e.target.value) : undefined })}
          />
        </div>
        <div>
          <label className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider block mb-1">
            Margin Delta (%)
          </label>
          <input
            type="number"
            step="0.1"
            className="w-full px-2.5 py-1.5 rounded bg-background border border-border text-[12px] text-foreground outline-none focus:border-primary/40"
            value={form.actualMarginDelta ?? ""}
            onChange={(e) => setForm({ ...form, actualMarginDelta: e.target.value ? Number(e.target.value) : undefined })}
          />
        </div>
      </div>

      <div>
        <label className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider block mb-1">
          Outcome Evaluation
        </label>
        <div className="flex gap-2">
          {(["POSITIVE", "NEUTRAL", "NEGATIVE"] as const).map((val) => {
            const selected = form.outcomeEvaluation === val;
            const colors = {
              POSITIVE: selected ? "bg-primary/20 text-primary border-primary/40" : "bg-secondary text-muted-foreground border-border",
              NEUTRAL: selected ? "bg-[#D4A24C]/20 text-[#D4A24C] border-[#D4A24C]/40" : "bg-secondary text-muted-foreground border-border",
              NEGATIVE: selected ? "bg-[#E05252]/20 text-[#E05252] border-[#E05252]/40" : "bg-secondary text-muted-foreground border-border",
            };
            return (
              <button
                key={val}
                type="button"
                onClick={() => setForm({ ...form, outcomeEvaluation: selected ? undefined : val })}
                className={`flex-1 px-2 py-1 text-[11px] font-medium rounded border transition-colors ${colors[val]}`}
              >
                {val.charAt(0) + val.slice(1).toLowerCase()}
              </button>
            );
          })}
        </div>
      </div>

      <div>
        <label className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider block mb-1">
          Post-Decision Notes
        </label>
        <textarea
          className="w-full px-2.5 py-1.5 rounded bg-background border border-border text-[12px] text-foreground outline-none focus:border-primary/40 resize-none h-16"
          placeholder="What actually happened after this decision..."
          value={form.postDecisionNotes ?? ""}
          onChange={(e) => setForm({ ...form, postDecisionNotes: e.target.value })}
        />
      </div>

      <div className="flex justify-end gap-2 pt-1">
        <button
          type="button"
          onClick={onCancel}
          className="px-3 py-1.5 rounded text-[12px] font-medium text-muted-foreground hover:bg-muted transition-colors"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={!hasAnyField}
          className="px-3 py-1.5 rounded text-[12px] font-medium bg-primary hover:bg-primary/90 text-primary-foreground disabled:opacity-50 transition-colors"
        >
          Record Outcome
        </button>
      </div>
    </motion.form>
  );
}
