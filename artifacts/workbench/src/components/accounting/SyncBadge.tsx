import { motion } from "framer-motion";
import {
  Loader2,
  CheckCircle2,
  XCircle,
  RefreshCw,
  ArrowUpRight,
  BookOpen,
  Clock,
  Banknote,
} from "lucide-react";
import {
  useInvoiceSyncStatus,
  useSyncInvoice,
  useRefreshPaymentStatus,
  useSimulateDemoPayment,
} from "@/hooks/use-accounting";

const DEMO_MODE = import.meta.env.VITE_DEMO_MODE === "true";

export function InvoiceSyncBadge({ invoiceId }: { invoiceId: string }) {
  const { data: syncRes, isLoading, refetch } = useInvoiceSyncStatus(invoiceId);
  const syncMut = useSyncInvoice();
  const refreshMut = useRefreshPaymentStatus();
  const demoPayMut = useSimulateDemoPayment();

  const sync = syncRes?.data;

  if (isLoading) return null;
  if (!sync?.connected) return null;

  const isSynced = sync?.synced;
  const isPending = syncMut.isPending || refreshMut.isPending || demoPayMut.isPending;

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className="p-4 rounded-xl bg-card border border-card-border"
    >
      <div className="flex items-center gap-2 mb-3">
        <BookOpen className="w-4 h-4 text-[#2CA01C]" />
        <h4 className="text-[13px] font-semibold text-foreground">QuickBooks Sync</h4>
        {isSynced ? (
          <span className="ml-auto flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 text-[10px] font-semibold">
            <CheckCircle2 className="w-2.5 h-2.5" />
            Synced
          </span>
        ) : sync?.syncStatus === "FAILED" ? (
          <span className="ml-auto flex items-center gap-1 px-2 py-0.5 rounded-full bg-red-500/10 text-red-400 text-[10px] font-semibold">
            <XCircle className="w-2.5 h-2.5" />
            Failed
          </span>
        ) : (
          <span className="ml-auto flex items-center gap-1 px-2 py-0.5 rounded-full bg-zinc-500/10 text-zinc-400 text-[10px] font-semibold">
            Not Synced
          </span>
        )}
      </div>

      {isSynced && sync?.externalId && (
        <div className="flex items-center gap-4 mb-3 text-[11px]">
          <div>
            <span className="text-muted-foreground">QB ID: </span>
            <span className="font-mono text-foreground">{sync.externalId}</span>
          </div>
          {sync.lastSyncAt && (
            <div className="flex items-center gap-1 text-muted-foreground">
              <Clock className="w-3 h-3" />
              {new Date(sync.lastSyncAt).toLocaleString()}
            </div>
          )}
        </div>
      )}

      {sync?.lastSyncError && (
        <p className="text-[11px] text-red-400 mb-3">{sync.lastSyncError}</p>
      )}

      <div className="flex gap-2">
        {!isSynced && (
          <button
            onClick={() => syncMut.mutate(invoiceId, { onSuccess: () => refetch() })}
            disabled={isPending}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary/10 text-primary text-[11px] font-medium hover:bg-primary/20 transition-colors disabled:opacity-50"
          >
            {syncMut.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <ArrowUpRight className="w-3 h-3" />}
            Push to QB
          </button>
        )}

        {isSynced && (
          <>
            <button
              onClick={() => syncMut.mutate(invoiceId, { onSuccess: () => refetch() })}
              disabled={isPending}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-muted/50 text-muted-foreground text-[11px] font-medium hover:text-foreground transition-colors disabled:opacity-50"
            >
              {syncMut.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
              Re-sync
            </button>
            <button
              onClick={() => refreshMut.mutate(invoiceId, { onSuccess: () => refetch() })}
              disabled={isPending}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-muted/50 text-muted-foreground text-[11px] font-medium hover:text-foreground transition-colors disabled:opacity-50"
            >
              {refreshMut.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <Banknote className="w-3 h-3" />}
              Refresh Payment
            </button>
          </>
        )}

        {DEMO_MODE && isSynced && (
          <button
            onClick={() => demoPayMut.mutate(invoiceId, { onSuccess: () => { refetch(); refreshMut.mutate(invoiceId); } })}
            disabled={isPending}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-violet-500/10 text-violet-400 text-[11px] font-medium hover:bg-violet-500/20 transition-colors disabled:opacity-50"
          >
            {demoPayMut.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <Banknote className="w-3 h-3" />}
            Simulate Payment
          </button>
        )}
      </div>
    </motion.div>
  );
}
