import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { getAuthToken } from "@workspace/api-client-react";
import { motion, AnimatePresence } from "framer-motion";
import { format } from "date-fns";
import {
  FileText,
  FileOutput,
  Package,
  Ship,
  ClipboardList,
  BarChart3,
  CheckCircle2,
  AlertCircle,
  Loader2,
  RefreshCw,
  Eye,
  Download,
  ChevronDown,
  ChevronUp,
  X,
  Clock,
  History,
} from "lucide-react";

const BASE = `${import.meta.env.BASE_URL}api`;

const DOC_TYPE_META: Record<string, { icon: React.ReactNode; color: string; description: string }> = {
  COMMERCIAL_INVOICE: {
    icon: <FileText className="w-4 h-4" />,
    color: "text-primary",
    description: "Formal invoice for international trade, detailing goods, values, and trade terms.",
  },
  PACKING_LIST: {
    icon: <Package className="w-4 h-4" />,
    color: "text-[#4EAEE3]",
    description: "Detailed cargo contents, weights, and packaging information.",
  },
  BILL_OF_LADING: {
    icon: <Ship className="w-4 h-4" />,
    color: "text-[#D4A24C]",
    description: "Draft Bill of Lading — carrier contract and receipt of cargo.",
  },
  CUSTOMS_DECLARATION: {
    icon: <ClipboardList className="w-4 h-4" />,
    color: "text-violet-400",
    description: "Export/import customs declaration scaffold with tariff data.",
  },
  SHIPMENT_SUMMARY: {
    icon: <BarChart3 className="w-4 h-4" />,
    color: "text-emerald-400",
    description: "Comprehensive overview of shipment, routing, and financial data.",
  },
};

interface DocumentWorkspaceProps {
  shipmentId: string;
}

export function DocumentWorkspace({ shipmentId }: DocumentWorkspaceProps) {
  const [generating, setGenerating] = useState<string | null>(null);
  const [previewDoc, setPreviewDoc] = useState<{ id: string; type: string; html: string } | null>(null);
  const [expandedType, setExpandedType] = useState<string | null>(null);
  const qc = useQueryClient();

  const { data: readinessRes, isLoading } = useQuery({
    queryKey: [`/api/shipments/${shipmentId}/generated-documents`],
    queryFn: async () => {
      const token = getAuthToken();
      const res = await fetch(`${BASE}/shipments/${shipmentId}/generated-documents`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) return { data: [] };
      return res.json();
    },
    enabled: !!shipmentId,
  });

  const readiness = (readinessRes?.data || []) as any[];

  const handleGenerate = async (docType: string) => {
    setGenerating(docType);
    try {
      const token = getAuthToken();
      const res = await fetch(`${BASE}/shipments/${shipmentId}/generated-documents/${docType}/generate`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      });
      const json = await res.json();
      if (!res.ok) {
        console.error("Generation failed:", json);
        return;
      }
      qc.invalidateQueries({ queryKey: [`/api/shipments/${shipmentId}/generated-documents`] });
      qc.invalidateQueries({ queryKey: [`/api/shipments/${shipmentId}/events`] });

      if (json.data?.documentId) {
        await handlePreview(json.data.documentId, docType);
      }
    } catch (err) {
      console.error("Generation error:", err);
    } finally {
      setGenerating(null);
    }
  };

  const handlePreview = async (documentId: string, docType: string) => {
    try {
      const token = getAuthToken();
      const res = await fetch(`${BASE}/shipments/${shipmentId}/generated-documents/${documentId}/download`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) return;
      const html = await res.text();
      setPreviewDoc({ id: documentId, type: docType, html });
    } catch (err) {
      console.error("Preview error:", err);
    }
  };

  const handleDownload = (html: string, docType: string) => {
    const blob = new Blob([html], { type: "text/html" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${docType.toLowerCase()}.html`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (isLoading) {
    return (
      <div className="p-5 rounded-xl bg-card border border-card-border">
        <div className="flex items-center gap-2 text-muted-foreground">
          <Loader2 className="w-4 h-4 animate-spin" />
          <span className="text-[12px]">Loading document readiness...</span>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="p-5 rounded-xl bg-card border border-card-border">
        <h3 className="text-[14px] font-semibold text-foreground mb-4 flex items-center gap-2">
          <FileOutput className="w-4 h-4 text-primary" />
          Document Engine
        </h3>

        <div className="space-y-3">
          {readiness.map((item: any) => {
            const meta = DOC_TYPE_META[item.documentType] || DOC_TYPE_META.SHIPMENT_SUMMARY;
            const isReady = item.validation?.ready;
            const isGenerating = generating === item.documentType;
            const hasDoc = !!item.latestVersion;
            const isExpanded = expandedType === item.documentType;

            return (
              <motion.div
                key={item.documentType}
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                className="rounded-lg border border-card-border overflow-hidden"
              >
                <div className="px-3 py-2.5 flex items-center gap-3">
                  <div className={`w-8 h-8 rounded-md flex items-center justify-center shrink-0 ${
                    isReady ? `${meta.color} bg-current/10` : "text-muted-foreground bg-muted/50"
                  }`} style={{ background: isReady ? undefined : undefined }}>
                    <div className={meta.color}>{meta.icon}</div>
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-[12px] font-semibold text-foreground">{item.label}</p>
                      {isReady ? (
                        <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-primary/10 text-primary">READY</span>
                      ) : (
                        <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-[#E05252]/10 text-[#E05252]">BLOCKED</span>
                      )}
                      {hasDoc && (
                        <span className="text-[9px] font-medium px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
                          v{item.latestVersion.versionNumber}
                        </span>
                      )}
                    </div>
                    {!isReady && item.validation?.missingFields?.length > 0 && (
                      <p className="text-[10px] text-[#E05252]/80 mt-0.5">
                        Missing: {item.validation.missingFields.slice(0, 3).join(", ")}
                        {item.validation.missingFields.length > 3 && ` +${item.validation.missingFields.length - 3} more`}
                      </p>
                    )}
                    {hasDoc && (
                      <p className="text-[10px] text-muted-foreground mt-0.5">
                        Generated {format(new Date(item.latestVersion.createdAt), "MMM d, HH:mm")}
                      </p>
                    )}
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    {hasDoc && (
                      <>
                        <button
                          onClick={() => handlePreview(item.latestVersion.id, item.documentType)}
                          className="p-1.5 rounded hover:bg-muted/50 text-muted-foreground hover:text-foreground transition-colors"
                          title="Preview"
                        >
                          <Eye className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => setExpandedType(isExpanded ? null : item.documentType)}
                          className="p-1.5 rounded hover:bg-muted/50 text-muted-foreground hover:text-foreground transition-colors"
                          title="Details"
                        >
                          {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                        </button>
                      </>
                    )}
                    <button
                      onClick={() => handleGenerate(item.documentType)}
                      disabled={!isReady || isGenerating}
                      className={`px-2.5 py-1 text-[10px] font-medium rounded flex items-center gap-1 border transition-colors ${
                        isReady
                          ? "bg-primary/10 text-primary border-primary/20 hover:bg-primary/20"
                          : "bg-muted text-muted-foreground border-card-border cursor-not-allowed opacity-50"
                      }`}
                    >
                      {isGenerating ? (
                        <Loader2 className="w-3 h-3 animate-spin" />
                      ) : hasDoc ? (
                        <RefreshCw className="w-3 h-3" />
                      ) : (
                        <FileOutput className="w-3 h-3" />
                      )}
                      {hasDoc ? "Regen" : "Generate"}
                    </button>
                  </div>
                </div>

                <AnimatePresence>
                  {isExpanded && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      className="border-t border-card-border"
                    >
                      <div className="px-3 py-2 bg-muted/20">
                        <p className="text-[10px] text-muted-foreground mb-2">{meta.description}</p>
                        {item.totalVersions > 1 && (
                          <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
                            <History className="w-3 h-3" />
                            {item.totalVersions} version{item.totalVersions !== 1 ? "s" : ""} generated
                          </div>
                        )}
                        {item.validation?.suggestions?.length > 0 && (
                          <div className="mt-2 space-y-1">
                            {item.validation.suggestions.map((s: string, i: number) => (
                              <div key={i} className="text-[10px] text-[#D4A24C] flex items-start gap-1">
                                <AlertCircle className="w-3 h-3 shrink-0 mt-0.5" />
                                {s}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            );
          })}
        </div>

        {readiness.length === 0 && (
          <p className="text-[11px] text-muted-foreground text-center py-4">No document types configured.</p>
        )}
      </div>

      <AnimatePresence>
        {previewDoc && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
            onClick={() => setPreviewDoc(null)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="relative w-[90vw] max-w-[900px] h-[85vh] bg-white rounded-xl shadow-2xl overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between px-4 py-2 bg-[#0D1219] border-b border-card-border">
                <div className="flex items-center gap-2">
                  <FileText className="w-4 h-4 text-primary" />
                  <span className="text-[12px] font-semibold text-white">
                    {(DOC_TYPE_META[previewDoc.type]?.icon ? previewDoc.type.replace(/_/g, " ") : previewDoc.type)}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleDownload(previewDoc.html, previewDoc.type)}
                    className="px-2 py-1 text-[10px] font-medium rounded bg-primary/10 text-primary hover:bg-primary/20 flex items-center gap-1 border border-primary/20"
                  >
                    <Download className="w-3 h-3" />
                    Download
                  </button>
                  <button
                    onClick={() => setPreviewDoc(null)}
                    className="p-1 rounded hover:bg-white/10 text-white/60 hover:text-white"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>
              <iframe
                srcDoc={previewDoc.html}
                className="w-full h-[calc(100%-40px)]"
                sandbox="allow-same-origin"
                title="Document Preview"
              />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
