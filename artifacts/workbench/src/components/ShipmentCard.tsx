import { Link } from "wouter";
import { motion } from "framer-motion";
import { ArrowRight, ShieldAlert, ShieldCheck, ShieldX, TrendingUp, Ship } from "lucide-react";
import { StatusBadge } from "./StatusBadge";
import type { EnrichedShipment } from "@workspace/api-client-react";

export function ShipmentCard({ shipment }: { shipment: EnrichedShipment }) {
  const complianceIcon = () => {
    if (!shipment.compliance) return <ShieldAlert className="w-4 h-4 text-muted-foreground" />;
    switch (shipment.compliance.status) {
      case 'CLEAR': return <ShieldCheck className="w-4 h-4 text-success" />;
      case 'ALERT': return <ShieldAlert className="w-4 h-4 text-warning" />;
      case 'BLOCKED': return <ShieldX className="w-4 h-4 text-destructive" />;
      default: return <ShieldAlert className="w-4 h-4 text-muted-foreground" />;
    }
  };

  const riskColor = () => {
    if (!shipment.risk) return 'text-muted-foreground';
    const score = shipment.risk.compositeScore;
    if (score < 30) return 'text-success';
    if (score < 70) return 'text-warning';
    return 'text-destructive';
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ y: -4, scale: 1.01 }}
      transition={{ duration: 0.2 }}
      className="glass-panel rounded-xl p-5 flex flex-col group hover:border-primary/50 transition-colors"
    >
      <div className="flex justify-between items-start mb-4">
        <div>
          <div className="flex items-center gap-2">
            <Ship className="w-5 h-5 text-primary" />
            <h3 className="font-display font-bold text-lg text-foreground tracking-tight">
              {shipment.reference}
            </h3>
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            Created {new Date(shipment.createdAt).toLocaleDateString()}
          </p>
        </div>
        <StatusBadge status={shipment.status} />
      </div>

      <div className="grid grid-cols-2 gap-4 mb-5 flex-grow">
        <div className="space-y-1">
          <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Route</span>
          <div className="flex items-center gap-2 text-sm font-medium">
            <span className="truncate max-w-[100px]">{shipment.portOfLoading || 'Unknown'}</span>
            <ArrowRight className="w-3 h-3 text-muted-foreground shrink-0" />
            <span className="truncate max-w-[100px]">{shipment.portOfDischarge || 'Unknown'}</span>
          </div>
        </div>
        <div className="space-y-1">
          <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Parties</span>
          <div className="flex items-center gap-2 text-sm">
            <span className="truncate max-w-[100px] font-medium text-primary/90">{shipment.shipper?.name || 'Pending'}</span>
            <ArrowRight className="w-3 h-3 text-muted-foreground shrink-0" />
            <span className="truncate max-w-[100px] font-medium">{shipment.consignee?.name || 'Pending'}</span>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-4 py-3 border-t border-border/50">
        <div className="flex items-center gap-1.5" title="Compliance Status">
          {complianceIcon()}
          <span className="text-sm font-medium">
            {shipment.compliance?.status || 'Pending'}
          </span>
        </div>
        <div className="w-px h-4 bg-border/50" />
        <div className="flex items-center gap-1.5" title="Risk Score">
          <TrendingUp className={`w-4 h-4 ${riskColor()}`} />
          <span className={`text-sm font-bold ${riskColor()}`}>
            {shipment.risk ? Math.round(shipment.risk.compositeScore) : '--'}
          </span>
        </div>
        <div className="w-px h-4 bg-border/50" />
        <div className="flex items-center gap-1.5 text-sm font-medium">
          {shipment.insurance ? (
            <span>{shipment.insurance.currency} {shipment.insurance.estimatedPremium.toLocaleString()}</span>
          ) : (
            <span className="text-muted-foreground">No quote</span>
          )}
        </div>
      </div>

      <div className="mt-4 pt-4 border-t border-border/50">
        <Link 
          href={`/shipments/${shipment.id}`}
          className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg bg-secondary/50 hover:bg-primary text-secondary-foreground hover:text-primary-foreground font-semibold transition-all duration-300"
        >
          Review Shipment
          <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
        </Link>
      </div>
    </motion.div>
  );
}
