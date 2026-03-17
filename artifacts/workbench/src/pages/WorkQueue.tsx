import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link, useLocation } from "wouter";
import { motion } from "framer-motion";
import {
  ClipboardList,
  Clock,
  AlertTriangle,
  CheckCircle2,
  User,
  ChevronRight,
  RefreshCw,
  Shield,
  DollarSign,
  Ship,
  Anchor,
  MapPin,
  FileText,
  Zap,
  Ban,
  Play,
  Pause,
  RotateCcw,
  Bell,
  Bot,
  TrendingUp,
  ArrowUpCircle,
  BarChart3,
} from "lucide-react";
import { AppLayout } from "@/components/layout/AppLayout";
import { getAuthToken } from "@workspace/api-client-react";
import { useAuth } from "@/hooks/use-auth";
import { format } from "date-fns";

const BASE = `${import.meta.env.BASE_URL}api`;

async function apiFetch<T>(path: string): Promise<T> {
  const token = getAuthToken();
  const res = await fetch(`${BASE}${path}`, {
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
  });
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  const json = await res.json();
  return json.data;
}

async function apiPost<T>(path: string, body?: Record<string, any>): Promise<T> {
  const token = getAuthToken();
  const res = await fetch(`${BASE}${path}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify(body || {}),
  });
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  const json = await res.json();
  return json.data;
}

async function apiPatch<T>(path: string, body: Record<string, any>): Promise<T> {
  const token = getAuthToken();
  const res = await fetch(`${BASE}${path}`, {
    method: "PATCH",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  const json = await res.json();
  return json.data;
}

async function apiFetchRaw<T>(path: string): Promise<T> {
  const token = getAuthToken();
  const res = await fetch(`${BASE}${path}`, {
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
  });
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  return res.json();
}

type QueueFilter = "all" | "my" | "compliance" | "pricing" | "carrier" | "insurance" | "documents" | "disruption" | "overdue" | "attention";
type ViewTab = "queue" | "analytics" | "notifications";

const QUEUE_TABS: { value: QueueFilter; label: string; icon: any }[] = [
  { value: "all", label: "All Tasks", icon: ClipboardList },
  { value: "attention", label: "Needs Attention", icon: AlertTriangle },
  { value: "my", label: "My Tasks", icon: User },
  { value: "overdue", label: "Overdue", icon: Clock },
  { value: "compliance", label: "Compliance", icon: Shield },
  { value: "pricing", label: "Pricing", icon: DollarSign },
  { value: "carrier", label: "Carrier/Route", icon: Anchor },
  { value: "insurance", label: "Insurance", icon: Ship },
  { value: "documents", label: "Documents", icon: FileText },
  { value: "disruption", label: "Disruption", icon: AlertTriangle },
];

const STATUS_COLORS: Record<string, string> = {
  OPEN: "bg-primary/20 text-primary border-primary/30",
  IN_PROGRESS: "bg-[#D4A24C]/20 text-[#D4A24C] border-[#D4A24C]/30",
  BLOCKED: "bg-[#E05252]/20 text-red-300 border-red-500/30",
  COMPLETED: "bg-primary/20 text-primary border-primary/30",
  CANCELLED: "bg-slate-500/20 text-slate-400 border-slate-500/30",
};

const PRIORITY_COLORS: Record<string, string> = {
  CRITICAL: "bg-[#E05252]/20 text-red-300",
  HIGH: "bg-[#D4A24C]/20 text-[#D4A24C]",
  MEDIUM: "bg-[#D4A24C]/20 text-[#D4A24C]",
  LOW: "bg-slate-500/20 text-slate-400",
};

const TASK_TYPE_LABELS: Record<string, string> = {
  COMPLIANCE_CASE: "Compliance",
  PRICING_REVIEW: "Pricing",
  CARRIER_REVIEW: "Carrier",
  ROUTE_REVIEW: "Route",
  INSURANCE_REVIEW: "Insurance",
  DOCUMENT_CORRECTION_TASK: "Document",
  DISRUPTION_RESPONSE_TASK: "Disruption",
  RISK_MITIGATION_TASK: "Risk",
  DELAY_RESPONSE_TASK: "Delay",
};

const TASK_TYPE_ICONS: Record<string, any> = {
  COMPLIANCE_CASE: Shield,
  PRICING_REVIEW: DollarSign,
  CARRIER_REVIEW: Anchor,
  ROUTE_REVIEW: MapPin,
  INSURANCE_REVIEW: Ship,
  DOCUMENT_CORRECTION_TASK: FileText,
  DISRUPTION_RESPONSE_TASK: AlertTriangle,
  RISK_MITIGATION_TASK: Zap,
  DELAY_RESPONSE_TASK: Clock,
};

export default function WorkQueue() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [activeQueue, setActiveQueue] = useState<QueueFilter>("all");
  const [statusFilter, setStatusFilter] = useState<string>("active");
  const [selectedTask, setSelectedTask] = useState<string | null>(null);
  const [viewTab, setViewTab] = useState<ViewTab>("queue");
  const userId = user?.userId;

  const buildQueryParams = () => {
    const params = new URLSearchParams();
    if (activeQueue === "my" && user?.userId) params.set("assignedTo", user.userId);
    else if (activeQueue === "overdue") params.set("overdue", "true");
    else if (activeQueue === "attention") {
    } else if (activeQueue !== "all") params.set("queue", activeQueue);
    if (statusFilter === "active") {
    } else if (statusFilter !== "all") {
      params.set("status", statusFilter);
    }
    return params.toString();
  };

  const usePrioritizedQueue = activeQueue === "attention";

  const { data: tasks, isLoading, refetch } = useQuery({
    queryKey: ["tasks", activeQueue, statusFilter],
    queryFn: () => {
      if (usePrioritizedQueue) {
        return apiFetch<any[]>("/orchestration/prioritized-queue?needsAttentionOnly=true");
      }
      const qs = buildQueryParams();
      return apiFetch<any[]>(`/tasks${qs ? `?${qs}` : ""}`);
    },
    staleTime: 15_000,
  });

  const { data: summary } = useQuery({
    queryKey: ["tasks", "summary"],
    queryFn: () => apiFetch<any>("/tasks/summary"),
    staleTime: 30_000,
  });

  const { data: taskDetail } = useQuery({
    queryKey: ["task", selectedTask],
    queryFn: () => apiFetch<any>(`/tasks/${selectedTask}`),
    enabled: !!selectedTask,
    staleTime: 10_000,
  });

  const { data: notifData } = useQuery({
    queryKey: ["notifications"],
    queryFn: () => apiFetchRaw<any>("/notifications?unreadOnly=false"),
    staleTime: 20_000,
  });

  const { data: workflowAnalytics } = useQuery({
    queryKey: ["analytics", "workflow"],
    queryFn: () => apiFetch<any>("/analytics/workflow"),
    enabled: viewTab === "analytics",
    staleTime: 60_000,
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, body }: { id: string; body: Record<string, any> }) =>
      apiPatch(`/tasks/${id}`, body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
      queryClient.invalidateQueries({ queryKey: ["task", selectedTask] });
    },
  });

  const applyBatchMutation = useMutation({
    mutationFn: () => apiPost("/orchestration/apply-batch"),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
    },
  });

  const escalationCheckMutation = useMutation({
    mutationFn: () => apiPost("/orchestration/escalation-check"),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
    },
  });

  const markAllReadMutation = useMutation({
    mutationFn: () => apiPatch("/notifications/read-all", {}),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["notifications"] }),
  });

  const filteredTasks = (tasks || []).filter((t: any) => {
    if (usePrioritizedQueue) return true;
    if (statusFilter === "active") {
      return ["OPEN", "IN_PROGRESS", "BLOCKED"].includes(t.status);
    }
    return true;
  });

  const unreadCount = notifData?.unreadCount ?? 0;

  return (
    <AppLayout>
      <div className="p-6 max-w-[1400px] space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-white flex items-center gap-2">
              <ClipboardList className="w-6 h-6 text-primary" />
              Work Queue
            </h1>
            <p className="text-sm text-white/50 mt-1">Task management and workflow orchestration</p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => applyBatchMutation.mutate()}
              disabled={applyBatchMutation.isPending}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-primary/20 text-primary rounded-lg border border-primary/30 hover:bg-primary/30 disabled:opacity-50"
            >
              <Bot size={13} className={applyBatchMutation.isPending ? "animate-spin" : ""} />
              {applyBatchMutation.isPending ? "Applying..." : "Auto-Process Recs"}
            </button>
            <button
              onClick={() => escalationCheckMutation.mutate()}
              disabled={escalationCheckMutation.isPending}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-[#D4A24C]/20 text-[#D4A24C] rounded-lg border border-[#D4A24C]/30 hover:bg-[#D4A24C]/30 disabled:opacity-50"
            >
              <ArrowUpCircle size={13} className={escalationCheckMutation.isPending ? "animate-spin" : ""} />
              {escalationCheckMutation.isPending ? "Checking..." : "Run Escalation"}
            </button>
            <button
              onClick={() => refetch()}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-white/5 text-white/60 rounded-lg border border-white/10 hover:bg-white/10"
            >
              <RefreshCw size={13} /> Refresh
            </button>
          </div>
        </div>

        <div className="flex gap-2">
          {(["queue", "analytics", "notifications"] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setViewTab(tab)}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg ${
                viewTab === tab ? "bg-primary/20 text-primary border border-primary/30" : "text-white/40 hover:text-white/60"
              }`}
            >
              {tab === "queue" && <ClipboardList size={12} />}
              {tab === "analytics" && <BarChart3 size={12} />}
              {tab === "notifications" && (
                <>
                  <Bell size={12} />
                  {unreadCount > 0 && (
                    <span className="bg-[#E05252] text-white text-[9px] font-bold rounded-full px-1.5">{unreadCount}</span>
                  )}
                </>
              )}
              {tab.charAt(0).toUpperCase() + tab.slice(1)}
            </button>
          ))}
        </div>

        {viewTab === "queue" && (
          <>
            {summary && (
              <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-3">
                <SummaryCard label="Open" value={summary.totals?.open ?? 0} color="text-primary" />
                <SummaryCard label="In Progress" value={summary.totals?.inProgress ?? 0} color="text-[#D4A24C]" />
                <SummaryCard label="Blocked" value={summary.totals?.blocked ?? 0} color="text-[#E05252]" />
                <SummaryCard label="Completed" value={summary.totals?.completed ?? 0} color="text-primary" />
                <SummaryCard label="Overdue" value={summary.totals?.overdue ?? 0} color="text-[#E05252]" />
                <SummaryCard label="My Tasks" value={summary.totals?.myTasks ?? 0} color="text-primary" />
                <SummaryCard label="Escalated" value={summary.byPriority?.filter((p: any) => p.priority === "CRITICAL").reduce((s: number, p: any) => s + p.total, 0) ?? 0} color="text-[#D4A24C]" />
                <SummaryCard label="Total" value={summary.totals?.total ?? 0} color="text-white/60" />
              </div>
            )}

            <div className="flex gap-1 overflow-x-auto pb-1">
              {QUEUE_TABS.map((tab) => (
                <button
                  key={tab.value}
                  onClick={() => setActiveQueue(tab.value)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg whitespace-nowrap transition-colors ${
                    activeQueue === tab.value
                      ? "bg-primary/20 text-primary border border-primary/30"
                      : "text-white/50 hover:text-white/70 border border-transparent"
                  }`}
                >
                  <tab.icon size={12} />
                  {tab.label}
                </button>
              ))}
            </div>

            <div className="flex gap-2">
              {["active", "all", "COMPLETED", "CANCELLED"].map((s) => (
                <button
                  key={s}
                  onClick={() => setStatusFilter(s)}
                  className={`px-2 py-1 text-[10px] font-medium rounded transition-colors ${
                    statusFilter === s ? "bg-white/10 text-white" : "text-white/40 hover:text-white/60"
                  }`}
                >
                  {s === "active" ? "Active" : s === "all" ? "All" : s.charAt(0) + s.slice(1).toLowerCase()}
                </button>
              ))}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2 space-y-2">
                {isLoading && <div className="text-white/30 text-sm py-8 text-center">Loading tasks...</div>}
                {!isLoading && filteredTasks.length === 0 && (
                  <div className="text-center py-16">
                    <ClipboardList className="w-10 h-10 text-muted-foreground/30 mx-auto mb-3" />
                    <h3 className="text-[15px] font-semibold text-foreground mb-1">No tasks in this queue</h3>
                    <p className="text-[13px] text-muted-foreground">Tasks will appear here as shipments are processed and policies trigger actions.</p>
                  </div>
                )}
                {filteredTasks.map((task: any) => {
                  const TaskIcon = TASK_TYPE_ICONS[task.taskType] || ClipboardList;
                  const isOverdue = task.dueAt && new Date(task.dueAt) < new Date() && ["OPEN", "IN_PROGRESS", "BLOCKED"].includes(task.status);
                  const isEscalated = (task.escalationLevel ?? 0) > 0;
                  const isAutoCreated = task.creationSource === "AUTO_POLICY";
                  return (
                    <motion.div
                      key={task.id}
                      onClick={() => setSelectedTask(task.id)}
                      className={`border rounded-lg p-4 cursor-pointer transition-colors ${
                        selectedTask === task.id
                          ? "border-primary/40 bg-primary/5"
                          : isOverdue
                            ? "border-red-500/30 bg-[#E05252]/5 hover:bg-[#E05252]/10"
                            : isEscalated
                              ? "border-[#D4A24C]/30 bg-[#D4A24C]/5 hover:bg-[#D4A24C]/10"
                              : "border-white/10 bg-white/[0.02] hover:bg-white/5"
                      }`}
                      whileHover={{ x: 2 }}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-start gap-3 min-w-0">
                          <div className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center shrink-0 mt-0.5">
                            <TaskIcon size={14} className="text-white/60" />
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-sm font-medium text-white truncate">{task.title}</span>
                              <span className={`px-1.5 py-0.5 text-[9px] font-bold uppercase rounded border ${STATUS_COLORS[task.status] || ""}`}>
                                {task.status.replace(/_/g, " ")}
                              </span>
                              <span className={`px-1.5 py-0.5 text-[9px] font-bold uppercase rounded ${PRIORITY_COLORS[task.priority] || ""}`}>
                                {task.priority}
                              </span>
                              {isEscalated && (
                                <span className="px-1.5 py-0.5 text-[9px] font-bold uppercase rounded bg-[#D4A24C]/20 text-[#D4A24C] border border-[#D4A24C]/30">
                                  L{task.escalationLevel}
                                </span>
                              )}
                              {isAutoCreated && (
                                <span className="px-1.5 py-0.5 text-[9px] font-bold uppercase rounded bg-primary/20 text-primary">
                                  Auto
                                </span>
                              )}
                              {task.needsAttentionNow && (
                                <span className="px-1.5 py-0.5 text-[9px] font-bold uppercase rounded bg-[#E05252]/30 text-red-200 animate-pulse">
                                  !!
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-3 mt-1 text-[11px] text-white/40">
                              <span>{TASK_TYPE_LABELS[task.taskType] || task.taskType}</span>
                              {task.shipmentId && (
                                <Link href={`/shipments/${task.shipmentId}`} onClick={(e: any) => e.stopPropagation()}>
                                  <span className="text-primary hover:text-primary">Shipment</span>
                                </Link>
                              )}
                              {task.dueAt && (
                                <span className={isOverdue ? "text-[#E05252]" : ""}>
                                  Due: {format(new Date(task.dueAt), "MMM d, h:mm a")}
                                </span>
                              )}
                              {task.priorityScore != null && usePrioritizedQueue && (
                                <span className="text-white/30">Score: {Number(task.priorityScore).toFixed(0)}</span>
                              )}
                            </div>
                          </div>
                        </div>
                        <ChevronRight size={14} className="text-white/20 shrink-0 mt-2" />
                      </div>
                    </motion.div>
                  );
                })}
              </div>

              <div className="space-y-4">
                {selectedTask && taskDetail ? (
                  <TaskDetailPanel
                    task={taskDetail}
                    onUpdate={(body: Record<string, any>) => {
                      updateMutation.mutate({ id: selectedTask, body });
                    }}
                    isUpdating={updateMutation.isPending}
                    currentUserId={userId}
                  />
                ) : (
                  <div className="border border-white/10 rounded-lg p-6 text-center">
                    <ClipboardList size={24} className="mx-auto text-white/20 mb-2" />
                    <p className="text-sm text-white/30">Select a task to view details</p>
                  </div>
                )}
              </div>
            </div>
          </>
        )}

        {viewTab === "analytics" && <WorkflowAnalyticsPanel analytics={workflowAnalytics} />}

        {viewTab === "notifications" && (
          <NotificationsPanel
            notifications={notifData?.data || []}
            onMarkAllRead={() => markAllReadMutation.mutate()}
            isMarking={markAllReadMutation.isPending}
          />
        )}
      </div>
    </AppLayout>
  );
}

function SummaryCard({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="border border-white/10 rounded-lg p-3 bg-white/[0.02]">
      <div className="text-[10px] uppercase tracking-wider text-white/40">{label}</div>
      <div className={`text-xl font-bold mt-1 ${color}`}>{value}</div>
    </div>
  );
}

function TaskDetailPanel({
  task,
  onUpdate,
  isUpdating,
  currentUserId,
}: {
  task: any;
  onUpdate: (body: Record<string, any>) => void;
  isUpdating: boolean;
  currentUserId?: string;
}) {
  const [notes, setNotes] = useState("");
  const [completionNotes, setCompletionNotes] = useState("");
  const [editingDue, setEditingDue] = useState(false);
  const [dueInput, setDueInput] = useState("");
  const [editingPriority, setEditingPriority] = useState(false);
  const isActive = ["OPEN", "IN_PROGRESS", "BLOCKED"].includes(task.status);
  const TaskIcon = TASK_TYPE_ICONS[task.taskType] || ClipboardList;
  const isEscalated = (task.escalationLevel ?? 0) > 0;
  const isAutoCreated = task.creationSource === "AUTO_POLICY";

  return (
    <div className="border border-white/10 rounded-lg bg-white/[0.02] overflow-hidden">
      <div className="p-4 border-b border-white/10">
        <div className="flex items-center gap-2 mb-2">
          <TaskIcon size={14} className="text-primary" />
          <span className="text-xs text-white/40">{TASK_TYPE_LABELS[task.taskType] || task.taskType}</span>
          {isAutoCreated && (
            <span className="px-1.5 py-0.5 text-[9px] font-bold bg-primary/20 text-primary rounded">Auto-Created</span>
          )}
          {isEscalated && (
            <span className="px-1.5 py-0.5 text-[9px] font-bold bg-[#D4A24C]/20 text-[#D4A24C] rounded">
              Escalated L{task.escalationLevel}
            </span>
          )}
        </div>
        <h3 className="text-sm font-semibold text-white">{task.title}</h3>
        {task.description && (
          <p className="text-[11px] text-white/50 mt-1 line-clamp-3">{task.description}</p>
        )}
        <div className="flex items-center gap-2 mt-3">
          <span className={`px-2 py-0.5 text-[10px] font-bold uppercase rounded border ${STATUS_COLORS[task.status] || ""}`}>
            {task.status.replace(/_/g, " ")}
          </span>
          <span className={`px-2 py-0.5 text-[10px] font-bold uppercase rounded ${PRIORITY_COLORS[task.priority] || ""}`}>
            {task.priority}
          </span>
        </div>
      </div>

      <div className="p-4 space-y-3 text-[11px]">
        {task.executionNotes && (
          <div>
            <span className="text-white/40">Action Required:</span>
            <p className="text-white/70 mt-0.5">{task.executionNotes}</p>
          </div>
        )}
        <div className="flex justify-between items-center">
          <span className="text-white/40">Due</span>
          {editingDue ? (
            <div className="flex items-center gap-1">
              <input
                type="datetime-local"
                className="bg-white/5 border border-white/10 rounded px-1 py-0.5 text-[10px] text-white/70 outline-none"
                value={dueInput}
                onChange={(e) => setDueInput(e.target.value)}
              />
              <button
                onClick={() => {
                  if (dueInput) onUpdate({ dueAt: new Date(dueInput).toISOString() });
                  setEditingDue(false);
                }}
                className="text-[9px] text-primary hover:text-primary"
              >Save</button>
              <button onClick={() => setEditingDue(false)} className="text-[9px] text-white/30">X</button>
            </div>
          ) : (
            <span
              onClick={() => { if (isActive) { setDueInput(task.dueAt ? new Date(task.dueAt).toISOString().slice(0, 16) : ""); setEditingDue(true); } }}
              className={`font-medium cursor-pointer hover:underline ${task.dueAt && new Date(task.dueAt) < new Date() && isActive ? "text-[#E05252]" : "text-white/70"}`}
            >
              {task.dueAt ? format(new Date(task.dueAt), "MMM d, yyyy h:mm a") : "Not set"}
            </span>
          )}
        </div>
        <div className="flex justify-between items-center">
          <span className="text-white/40">Priority</span>
          {editingPriority && isActive ? (
            <div className="flex gap-1">
              {(["LOW", "MEDIUM", "HIGH", "CRITICAL"] as const).map((p) => (
                <button
                  key={p}
                  onClick={() => { onUpdate({ priority: p }); setEditingPriority(false); }}
                  className={`px-1.5 py-0.5 text-[9px] font-bold uppercase rounded ${PRIORITY_COLORS[p]} ${p === task.priority ? "ring-1 ring-white/30" : ""}`}
                >
                  {p}
                </button>
              ))}
            </div>
          ) : (
            <span
              onClick={() => { if (isActive) setEditingPriority(true); }}
              className={`px-1.5 py-0.5 text-[9px] font-bold uppercase rounded cursor-pointer ${PRIORITY_COLORS[task.priority]}`}
            >
              {task.priority}
            </span>
          )}
        </div>
        <div className="flex justify-between items-center">
          <span className="text-white/40">Assigned</span>
          {isActive ? (
            <button
              onClick={() => onUpdate({ assignedTo: task.assignedTo ? null : currentUserId })}
              className="text-white/60 text-[10px] hover:text-white/80"
            >
              {task.assignedTo ? "Unassign" : "Assign to me"}
            </button>
          ) : (
            <span className="text-white/60">{task.assignedTo ? task.assignedTo.slice(0, 12) + "..." : "Unassigned"}</span>
          )}
        </div>
        {task.shipmentId && (
          <div className="flex justify-between">
            <span className="text-white/40">Shipment</span>
            <Link href={`/shipments/${task.shipmentId}`}>
              <span className="text-primary hover:text-primary font-mono">{task.shipmentId.slice(0, 12)}...</span>
            </Link>
          </div>
        )}
        {task.policyDecisionId && (
          <div className="flex justify-between">
            <span className="text-white/40">Policy</span>
            <span className="text-primary font-mono text-[9px]">{task.policyDecisionId.slice(0, 12)}...</span>
          </div>
        )}
        <div className="flex justify-between">
          <span className="text-white/40">Created</span>
          <span className="text-white/60">{format(new Date(task.createdAt), "MMM d, h:mm a")}</span>
        </div>
        {task.completionNotes && (
          <div>
            <span className="text-white/40">Completion Notes:</span>
            <p className="text-white/70 mt-0.5">{task.completionNotes}</p>
          </div>
        )}
      </div>

      {isActive && (
        <div className="p-4 border-t border-white/10 space-y-3">
          <div className="flex gap-1.5 flex-wrap">
            {task.status === "OPEN" && (
              <button
                onClick={() => onUpdate({ status: "IN_PROGRESS" })}
                disabled={isUpdating}
                className="flex items-center gap-1 px-2 py-1 text-[10px] font-medium bg-[#D4A24C]/20 text-[#D4A24C] rounded hover:bg-[#D4A24C]/30 border border-[#D4A24C]/30 disabled:opacity-50"
              >
                <Play size={10} /> Start
              </button>
            )}
            {task.status === "IN_PROGRESS" && (
              <button
                onClick={() => onUpdate({ status: "BLOCKED" })}
                disabled={isUpdating}
                className="flex items-center gap-1 px-2 py-1 text-[10px] font-medium bg-[#E05252]/20 text-red-300 rounded hover:bg-[#E05252]/30 border border-red-500/30 disabled:opacity-50"
              >
                <Pause size={10} /> Block
              </button>
            )}
            {task.status === "BLOCKED" && (
              <button
                onClick={() => onUpdate({ status: "IN_PROGRESS" })}
                disabled={isUpdating}
                className="flex items-center gap-1 px-2 py-1 text-[10px] font-medium bg-[#D4A24C]/20 text-[#D4A24C] rounded hover:bg-[#D4A24C]/30 border border-[#D4A24C]/30 disabled:opacity-50"
              >
                <RotateCcw size={10} /> Unblock
              </button>
            )}
            <button
              onClick={() => onUpdate({ status: "CANCELLED", notes: notes || "Cancelled by operator" })}
              disabled={isUpdating}
              className="flex items-center gap-1 px-2 py-1 text-[10px] font-medium bg-slate-500/20 text-slate-400 rounded hover:bg-slate-500/30 border border-slate-500/30 disabled:opacity-50"
            >
              <Ban size={10} /> Cancel
            </button>
          </div>

          <div>
            <textarea
              className="w-full p-2 rounded-lg bg-white/5 border border-white/10 focus:border-primary/40 outline-none resize-none h-16 text-[11px] text-white/70 placeholder:text-white/20"
              placeholder="Completion notes..."
              value={completionNotes}
              onChange={(e) => setCompletionNotes(e.target.value)}
            />
            <button
              onClick={() => {
                onUpdate({ status: "COMPLETED", completionNotes: completionNotes || "Completed" });
                setCompletionNotes("");
              }}
              disabled={isUpdating}
              className="flex items-center gap-1 px-3 py-1.5 text-[11px] font-medium bg-primary/20 text-primary rounded-lg hover:bg-primary/30 border border-primary/30 disabled:opacity-50 mt-1.5 w-full justify-center"
            >
              <CheckCircle2 size={12} /> Mark Complete
            </button>
          </div>

          <div>
            <textarea
              className="w-full p-2 rounded-lg bg-white/5 border border-white/10 focus:border-primary/40 outline-none resize-none h-12 text-[11px] text-white/70 placeholder:text-white/20"
              placeholder="Add a note..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
            {notes.trim() && (
              <button
                onClick={() => {
                  onUpdate({ notes });
                  setNotes("");
                }}
                disabled={isUpdating}
                className="text-[10px] text-primary hover:text-primary mt-1"
              >
                Add Note
              </button>
            )}
          </div>
        </div>
      )}

      {task.events && task.events.length > 0 && (
        <div className="p-4 border-t border-white/10">
          <h4 className="text-[10px] font-semibold text-white/50 uppercase tracking-wider mb-2">Audit Trail</h4>
          <div className="space-y-2 max-h-60 overflow-y-auto">
            {task.events.map((evt: any) => (
              <div key={evt.id} className="text-[10px] text-white/40">
                <div className="flex items-center justify-between">
                  <span className={`font-medium ${
                    evt.eventType === "ESCALATED" ? "text-[#D4A24C]" :
                    evt.eventType === "AUTO_CREATED" ? "text-primary" :
                    evt.eventType === "COMPLETED" ? "text-primary" :
                    evt.eventType === "CANCELLED" ? "text-[#E05252]" :
                    "text-white/60"
                  }`}>{evt.eventType.replace(/_/g, " ")}</span>
                  <span>{format(new Date(evt.createdAt), "MMM d, h:mm a")}</span>
                </div>
                {evt.beforeValue && evt.afterValue && (
                  <span className="text-white/30">{evt.beforeValue} → {evt.afterValue}</span>
                )}
                {evt.notes && <p className="text-white/50 mt-0.5">{evt.notes}</p>}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function WorkflowAnalyticsPanel({ analytics }: { analytics: any }) {
  if (!analytics) return <div className="text-white/30 text-sm py-8 text-center">Loading analytics...</div>;

  const { totals, byType, rates, avgAssignmentHours, policyOutcomes, funnel } = analytics;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <AnalyticsCard label="Completion Rate" value={`${rates?.completionRate ?? 0}%`} color="text-primary" />
        <AnalyticsCard label="Overdue Rate" value={`${rates?.overdueRate ?? 0}%`} color="text-[#E05252]" />
        <AnalyticsCard label="Escalation Rate" value={`${rates?.escalationRate ?? 0}%`} color="text-[#D4A24C]" />
        <AnalyticsCard label="Avg Assignment" value={avgAssignmentHours != null ? `${Number(avgAssignmentHours).toFixed(1)}h` : "N/A"} color="text-primary" />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="border border-white/10 rounded-lg p-4 bg-white/[0.02]">
          <h3 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
            <TrendingUp size={14} className="text-primary" /> Recommendation → Task Funnel
          </h3>
          <div className="space-y-2 text-[11px]">
            <FunnelRow label="Total Recommendations" value={funnel?.totalRecommendations ?? 0} max={funnel?.totalRecommendations ?? 1} color="bg-primary/60" />
            <FunnelRow label="Accepted/Modified" value={funnel?.acceptedRecommendations ?? 0} max={funnel?.totalRecommendations ?? 1} color="bg-[#D4A24C]" />
            <FunnelRow label="Tasks Created" value={funnel?.tasksCreated ?? 0} max={funnel?.totalRecommendations ?? 1} color="bg-primary" />
            <FunnelRow label="Tasks Completed" value={funnel?.tasksCompleted ?? 0} max={funnel?.totalRecommendations ?? 1} color="bg-primary" />
          </div>
        </div>

        <div className="border border-white/10 rounded-lg p-4 bg-white/[0.02]">
          <h3 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
            <Bot size={14} className="text-primary" /> Policy Outcomes
          </h3>
          {policyOutcomes && policyOutcomes.length > 0 ? (
            <div className="space-y-1.5">
              {policyOutcomes.map((p: any) => (
                <div key={p.outcome} className="flex justify-between text-[11px]">
                  <span className="text-white/50">{p.outcome.replace(/_/g, " ")}</span>
                  <span className="text-white/70 font-medium">{p.count}</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-[11px] text-white/30">No policy decisions yet. Click "Auto-Process Recs" to evaluate pending recommendations.</p>
          )}
        </div>
      </div>

      <div className="border border-white/10 rounded-lg p-4 bg-white/[0.02]">
        <h3 className="text-sm font-semibold text-white mb-3">Completion by Task Type</h3>
        <div className="space-y-2">
          {(byType || []).map((t: any) => (
            <div key={t.taskType} className="flex items-center justify-between text-[11px]">
              <span className="text-white/50">{TASK_TYPE_LABELS[t.taskType] || t.taskType}</span>
              <div className="flex gap-4">
                <span className="text-white/40">Active: {t.active}</span>
                <span className="text-primary">Done: {t.completed}</span>
                <span className="text-primary">Auto: {t.autoCreated}</span>
                {t.avgCompletionHours != null && (
                  <span className="text-white/30">Avg: {Number(t.avgCompletionHours).toFixed(1)}h</span>
                )}
              </div>
            </div>
          ))}
          {(!byType || byType.length === 0) && (
            <p className="text-[11px] text-white/30">No task data yet.</p>
          )}
        </div>
      </div>

      <div className="border border-white/10 rounded-lg p-4 bg-white/[0.02]">
        <h3 className="text-sm font-semibold text-white mb-3">Auto vs Manual Creation</h3>
        <div className="flex gap-8 text-[11px]">
          <div>
            <span className="text-white/40">Auto-Created: </span>
            <span className="text-primary font-bold">{totals?.autoCreated ?? 0}</span>
          </div>
          <div>
            <span className="text-white/40">Manual/Recommendation: </span>
            <span className="text-white/70 font-bold">{totals?.manualCreated ?? 0}</span>
          </div>
          <div>
            <span className="text-white/40">Escalated: </span>
            <span className="text-[#D4A24C] font-bold">{totals?.escalated ?? 0}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function AnalyticsCard({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className="border border-white/10 rounded-lg p-4 bg-white/[0.02]">
      <div className="text-[10px] uppercase tracking-wider text-white/40">{label}</div>
      <div className={`text-2xl font-bold mt-1 ${color}`}>{value}</div>
    </div>
  );
}

function FunnelRow({ label, value, max, color }: { label: string; value: number; max: number; color: string }) {
  const pct = max > 0 ? (value / max) * 100 : 0;
  return (
    <div>
      <div className="flex justify-between text-white/50 mb-0.5">
        <span>{label}</span>
        <span className="text-white/70 font-medium">{value}</span>
      </div>
      <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${Math.max(pct, 2)}%` }} />
      </div>
    </div>
  );
}

function NotificationsPanel({
  notifications,
  onMarkAllRead,
  isMarking,
}: {
  notifications: any[];
  onMarkAllRead: () => void;
  isMarking: boolean;
}) {
  const SEVERITY_COLORS: Record<string, string> = {
    CRITICAL: "border-red-500/30 bg-[#E05252]/5",
    WARNING: "border-[#D4A24C]/30 bg-[#D4A24C]/5",
    INFO: "border-white/10 bg-white/[0.02]",
  };

  const EVENT_ICONS: Record<string, any> = {
    TASK_ASSIGNED: User,
    TASK_AUTO_CREATED: Bot,
    TASK_OVERDUE: Clock,
    TASK_ESCALATED: ArrowUpCircle,
    RECOMMENDATION_CHANGED: RefreshCw,
    TASK_COMPLETED: CheckCircle2,
    TASK_BLOCKED: AlertTriangle,
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="text-sm font-semibold text-white">Operational Notifications</h3>
        <button
          onClick={onMarkAllRead}
          disabled={isMarking}
          className="text-[10px] text-primary hover:text-primary disabled:opacity-50"
        >
          Mark all as read
        </button>
      </div>
      {notifications.length === 0 && (
        <div className="text-white/30 text-sm py-8 text-center">No notifications</div>
      )}
      <div className="space-y-2 max-h-[600px] overflow-y-auto">
        {notifications.map((n: any) => {
          const Icon = EVENT_ICONS[n.eventType] || Bell;
          return (
            <div
              key={n.id}
              className={`border rounded-lg p-3 ${SEVERITY_COLORS[n.severity] || SEVERITY_COLORS.INFO} ${!n.read ? "ring-1 ring-primary/20" : ""}`}
            >
              <div className="flex items-start gap-2">
                <Icon size={14} className={`shrink-0 mt-0.5 ${n.severity === "CRITICAL" ? "text-[#E05252]" : n.severity === "WARNING" ? "text-[#D4A24C]" : "text-white/40"}`} />
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-medium text-white">{n.title}</span>
                    {!n.read && <span className="w-1.5 h-1.5 rounded-full bg-primary" />}
                  </div>
                  {n.message && <p className="text-[11px] text-white/50 mt-0.5">{n.message}</p>}
                  <div className="flex gap-3 mt-1 text-[10px] text-white/30">
                    <span>{n.eventType.replace(/_/g, " ")}</span>
                    <span>{format(new Date(n.createdAt), "MMM d, h:mm a")}</span>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
