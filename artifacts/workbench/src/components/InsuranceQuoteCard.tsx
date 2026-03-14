import { type InsuranceQuote } from "@workspace/api-client-react";
import { Shield, FileText, CheckCircle2 } from "lucide-react";

export function InsuranceQuoteCard({ quote }: { quote?: InsuranceQuote }) {
  if (!quote) {
    return (
      <div className="glass-panel rounded-xl p-6 flex flex-col items-center justify-center h-[200px] text-center">
        <Shield className="w-12 h-12 text-muted-foreground mb-4" />
        <h3 className="text-lg font-semibold">No Quote Available</h3>
        <p className="text-muted-foreground text-sm max-w-xs mt-2">
          Insurance agent has not processed this shipment.
        </p>
      </div>
    );
  }

  return (
    <div className="glass-panel rounded-xl p-6 bg-gradient-to-br from-card to-primary/5">
      <div className="flex justify-between items-start mb-6">
        <div>
          <h3 className="text-lg font-display font-bold flex items-center gap-2">
            Cargo Insurance
          </h3>
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-primary/10 text-primary text-xs font-bold mt-2 border border-primary/20">
            {quote.coverageType.replace(/_/g, ' ')}
          </span>
        </div>
        <div className="text-right">
          <div className="text-3xl font-display font-bold text-foreground">
            {quote.currency || 'USD'} {quote.estimatedPremium.toLocaleString()}
          </div>
          <div className="text-xs text-muted-foreground font-medium uppercase tracking-wider mt-1">
            Estimated Premium
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 mb-6">
        <div className="p-3 bg-background rounded-lg border border-border/50">
          <div className="text-xs text-muted-foreground mb-1">Insured Value</div>
          <div className="font-semibold">{quote.currency || 'USD'} {quote.estimatedInsuredValue.toLocaleString()}</div>
        </div>
        <div className="p-3 bg-background rounded-lg border border-border/50">
          <div className="text-xs text-muted-foreground mb-1">AI Confidence</div>
          <div className="font-semibold text-primary">{((quote.confidenceScore ?? 0) * 100).toFixed(0)}%</div>
        </div>
      </div>

      {quote.coverageRationale && (
        <div className="mb-4">
          <div className="text-sm text-foreground/80 leading-relaxed border-l-2 border-primary pl-3 py-1">
            "{quote.coverageRationale}"
          </div>
        </div>
      )}

      {quote.exclusions && quote.exclusions.length > 0 && (
        <div className="mt-4 pt-4 border-t border-border/50">
          <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-2 mb-3">
            <FileText className="w-4 h-4" /> Notable Exclusions
          </h4>
          <ul className="space-y-2">
            {quote.exclusions.map((exc, i) => (
              <li key={i} className="text-sm flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 text-muted-foreground mt-0.5 shrink-0" />
                <span className="text-muted-foreground">{exc}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
