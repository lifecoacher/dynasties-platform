import { useRoute, Link } from "wouter";
import {
  useGetShipment,
  useGetShipmentCompliance,
  useGetShipmentRisk,
  useGetShipmentInsurance,
  useGetShipmentEvents,
  useGetShipmentDocuments,
} from "@workspace/api-client-react";
import { ArrowLeft, Loader2, FileText, Brain, Users, Shield, TrendingUp, Umbrella, ChevronDown, CheckCircle2, AlertTriangle, Info } from "lucide-react";
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { normalizeRiskScore, riskColor, riskLabel, formatCurrency, humanizeCoverageType, humanizeDocType } from "@/lib/format";
import { AppLayout } from "@/components/layout/AppLayout";

function TraceLayer({ icon, title, color, children, defaultOpen = false }: {
  icon: React.ReactNode;
  title: string;
  color: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="rounded-xl border border-card-border bg-card overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className={`w-full flex items-center gap-3 p-4 text-left hover:bg-primary/5 transition-colors ${open ? "border-b border-card-border" : ""}`}
      >
        <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${color}`}>{icon}</div>
        <span className="text-[14px] font-semibold flex-grow">{title}</span>
        <ChevronDown className={`w-4 h-4 text-muted-foreground transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="p-4">{children}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function TraceField({ label, value, mono = false }: { label: string; value: any; mono?: boolean }) {
  return (
    <div className="flex justify-between items-center py-1.5 border-b border-card-border/30 last:border-b-0">
      <span className="text-[12px] text-muted-foreground">{label}</span>
      <span className={`text-[12px] font-medium text-foreground ${mono ? "font-mono" : ""}`}>{value ?? "N/A"}</span>
    </div>
  );
}

function ConfidenceDot({ value }: { value: number | undefined | null }) {
  if (value == null) return <span className="text-[10px] text-muted-foreground">—</span>;
  const pct = (Number(value) * 100).toFixed(0);
  const color = Number(value) >= 0.8 ? "bg-primary" : Number(value) >= 0.5 ? "bg-[#D4A24C]" : "bg-[#E05252]";
  return (
    <span className="inline-flex items-center gap-1">
      <span className={`w-1.5 h-1.5 rounded-full ${color}`} />
      <span className="text-[10px] font-mono">{pct}%</span>
    </span>
  );
}

function TraceFieldWithConfidence({ label, value, confidence, mono = false }: {
  label: string; value: any; confidence?: number | null; mono?: boolean;
}) {
  return (
    <div className="flex justify-between items-center py-1.5 border-b border-card-border/30 last:border-b-0">
      <span className="text-[12px] text-muted-foreground">{label}</span>
      <div className="flex items-center gap-2">
        <span className={`text-[12px] font-medium text-foreground ${mono ? "font-mono" : ""}`}>{value ?? "N/A"}</span>
        <ConfidenceDot value={confidence} />
      </div>
    </div>
  );
}

export default function DecisionTrace() {
  const [, params] = useRoute("/shipments/:id/trace");
  const id = params?.id || "";

  const { data: shipmentRes, isLoading } = useGetShipment(id);
  const { data: complianceRes } = useGetShipmentCompliance(id);
  const { data: riskRes } = useGetShipmentRisk(id);
  const { data: insuranceRes } = useGetShipmentInsurance(id);
  const { data: eventsRes } = useGetShipmentEvents(id);
  const { data: docsRes } = useGetShipmentDocuments(id);

  const shipment = shipmentRes?.data as any;
  const compliance = complianceRes?.data as any;
  const risk = riskRes?.data as any;
  const insurance = insuranceRes?.data as any;
  const events = (eventsRes?.data || []) as any[];
  const docs = (docsRes?.data || []) as any[];

  if (isLoading || !shipment) {
    return (
      <AppLayout hideRightPanel>
        <div className="flex items-center justify-center h-full">
          <Loader2 className="w-6 h-6 animate-spin text-primary" />
        </div>
      </AppLayout>
    );
  }

  const extractionConfidence = shipment.extractionConfidence || {};
  const confidenceKeys = Object.keys(extractionConfidence);
  const avgConfidence = confidenceKeys.length > 0
    ? confidenceKeys.reduce((sum: number, k: string) => sum + Number(extractionConfidence[k] || 0), 0) / confidenceKeys.length
    : null;
  const riskScore = normalizeRiskScore(risk?.compositeScore);

  return (
    <AppLayout hideRightPanel>
      <div className="px-6 py-6 max-w-4xl mx-auto">
        <div className="flex items-center gap-3 mb-6">
          <Link href={`/shipments/${id}`} className="p-1.5 rounded-lg hover:bg-card transition-colors text-muted-foreground hover:text-foreground">
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <div className="flex-grow">
            <h1 className="text-xl font-semibold text-foreground flex items-center gap-2">
              <Brain className="w-5 h-5 text-primary" />
              Decision Trace
            </h1>
            <p className="text-[12px] text-muted-foreground mt-0.5">
              Full transparency for <span className="text-primary font-semibold font-mono">{shipment.reference}</span>
            </p>
          </div>
          <Link
            href={`/shipments/${id}`}
            className="px-3 py-2 rounded-lg bg-card border border-card-border text-[12px] font-medium text-foreground hover:bg-primary/10 hover:text-primary transition-colors"
          >
            View Shipment
          </Link>
        </div>

        <div className="space-y-3">
          <TraceLayer icon={<FileText className="w-4 h-4 text-primary" />} title="Document Layer" color="bg-primary/10" defaultOpen={true}>
            <div className="space-y-4">
              <div>
                <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider mb-2">Source Email</p>
                <div className="bg-muted/20 rounded-lg p-3 space-y-1">
                  <TraceField label="Subject" value={shipment.metadata?.emailSubject || events.find((e: any) => e.eventType === "EMAIL_RECEIVED")?.metadata?.subject || "Shipping document ingestion"} />
                  <TraceField label="From" value={shipment.metadata?.emailFrom || "Via pipeline ingestion"} />
                  <TraceField label="Received" value={new Date(shipment.createdAt).toLocaleString()} />
                </div>
              </div>
              {docs.length > 0 && (
                <div>
                  <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider mb-2">Parsed Attachments</p>
                  <div className="space-y-1.5">
                    {docs.map((doc: any) => (
                      <div key={doc.id} className="bg-muted/20 rounded-lg p-3 flex items-center justify-between">
                        <div>
                          <p className="text-[12px] font-medium">{doc.fileName}</p>
                          <p className="text-[11px] text-muted-foreground">{humanizeDocType(doc.documentType)}</p>
                        </div>
                        <span className="text-[10px] text-muted-foreground font-mono">{doc.id.slice(0, 12)}...</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </TraceLayer>

          <TraceLayer icon={<Brain className="w-4 h-4 text-primary" />} title="Extraction Layer" color="bg-primary/10" defaultOpen={true}>
            <div className="space-y-3">
              {avgConfidence != null && (
                <div className="flex items-center gap-2 text-[11px] mb-2">
                  <Info className="w-3 h-3 text-muted-foreground" />
                  <span className="text-muted-foreground">Avg Confidence:</span>
                  <ConfidenceDot value={avgConfidence} />
                </div>
              )}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="bg-muted/20 rounded-lg p-3 space-y-1">
                  <p className="text-[11px] font-medium text-muted-foreground mb-1.5">Shipment Details</p>
                  <TraceFieldWithConfidence label="B/L Number" value={shipment.blNumber} confidence={extractionConfidence.blNumber} />
                  <TraceFieldWithConfidence label="Booking Number" value={shipment.bookingNumber} confidence={extractionConfidence.bookingNumber} />
                  <TraceFieldWithConfidence label="Commodity" value={shipment.commodity} confidence={extractionConfidence.commodity} />
                  <TraceFieldWithConfidence label="HS Code" value={shipment.hsCode} confidence={extractionConfidence.hsCode} mono />
                  <TraceFieldWithConfidence label="Incoterms" value={shipment.incoterms} confidence={extractionConfidence.incoterms} />
                </div>
                <div className="bg-muted/20 rounded-lg p-3 space-y-1">
                  <p className="text-[11px] font-medium text-muted-foreground mb-1.5">Routing & Cargo</p>
                  <TraceFieldWithConfidence label="Port of Loading" value={shipment.portOfLoading} confidence={extractionConfidence.portOfLoading} />
                  <TraceFieldWithConfidence label="Port of Discharge" value={shipment.portOfDischarge} confidence={extractionConfidence.portOfDischarge} />
                  <TraceFieldWithConfidence label="Vessel" value={shipment.vessel} confidence={extractionConfidence.vessel} />
                  <TraceFieldWithConfidence label="Gross Weight" value={shipment.grossWeight ? `${Number(shipment.grossWeight).toLocaleString()} ${shipment.weightUnit || "KG"}` : null} confidence={extractionConfidence.grossWeight} />
                  <TraceFieldWithConfidence label="Volume" value={shipment.volume ? `${Number(shipment.volume).toLocaleString()} ${shipment.volumeUnit || "CBM"}` : null} confidence={extractionConfidence.volume} />
                </div>
              </div>
            </div>
          </TraceLayer>

          <TraceLayer icon={<Users className="w-4 h-4 text-primary/70" />} title="Entity Resolution" color="bg-primary/10">
            <div className="space-y-3">
              {[
                { role: "Shipper", entity: shipment.shipper },
                { role: "Consignee", entity: shipment.consignee },
                { role: "Notify Party", entity: shipment.notifyParty },
                { role: "Carrier", entity: shipment.carrier },
              ]
                .filter(({ entity }) => entity)
                .map(({ role, entity }) => (
                  <div key={role} className="bg-muted/20 rounded-lg p-3">
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">{role}</p>
                      <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold ${entity.status === "VERIFIED" ? "bg-primary/15 text-primary" : "bg-primary/15 text-primary"}`}>
                        {entity.status === "VERIFIED" ? "Verified" : "Auto-Resolved"}
                      </span>
                    </div>
                    <div className="space-y-1">
                      <TraceField label="Name" value={entity.name} />
                      {entity.address && <TraceField label="Address" value={entity.address} />}
                      {entity.country && <TraceField label="Country" value={entity.country} />}
                    </div>
                  </div>
                ))}
            </div>
          </TraceLayer>

          <TraceLayer icon={<Shield className="w-4 h-4 text-primary" />} title="Compliance Screening" color="bg-primary/10">
            {compliance ? (
              <div className="space-y-3">
                <div className={`flex items-center gap-1.5 text-[14px] font-semibold ${compliance.status === "CLEAR" ? "text-primary" : "text-[#E05252]"}`}>
                  {compliance.status === "CLEAR" ? <CheckCircle2 className="w-4 h-4" /> : <AlertTriangle className="w-4 h-4" />}
                  {compliance.status}
                </div>
                <div className="bg-muted/20 rounded-lg p-3 space-y-1">
                  <TraceField label="Parties Screened" value={compliance.screenedParties ?? compliance.partiesScreened ?? "3"} />
                  <TraceField label="Total Matches" value={compliance.matchCount ?? 0} />
                  <TraceField label="Lists Checked" value={(compliance.listsChecked || ["OFAC SDN", "EU Sanctions", "UN Consolidated"]).join(", ")} />
                </div>
                {compliance.explanation && (
                  <div className="bg-muted/20 rounded-lg p-3 text-[12px] text-muted-foreground whitespace-pre-line">{compliance.explanation}</div>
                )}
              </div>
            ) : (
              <p className="text-[12px] text-muted-foreground italic">Not yet completed.</p>
            )}
          </TraceLayer>

          <TraceLayer icon={<TrendingUp className="w-4 h-4 text-[#D4A24C]" />} title="Risk Scoring" color="bg-[#D4A24C]/10">
            {risk ? (
              <div className="space-y-3">
                <div className="flex items-center gap-6">
                  <div>
                    <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-0.5">Score</p>
                    <p className={`text-3xl font-semibold tabular-nums ${riskColor(riskScore)}`}>{riskScore ?? 0}</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-0.5">Level</p>
                    <p className={`text-[14px] font-semibold ${riskColor(riskScore)}`}>{riskLabel(riskScore)}</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-0.5">Action</p>
                    <p className="text-[14px] font-semibold text-foreground">{risk.recommendedAction?.replace(/_/g, " ")}</p>
                  </div>
                </div>
                {risk.subScores && (
                  <div className="space-y-1.5">
                    {Object.entries(risk.subScores).map(([key, val]: [string, any]) => {
                      const normalized = Number(val) <= 1 ? Number(val) * 100 : Number(val);
                      return (
                        <div key={key} className="bg-muted/20 rounded-lg p-2.5 flex items-center justify-between text-[12px]">
                          <span className="font-medium">{key.replace(/([A-Z])/g, " $1").trim()}</span>
                          <div className="flex items-center gap-2">
                            <div className="w-20 h-1.5 bg-background rounded-full overflow-hidden">
                              <div className={`h-full rounded-full ${normalized < 30 ? "bg-primary" : normalized < 60 ? "bg-[#D4A24C]" : "bg-[#E05252]"}`} style={{ width: `${Math.min(normalized, 100)}%` }} />
                            </div>
                            <span className="font-mono w-6 text-right text-[11px]">{Math.round(normalized)}</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
                {risk.agentExplanation && (
                  <div className="bg-muted/20 rounded-lg p-3 text-[12px] text-muted-foreground whitespace-pre-line">{risk.agentExplanation}</div>
                )}
              </div>
            ) : (
              <p className="text-[12px] text-muted-foreground italic">Not yet completed.</p>
            )}
          </TraceLayer>

          <TraceLayer icon={<Umbrella className="w-4 h-4 text-primary" />} title="Insurance Quote" color="bg-primary/10">
            {insurance ? (
              <div className="space-y-3">
                <div className="grid grid-cols-3 gap-3">
                  <div className="bg-muted/20 rounded-lg p-3 text-center">
                    <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-0.5">Coverage</p>
                    <p className="text-[13px] font-semibold text-primary">{humanizeCoverageType(insurance.coverageType)}</p>
                  </div>
                  <div className="bg-muted/20 rounded-lg p-3 text-center">
                    <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-0.5">Cargo Value</p>
                    <p className="text-[13px] font-semibold">{formatCurrency(insurance.estimatedInsuredValue || insurance.cargoValue, insurance.currency)}</p>
                  </div>
                  <div className="bg-muted/20 rounded-lg p-3 text-center">
                    <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-0.5">Premium</p>
                    <p className="text-[13px] font-semibold text-primary">{formatCurrency(insurance.estimatedPremium, insurance.currency)}</p>
                  </div>
                </div>
                {insurance.coverageRationale && (
                  <div className="bg-muted/20 rounded-lg p-3 text-[12px] text-muted-foreground whitespace-pre-line">{insurance.coverageRationale}</div>
                )}
              </div>
            ) : (
              <p className="text-[12px] text-muted-foreground italic">Not yet generated.</p>
            )}
          </TraceLayer>
        </div>
      </div>
    </AppLayout>
  );
}
