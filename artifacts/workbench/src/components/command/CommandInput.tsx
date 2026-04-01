import { useState, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowUp, Sparkles, Loader2 } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { useLocation } from "wouter";

interface CommandResult {
  type: "success" | "info" | "error";
  title: string;
  detail?: string;
  actions?: { label: string; href?: string; onClick?: () => void }[];
}

const SUGGESTIONS = [
  "Create shipment from email",
];

function getBaseUrl() {
  return import.meta.env.BASE_URL.replace(/\/$/, "");
}

export function CommandInput() {
  const [value, setValue] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [result, setResult] = useState<CommandResult | null>(null);
  const [phase, setPhase] = useState<"idle" | "understanding" | "processing" | "result">("idle");
  const inputRef = useRef<HTMLInputElement>(null);
  const { token } = useAuth();
  const queryClient = useQueryClient();
  const [, setLocation] = useLocation();

  const handleSubmit = useCallback(async () => {
    const cmd = value.trim().toLowerCase();
    if (!cmd) return;

    setIsProcessing(true);
    setPhase("understanding");
    setResult(null);

    await new Promise((r) => setTimeout(r, 300));
    setPhase("processing");

    const isEmailIngest = (cmd.includes("email") || cmd.includes("ingest")) && (cmd.includes("create") || cmd.includes("shipment") || cmd.includes("ingest"));
    if (isEmailIngest) {
      try {
        const res = await fetch(`${getBaseUrl()}/api/demo/ingest`, {
          method: "POST",
          headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        });
        const body = await res.json();
        if (res.ok) {
          queryClient.invalidateQueries({ queryKey: ["shipments"] });
          setResult({
            type: "success",
            title: "Email ingestion triggered",
            detail: `${body.data.attachmentCount} attachment(s) detected. Pipeline is processing.`,
            actions: [{ label: "View Pipeline", href: "/demo" }],
          });
        } else {
          setResult({ type: "error", title: "Ingestion failed", detail: body.error });
        }
      } catch {
        setResult({ type: "error", title: "Network error", detail: "Could not reach the API" });
      }
    } else {
      setResult({
        type: "info",
        title: "This feature is not yet available",
        detail: "Natural language queries are coming in a future release. Use the navigation to access specific areas.",
        actions: [
          { label: "Shipments", href: "/shipments" },
          { label: "Exceptions", href: "/exceptions" },
          { label: "Work Queue", href: "/work-queue" },
        ],
      });
    }

    setPhase("result");
    setIsProcessing(false);
    setValue("");
  }, [value, token, queryClient, setLocation]);

  return (
    <div className="w-full max-w-2xl mx-auto">
      <div className="relative">
        <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-card border border-card-border focus-within:border-primary/40 focus-within:ring-1 focus-within:ring-primary/20 transition-all">
          <Sparkles className="w-4 h-4 text-muted-foreground shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
            placeholder="Create shipment from email..."
            className="flex-1 bg-transparent text-[14px] text-foreground placeholder:text-muted-foreground/60 outline-none"
            disabled={isProcessing}
          />
          <button
            onClick={handleSubmit}
            disabled={!value.trim() || isProcessing}
            className="w-7 h-7 rounded-lg bg-primary/10 text-primary flex items-center justify-center hover:bg-primary hover:text-primary-foreground disabled:opacity-30 disabled:hover:bg-primary/10 disabled:hover:text-primary transition-all"
          >
            {isProcessing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ArrowUp className="w-3.5 h-3.5" />}
          </button>
        </div>
      </div>

      <AnimatePresence>
        {phase !== "idle" && phase !== "result" && (
          <motion.div
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            className="mt-3 flex items-center gap-2 px-4 text-[12px] text-muted-foreground"
          >
            <Loader2 className="w-3 h-3 animate-spin" />
            {phase === "understanding" ? "Processing..." : "Working..."}
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {result && phase === "result" && (
          <motion.div
            initial={{ opacity: 0, y: -8, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4 }}
            className={`mt-3 p-4 rounded-xl border ${
              result.type === "success"
                ? "bg-primary/5 border-primary/20"
                : result.type === "error"
                  ? "bg-destructive/5 border-destructive/20"
                  : "bg-card border-card-border"
            }`}
          >
            <p className="text-[13px] font-semibold text-foreground">{result.title}</p>
            {result.detail && <p className="text-[12px] text-muted-foreground mt-1">{result.detail}</p>}
            {result.actions && result.actions.length > 0 && (
              <div className="flex items-center gap-2 mt-3">
                {result.actions.map((action, i) =>
                  action.href ? (
                    <button
                      key={i}
                      onClick={() => setLocation(action.href!)}
                      className="px-3 py-1.5 rounded-lg bg-card border border-card-border text-[12px] font-medium text-foreground hover:bg-primary/10 hover:text-primary hover:border-primary/30 transition-all"
                    >
                      {action.label}
                    </button>
                  ) : null
                )}
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {phase === "idle" && !value && (
        <div className="flex items-center gap-2 mt-3 overflow-x-auto pb-1">
          {SUGGESTIONS.map((s) => (
            <button
              key={s}
              onClick={() => {
                setValue(s);
                inputRef.current?.focus();
              }}
              className="px-3 py-1.5 rounded-lg border border-card-border bg-card/50 text-[11px] text-muted-foreground hover:text-foreground hover:border-primary/30 transition-all whitespace-nowrap shrink-0"
            >
              {s}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
