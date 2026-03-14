import { type RiskScore } from "@workspace/api-client-react";
import { StatusBadge } from "./StatusBadge";
import { AlertTriangle, Info, ShieldAlert } from "lucide-react";
import { ResponsiveContainer, RadialBarChart, RadialBar, PolarAngleAxis } from "recharts";
import { normalizeRiskScore, riskCssColor } from "@/lib/format";

export function RiskPanel({ risk }: { risk?: RiskScore }) {
  if (!risk) {
    return (
      <div className="glass-panel rounded-xl p-6 flex flex-col items-center justify-center h-[300px] text-center">
        <ShieldAlert className="w-12 h-12 text-muted-foreground mb-4" />
        <h3 className="text-lg font-semibold">Risk Analysis Pending</h3>
        <p className="text-muted-foreground text-sm max-w-xs mt-2">
          The Risk Intelligence Agent has not yet scored this shipment.
        </p>
      </div>
    );
  }

  const score = normalizeRiskScore(risk.compositeScore) ?? 0;
  const color = riskCssColor(score);

  const data = [{ name: 'Risk', value: score, fill: color }];

  return (
    <div className="glass-panel rounded-xl p-6 border-l-4" style={{ borderLeftColor: color }}>
      <div className="flex justify-between items-start mb-6">
        <div>
          <h3 className="text-lg font-display font-bold flex items-center gap-2">
            Risk Intelligence
          </h3>
          <p className="text-sm text-muted-foreground mt-1">AI-driven risk assessment</p>
        </div>
        <StatusBadge status={risk.recommendedAction} />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <div className="relative flex items-center justify-center h-48">
          <ResponsiveContainer width="100%" height="100%">
            <RadialBarChart 
              cx="50%" cy="50%" 
              innerRadius="70%" outerRadius="100%" 
              barSize={20} data={data} 
              startAngle={180} endAngle={0}
            >
              <PolarAngleAxis type="number" domain={[0, 100]} angleAxisId={0} tick={false} />
              <RadialBar background={{ fill: 'hsl(var(--muted))' }} dataKey="value" cornerRadius={10} />
            </RadialBarChart>
          </ResponsiveContainer>
          <div className="absolute inset-0 flex flex-col items-center justify-center mt-8">
            <span className="text-5xl font-display font-bold" style={{ color }}>
              {score}
            </span>
            <span className="text-xs font-semibold text-muted-foreground tracking-widest uppercase mt-1">
              Risk Score
            </span>
          </div>
        </div>

        <div className="space-y-4">
          <div>
            <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-2 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4" />
              Primary Risk Factors
            </h4>
            <ul className="space-y-2">
              {risk.primaryRiskFactors?.map((factor: any, i) => (
                <li key={i} className="text-sm bg-secondary/30 p-2.5 rounded-lg border border-border/50">
                  <span className="font-semibold text-foreground block">{factor.factor || 'Unknown Factor'}</span>
                  <span className="text-muted-foreground">{factor.detail || factor.explanation || 'Standard risk factor within acceptable thresholds.'}</span>
                </li>
              ))}
              {(!risk.primaryRiskFactors || risk.primaryRiskFactors.length === 0) && (
                <li className="text-sm text-success flex items-center gap-2 p-2 bg-success/10 rounded-lg">
                   No significant risk factors identified.
                </li>
              )}
            </ul>
          </div>
        </div>
      </div>

      {risk.agentExplanation && (
        <div className="mt-6 p-4 rounded-lg bg-primary/5 border border-primary/20 flex gap-3 items-start">
          <Info className="w-5 h-5 text-primary shrink-0 mt-0.5" />
          <div>
            <h4 className="text-sm font-semibold text-primary mb-1">Agent Rationale</h4>
            <p className="text-sm text-foreground/80 leading-relaxed">{risk.agentExplanation}</p>
          </div>
        </div>
      )}
    </div>
  );
}
