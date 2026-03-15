import { useState, useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "../hooks/use-auth";
import { Link } from "wouter";
import { motion } from "framer-motion";
import {
  Mail,
  RotateCcw,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Ship,
  Zap,
  Shield,
  TrendingUp,
  FileText,
} from "lucide-react";
import { AppLayout } from "@/components/layout/AppLayout";

function getBaseUrl() {
  return import.meta.env.BASE_URL.replace(/\/$/, "");
}

type StepStatus = "pending" | "active" | "done" | "error";

interface PipelineStep {
  label: string;
  icon: React.ReactNode;
  status: StepStatus;
  detail?: string;
}

export default function DemoControls() {
  const { token } = useAuth();
  const queryClient = useQueryClient();
  const [ingesting, setIngesting] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error" | "info"; text: string } | null>(null);
  const [pipelineSteps, setPipelineSteps] = useState<PipelineStep[]>([]);
  const [newShipmentId, setNewShipmentId] = useState<string | null>(null);

  const headers = useCallback(
    () => ({
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    }),
    [token],
  );

  const pollForShipment = useCallback(
    async (emailId: string, maxAttempts = 20) => {
      for (let i = 0; i < maxAttempts; i++) {
        await new Promise((r) => setTimeout(r, 2000));
        const res = await fetch(`${getBaseUrl()}/api/demo/status`, { headers: headers() });
        if (!res.ok) continue;
        const { data } = await res.json();
        if (!data.ingested) continue;

        const docs = data.documents || [];
        const shipments = data.shipments || [];

        if (docs.some((d: any) => d.extractionStatus === "PROCESSING" || d.extractionStatus === "PENDING")) {
          setPipelineSteps((prev) =>
            prev.map((s) =>
              s.label === "AI Extraction" ? { ...s, status: "active" as StepStatus, detail: "Claude is reading the document..." } : s,
            ),
          );
          continue;
        }

        if (docs.every((d: any) => d.extractionStatus === "EXTRACTED" || d.extractionStatus === "FAILED")) {
          setPipelineSteps((prev) =>
            prev.map((s) =>
              s.label === "AI Extraction" ? { ...s, status: "done" as StepStatus, detail: "Fields extracted" } : s,
            ),
          );
        }

        if (shipments.length > 0) {
          setPipelineSteps((prev) =>
            prev.map((s) => {
              if (s.label === "Entity Resolution") return { ...s, status: "done" as StepStatus, detail: "Parties resolved" };
              if (s.label === "Shipment Created") return { ...s, status: "done" as StepStatus, detail: `${shipments[0].reference}` };
              if (s.label === "Compliance & Risk") return { ...s, status: "done" as StepStatus, detail: "Screening complete" };
              return s;
            }),
          );
          setNewShipmentId(shipments[0].id);
          queryClient.invalidateQueries({ queryKey: ["shipments"] });
          return shipments[0];
        }

        if (data.email?.status === "PROCESSED" && shipments.length === 0) {
          setPipelineSteps((prev) =>
            prev.map((s) => {
              if (s.label === "Entity Resolution") return { ...s, status: "active" as StepStatus, detail: "Resolving parties..." };
              return s;
            }),
          );
        }
      }
      return null;
    },
    [headers, queryClient],
  );

  const handleIngest = useCallback(async () => {
    setIngesting(true);
    setMessage(null);
    setNewShipmentId(null);
    setPipelineSteps([
      { label: "Email Ingestion", icon: <Mail className="w-3.5 h-3.5" />, status: "active", detail: "Parsing MIME..." },
      { label: "AI Extraction", icon: <FileText className="w-3.5 h-3.5" />, status: "pending" },
      { label: "Entity Resolution", icon: <Zap className="w-3.5 h-3.5" />, status: "pending" },
      { label: "Shipment Created", icon: <Ship className="w-3.5 h-3.5" />, status: "pending" },
      { label: "Compliance & Risk", icon: <Shield className="w-3.5 h-3.5" />, status: "pending" },
    ]);

    try {
      const res = await fetch(`${getBaseUrl()}/api/demo/ingest`, { method: "POST", headers: headers() });
      const body = await res.json();

      if (!res.ok) {
        setMessage({ type: "error", text: body.error || "Ingestion failed" });
        setPipelineSteps([]);
        setIngesting(false);
        return;
      }

      setPipelineSteps((prev) =>
        prev.map((s) =>
          s.label === "Email Ingestion"
            ? { ...s, status: "done" as StepStatus, detail: `${body.data.attachmentCount} attachment(s)` }
            : s.label === "AI Extraction"
              ? { ...s, status: "active" as StepStatus, detail: "Starting extraction..." }
              : s,
        ),
      );

      const shipment = await pollForShipment(body.data.emailId);
      if (shipment) {
        setMessage({ type: "success", text: `Shipment ${shipment.reference} created successfully.` });
      } else {
        setMessage({ type: "info", text: "Pipeline is still processing. Check back shortly." });
      }
    } catch {
      setMessage({ type: "error", text: "Network error during ingestion" });
      setPipelineSteps([]);
    } finally {
      setIngesting(false);
    }
  }, [headers, pollForShipment]);

  const handleReset = useCallback(async () => {
    setResetting(true);
    setMessage(null);
    setPipelineSteps([]);
    setNewShipmentId(null);
    try {
      const res = await fetch(`${getBaseUrl()}/api/demo/reset`, { method: "POST", headers: headers() });
      const body = await res.json();
      if (!res.ok) {
        setMessage({ type: "error", text: body.error || "Reset failed" });
      } else {
        setMessage({ type: "success", text: body.data.message });
        queryClient.invalidateQueries({ queryKey: ["shipments"] });
      }
    } catch {
      setMessage({ type: "error", text: "Network error during reset" });
    } finally {
      setResetting(false);
    }
  }, [headers, queryClient]);

  return (
    <AppLayout>
      <div className="max-w-2xl mx-auto px-6 py-8">
        <div className="mb-8">
          <h1 className="text-xl font-semibold text-foreground tracking-tight flex items-center gap-2">
            <Zap className="w-5 h-5 text-primary" />
            Demo Pipeline
          </h1>
          <p className="text-[13px] text-muted-foreground mt-1">
            Trigger the full email ingestion pipeline and manage demo data.
          </p>
        </div>

        <div className="space-y-4">
          <div className="p-5 rounded-xl bg-card border border-card-border">
            <h2 className="text-[14px] font-semibold text-foreground mb-1">Ingest Demo Email</h2>
            <p className="text-[12px] text-muted-foreground mb-4">
              Sends a realistic Bill of Lading through the full pipeline: email parsing, AI extraction, entity resolution, compliance screening, and risk scoring.
            </p>

            <button
              onClick={handleIngest}
              disabled={ingesting || resetting}
              className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-primary text-primary-foreground text-[13px] font-medium hover:bg-primary/90 disabled:opacity-50 transition-colors"
            >
              {ingesting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Processing...
                </>
              ) : (
                <>
                  <Mail className="w-4 h-4" />
                  Ingest Demo Email
                </>
              )}
            </button>

            {pipelineSteps.length > 0 && (
              <div className="mt-5 space-y-2">
                {pipelineSteps.map((step, i) => (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, x: -8 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.05 }}
                    className="flex items-center gap-3"
                  >
                    <div className={`w-7 h-7 rounded-md flex items-center justify-center shrink-0 ${
                      step.status === "done"
                        ? "bg-emerald-400/10 text-emerald-400"
                        : step.status === "active"
                          ? "bg-primary/10 text-primary"
                          : step.status === "error"
                            ? "bg-destructive/10 text-destructive"
                            : "bg-muted text-muted-foreground"
                    }`}>
                      {step.status === "done" ? <CheckCircle2 className="w-3.5 h-3.5" /> : step.status === "active" ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : step.icon}
                    </div>
                    <div className="flex-1">
                      <span className={`text-[12px] font-medium ${step.status === "done" ? "text-emerald-400" : step.status === "active" ? "text-foreground" : "text-muted-foreground"}`}>
                        {step.label}
                      </span>
                      {step.detail && <span className="text-[11px] text-muted-foreground ml-2">— {step.detail}</span>}
                    </div>
                  </motion.div>
                ))}
              </div>
            )}

            {newShipmentId && (
              <div className="mt-4">
                <Link
                  href={`/shipments/${newShipmentId}`}
                  className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-emerald-400/10 text-emerald-400 hover:bg-emerald-400/20 text-[12px] font-medium transition-colors"
                >
                  <Ship className="w-3.5 h-3.5" />
                  View Created Shipment
                </Link>
              </div>
            )}
          </div>

          <div className="p-5 rounded-xl bg-card border border-card-border">
            <h2 className="text-[14px] font-semibold text-foreground mb-1">Reset Demo Data</h2>
            <p className="text-[12px] text-muted-foreground mb-4">
              Removes demo-generated shipments and related data. Does not affect seed data.
            </p>
            <button
              onClick={handleReset}
              disabled={ingesting || resetting}
              className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-muted text-foreground text-[13px] font-medium hover:bg-muted/80 disabled:opacity-50 transition-colors"
            >
              {resetting ? <><Loader2 className="w-4 h-4 animate-spin" />Resetting...</> : <><RotateCcw className="w-4 h-4" />Reset Demo Data</>}
            </button>
          </div>
        </div>

        {message && (
          <div className={`mt-5 p-4 rounded-xl flex items-start gap-3 text-[13px] ${
            message.type === "success"
              ? "bg-emerald-400/5 border border-emerald-400/20 text-emerald-400"
              : message.type === "error"
                ? "bg-destructive/5 border border-destructive/20 text-destructive"
                : "bg-primary/5 border border-primary/20 text-primary"
          }`}>
            {message.type === "success" ? <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" /> : <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />}
            {message.text}
          </div>
        )}
      </div>
    </AppLayout>
  );
}
