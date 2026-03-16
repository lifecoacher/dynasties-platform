import { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import {
  Settings2,
  Shield,
  Sliders,
  Play,
  RotateCcw,
  Save,
  ChevronRight,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Loader2,
  Zap,
  Activity,
  Eye,
  ToggleLeft,
  ToggleRight,
  TrendingUp,
  TrendingDown,
  Minus,
  History,
  FlaskConical,
  Radio,
} from "lucide-react";

const BASE = `${import.meta.env.BASE_URL}api`;

function useAuthHeaders() {
  const token = localStorage.getItem("auth_token");
  return {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

type Tab = "policies" | "simulation" | "modes" | "history";

interface PolicyEntry {
  policyKey: string;
  value: Record<string, unknown>;
  isActive: boolean;
  source: "TENANT_OVERRIDE" | "GLOBAL_DEFAULT";
  version?: number;
}

interface SimulationResult {
  id: string;
  simulationName: string;
  baseline: any;
  simulated: any;
  impactAnalysis: {
    shipmentDelta: number;
    blockRateChange: number;
    taskVolumeChange: number;
    escalationChange: number;
    summary: string[];
  };
}

interface ModePreset {
  description: string;
  overrides: Record<string, Record<string, unknown>>;
}

const POLICY_LABELS: Record<string, { label: string; description: string }> = {
  "recommendation.confidence_threshold": { label: "Confidence Threshold", description: "Minimum confidence score for recommendations to be surfaced" },
  "booking.gate_thresholds": { label: "Booking Gate Thresholds", description: "Risk score thresholds for blocking, review, and caution gates" },
  "booking.gate_types_enabled": { label: "Gate Types Enabled", description: "Toggle individual gate types (compliance, risk, document, etc.)" },
  "sla.response_times": { label: "SLA Response Times", description: "Maximum response times for different task priorities" },
  "sla.escalation_thresholds": { label: "Escalation Thresholds", description: "When to escalate overdue tasks" },
  "auto_task.creation_rules": { label: "Auto-Task Rules", description: "Rules for automatic task creation based on risk scores" },
  "escalation.timings": { label: "Escalation Timings", description: "Time windows before escalation triggers" },
  "intelligence.weighting": { label: "Intelligence Weighting", description: "Relative weights for different intelligence signals" },
  "risk.tolerances": { label: "Risk Tolerances", description: "Maximum acceptable risk scores by category" },
  "strategic.sensitivity": { label: "Strategic Sensitivity", description: "Thresholds for strategic actions like rerouting and repricing" },
};

const MODE_COLORS: Record<string, string> = {
  ADVISORY: "bg-primary/10 border-primary/30 text-primary",
  APPROVAL_HEAVY: "bg-[#D4A24C]/10 border-[#D4A24C]/30 text-[#D4A24C]",
  SEMI_AUTONOMOUS: "bg-primary/10 border-primary/30 text-primary",
  HIGH_COMPLIANCE: "bg-[#E05252]/10 border-[#E05252]/30 text-[#E05252]",
  MARGIN_PROTECTION: "bg-[#D4A24C]/10 border-[#D4A24C]/30 text-[#D4A24C]",
  DISRUPTION_SENSITIVE: "bg-[#E05252]/10 border-[#E05252]/30 text-[#E05252]",
};

export default function PolicyStudio() {
  const [tab, setTab] = useState<Tab>("policies");
  const headers = useAuthHeaders();

  return (
    <div className="flex-1 flex flex-col min-h-screen bg-background">
      <header className="border-b border-border px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold flex items-center gap-2">
              <Settings2 className="w-5 h-5 text-primary" />
              Policy Studio
            </h1>
            <p className="text-sm text-muted-foreground mt-0.5">Configure decision policies, simulate changes, and manage operating modes</p>
          </div>
        </div>
        <div className="flex gap-1 mt-4">
          {([
            { key: "policies", label: "Policies", icon: Sliders },
            { key: "simulation", label: "Simulation", icon: FlaskConical },
            { key: "modes", label: "Operating Modes", icon: Radio },
            { key: "history", label: "History", icon: History },
          ] as const).map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                tab === t.key ? "bg-primary/10 text-primary" : "text-muted-foreground hover:text-foreground hover:bg-white/[0.04]"
              }`}
            >
              <t.icon className="w-3.5 h-3.5" />
              {t.label}
            </button>
          ))}
        </div>
      </header>

      <main className="flex-1 p-6 overflow-y-auto">
        {tab === "policies" && <PoliciesTab headers={headers} />}
        {tab === "simulation" && <SimulationTab headers={headers} />}
        {tab === "modes" && <ModesTab headers={headers} />}
        {tab === "history" && <HistoryTab headers={headers} />}
      </main>
    </div>
  );
}

function PoliciesTab({ headers }: { headers: Record<string, string> }) {
  const [policies, setPolicies] = useState<PolicyEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`${BASE}/policy/effective`, { headers });
      const json = await res.json();
      const raw = json.data || {};
      const entries: PolicyEntry[] = Object.entries(raw).map(([key, val]: [string, any]) => ({
        policyKey: key,
        value: val.value,
        isActive: true,
        source: val.source === "tenant" ? "TENANT_OVERRIDE" as const : "GLOBAL_DEFAULT" as const,
        version: val.version,
      }));
      setPolicies(entries);
    } catch { /* */ }
    setLoading(false);
  }, [headers]);

  useEffect(() => { load(); }, [load]);

  const handleSave = async (key: string) => {
    setSaving(true);
    try {
      const value = JSON.parse(editValue);
      await fetch(`${BASE}/policy/tenant/${key}`, {
        method: "PUT",
        headers,
        body: JSON.stringify({ value, reason: "Policy Studio update" }),
      });
      setEditing(null);
      load();
    } catch { /* */ }
    setSaving(false);
  };

  const handleReset = async (key: string) => {
    await fetch(`${BASE}/policy/tenant/${key}/reset`, { method: "POST", headers });
    load();
  };

  if (loading) return <LoadingState />;

  return (
    <div className="space-y-3">
      {policies.map((p) => {
        const meta = POLICY_LABELS[p.policyKey] || { label: p.policyKey, description: "" };
        const isEditing = editing === p.policyKey;

        return (
          <motion.div
            key={p.policyKey}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-card border border-border rounded-lg p-4"
          >
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-medium">{meta.label}</h3>
                  <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${
                    p.source === "TENANT_OVERRIDE"
                      ? "bg-primary/10 text-primary"
                      : "bg-muted text-muted-foreground"
                  }`}>
                    {p.source === "TENANT_OVERRIDE" ? "Custom" : "Default"}
                  </span>
                  {p.isActive ? (
                    <CheckCircle className="w-3.5 h-3.5 text-primary" />
                  ) : (
                    <XCircle className="w-3.5 h-3.5 text-[#E05252]" />
                  )}
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">{meta.description}</p>
                <p className="text-[10px] font-mono text-muted-foreground mt-0.5">{p.policyKey}</p>
              </div>
              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => {
                    setEditing(isEditing ? null : p.policyKey);
                    setEditValue(JSON.stringify(p.value, null, 2));
                  }}
                  className="p-1.5 rounded text-muted-foreground hover:text-foreground hover:bg-white/[0.04] transition-colors"
                >
                  <Sliders className="w-3.5 h-3.5" />
                </button>
                {p.source === "TENANT_OVERRIDE" && (
                  <button
                    onClick={() => handleReset(p.policyKey)}
                    className="p-1.5 rounded text-muted-foreground hover:text-[#D4A24C] hover:bg-[#D4A24C]/10 transition-colors"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>

            {!isEditing && (
              <pre className="mt-2 text-[11px] font-mono bg-secondary rounded p-2 overflow-x-auto max-h-24 text-muted-foreground">
                {JSON.stringify(p.value, null, 2)}
              </pre>
            )}

            {isEditing && (
              <div className="mt-3 space-y-2">
                <textarea
                  value={editValue}
                  onChange={(e) => setEditValue(e.target.value)}
                  className="w-full h-32 bg-background border border-border rounded-md p-2 text-[11px] font-mono text-foreground focus:outline-none focus:ring-1 focus:ring-primary resize-y"
                />
                <div className="flex gap-2">
                  <button
                    onClick={() => handleSave(p.policyKey)}
                    disabled={saving}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-primary text-primary-foreground rounded-md text-xs font-medium hover:bg-primary/90 disabled:opacity-50"
                  >
                    {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />}
                    Save
                  </button>
                  <button
                    onClick={() => setEditing(null)}
                    className="px-3 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </motion.div>
        );
      })}
    </div>
  );
}

function SimulationTab({ headers }: { headers: Record<string, string> }) {
  const [simName, setSimName] = useState("What-if Analysis");
  const [policyChanges, setPolicyChanges] = useState(
    JSON.stringify({
      "booking.gate_thresholds": { blockThreshold: 0.75, requireReviewThreshold: 0.55 },
    }, null, 2),
  );
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<SimulationResult | null>(null);
  const [history, setHistory] = useState<SimulationResult[]>([]);

  useEffect(() => {
    fetch(`${BASE}/policy/simulations`, { headers })
      .then((r) => r.json())
      .then((j) => setHistory(j.data || []))
      .catch(() => {});
  }, [headers]);

  const runSimulation = async () => {
    setRunning(true);
    try {
      const res = await fetch(`${BASE}/policy/simulate`, {
        method: "POST",
        headers,
        body: JSON.stringify({
          simulationName: simName,
          policyChanges: JSON.parse(policyChanges),
        }),
      });
      const json = await res.json();
      setResult(json.data);
      setHistory((prev) => [json.data, ...prev]);
    } catch { /* */ }
    setRunning(false);
  };

  return (
    <div className="space-y-6">
      <div className="bg-card border border-border rounded-lg p-5">
        <h2 className="text-sm font-semibold flex items-center gap-2 mb-3">
          <FlaskConical className="w-4 h-4 text-primary" />
          Run Policy Simulation
        </h2>
        <div className="space-y-3">
          <div>
            <label className="text-xs text-muted-foreground">Simulation Name</label>
            <input
              value={simName}
              onChange={(e) => setSimName(e.target.value)}
              className="w-full mt-1 bg-secondary border border-border rounded-md px-3 py-1.5 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>
          <div>
            <label className="text-xs text-muted-foreground">Policy Changes (JSON)</label>
            <textarea
              value={policyChanges}
              onChange={(e) => setPolicyChanges(e.target.value)}
              className="w-full mt-1 h-32 bg-background border border-border rounded-md p-2 text-[11px] font-mono text-foreground focus:outline-none focus:ring-1 focus:ring-primary resize-y"
            />
          </div>
          <button
            onClick={runSimulation}
            disabled={running}
            className="flex items-center gap-1.5 px-4 py-2 bg-primary text-primary-foreground rounded-md text-sm font-medium hover:bg-primary/90 disabled:opacity-50"
          >
            {running ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
            Run Simulation
          </button>
        </div>
      </div>

      {result && (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-card border border-border rounded-lg p-5"
        >
          <h2 className="text-sm font-semibold mb-3">Simulation Results: {result.simulationName}</h2>

          <div className="grid grid-cols-4 gap-3 mb-4">
            <MetricCard
              label="Shipment Delta"
              value={result.impactAnalysis.shipmentDelta}
              format="delta"
            />
            <MetricCard
              label="Block Rate Change"
              value={result.impactAnalysis.blockRateChange}
              format="percent"
            />
            <MetricCard
              label="Task Volume Change"
              value={result.impactAnalysis.taskVolumeChange}
              format="delta"
            />
            <MetricCard
              label="Escalation Change"
              value={result.impactAnalysis.escalationChange}
              format="delta"
            />
          </div>

          <div className="space-y-1.5">
            {result.impactAnalysis.summary.map((s, i) => (
              <div key={i} className="flex items-start gap-2 text-xs text-muted-foreground">
                <AlertTriangle className="w-3 h-3 mt-0.5 text-[#D4A24C] shrink-0" />
                {s}
              </div>
            ))}
          </div>

          <div className="grid grid-cols-2 gap-4 mt-4">
            <div>
              <h3 className="text-xs font-medium text-muted-foreground mb-2">Baseline Booking Gates</h3>
              <BookingBar data={result.baseline.bookingDecisionsChanged} />
            </div>
            <div>
              <h3 className="text-xs font-medium text-muted-foreground mb-2">Simulated Booking Gates</h3>
              <BookingBar data={result.simulated.bookingDecisionsChanged} />
            </div>
          </div>
        </motion.div>
      )}

      {history.length > 0 && (
        <div className="bg-card border border-border rounded-lg p-5">
          <h2 className="text-sm font-semibold mb-3 flex items-center gap-2">
            <History className="w-4 h-4 text-muted-foreground" />
            Simulation History
          </h2>
          <div className="space-y-2">
            {history.map((h) => (
              <button
                key={h.id}
                onClick={() => setResult(h)}
                className="w-full text-left p-3 rounded-md bg-secondary hover:bg-muted transition-colors"
              >
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">{h.simulationName}</span>
                  <span className="text-[10px] text-muted-foreground font-mono">{h.id}</span>
                </div>
                <div className="flex gap-4 mt-1 text-xs text-muted-foreground">
                  <span>Delta: {h.impactAnalysis.shipmentDelta > 0 ? "+" : ""}{h.impactAnalysis.shipmentDelta}</span>
                  <span>Block rate: {(h.impactAnalysis.blockRateChange * 100).toFixed(1)}%</span>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function ModesTab({ headers }: { headers: Record<string, string> }) {
  const [presets, setPresets] = useState<Record<string, ModePreset>>({});
  const [activeMode, setActiveMode] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [activating, setActivating] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [presetsRes, activeRes] = await Promise.all([
        fetch(`${BASE}/policy/modes/presets`, { headers }),
        fetch(`${BASE}/policy/modes/active`, { headers }),
      ]);
      const presetsJson = await presetsRes.json();
      const activeJson = await activeRes.json();
      setPresets(presetsJson.data || {});
      setActiveMode(activeJson.data);
    } catch { /* */ }
    setLoading(false);
  }, [headers]);

  useEffect(() => { load(); }, [load]);

  const activate = async (modeName: string) => {
    setActivating(modeName);
    try {
      await fetch(`${BASE}/policy/modes/activate`, {
        method: "POST",
        headers,
        body: JSON.stringify({ modeName }),
      });
      load();
    } catch { /* */ }
    setActivating(null);
  };

  const deactivate = async () => {
    await fetch(`${BASE}/policy/modes/deactivate`, { method: "POST", headers });
    load();
  };

  if (loading) return <LoadingState />;

  return (
    <div className="space-y-4">
      {activeMode && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="bg-primary/5 border border-primary/20 rounded-lg p-4"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Radio className="w-4 h-4 text-primary animate-pulse" />
              <span className="text-sm font-semibold">Active Mode: {activeMode.modeName}</span>
            </div>
            <button
              onClick={deactivate}
              className="px-3 py-1 text-xs font-medium text-[#E05252] hover:bg-[#E05252]/10 rounded-md transition-colors"
            >
              Deactivate
            </button>
          </div>
          <p className="text-xs text-muted-foreground mt-1">{activeMode.description}</p>
        </motion.div>
      )}

      <div className="grid grid-cols-2 gap-3">
        {Object.entries(presets).map(([name, preset]) => {
          const isActive = activeMode?.modeName === name;
          const colorClass = MODE_COLORS[name] || "bg-gray-500/10 border-gray-500/30 text-gray-400";

          return (
            <motion.div
              key={name}
              initial={{ opacity: 0, scale: 0.97 }}
              animate={{ opacity: 1, scale: 1 }}
              className={`border rounded-lg p-4 transition-colors ${isActive ? "ring-1 ring-primary " + colorClass : "bg-card border-border"}`}
            >
              <div className="flex items-start justify-between">
                <div>
                  <h3 className={`text-sm font-semibold ${isActive ? "" : ""}`}>{name.replace(/_/g, " ")}</h3>
                  <p className="text-xs text-muted-foreground mt-1">{preset.description}</p>
                </div>
                {isActive && <CheckCircle className="w-4 h-4 text-primary shrink-0" />}
              </div>

              <div className="mt-3 flex items-center gap-2">
                {!isActive && (
                  <button
                    onClick={() => activate(name)}
                    disabled={activating === name}
                    className="flex items-center gap-1 px-3 py-1.5 bg-primary/10 text-primary rounded-md text-xs font-medium hover:bg-primary/20 disabled:opacity-50"
                  >
                    {activating === name ? <Loader2 className="w-3 h-3 animate-spin" /> : <Zap className="w-3 h-3" />}
                    Activate
                  </button>
                )}
                <span className="text-[10px] text-muted-foreground">{Object.keys(preset.overrides).length} policy overrides</span>
              </div>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}

function HistoryTab({ headers }: { headers: Record<string, string> }) {
  const [history, setHistory] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetch(`${BASE}/policy/history?limit=50`, { headers })
      .then((r) => r.json())
      .then((j) => setHistory(j.data || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [headers]);

  if (loading) return <LoadingState />;

  return (
    <div className="bg-card border border-border rounded-lg">
      <div className="p-4 border-b border-border">
        <h2 className="text-sm font-semibold flex items-center gap-2">
          <History className="w-4 h-4 text-muted-foreground" />
          Policy Change History
        </h2>
      </div>
      <div className="divide-y divide-border">
        {history.length === 0 && (
          <div className="p-8 text-center text-sm text-muted-foreground">No policy changes recorded</div>
        )}
        {history.map((h: any, i: number) => (
          <div key={i} className="p-3 hover:bg-white/[0.02] transition-colors">
            <div className="flex items-center justify-between">
              <span className="text-xs font-mono text-primary">{h.policyKey}</span>
              <span className="text-[10px] text-muted-foreground">v{h.version}</span>
            </div>
            {h.changeReason && <p className="text-xs text-muted-foreground mt-0.5">{h.changeReason}</p>}
            <div className="text-[10px] text-muted-foreground mt-0.5">
              {h.changedAt ? new Date(h.changedAt).toLocaleString() : ""}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function MetricCard({ label, value, format }: { label: string; value: number; format: "delta" | "percent" }) {
  const isPositive = value > 0;
  const isNegative = value < 0;
  const display = format === "percent"
    ? `${(value * 100).toFixed(1)}%`
    : `${isPositive ? "+" : ""}${value}`;

  return (
    <div className="bg-secondary rounded-lg p-3">
      <p className="text-[10px] text-muted-foreground uppercase tracking-wider">{label}</p>
      <div className="flex items-center gap-1 mt-1">
        {isPositive && <TrendingUp className="w-3.5 h-3.5 text-[#E05252]" />}
        {isNegative && <TrendingDown className="w-3.5 h-3.5 text-primary" />}
        {value === 0 && <Minus className="w-3.5 h-3.5 text-muted-foreground" />}
        <span className={`text-lg font-semibold ${isPositive ? "text-[#E05252]" : isNegative ? "text-primary" : ""}`}>
          {display}
        </span>
      </div>
    </div>
  );
}

function BookingBar({ data }: { data: Record<string, number> }) {
  const total = Object.values(data).reduce((a, b) => a + b, 0) || 1;
  const segments = [
    { key: "approved", color: "bg-primary", label: "Approved" },
    { key: "cautionApproved", color: "bg-[#D4A24C]/70", label: "Caution" },
    { key: "requireReview", color: "bg-[#D4A24C]", label: "Review" },
    { key: "alternative", color: "bg-[#D4A24C]", label: "Alternative" },
    { key: "blocked", color: "bg-[#E05252]", label: "Blocked" },
  ];

  return (
    <div>
      <div className="flex h-3 rounded-full overflow-hidden bg-secondary">
        {segments.map((s) => {
          const pct = ((data[s.key] || 0) / total) * 100;
          if (pct === 0) return null;
          return <div key={s.key} className={`${s.color}`} style={{ width: `${pct}%` }} />;
        })}
      </div>
      <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-1.5">
        {segments.map((s) => (
          <span key={s.key} className="flex items-center gap-1 text-[10px] text-muted-foreground">
            <span className={`w-2 h-2 rounded-full ${s.color}`} />
            {s.label}: {data[s.key] || 0}
          </span>
        ))}
      </div>
    </div>
  );
}

function LoadingState() {
  return (
    <div className="flex items-center justify-center py-12">
      <Loader2 className="w-6 h-6 animate-spin text-primary" />
    </div>
  );
}
