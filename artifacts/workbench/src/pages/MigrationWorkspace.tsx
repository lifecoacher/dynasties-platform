import { useState, useCallback, useRef } from "react";
import { useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import {
  Upload,
  FileSpreadsheet,
  Brain,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  ArrowLeft,
  Loader2,
  X,
  Users,
  Ship,
  FileText,
  DollarSign,
  Sparkles,
  RefreshCw,
  ChevronDown,
  ChevronUp,
  Zap,
  Database,
  ShieldCheck,
  Link2,
  Check,
} from "lucide-react";
import { AppLayout } from "@/components/layout/AppLayout";
import { getAuthToken } from "@workspace/api-client-react";

const BASE = `${import.meta.env.BASE_URL}api`;

async function apiPost<T>(path: string, body?: any, isFormData = false): Promise<T> {
  const token = getAuthToken();
  const headers: Record<string, string> = { Authorization: `Bearer ${token}` };
  if (!isFormData) headers["Content-Type"] = "application/json";

  const res = await fetch(`${BASE}${path}`, {
    method: "POST",
    headers,
    body: isFormData ? body : body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || res.statusText);
  }
  const json = await res.json();
  return json.data;
}

async function apiGet<T>(path: string): Promise<T> {
  const token = getAuthToken();
  const res = await fetch(`${BASE}${path}`, {
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
  });
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  const json = await res.json();
  return json.data;
}

const STEPS = [
  { label: "Upload", icon: Upload },
  { label: "AI Processing", icon: Brain },
  { label: "Review Mappings", icon: FileSpreadsheet },
  { label: "Validation", icon: ShieldCheck },
  { label: "Import", icon: Database },
];

interface UploadedFile {
  fileName: string;
  originalName: string;
  rowCount: number;
  headers: string[];
  sampleRows: Record<string, any>[];
}

interface ClassificationResult {
  fileName: string;
  fileType: string;
  confidence: number;
  reasoning: string;
}

interface FieldMapping {
  sourceField: string;
  targetField: string;
  confidence: number;
  transformation: string | null;
  userConfirmed: boolean;
}

interface MappingResult {
  fileName: string;
  fileType: string;
  fieldMappings: FieldMapping[];
  unmappedFields: string[];
  autoMappedPercent: number;
}

interface ValidationSummary {
  totalCustomers: number;
  totalShipments: number;
  totalInvoices: number;
  totalInvoiceValue: number;
  totalLineItems: number;
  missingRequiredFields: { entity: string; field: string; count: number }[];
  duplicateWarnings: { entity: string; field: string; count: number }[];
  relationshipLinks: { from: string; to: string; linked: number; unlinked: number }[];
}

interface ImportResults {
  customersCreated: number;
  shipmentsCreated: number;
  invoicesCreated: number;
  lineItemsCreated: number;
  totalRevenue: number;
  errors: string[];
  completedAt: string;
}

const FILE_TYPE_META: Record<string, { label: string; icon: any; color: string }> = {
  customers: { label: "Customers", icon: Users, color: "text-blue-400" },
  shipments: { label: "Shipments", icon: Ship, color: "text-teal-400" },
  invoices: { label: "Invoices", icon: FileText, color: "text-amber-400" },
  line_items: { label: "Line Items", icon: DollarSign, color: "text-emerald-400" },
  payments: { label: "Payments", icon: DollarSign, color: "text-purple-400" },
  unknown: { label: "Unknown", icon: AlertTriangle, color: "text-red-400" },
};

const TARGET_FIELDS: Record<string, string[]> = {
  customers: ["name", "email", "phone", "address", "city", "state", "country", "postalCode", "accountNumber", "contactName", "taxId", "website"],
  shipments: ["reference", "status", "portOfLoading", "portOfDischarge", "vessel", "voyage", "containerNumber", "bookingNumber", "blNumber", "commodity", "hsCode", "incoterms", "packageCount", "grossWeight", "weightUnit", "volume", "volumeUnit", "etd", "eta", "customerName"],
  invoices: ["invoiceNumber", "customerName", "shipmentReference", "issueDate", "dueDate", "subtotal", "tax", "grandTotal", "currency", "paymentTerms", "status", "notes"],
  line_items: ["invoiceNumber", "description", "lineType", "quantity", "unitPrice", "amount"],
  payments: ["invoiceNumber", "paymentDate", "amount", "currency", "method", "reference"],
};

export default function MigrationWorkspace() {
  const [, setLocation] = useLocation();
  const [step, setStep] = useState(0);
  const [jobId, setJobId] = useState<string | null>(null);
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);
  const [classifications, setClassifications] = useState<ClassificationResult[]>([]);
  const [mappings, setMappings] = useState<MappingResult[]>([]);
  const [validation, setValidation] = useState<ValidationSummary | null>(null);
  const [importResults, setImportResults] = useState<ImportResults | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFiles = useCallback(async (fileList: FileList) => {
    setLoading(true);
    setError(null);
    try {
      const formData = new FormData();
      for (let i = 0; i < fileList.length; i++) {
        formData.append("files", fileList[i]);
      }
      const result = await apiPost<{ jobId: string; uploadedFiles: UploadedFile[] }>(
        "/migration/upload",
        formData,
        true,
      );
      setJobId(result.jobId);
      setUploadedFiles(result.uploadedFiles);
      setStep(1);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  const runAIProcessing = useCallback(async () => {
    if (!jobId) return;
    setLoading(true);
    setError(null);
    try {
      const classResults = await apiPost<ClassificationResult[]>(`/migration/${jobId}/classify`);
      setClassifications(classResults);

      const mapResults = await apiPost<MappingResult[]>(`/migration/${jobId}/map`);
      setMappings(mapResults);

      setStep(2);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [jobId]);

  const handleMappingChange = useCallback((fileName: string, sourceField: string, newTarget: string) => {
    setMappings((prev) =>
      prev.map((m) => {
        if (m.fileName !== fileName) return m;
        return {
          ...m,
          fieldMappings: m.fieldMappings.map((f) => {
            if (f.sourceField !== sourceField) return f;
            return { ...f, targetField: newTarget, userConfirmed: true, confidence: 1.0 };
          }),
        };
      }),
    );
  }, []);

  const runValidation = useCallback(async () => {
    if (!jobId) return;
    setLoading(true);
    setError(null);
    try {
      if (mappings.some((m) => m.fieldMappings.some((f) => f.userConfirmed))) {
        const corrections: Record<string, any> = {};
        for (const m of mappings) {
          for (const f of m.fieldMappings) {
            if (f.userConfirmed) {
              corrections[`${m.fileName}::${f.sourceField}`] = { targetField: f.targetField };
            }
          }
        }
        await apiPost(`/migration/${jobId}/resolve`, { corrections });
      }

      const result = await apiPost<ValidationSummary>(`/migration/${jobId}/validate`);
      setValidation(result);
      setStep(3);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [jobId, mappings]);

  const runImport = useCallback(async () => {
    if (!jobId) return;
    setLoading(true);
    setError(null);
    try {
      const results = await apiPost<ImportResults>(`/migration/${jobId}/import`);
      setImportResults(results);
      setStep(4);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [jobId]);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragActive(false);
      if (e.dataTransfer.files.length > 0) {
        handleFiles(e.dataTransfer.files);
      }
    },
    [handleFiles],
  );

  return (
    <AppLayout hideRightPanel>
      <div className="max-w-5xl mx-auto px-6 py-8">
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
              <Sparkles className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h1 className="text-xl font-semibold text-foreground">AI Migration Engine</h1>
              <p className="text-sm text-muted-foreground">Import your existing data with intelligent mapping</p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-1 mb-8">
          {STEPS.map((s, i) => {
            const Icon = s.icon;
            const isActive = i === step;
            const isDone = i < step;
            return (
              <div key={s.label} className="flex items-center gap-1 flex-1">
                <div
                  className={`flex items-center gap-2 px-3 py-2 rounded-lg transition-all flex-1 ${
                    isActive
                      ? "bg-primary/10 border border-primary/30"
                      : isDone
                        ? "bg-emerald-500/10 border border-emerald-500/20"
                        : "bg-card border border-card-border opacity-50"
                  }`}
                >
                  {isDone ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                  ) : (
                    <Icon className={`w-4 h-4 shrink-0 ${isActive ? "text-primary" : "text-muted-foreground"}`} />
                  )}
                  <span
                    className={`text-xs font-medium truncate ${
                      isActive ? "text-primary" : isDone ? "text-emerald-400" : "text-muted-foreground"
                    }`}
                  >
                    {s.label}
                  </span>
                </div>
                {i < STEPS.length - 1 && (
                  <ArrowRight className={`w-3 h-3 shrink-0 ${isDone ? "text-emerald-400" : "text-muted-foreground/30"}`} />
                )}
              </div>
            );
          })}
        </div>

        {error && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-6 px-4 py-3 rounded-lg bg-red-500/10 border border-red-500/20 flex items-center gap-3"
          >
            <AlertTriangle className="w-4 h-4 text-red-400 shrink-0" />
            <p className="text-sm text-red-300 flex-1">{error}</p>
            <button onClick={() => setError(null)} className="text-red-400 hover:text-red-300">
              <X className="w-4 h-4" />
            </button>
          </motion.div>
        )}

        <AnimatePresence mode="wait">
          {step === 0 && (
            <motion.div key="upload" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
              <UploadStep
                dragActive={dragActive}
                loading={loading}
                fileInputRef={fileInputRef}
                onDrop={handleDrop}
                onDragOver={(e) => { e.preventDefault(); setDragActive(true); }}
                onDragLeave={() => setDragActive(false)}
                onFileSelect={(e) => { if (e.target.files) handleFiles(e.target.files); }}
                onBrowse={() => fileInputRef.current?.click()}
              />
            </motion.div>
          )}

          {step === 1 && (
            <motion.div key="processing" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
              <AIProcessingStep
                uploadedFiles={uploadedFiles}
                loading={loading}
                onProcess={runAIProcessing}
                onBack={() => setStep(0)}
              />
            </motion.div>
          )}

          {step === 2 && (
            <motion.div key="review" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
              <ReviewStep
                classifications={classifications}
                mappings={mappings}
                uploadedFiles={uploadedFiles}
                loading={loading}
                onMappingChange={handleMappingChange}
                onValidate={runValidation}
                onBack={() => setStep(1)}
              />
            </motion.div>
          )}

          {step === 3 && (
            <motion.div key="validation" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
              <ValidationStep
                validation={validation}
                loading={loading}
                onImport={runImport}
                onBack={() => setStep(2)}
              />
            </motion.div>
          )}

          {step === 4 && (
            <motion.div key="import" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
              <ImportCompleteStep results={importResults} onDashboard={() => setLocation("/")} />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </AppLayout>
  );
}

function UploadStep({
  dragActive,
  loading,
  fileInputRef,
  onDrop,
  onDragOver,
  onDragLeave,
  onFileSelect,
  onBrowse,
}: {
  dragActive: boolean;
  loading: boolean;
  fileInputRef: React.RefObject<HTMLInputElement | null>;
  onDrop: (e: React.DragEvent) => void;
  onDragOver: (e: React.DragEvent) => void;
  onDragLeave: () => void;
  onFileSelect: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onBrowse: () => void;
}) {
  return (
    <div className="space-y-6">
      <div
        onDrop={onDrop}
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        className={`relative border-2 border-dashed rounded-xl p-12 text-center transition-all cursor-pointer ${
          dragActive
            ? "border-primary bg-primary/5"
            : "border-card-border hover:border-primary/40 bg-card"
        }`}
        onClick={onBrowse}
      >
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept=".csv,.xlsx,.xls"
          onChange={onFileSelect}
          className="hidden"
        />
        {loading ? (
          <div className="flex flex-col items-center gap-4">
            <Loader2 className="w-12 h-12 text-primary animate-spin" />
            <p className="text-muted-foreground">Parsing files...</p>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-4">
            <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center">
              <Upload className="w-8 h-8 text-primary" />
            </div>
            <div>
              <p className="text-lg font-medium text-foreground">Drop files here or click to browse</p>
              <p className="text-sm text-muted-foreground mt-1">
                Supports CSV, XLSX, and XLS files. Upload multiple files at once.
              </p>
            </div>
            <div className="flex gap-3 mt-2">
              {["Customers", "Shipments", "Invoices", "Line Items"].map((type) => (
                <span key={type} className="px-3 py-1 rounded-full bg-surface text-xs text-muted-foreground border border-card-border">
                  {type}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="bg-card rounded-xl border border-card-border p-6">
        <h3 className="text-sm font-medium text-foreground mb-3">How it works</h3>
        <div className="grid grid-cols-4 gap-4">
          {[
            { icon: Upload, title: "Upload", desc: "Drop your CSV or Excel files" },
            { icon: Brain, title: "AI Classifies", desc: "Engine identifies data types" },
            { icon: FileSpreadsheet, title: "Smart Mapping", desc: "Fields mapped to Dynasties schema" },
            { icon: Database, title: "Import", desc: "Data flows into your workspace" },
          ].map((item) => (
            <div key={item.title} className="flex flex-col items-center text-center gap-2">
              <div className="w-10 h-10 rounded-lg bg-primary/5 flex items-center justify-center">
                <item.icon className="w-5 h-5 text-primary/70" />
              </div>
              <p className="text-xs font-medium text-foreground">{item.title}</p>
              <p className="text-[11px] text-muted-foreground leading-tight">{item.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function AIProcessingStep({
  uploadedFiles,
  loading,
  onProcess,
  onBack,
}: {
  uploadedFiles: UploadedFile[];
  loading: boolean;
  onProcess: () => void;
  onBack: () => void;
}) {
  return (
    <div className="space-y-6">
      <div className="bg-card rounded-xl border border-card-border p-6">
        <h3 className="text-sm font-medium text-foreground mb-4">Files Ready for Processing</h3>
        <div className="space-y-3">
          {uploadedFiles.map((file) => (
            <div
              key={file.fileName}
              className="flex items-center gap-4 px-4 py-3 rounded-lg bg-surface border border-card-border"
            >
              <FileSpreadsheet className="w-5 h-5 text-primary shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground truncate">{file.originalName}</p>
                <p className="text-xs text-muted-foreground">
                  {file.rowCount.toLocaleString()} rows &middot; {file.headers.length} columns
                </p>
              </div>
              <div className="text-xs text-muted-foreground px-2 py-1 rounded bg-card border border-card-border">
                {file.headers.slice(0, 3).join(", ")}
                {file.headers.length > 3 && ` +${file.headers.length - 3}`}
              </div>
            </div>
          ))}
        </div>
      </div>

      {loading && (
        <div className="bg-card rounded-xl border border-primary/20 p-8">
          <div className="flex flex-col items-center gap-4">
            <div className="relative">
              <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center">
                <Brain className="w-8 h-8 text-primary" />
              </div>
              <div className="absolute -top-1 -right-1 w-6 h-6 rounded-full bg-primary flex items-center justify-center">
                <Loader2 className="w-3.5 h-3.5 text-primary-foreground animate-spin" />
              </div>
            </div>
            <div className="text-center">
              <p className="text-sm font-medium text-foreground">AI Engine Processing</p>
              <p className="text-xs text-muted-foreground mt-1">
                Classifying file types and mapping fields to your schema...
              </p>
            </div>
            <div className="w-48 h-1 rounded-full bg-surface overflow-hidden">
              <motion.div
                className="h-full bg-primary rounded-full"
                initial={{ width: "0%" }}
                animate={{ width: "100%" }}
                transition={{ duration: 8, ease: "linear" }}
              />
            </div>
          </div>
        </div>
      )}

      <div className="flex justify-between">
        <button
          onClick={onBack}
          className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Back
        </button>
        <button
          onClick={onProcess}
          disabled={loading}
          className="flex items-center gap-2 px-6 py-2.5 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 disabled:opacity-50 transition-all"
        >
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}
          Run AI Classification & Mapping
        </button>
      </div>
    </div>
  );
}

function ReviewStep({
  classifications,
  mappings,
  uploadedFiles,
  loading,
  onMappingChange,
  onValidate,
  onBack,
}: {
  classifications: ClassificationResult[];
  mappings: MappingResult[];
  uploadedFiles: UploadedFile[];
  loading: boolean;
  onMappingChange: (fileName: string, sourceField: string, newTarget: string) => void;
  onValidate: () => void;
  onBack: () => void;
}) {
  const [expandedFile, setExpandedFile] = useState<string | null>(mappings[0]?.fileName || null);

  const totalMapped = mappings.reduce((s, m) => s + m.fieldMappings.filter((f) => f.targetField).length, 0);
  const totalFields = mappings.reduce((s, m) => s + m.fieldMappings.length, 0);
  const lowConfidence = mappings.reduce(
    (s, m) => s + m.fieldMappings.filter((f) => f.targetField && f.confidence < 0.8 && !f.userConfirmed).length,
    0,
  );

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-card rounded-xl border border-card-border p-4">
          <p className="text-xs text-muted-foreground mb-1">Files Classified</p>
          <p className="text-2xl font-semibold text-foreground">{classifications.length}</p>
        </div>
        <div className="bg-card rounded-xl border border-card-border p-4">
          <p className="text-xs text-muted-foreground mb-1">Fields Mapped</p>
          <p className="text-2xl font-semibold text-foreground">
            {totalMapped}<span className="text-sm text-muted-foreground">/{totalFields}</span>
          </p>
        </div>
        <div className="bg-card rounded-xl border border-card-border p-4">
          <p className="text-xs text-muted-foreground mb-1">Needs Review</p>
          <p className={`text-2xl font-semibold ${lowConfidence > 0 ? "text-amber-400" : "text-emerald-400"}`}>
            {lowConfidence}
          </p>
        </div>
      </div>

      <div className="space-y-3">
        {mappings.map((mapping) => {
          const classification = classifications.find((c) => c.fileName === mapping.fileName);
          const meta = FILE_TYPE_META[mapping.fileType] || FILE_TYPE_META.unknown;
          const Icon = meta.icon;
          const isExpanded = expandedFile === mapping.fileName;
          const file = uploadedFiles.find((f) => f.fileName === mapping.fileName);
          const targets = TARGET_FIELDS[mapping.fileType] || [];

          return (
            <div key={mapping.fileName} className="bg-card rounded-xl border border-card-border overflow-hidden">
              <button
                onClick={() => setExpandedFile(isExpanded ? null : mapping.fileName)}
                className="w-full flex items-center gap-4 px-5 py-4 hover:bg-surface/50 transition-colors"
              >
                <div className={`w-9 h-9 rounded-lg bg-surface flex items-center justify-center`}>
                  <Icon className={`w-5 h-5 ${meta.color}`} />
                </div>
                <div className="flex-1 text-left min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">{mapping.fileName}</p>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className={`text-xs ${meta.color}`}>{meta.label}</span>
                    {classification && (
                      <ConfidenceBadge confidence={classification.confidence} />
                    )}
                    <span className="text-xs text-muted-foreground">
                      {file?.rowCount.toLocaleString()} rows
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-xs text-muted-foreground">
                    {mapping.autoMappedPercent}% auto-mapped
                  </span>
                  {isExpanded ? (
                    <ChevronUp className="w-4 h-4 text-muted-foreground" />
                  ) : (
                    <ChevronDown className="w-4 h-4 text-muted-foreground" />
                  )}
                </div>
              </button>

              {isExpanded && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  transition={{ duration: 0.2 }}
                  className="border-t border-card-border"
                >
                  <div className="p-4">
                    <div className="grid grid-cols-[1fr_auto_1fr_auto] gap-2 mb-3 px-2 text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
                      <span>Source Column</span>
                      <span />
                      <span>Maps To</span>
                      <span>Confidence</span>
                    </div>
                    <div className="space-y-1.5">
                      {mapping.fieldMappings.map((fm) => (
                        <div
                          key={fm.sourceField}
                          className={`grid grid-cols-[1fr_auto_1fr_auto] gap-2 items-center px-2 py-2 rounded-lg ${
                            !fm.targetField
                              ? "bg-red-500/5 border border-red-500/10"
                              : fm.confidence < 0.8 && !fm.userConfirmed
                                ? "bg-amber-500/5 border border-amber-500/10"
                                : "bg-surface border border-card-border"
                          }`}
                        >
                          <span className="text-sm text-foreground font-mono truncate">{fm.sourceField}</span>
                          <ArrowRight className="w-3.5 h-3.5 text-muted-foreground" />
                          <select
                            value={fm.targetField}
                            onChange={(e) => onMappingChange(mapping.fileName, fm.sourceField, e.target.value)}
                            className="bg-background border border-card-border rounded px-2 py-1 text-sm text-foreground w-full"
                          >
                            <option value="">-- skip --</option>
                            {targets.map((t) => (
                              <option key={t} value={t}>{t}</option>
                            ))}
                          </select>
                          <div className="flex items-center gap-1.5 min-w-[70px] justify-end">
                            {fm.userConfirmed ? (
                              <span className="flex items-center gap-1 text-xs text-emerald-400">
                                <Check className="w-3 h-3" /> Confirmed
                              </span>
                            ) : (
                              <ConfidenceBadge confidence={fm.confidence} />
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                    {mapping.unmappedFields.length > 0 && (
                      <div className="mt-3 px-2">
                        <p className="text-xs text-muted-foreground">
                          Unmapped columns: {mapping.unmappedFields.join(", ")}
                        </p>
                      </div>
                    )}
                  </div>
                </motion.div>
              )}
            </div>
          );
        })}
      </div>

      <div className="flex justify-between">
        <button
          onClick={onBack}
          className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Re-run AI
        </button>
        <button
          onClick={onValidate}
          disabled={loading}
          className="flex items-center gap-2 px-6 py-2.5 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 disabled:opacity-50 transition-all"
        >
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <ShieldCheck className="w-4 h-4" />}
          Validate & Preview
        </button>
      </div>
    </div>
  );
}

function ValidationStep({
  validation,
  loading,
  onImport,
  onBack,
}: {
  validation: ValidationSummary | null;
  loading: boolean;
  onImport: () => void;
  onBack: () => void;
}) {
  if (!validation) return null;

  const hasIssues = validation.missingRequiredFields.length > 0 || validation.duplicateWarnings.length > 0;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-4 gap-4">
        {[
          { label: "Customers", value: validation.totalCustomers, icon: Users, color: "text-blue-400" },
          { label: "Shipments", value: validation.totalShipments, icon: Ship, color: "text-teal-400" },
          { label: "Invoices", value: validation.totalInvoices, icon: FileText, color: "text-amber-400" },
          {
            label: "Revenue",
            value: `$${validation.totalInvoiceValue.toLocaleString()}`,
            icon: DollarSign,
            color: "text-emerald-400",
          },
        ].map((item) => (
          <div key={item.label} className="bg-card rounded-xl border border-card-border p-4">
            <div className="flex items-center gap-2 mb-2">
              <item.icon className={`w-4 h-4 ${item.color}`} />
              <span className="text-xs text-muted-foreground">{item.label}</span>
            </div>
            <p className="text-2xl font-semibold text-foreground">{item.value}</p>
          </div>
        ))}
      </div>

      <div className="bg-card rounded-xl border border-card-border p-6">
        <h3 className="text-sm font-medium text-foreground mb-4 flex items-center gap-2">
          <Link2 className="w-4 h-4 text-primary" />
          Relationship Links
        </h3>
        <div className="space-y-3">
          {validation.relationshipLinks.map((rel) => (
            <div key={`${rel.from}-${rel.to}`} className="flex items-center gap-4">
              <span className="text-sm text-foreground w-40 capitalize">{rel.from} → {rel.to}</span>
              <div className="flex-1 h-2 rounded-full bg-surface overflow-hidden">
                <div
                  className="h-full bg-primary rounded-full"
                  style={{ width: `${((rel.linked / Math.max(rel.linked + rel.unlinked, 1)) * 100)}%` }}
                />
              </div>
              <span className="text-xs text-muted-foreground w-20 text-right">
                {rel.linked}/{rel.linked + rel.unlinked} linked
              </span>
            </div>
          ))}
        </div>
      </div>

      {hasIssues && (
        <div className="bg-card rounded-xl border border-amber-500/20 p-6">
          <h3 className="text-sm font-medium text-amber-400 mb-3 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4" />
            Warnings
          </h3>
          <div className="space-y-2">
            {validation.missingRequiredFields.map((item) => (
              <div key={`${item.entity}-${item.field}`} className="flex items-center gap-3 text-sm">
                <span className="text-amber-400">Missing:</span>
                <span className="text-foreground capitalize">{item.entity}.{item.field}</span>
                <span className="text-muted-foreground">({item.count} records)</span>
              </div>
            ))}
            {validation.duplicateWarnings.map((item, idx) => (
              <div key={idx} className="flex items-center gap-3 text-sm">
                <span className="text-amber-400">Duplicate:</span>
                <span className="text-foreground capitalize">{item.entity}.{item.field}</span>
                <span className="text-muted-foreground">({item.count} occurrences)</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="flex justify-between">
        <button
          onClick={onBack}
          className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Review Mappings
        </button>
        <button
          onClick={onImport}
          disabled={loading}
          className="flex items-center gap-2 px-6 py-2.5 rounded-lg bg-emerald-600 text-white text-sm font-medium hover:bg-emerald-500 disabled:opacity-50 transition-all"
        >
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Database className="w-4 h-4" />}
          Import to Dynasties
        </button>
      </div>
    </div>
  );
}

function ImportCompleteStep({
  results,
  onDashboard,
}: {
  results: ImportResults | null;
  onDashboard: () => void;
}) {
  if (!results) return null;

  return (
    <div className="space-y-6">
      <div className="bg-card rounded-xl border border-emerald-500/20 p-8 text-center">
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: "spring", stiffness: 200, damping: 15 }}
          className="w-20 h-20 rounded-2xl bg-emerald-500/10 flex items-center justify-center mx-auto mb-4"
        >
          <CheckCircle2 className="w-10 h-10 text-emerald-400" />
        </motion.div>
        <h2 className="text-xl font-semibold text-foreground mb-2">Migration Complete</h2>
        <p className="text-sm text-muted-foreground">Your data has been successfully imported into Dynasties</p>
      </div>

      <div className="grid grid-cols-4 gap-4">
        {[
          { label: "Customers", value: results.customersCreated, icon: Users, color: "text-blue-400" },
          { label: "Shipments", value: results.shipmentsCreated, icon: Ship, color: "text-teal-400" },
          { label: "Invoices", value: results.invoicesCreated, icon: FileText, color: "text-amber-400" },
          {
            label: "Revenue",
            value: `$${results.totalRevenue.toLocaleString()}`,
            icon: DollarSign,
            color: "text-emerald-400",
          },
        ].map((item) => (
          <motion.div
            key={item.label}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-card rounded-xl border border-card-border p-4"
          >
            <div className="flex items-center gap-2 mb-2">
              <item.icon className={`w-4 h-4 ${item.color}`} />
              <span className="text-xs text-muted-foreground">{item.label}</span>
            </div>
            <p className="text-2xl font-semibold text-foreground">{item.value}</p>
          </motion.div>
        ))}
      </div>

      {results.lineItemsCreated > 0 && (
        <div className="bg-card rounded-xl border border-card-border px-5 py-3">
          <span className="text-sm text-muted-foreground">
            Also imported: <span className="text-foreground font-medium">{results.lineItemsCreated}</span> invoice line items
          </span>
        </div>
      )}

      {results.errors.length > 0 && (
        <div className="bg-card rounded-xl border border-amber-500/20 p-5">
          <h4 className="text-sm font-medium text-amber-400 mb-2 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4" />
            {results.errors.length} warnings during import
          </h4>
          <div className="max-h-32 overflow-y-auto space-y-1">
            {results.errors.map((err, i) => (
              <p key={i} className="text-xs text-muted-foreground">{err}</p>
            ))}
          </div>
        </div>
      )}

      <div className="flex justify-center">
        <button
          onClick={onDashboard}
          className="flex items-center gap-2 px-8 py-3 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-all"
        >
          Go to Command Center
          <ArrowRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}

function ConfidenceBadge({ confidence }: { confidence: number }) {
  const pct = Math.round(confidence * 100);
  const color =
    pct >= 90 ? "text-emerald-400 bg-emerald-500/10" :
    pct >= 70 ? "text-amber-400 bg-amber-500/10" :
    "text-red-400 bg-red-500/10";

  return (
    <span className={`text-[11px] px-1.5 py-0.5 rounded ${color}`}>
      {pct}%
    </span>
  );
}
