import { type ComplianceScreening } from "@workspace/api-client-react";
import { StatusBadge } from "./StatusBadge";
import { ShieldCheck, ShieldAlert, ShieldX, Users, FileSearch } from "lucide-react";

export function CompliancePanel({ screenings }: { screenings?: ComplianceScreening[] }) {
  const compliance = screenings && screenings.length > 0 ? screenings[0] : null;

  if (!compliance) {
    return (
      <div className="glass-panel rounded-xl p-6 flex flex-col items-center justify-center h-[250px] text-center">
        <ShieldAlert className="w-12 h-12 text-muted-foreground mb-4" />
        <h3 className="text-lg font-semibold">Compliance Screening Pending</h3>
        <p className="text-muted-foreground text-sm max-w-xs mt-2">
          Sanctions and restricted party screening has not been completed.
        </p>
      </div>
    );
  }

  const isClear = compliance.status === 'CLEAR';
  const colorClass = isClear ? 'border-success/50' : compliance.status === 'ALERT' ? 'border-warning/50' : 'border-destructive/50';

  return (
    <div className={`glass-panel rounded-xl p-6 border-t-4 ${colorClass}`}>
      <div className="flex justify-between items-start mb-6">
        <div>
          <h3 className="text-lg font-display font-bold flex items-center gap-2">
            Sanctions & Compliance
          </h3>
          <p className="text-sm text-muted-foreground mt-1">OFAC, EU, UN restricted party screening</p>
        </div>
        <StatusBadge status={compliance.status} type="compliance" />
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-secondary/30 rounded-lg p-4 border border-border/50">
          <Users className="w-5 h-5 text-primary mb-2" />
          <div className="text-2xl font-bold">{compliance.screenedParties}</div>
          <div className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">Parties Screened</div>
        </div>
        <div className="bg-secondary/30 rounded-lg p-4 border border-border/50">
          <FileSearch className="w-5 h-5 text-primary mb-2" />
          <div className="text-2xl font-bold">{compliance.listsChecked?.length || 3}</div>
          <div className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">Lists Checked</div>
        </div>
        <div className={`col-span-2 rounded-lg p-4 border ${isClear ? 'bg-success/10 border-success/30' : 'bg-warning/10 border-warning/30'}`}>
          <div className="flex items-center gap-3">
            {isClear ? <ShieldCheck className="w-8 h-8 text-success" /> : <ShieldAlert className="w-8 h-8 text-warning" />}
            <div>
              <div className="text-2xl font-bold flex items-baseline gap-2">
                {compliance.matchCount} <span className="text-sm font-normal text-muted-foreground">Potential Matches</span>
              </div>
              <div className="text-xs text-foreground/70">
                {isClear ? 'No blocked entities detected.' : 'Review required for potential hits.'}
              </div>
            </div>
          </div>
        </div>
      </div>

      {compliance.matches && compliance.matches.length > 0 && (
        <div className="mb-6 space-y-3">
          <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Identified Matches</h4>
          {compliance.matches.map((match: any, i) => (
            <div key={i} className="bg-destructive/10 border border-destructive/20 p-4 rounded-lg flex items-start gap-3">
              <ShieldX className="w-5 h-5 text-destructive shrink-0 mt-0.5" />
              <div>
                <div className="font-semibold text-destructive-foreground">{match.entityName || 'Unknown Entity'}</div>
                <div className="text-sm text-foreground/80 mt-1">
                  Matched on: <span className="font-medium">{match.listName || 'Sanctions List'}</span> (Score: {match.score || 'N/A'})
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {compliance.agentExplanation && (
        <div className="p-4 rounded-lg bg-secondary/50 border border-border">
          <h4 className="text-sm font-semibold mb-2">Screening Notes</h4>
          <p className="text-sm text-muted-foreground leading-relaxed">{compliance.agentExplanation}</p>
        </div>
      )}
    </div>
  );
}
