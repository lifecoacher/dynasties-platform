import { useState, useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "../hooks/use-auth";
import { Link } from "wouter";
import {
  Mail,
  RotateCcw,
  CheckCircle2,
  AlertCircle,
  Loader2,
  ArrowLeft,
  Ship,
  Zap,
  Shield,
  TrendingUp,
  FileText,
} from "lucide-react";

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

        const emailStatus = data.email?.status;
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

        if (emailStatus === "PROCESSED" && shipments.length === 0) {
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
      { label: "Email Ingestion", icon: <Mail className="w-4 h-4" />, status: "active", detail: "Parsing MIME..." },
      { label: "AI Extraction", icon: <FileText className="w-4 h-4" />, status: "pending" },
      { label: "Entity Resolution", icon: <Zap className="w-4 h-4" />, status: "pending" },
      { label: "Shipment Created", icon: <Ship className="w-4 h-4" />, status: "pending" },
      { label: "Compliance & Risk", icon: <Shield className="w-4 h-4" />, status: "pending" },
    ]);

    try {
      const res = await fetch(`${getBaseUrl()}/api/demo/ingest`, {
        method: "POST",
        headers: headers(),
      });

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
        setMessage({
          type: "success",
          text: `Shipment ${shipment.reference} created successfully as ${shipment.status}.`,
        });
      } else {
        setMessage({
          type: "info",
          text: "Pipeline is still processing. Check the Workbench in a moment.",
        });
      }
    } catch (err) {
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
      const res = await fetch(`${getBaseUrl()}/api/demo/reset`, {
        method: "POST",
        headers: headers(),
      });

      const body = await res.json();

      if (!res.ok) {
        setMessage({ type: "error", text: body.error || "Reset failed" });
      } else {
        setMessage({ type: "success", text: body.data.message });
        queryClient.invalidateQueries({ queryKey: ["shipments"] });
      }
    } catch (err) {
      setMessage({ type: "error", text: "Network error during reset" });
    } finally {
      setResetting(false);
    }
  }, [headers, queryClient]);

  return (
    <div className="min-h-screen bg-background p-8">
      <div className="max-w-3xl mx-auto">
        <Link href="/" className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground mb-6 transition-colors">
          <ArrowLeft className="w-4 h-4" />
          Back to Workbench
        </Link>

        <div className="mb-8">
          <h1 className="font-display text-3xl font-bold tracking-tight flex items-center gap-3">
            <Zap className="w-8 h-8 text-primary" />
            Demo Controls
          </h1>
          <p className="text-muted-foreground mt-2">
            Trigger the full email ingestion pipeline and manage demo data.
          </p>
        </div>

        <div className="grid gap-6">
          <div className="glass-panel rounded-xl p-6">
            <h2 className="font-display text-xl font-bold mb-2">Ingest Demo Email</h2>
            <p className="text-sm text-muted-foreground mb-4">
              Sends a realistic Bill of Lading email through the full pipeline:
              email parsing, AI extraction, entity resolution, shipment creation,
              compliance screening, risk scoring, and insurance quoting.
            </p>

            <button
              onClick={handleIngest}
              disabled={ingesting || resetting}
              className="flex items-center gap-2 px-6 py-3 rounded-lg bg-primary text-primary-foreground font-semibold hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
            >
              {ingesting ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Processing Pipeline...
                </>
              ) : (
                <>
                  <Mail className="w-5 h-5" />
                  Ingest Demo Email
                </>
              )}
            </button>

            {pipelineSteps.length > 0 && (
              <div className="mt-6 space-y-3">
                {pipelineSteps.map((step, i) => (
                  <div key={i} className="flex items-center gap-3">
                    <div
                      className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${
                        step.status === "done"
                          ? "bg-green-500/20 text-green-400"
                          : step.status === "active"
                            ? "bg-primary/20 text-primary"
                            : step.status === "error"
                              ? "bg-destructive/20 text-destructive"
                              : "bg-muted text-muted-foreground"
                      }`}
                    >
                      {step.status === "done" ? (
                        <CheckCircle2 className="w-4 h-4" />
                      ) : step.status === "active" ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        step.icon
                      )}
                    </div>
                    <div className="flex-1">
                      <span
                        className={`text-sm font-medium ${
                          step.status === "done"
                            ? "text-green-400"
                            : step.status === "active"
                              ? "text-foreground"
                              : "text-muted-foreground"
                        }`}
                      >
                        {step.label}
                      </span>
                      {step.detail && (
                        <span className="text-xs text-muted-foreground ml-2">— {step.detail}</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {newShipmentId && (
              <div className="mt-4">
                <Link
                  href={`/shipments/${newShipmentId}`}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-green-500/20 text-green-400 hover:bg-green-500/30 font-medium text-sm transition-colors"
                >
                  <Ship className="w-4 h-4" />
                  View Created Shipment
                </Link>
              </div>
            )}
          </div>

          <div className="glass-panel rounded-xl p-6">
            <h2 className="font-display text-xl font-bold mb-2">Reset Demo Data</h2>
            <p className="text-sm text-muted-foreground mb-4">
              Removes the demo-generated shipment, entities, and related data.
              Use this before each presentation to start fresh.
              Does not affect your 3 seed shipments.
            </p>

            <button
              onClick={handleReset}
              disabled={ingesting || resetting}
              className="flex items-center gap-2 px-6 py-3 rounded-lg bg-secondary text-secondary-foreground font-semibold hover:bg-secondary/80 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
            >
              {resetting ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Resetting...
                </>
              ) : (
                <>
                  <RotateCcw className="w-5 h-5" />
                  Reset Demo Data
                </>
              )}
            </button>
          </div>
        </div>

        {message && (
          <div
            className={`mt-6 p-4 rounded-lg flex items-start gap-3 ${
              message.type === "success"
                ? "bg-green-500/10 border border-green-500/30 text-green-400"
                : message.type === "error"
                  ? "bg-destructive/10 border border-destructive/30 text-destructive"
                  : "bg-primary/10 border border-primary/30 text-primary"
            }`}
          >
            {message.type === "success" ? (
              <CheckCircle2 className="w-5 h-5 shrink-0 mt-0.5" />
            ) : (
              <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
            )}
            <span className="text-sm">{message.text}</span>
          </div>
        )}
      </div>
    </div>
  );
}
