import { type Event } from "@workspace/api-client-react";
import { format } from "date-fns";
import { Bot, FileText, Shield, TrendingUp, User, Edit3, CheckCircle, XCircle, Umbrella, DollarSign, FileOutput, Receipt, AlertCircle, BarChart3 } from "lucide-react";
import { motion } from "framer-motion";
import { agentLabel, humanizeLabel } from "@/lib/format";

export function AgentActionLog({ events }: { events?: Event[] }) {
  if (!events || events.length === 0) return null;

  const getIcon = (type: string) => {
    if (type.includes('EXTRACT')) return <FileText className="w-4 h-4 text-primary" />;
    if (type.includes('COMPLIANCE')) return <Shield className="w-4 h-4 text-emerald-400" />;
    if (type.includes('RISK')) return <TrendingUp className="w-4 h-4 text-amber-400" />;
    if (type.includes('INSURANCE')) return <Umbrella className="w-4 h-4 text-violet-400" />;
    if (type.includes('PRIC')) return <DollarSign className="w-4 h-4 text-blue-400" />;
    if (type.includes('DOCGEN') || type.includes('DOCUMENT_GENERATED')) return <FileOutput className="w-4 h-4 text-cyan-400" />;
    if (type.includes('BILLING') || type.includes('INVOICE')) return <Receipt className="w-4 h-4 text-orange-400" />;
    if (type.includes('EXCEPTION')) return <AlertCircle className="w-4 h-4 text-red-400" />;
    if (type.includes('TRADE_LANE')) return <BarChart3 className="w-4 h-4 text-indigo-400" />;
    if (type.includes('CORRECTION')) return <Edit3 className="w-4 h-4 text-accent" />;
    if (type.includes('APPROVED')) return <CheckCircle className="w-4 h-4 text-success" />;
    if (type.includes('REJECTED')) return <XCircle className="w-4 h-4 text-destructive" />;
    if (type.includes('USER')) return <User className="w-4 h-4 text-secondary-foreground" />;
    return <Bot className="w-4 h-4 text-primary" />;
  };

  return (
    <div className="glass-panel rounded-xl p-6">
      <h3 className="text-lg font-display font-bold mb-6 flex items-center gap-2">
        <Bot className="w-5 h-5 text-primary" />
        Processing Timeline
      </h3>
      
      <div className="space-y-6 relative before:absolute before:inset-0 before:ml-5 before:-translate-x-px md:before:mx-auto md:before:translate-x-0 before:h-full before:w-0.5 before:bg-gradient-to-b before:from-transparent before:via-border before:to-transparent">
        {events.map((event, index) => (
          <motion.div 
            key={event.id}
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: index * 0.1 }}
            className="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group is-active"
          >
            <div className="flex items-center justify-center w-10 h-10 rounded-full border-4 border-card bg-secondary shrink-0 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2 shadow-sm z-10">
              {getIcon(event.eventType)}
            </div>
            
            <div className="w-[calc(100%-4rem)] md:w-[calc(50%-2.5rem)] p-4 rounded-xl border border-border/50 bg-secondary/20 shadow-sm transition-colors hover:border-primary/30">
              <div className="flex flex-col md:flex-row justify-between mb-1 gap-2">
                <span className="font-bold text-sm text-foreground">
                  {humanizeLabel(event.eventType)}
                </span>
                <span className="text-xs text-muted-foreground whitespace-nowrap">
                  {format(new Date(event.createdAt), "MMM d, HH:mm:ss")}
                </span>
              </div>
              <div className="text-xs text-muted-foreground/80 mt-2 px-2 py-1.5 rounded bg-background/50">
                {agentLabel(event.eventType)}
              </div>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
