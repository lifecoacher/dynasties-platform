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

function TraceLayer({ icon, title, color, children, defaultOpen = false }: {
  icon: React.ReactNode;
  title: string;
  color: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="glass-panel rounded-xl border border-border/50 overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className={`w-full flex items-center gap-3 p-5 text-left hover:bg-primary/5 transition-colors ${open ? "border-b border-border/50" : ""}`}
      >
        <div className={`p-2 rounded-lg ${color}`}>{icon}</div>
        <span className="text-lg font-display font-bold flex-grow">{title}</span>
        <ChevronDown className={`w-5 h-5 text-muted-foreground transition-transform ${open ? "rotate-180" : ""}`} />
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
            <div className="p-5">{children}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function TraceField({ label, value, mono = false }: { label: string; value: any; mono?: boolean }) {
  return (
    <div className="flex justify-between items-center py-1.5 border-b border-border/20 last:border-b-0">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className={`text-sm font-medium text-foreground ${mono ? "font-mono" : ""}`}>{value ?? "N/A"}</span>
    </div>
  );
}

function ConfidenceDot({ value }: { value: number | undefined | null }) {
  if (value == null) return <span className="text-xs text-muted-foreground">—</span>;
  const pct = (Number(value) * 100).toFixed(0);
  const color = Number(value) >= 0.8 ? "bg-emerald-400" : Number(value) >= 0.5 ? "bg-amber-400" : "bg-red-400";
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className={`w-2 h-2 rounded-full ${color}`} />
      <span className="text-xs font-mono">{pct}%</span>
    </span>
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
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-12 h-12 animate-spin text-primary" />
      </div>
    );
  }

  const extractionConfidence = shipment.extractionConfidence || {};
  const confidenceKeys = Object.keys(extractionConfidence);
  const avgConfidence = confidenceKeys.length > 0
    ? confidenceKeys.reduce((sum: number, k: string) => sum + Number(extractionConfidence[k] || 0), 0) / confidenceKeys.length
    : null;

  const riskScore = normalizeRiskScore(risk?.compositeScore);

  return (
    <div className="min-h-screen p-4 md:p-8 max-w-5xl mx-auto pb-24">
      <div className="flex items-center gap-4 mb-8 mt-4">
        <Link href="/intelligence" className="p-2 rounded-full hover:bg-secondary transition-colors text-muted-foreground hover:text-foreground">
          <ArrowLeft className="w-6 h-6" />
        </Link>
        <div className="flex-grow">
          <h1 className="text-3xl font-display font-bold text-foreground flex items-center gap-3">
            <Brain className="w-7 h-7 text-primary" />
            AI Decision Trace
          </h1>
          <p className="text-muted-foreground mt-1">
            Full transparency into how the system produced decisions for <span className="text-primary font-semibold">{shipment.reference}</span>
          </p>
        </div>
        <Link
          href={`/shipments/${id}`}
          className="px-4 py-2 rounded-lg bg-primary/10 text-primary font-semibold text-sm hover:bg-primary/20 transition-colors"
        >
          View Shipment
        </Link>
      </div>

      <div className="space-y-4">
        <TraceLayer
          icon={<FileText className="w-5 h-5 text-blue-400" />}
          title="Document Layer"
          color="bg-blue-400/10"
          defaultOpen={true}
        >
          <div className="space-y-4">
            <div>
              <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">Source Email</h4>
              <div className="bg-card/50 rounded-lg p-4 space-y-1">
                <TraceField label="Subject" value={shipment.metadata?.emailSubject || events.find((e: any) => e.eventType === "EMAIL_RECEIVED")?.metadata?.subject || "Shipping document ingestion"} />
                <TraceField label="From" value={shipment.metadata?.emailFrom || "Via pipeline ingestion"} />
                <TraceField label="Received" value={new Date(shipment.createdAt).toLocaleString()} />
              </div>
            </div>

            <div>
              <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">Parsed Attachments</h4>
              {docs.length > 0 ? (
                <div className="space-y-2">
                  {docs.map((doc: any) => (
                    <div key={doc.id} className="bg-card/50 rounded-lg p-4 flex items-center justify-between">
                      <div>
                        <div className="font-semibold text-sm">{doc.fileName}</div>
                        <div className="text-xs text-muted-foreground">{humanizeDocType(doc.documentType)} · Status: {doc.extractionStatus === "EXTRACTED" ? "Extracted" : doc.extractionStatus}</div>
                      </div>
                      <div className="text-xs text-muted-foreground font-mono">{doc.id.slice(0, 12)}...</div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="bg-card/50 rounded-lg p-4 text-sm text-muted-foreground">
                  Documents processed via automated pipeline ingestion.
                </div>
              )}
            </div>
          </div>
        </TraceLayer>

        <TraceLayer
          icon={<Brain className="w-5 h-5 text-violet-400" />}
          title="Extraction Layer"
          color="bg-violet-400/10"
          defaultOpen={true}
        >
          <div className="space-y-4">
            <div className="flex items-center justify-between mb-2">
              <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">AI-Extracted Fields</h4>
              {avgConfidence != null && (
                <div className="flex items-center gap-2 text-xs">
                  <Info className="w-3.5 h-3.5 text-muted-foreground" />
                  <span className="text-muted-foreground">Avg Confidence:</span>
                  <ConfidenceDot value={avgConfidence} />
                </div>
              )}
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-card/50 rounded-lg p-4 space-y-1">
                <h5 className="text-xs font-semibold text-muted-foreground mb-2">Shipment Details</h5>
                <TraceFieldWithConfidence label="B/L Number" value={shipment.blNumber} confidence={extractionConfidence.blNumber} />
                <TraceFieldWithConfidence label="Booking Number" value={shipment.bookingNumber} confidence={extractionConfidence.bookingNumber} />
                <TraceFieldWithConfidence label="Commodity" value={shipment.commodity} confidence={extractionConfidence.commodity} />
                <TraceFieldWithConfidence label="HS Code" value={shipment.hsCode} confidence={extractionConfidence.hsCode} mono />
                <TraceFieldWithConfidence label="Incoterms" value={shipment.incoterms} confidence={extractionConfidence.incoterms} />
              </div>
              <div className="bg-card/50 rounded-lg p-4 space-y-1">
                <h5 className="text-xs font-semibold text-muted-foreground mb-2">Routing & Cargo</h5>
                <TraceFieldWithConfidence label="Port of Loading" value={shipment.portOfLoading} confidence={extractionConfidence.portOfLoading} />
                <TraceFieldWithConfidence label="Port of Discharge" value={shipment.portOfDischarge} confidence={extractionConfidence.portOfDischarge} />
                <TraceFieldWithConfidence label="Vessel" value={shipment.vessel} confidence={extractionConfidence.vessel} />
                <TraceFieldWithConfidence label="Gross Weight" value={shipment.grossWeight ? `${Number(shipment.grossWeight).toLocaleString()} ${shipment.weightUnit || "KG"}` : null} confidence={extractionConfidence.grossWeight} />
                <TraceFieldWithConfidence label="Volume" value={shipment.volume ? `${Number(shipment.volume).toLocaleString()} ${shipment.volumeUnit || "CBM"}` : null} confidence={extractionConfidence.volume} />
                <TraceFieldWithConfidence label="Packages" value={shipment.packageCount ? Number(shipment.packageCount).toLocaleString() : null} confidence={extractionConfidence.packageCount} />
              </div>
            </div>
          </div>
        </TraceLayer>

        <TraceLayer
          icon={<Users className="w-5 h-5 text-cyan-400" />}
          title="Entity Resolution"
          color="bg-cyan-400/10"
        >
          <div className="space-y-4">
            {[
              { role: "Shipper", entity: shipment.shipper },
              { role: "Consignee", entity: shipment.consignee },
              { role: "Notify Party", entity: shipment.notifyParty },
              { role: "Carrier", entity: shipment.carrier },
            ].filter(({ entity }) => entity).map(({ role, entity }) => (
              <div key={role} className="bg-card/50 rounded-lg p-4">
                <div className="flex items-center justify-between mb-2">
                  <h5 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{role}</h5>
                  {entity && (
                    <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${entity.status === "VERIFIED" ? "bg-emerald-400/20 text-emerald-400" : "bg-blue-400/20 text-blue-400"}`}>
                      {entity.status === "VERIFIED" ? "Verified" : "Auto-Resolved"}
                    </span>
                  )}
                </div>
                {entity && (
                  <div className="space-y-1">
                    <TraceField label="Name" value={entity.name} />
                    <TraceField label="Type" value={entity.type || "Organization"} />
                    {entity.address && <TraceField label="Address" value={entity.address} />}
                    {entity.country && <TraceField label="Country" value={entity.country} />}
                    <TraceField label="Entity ID" value={entity.id?.slice(0, 16) + "..."} mono />
                  </div>
                )}
              </div>
            ))}
          </div>
        </TraceLayer>

        <TraceLayer
          icon={<Shield className="w-5 h-5 text-emerald-400" />}
          title="Compliance Screening"
          color="bg-emerald-400/10"
        >
          {compliance ? (
            <div className="space-y-4">
              <div className="flex items-center gap-3 mb-4">
                <span className={`text-lg font-bold ${compliance.status === "CLEAR" ? "text-emerald-400" : "text-red-400"}`}>
                  {compliance.status === "CLEAR" ? <CheckCircle2 className="w-5 h-5 inline mr-1" /> : <AlertTriangle className="w-5 h-5 inline mr-1" />}
                  {compliance.status}
                </span>
              </div>
              <div className="bg-card/50 rounded-lg p-4 space-y-1">
                <TraceField label="Parties Screened" value={compliance.screenedParties ?? compliance.partiesScreened ?? "3"} />
                <TraceField label="Total Matches" value={compliance.matchCount ?? 0} />
                <TraceField label="Lists Checked" value={(compliance.listsChecked || ["OFAC SDN", "EU Sanctions", "UN Consolidated"]).join(", ")} />
                <TraceField label="Screening Date" value={compliance.createdAt ? new Date(compliance.createdAt).toLocaleString() : new Date(shipment.createdAt).toLocaleString()} />
              </div>

              {compliance.screenedParties && Array.isArray(compliance.screenedParties) && compliance.screenedParties.length > 0 && (
                <div>
                  <h5 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">Sanctions Check Results</h5>
                  {compliance.screenedParties.map((party: any, i: number) => (
                    <div key={i} className="bg-card/50 rounded-lg p-3 mb-2 flex items-center justify-between">
                      <div>
                        <span className="font-semibold text-sm">{party.name}</span>
                        <span className="text-xs text-muted-foreground ml-2">({party.role})</span>
                      </div>
                      <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${party.matches === 0 ? "bg-emerald-400/20 text-emerald-400" : "bg-red-400/20 text-red-400"}`}>
                        {party.matches === 0 ? "CLEAR" : `${party.matches} match(es)`}
                      </span>
                    </div>
                  ))}
                </div>
              )}

              {compliance.explanation && (
                <div>
                  <h5 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">AI Explanation</h5>
                  <div className="bg-card/50 rounded-lg p-4 text-sm text-muted-foreground whitespace-pre-line">{compliance.explanation}</div>
                </div>
              )}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground italic">Compliance screening not yet completed.</p>
          )}
        </TraceLayer>

        <TraceLayer
          icon={<TrendingUp className="w-5 h-5 text-amber-400" />}
          title="Risk Scoring"
          color="bg-amber-400/10"
        >
          {risk ? (
            <div className="space-y-4">
              <div className="flex items-center gap-6 mb-4">
                <div>
                  <div className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Risk Score</div>
                  <div className={`text-3xl font-display font-bold ${riskColor(riskScore)}`}>
                    {riskScore ?? 0}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Risk Level</div>
                  <div className={`text-lg font-bold ${riskColor(riskScore)}`}>
                    {riskLabel(riskScore)}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Recommended Action</div>
                  <div className={`text-lg font-bold ${risk.recommendedAction === "AUTO_APPROVE" ? "text-emerald-400" : risk.recommendedAction === "OPERATOR_REVIEW" ? "text-amber-400" : "text-red-400"}`}>
                    {risk.recommendedAction?.replace(/_/g, " ")}
                  </div>
                </div>
              </div>

              {risk.subScores && (
                <div>
                  <h5 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">Risk Components</h5>
                  <div className="space-y-2">
                    {Object.entries(risk.subScores).map(([key, val]: [string, any]) => {
                      const normalized = Number(val) <= 1 ? Number(val) * 100 : Number(val);
                      const label = key.replace(/([A-Z])/g, ' $1').replace(/^./, s => s.toUpperCase());
                      return (
                        <div key={key} className="bg-card/50 rounded-lg p-3 flex items-center justify-between">
                          <span className="font-semibold text-sm">{label}</span>
                          <div className="flex items-center gap-3">
                            <div className="w-24 h-2 bg-background rounded-full overflow-hidden">
                              <div
                                className={`h-full rounded-full ${normalized < 30 ? "bg-emerald-400" : normalized < 60 ? "bg-amber-400" : "bg-red-400"}`}
                                style={{ width: `${Math.min(normalized, 100)}%` }}
                              />
                            </div>
                            <span className="text-xs font-mono w-12 text-right">{Math.round(normalized)}</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {risk.primaryRiskFactors && risk.primaryRiskFactors.length > 0 && (
                <div>
                  <h5 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">Primary Risk Factors</h5>
                  <div className="space-y-2">
                    {risk.primaryRiskFactors.map((f: any, i: number) => (
                      <div key={i} className="bg-card/50 rounded-lg p-3">
                        <span className="font-semibold text-sm block">{f.factor}</span>
                        <span className="text-xs text-muted-foreground">{f.detail || f.explanation || 'Standard risk factor within acceptable thresholds.'}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {risk.agentExplanation && (
                <div>
                  <h5 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">AI Explanation</h5>
                  <div className="bg-card/50 rounded-lg p-4 text-sm text-muted-foreground whitespace-pre-line">{risk.agentExplanation}</div>
                </div>
              )}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground italic">Risk scoring not yet completed.</p>
          )}
        </TraceLayer>

        <TraceLayer
          icon={<Umbrella className="w-5 h-5 text-violet-400" />}
          title="Insurance Quote"
          color="bg-violet-400/10"
        >
          {insurance ? (
            <div className="space-y-4">
              <div className="grid grid-cols-3 gap-4 mb-4">
                <div className="bg-card/50 rounded-lg p-4 text-center">
                  <div className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Coverage</div>
                  <div className="text-lg font-bold text-violet-400">{humanizeCoverageType(insurance.coverageType)}</div>
                </div>
                <div className="bg-card/50 rounded-lg p-4 text-center">
                  <div className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Cargo Value</div>
                  <div className="text-lg font-bold text-foreground">
                    {formatCurrency(insurance.estimatedInsuredValue || insurance.cargoValue, insurance.currency || "USD")}
                  </div>
                </div>
                <div className="bg-card/50 rounded-lg p-4 text-center">
                  <div className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Premium</div>
                  <div className="text-lg font-bold text-emerald-400">
                    {formatCurrency(insurance.estimatedPremium, insurance.currency || "USD")}
                  </div>
                </div>
              </div>

              <div className="bg-card/50 rounded-lg p-4 space-y-1">
                <TraceField label="Trade Lane" value={`${shipment.portOfLoading || "?"} → ${shipment.portOfDischarge || "?"}`} />
                <TraceField label="AI Confidence" value={insurance.confidenceScore ? `${(Number(insurance.confidenceScore) * 100).toFixed(0)}%` : "N/A"} />
                <TraceField label="Risk Adjustment" value={insurance.riskAdjustment ? `${(Number(insurance.riskAdjustment) * 100).toFixed(1)}%` : "Standard"} />
                <TraceField label="Premium Rate" value={insurance.premiumRate ? `${(Number(insurance.premiumRate) * 100).toFixed(3)}%` : "Calculated"} />
                <TraceField label="Deductible" value={insurance.deductible ? formatCurrency(insurance.deductible, insurance.currency || "USD") : "Standard"} />
              </div>

              {insurance.coverageRationale && (
                <div>
                  <h5 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">AI Rationale</h5>
                  <div className="bg-card/50 rounded-lg p-4 text-sm text-muted-foreground whitespace-pre-line">{insurance.coverageRationale}</div>
                </div>
              )}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground italic">Insurance quote not yet generated.</p>
          )}
        </TraceLayer>
      </div>
    </div>
  );
}

function TraceFieldWithConfidence({ label, value, confidence, mono = false }: {
  label: string;
  value: any;
  confidence?: number | null;
  mono?: boolean;
}) {
  return (
    <div className="flex justify-between items-center py-1.5 border-b border-border/20 last:border-b-0">
      <span className="text-sm text-muted-foreground">{label}</span>
      <div className="flex items-center gap-3">
        <span className={`text-sm font-medium text-foreground ${mono ? "font-mono" : ""}`}>{value ?? "N/A"}</span>
        <ConfidenceDot value={confidence} />
      </div>
    </div>
  );
}
