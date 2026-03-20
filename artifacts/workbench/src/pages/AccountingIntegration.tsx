import { useState } from "react";
import { Link } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import {
  ChevronLeft,
  Loader2,
  Plug,
  Unplug,
  RefreshCw,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  ArrowUpRight,
  Building2,
  FileText,
  Users,
  Zap,
  Clock,
  BookOpen,
} from "lucide-react";
import { AppLayout } from "@/components/layout/AppLayout";
import {
  useAccountingStatus,
  useConnectAccounting,
  useDisconnectAccounting,
  useAccountingMappings,
} from "@/hooks/use-accounting";

function SyncStatusBadge({ status }: { status: string }) {
  const map: Record<string, { bg: string; text: string }> = {
    SYNCED: { bg: "bg-emerald-500/10", text: "text-emerald-400" },
    PENDING: { bg: "bg-amber-500/10", text: "text-amber-400" },
    FAILED: { bg: "bg-red-500/10", text: "text-red-400" },
    CONFLICT: { bg: "bg-orange-500/10", text: "text-orange-400" },
    STALE: { bg: "bg-zinc-500/10", text: "text-zinc-400" },
  };
  const style = map[status] || map.PENDING;
  return (
    <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${style.bg} ${style.text}`}>
      {status}
    </span>
  );
}

export default function AccountingIntegration() {
  const { data: statusRes, isLoading, refetch } = useAccountingStatus();
  const connectMut = useConnectAccounting();
  const disconnectMut = useDisconnectAccounting();
  const { data: mappingsRes } = useAccountingMappings();
  const [showMappings, setShowMappings] = useState(false);

  const status = statusRes?.data;
  const connection = status?.connection;
  const stats = status?.stats;
  const mappings = mappingsRes?.data || [];
  const isConnected = connection?.status === "CONNECTED";

  if (isLoading) {
    return (
      <AppLayout hideRightPanel>
        <div className="flex items-center justify-center h-full">
          <Loader2 className="w-6 h-6 animate-spin text-primary" />
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout hideRightPanel>
      <div className="px-8 py-8 max-w-[1000px] mx-auto">
        <div className="flex items-center gap-3 mb-8">
          <Link href="/settings">
            <button className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-white/[0.04] transition-colors">
              <ChevronLeft className="w-4 h-4" />
            </button>
          </Link>
          <div className="flex-1">
            <h1 className="text-[22px] font-semibold text-foreground">Accounting Integration</h1>
            <p className="text-[13px] text-muted-foreground mt-0.5">Sync invoices and customers with QuickBooks Online</p>
          </div>
          <button
            onClick={() => refetch()}
            className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-white/[0.04] transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>

        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="bg-card border border-card-border rounded-xl p-6 mb-6">
          <div className="flex items-center justify-between mb-5">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-[#2CA01C]/10 flex items-center justify-center">
                <BookOpen className="w-5 h-5 text-[#2CA01C]" />
              </div>
              <div>
                <h3 className="text-[14px] font-semibold text-foreground">QuickBooks Online</h3>
                <p className="text-[12px] text-muted-foreground">
                  {isConnected ? `Connected to ${connection?.companyName}` : "Not connected"}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {isConnected ? (
                <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-400 text-[11px] font-semibold">
                  <CheckCircle2 className="w-3 h-3" />
                  Connected
                </span>
              ) : (
                <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-zinc-500/10 text-zinc-400 text-[11px] font-semibold">
                  <XCircle className="w-3 h-3" />
                  Disconnected
                </span>
              )}
            </div>
          </div>

          {isConnected && connection?.realmId && (
            <div className="grid grid-cols-3 gap-4 mb-5 text-[12px]">
              <div>
                <p className="text-muted-foreground mb-0.5">Realm ID</p>
                <p className="font-mono text-foreground text-[11px]">{connection.realmId}</p>
              </div>
              <div>
                <p className="text-muted-foreground mb-0.5">Last Sync</p>
                <p className="text-foreground">{connection.lastSyncAt ? new Date(connection.lastSyncAt).toLocaleString() : "Never"}</p>
              </div>
              <div>
                <p className="text-muted-foreground mb-0.5">Last Status</p>
                <p className="text-foreground">{connection.lastSyncStatus || "—"}</p>
              </div>
            </div>
          )}

          {connection?.lastSyncError && (
            <div className="flex items-center gap-2 p-3 rounded-lg bg-red-500/5 border border-red-500/10 mb-4">
              <AlertTriangle className="w-4 h-4 text-red-400 shrink-0" />
              <p className="text-[12px] text-red-400">{connection.lastSyncError}</p>
            </div>
          )}

          <div className="flex gap-2">
            {isConnected ? (
              <button
                onClick={() => disconnectMut.mutate()}
                disabled={disconnectMut.isPending}
                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-red-500/10 text-red-400 text-[13px] font-medium hover:bg-red-500/20 transition-colors disabled:opacity-50"
              >
                {disconnectMut.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Unplug className="w-3.5 h-3.5" />}
                Disconnect
              </button>
            ) : (
              <button
                onClick={() => connectMut.mutate()}
                disabled={connectMut.isPending}
                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-primary/10 text-primary text-[13px] font-medium hover:bg-primary/20 transition-colors disabled:opacity-50"
              >
                {connectMut.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plug className="w-3.5 h-3.5" />}
                Connect QuickBooks
              </button>
            )}
          </div>
        </motion.div>

        {isConnected && stats && (
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="bg-card border border-card-border rounded-xl p-6 mb-6">
            <div className="flex items-center gap-3 mb-5">
              <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center">
                <Zap className="w-4 h-4 text-primary" />
              </div>
              <div>
                <h3 className="text-[14px] font-semibold text-foreground">Sync Overview</h3>
                <p className="text-[12px] text-muted-foreground">Current sync status for customers and invoices</p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-6">
              <div className="p-4 rounded-lg bg-background/50 border border-card-border">
                <div className="flex items-center gap-2 mb-3">
                  <Users className="w-4 h-4 text-blue-400" />
                  <h4 className="text-[13px] font-semibold text-foreground">Customers</h4>
                </div>
                <div className="grid grid-cols-3 gap-3 text-center">
                  <div>
                    <p className="text-[20px] font-bold text-foreground">{stats.totalCustomers}</p>
                    <p className="text-[10px] text-muted-foreground uppercase">Total</p>
                  </div>
                  <div>
                    <p className="text-[20px] font-bold text-emerald-400">{stats.syncedCustomers}</p>
                    <p className="text-[10px] text-muted-foreground uppercase">Synced</p>
                  </div>
                  <div>
                    <p className="text-[20px] font-bold text-amber-400">{stats.totalCustomers - stats.syncedCustomers}</p>
                    <p className="text-[10px] text-muted-foreground uppercase">Pending</p>
                  </div>
                </div>
                {stats.totalCustomers > 0 && (
                  <div className="mt-3">
                    <div className="h-1.5 rounded-full bg-zinc-800 overflow-hidden">
                      <div
                        className="h-full rounded-full bg-emerald-500 transition-all duration-500"
                        style={{ width: `${(stats.syncedCustomers / stats.totalCustomers) * 100}%` }}
                      />
                    </div>
                  </div>
                )}
              </div>

              <div className="p-4 rounded-lg bg-background/50 border border-card-border">
                <div className="flex items-center gap-2 mb-3">
                  <FileText className="w-4 h-4 text-violet-400" />
                  <h4 className="text-[13px] font-semibold text-foreground">Invoices</h4>
                </div>
                <div className="grid grid-cols-3 gap-3 text-center">
                  <div>
                    <p className="text-[20px] font-bold text-foreground">{stats.totalInvoices}</p>
                    <p className="text-[10px] text-muted-foreground uppercase">Total</p>
                  </div>
                  <div>
                    <p className="text-[20px] font-bold text-emerald-400">{stats.syncedInvoices}</p>
                    <p className="text-[10px] text-muted-foreground uppercase">Synced</p>
                  </div>
                  <div>
                    <p className="text-[20px] font-bold text-amber-400">{stats.totalInvoices - stats.syncedInvoices}</p>
                    <p className="text-[10px] text-muted-foreground uppercase">Pending</p>
                  </div>
                </div>
                {stats.totalInvoices > 0 && (
                  <div className="mt-3">
                    <div className="h-1.5 rounded-full bg-zinc-800 overflow-hidden">
                      <div
                        className="h-full rounded-full bg-emerald-500 transition-all duration-500"
                        style={{ width: `${(stats.syncedInvoices / stats.totalInvoices) * 100}%` }}
                      />
                    </div>
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        )}

        {isConnected && (
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="bg-card border border-card-border rounded-xl p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-violet-500/10 flex items-center justify-center">
                  <ArrowUpRight className="w-4 h-4 text-violet-400" />
                </div>
                <div>
                  <h3 className="text-[14px] font-semibold text-foreground">Sync Mappings</h3>
                  <p className="text-[12px] text-muted-foreground">{mappings.length} entities mapped</p>
                </div>
              </div>
              <button
                onClick={() => setShowMappings(!showMappings)}
                className="px-3 py-1.5 rounded-lg bg-muted/50 text-[12px] text-muted-foreground hover:text-foreground transition-colors"
              >
                {showMappings ? "Hide" : "Show"} Details
              </button>
            </div>

            <AnimatePresence>
              {showMappings && mappings.length > 0 && (
                <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
                  <div className="rounded-lg border border-card-border overflow-hidden">
                    <table className="w-full text-[12px]">
                      <thead>
                        <tr className="bg-background/50 border-b border-card-border">
                          <th className="px-4 py-2.5 text-left text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Type</th>
                          <th className="px-4 py-2.5 text-left text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Dynasties ID</th>
                          <th className="px-4 py-2.5 text-left text-[10px] uppercase tracking-wider text-muted-foreground font-medium">QB ID</th>
                          <th className="px-4 py-2.5 text-left text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Status</th>
                          <th className="px-4 py-2.5 text-left text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Last Sync</th>
                        </tr>
                      </thead>
                      <tbody>
                        {mappings.map((m: any) => (
                          <tr key={m.id} className="border-b border-card-border last:border-0 hover:bg-white/[0.02]">
                            <td className="px-4 py-2.5">
                              <span className={`px-2 py-0.5 rounded text-[10px] font-semibold ${
                                m.entityType === "CUSTOMER" ? "bg-blue-500/10 text-blue-400" :
                                m.entityType === "INVOICE" ? "bg-violet-500/10 text-violet-400" :
                                "bg-emerald-500/10 text-emerald-400"
                              }`}>
                                {m.entityType}
                              </span>
                            </td>
                            <td className="px-4 py-2.5 font-mono text-[11px] text-foreground">{m.dynastiesEntityId?.slice(0, 16)}...</td>
                            <td className="px-4 py-2.5 font-mono text-[11px] text-foreground">{m.externalEntityId || "—"}</td>
                            <td className="px-4 py-2.5"><SyncStatusBadge status={m.syncStatus} /></td>
                            <td className="px-4 py-2.5 text-muted-foreground">
                              {m.lastSyncAt ? (
                                <span className="flex items-center gap-1">
                                  <Clock className="w-3 h-3" />
                                  {new Date(m.lastSyncAt).toLocaleString()}
                                </span>
                              ) : "—"}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {showMappings && mappings.length === 0 && (
              <p className="text-[13px] text-muted-foreground text-center py-6">No sync mappings yet. Sync customers and invoices from the Billing section.</p>
            )}
          </motion.div>
        )}
      </div>
    </AppLayout>
  );
}
