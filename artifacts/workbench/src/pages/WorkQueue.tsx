import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link, useLocation } from "wouter";
import { motion } from "framer-motion";
import {
  ClipboardList,
  Clock,
  AlertTriangle,
  CheckCircle2,
  Loader2,
  User,
  ChevronRight,
  RefreshCw,
  Shield,
  DollarSign,
  Anchor,
  MapPin,
  FileText,
  Zap,
  Bell,
  Bot,
  TrendingUp,
  ArrowUpCircle,
  BarChart3,
  Ship,
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
  OPEN: "bg-primary/10 text-primary border-primary/20",
  IN_PROGRESS: "bg-[#D4A24C]/10 text-[#D4A24C] border-[#D4A24C]/20",
  BLOCKED: "bg-[#E05252]/10 text-[#E05252] border-[#E05252]/20",
  COMPLETED: "bg-primary/10 text-primary border-primary/20",
  CANCELLED: "bg-muted text-muted-foreground border-border",
};

const PRIORITY_COLORS: Record<string, string> = {
  CRITICAL: "bg-[#E05252]/10 text-[#E05252]",
  HIGH: "bg-[#D4A24C]/10 text-[#D4A24C]",
  MEDIUM: "bg-[#D4A24C]/10 text-[#D4A24C]",
  LOW: "bg-muted text-muted-foreground",
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
  const userId = user?.id;

  const buildQueryParams = () => {
    const params = new URLSearchParams();
    if (activeQueue === "my" && user?.id) params.set("assignedTo", user.id);
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

  const generateTasksMutation = useMutation({
    mutationFn: () => apiPost("/tasks/generate-from-issues"),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
    },
  });

  const generateNotifsMutation = useMutation({
    mutationFn: () => apiPost("/notifications/generate"),
    onSuccess: () => {
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

  const openCount = summary?.totals?.open ?? 0;
  const blockedCount = summary?.totals?.blocked ?? 0;
  const overdueCount = summary?.totals?.overdue ?? 0;
  const hasWork = openCount > 0 || blockedCount > 0 || overdueCount > 0;

  const voiceText = blockedCount > 0
    ? `${blockedCount} task${blockedCount > 1 ? "s" : ""} blocked — intervention needed`
    : overdueCount > 0
      ? `${overdueCount} overdue task${overdueCount > 1 ? "s" : ""}`
      : hasWork
        ? `${openCount} task${openCount > 1 ? "s" : ""} in queue`
        : "System operating normally";

  return (
    <AppLayout>
      <div className="p-6 max-w-[1400px] space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-[22px] font-bold text-foreground tracking-tight font-heading">Work Queue</h1>
            <p className={`text-[13px] mt-1 ${blockedCount > 0 ? "text-[#E05252]" : overdueCount > 0 ? "text-[#D4A24C]" : hasWork ? "text-foreground/60" : "text-primary/60"}`}>
              {voiceText}
            </p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => generateTasksMutation.mutate()}
              disabled={generateTasksMutation.isPending}
              className="flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-medium bg-primary/10 text-primary rounded-lg hover:bg-primary/15 disabled:opacity-50 transition-colors"
            >
              <RefreshCw size={13} className={generateTasksMutation.isPending ? "animate-spin" : ""} />
              {generateTasksMutation.isPending ? "Syncing..." : "Refresh Queue"}
            </button>
            <button
              onClick={() => applyBatchMutation.mutate()}
              disabled={applyBatchMutation.isPending}
              className="flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-medium bg-primary/10 text-primary rounded-lg hover:bg-primary/15 disabled:opacity-50 transition-colors"
            >
              <Bot size={13} className={applyBatchMutation.isPending ? "animate-spin" : ""} />
              {applyBatchMutation.isPending ? "Applying..." : "Auto-Process"}
            </button>
            <button
              onClick={() => escalationCheckMutation.mutate()}
              disabled={escalationCheckMutation.isPending}
              className="flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-medium bg-[#D4A24C]/10 text-[#D4A24C] rounded-lg hover:bg-[#D4A24C]/15 disabled:opacity-50 transition-colors"
            >
              <ArrowUpCircle size={13} className={escalationCheckMutation.isPending ? "animate-spin" : ""} />
              {escalationCheckMutation.isPending ? "Checking..." : "Escalation"}
            </button>
            <button
              onClick={() => refetch()}
              className="flex items-center gap-1.5 px-3 py-1.5 text-[11px] text-muted-foreground/40 rounded-lg hover:text-muted-foreground transition-colors"
            >
              <RefreshCw size={13} />
            </button>
          </div>
        </div>

        <div className="flex gap-2">
          {(["queue", "analytics", "notifications"] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setViewTab(tab)}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-medium rounded-lg transition-colors ${
                viewTab === tab ? "bg-primary/10 text-primary" : "text-muted-foreground/40 hover:text-foreground"
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
            {summary && hasWork && (
              <div className="flex items-center gap-8 text-[13px]">
                {openCount > 0 && (
                  <div>
                    <span className="text-muted-foreground/50 text-[11px] uppercase tracking-wider">Open</span>
                    <div className="mt-0.5"><span className="text-[20px] font-bold text-primary tabular-nums">{openCount}</span></div>
                  </div>
                )}
                {(summary.totals?.inProgress ?? 0) > 0 && (
                  <>
                    <div className="w-px h-8 bg-border/60" />
                    <div>
                      <span className="text-muted-foreground/50 text-[11px] uppercase tracking-wider">In Progress</span>
                      <div className="mt-0.5"><span className="text-[20px] font-bold text-[#D4A24C] tabular-nums">{summary.totals.inProgress}</span></div>
                    </div>
                  </>
                )}
                {blockedCount > 0 && (
                  <>
                    <div className="w-px h-8 bg-border/60" />
                    <div>
                      <span className="text-muted-foreground/50 text-[11px] uppercase tracking-wider">Blocked</span>
                      <div className="mt-0.5"><span className="text-[20px] font-bold text-[#E05252] tabular-nums">{blockedCount}</span></div>
                    </div>
                  </>
                )}
                {overdueCount > 0 && (
                  <>
                    <div className="w-px h-8 bg-border/60" />
                    <div>
                      <span className="text-muted-foreground/50 text-[11px] uppercase tracking-wider">Overdue</span>
                      <div className="mt-0.5"><span className="text-[20px] font-bold text-[#E05252] tabular-nums">{overdueCount}</span></div>
                    </div>
                  </>
                )}
              </div>
            )}

            <div className="flex gap-1 overflow-x-auto pb-1">
              {QUEUE_TABS.map((tab) => (
                <button
                  key={tab.value}
                  onClick={() => setActiveQueue(tab.value)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-medium rounded-lg whitespace-nowrap transition-colors ${
                    activeQueue === tab.value
                      ? "bg-primary/10 text-primary"
                      : "text-muted-foreground/40 hover:text-foreground"
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
                    statusFilter === s ? "bg-background text-foreground" : "text-muted-foreground/35 hover:text-foreground/60"
                  }`}
                >
                  {s === "active" ? "Active" : s === "all" ? "All" : s.charAt(0) + s.slice(1).toLowerCase()}
                </button>
              ))}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2 space-y-2">
                {isLoading && (
                  <div className="flex items-center justify-center py-16">
                    <Loader2 className="w-5 h-5 animate-spin text-muted-foreground/30" />
                  </div>
                )}
                {!isLoading && filteredTasks.length === 0 && (
                  <div className="text-center py-20">
                    <CheckCircle2 className="w-5 h-5 text-primary/20 mx-auto mb-2" />
                    <h3 className="text-[14px] font-medium text-foreground/60 mb-1">System operating normally</h3>
                    <p className="text-[13px] text-muted-foreground/40">Tasks will appear when shipments need intervention.</p>
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
                      className={`border rounded-lg p-4 cursor-pointer transition-all ${
                        selectedTask === task.id
                          ? "border-primary/30 bg-primary/[0.03]"
                          : isOverdue
                            ? "border-[#E05252]/15 hover:border-[#E05252]/25"
                            : isEscalated
                              ? "border-[#D4A24C]/15 hover:border-[#D4A24C]/25"
                              : "border-border/60 hover:border-border"
                      }`}
                      whileHover={{ x: 2 }}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-start gap-3 min-w-0">
                          <div className="w-7 h-7 rounded-lg bg-background flex items-center justify-center shrink-0 mt-0.5">
                            <TaskIcon size={13} className="text-muted-foreground/50" />
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-[13px] font-medium text-foreground truncate">{task.title}</span>
                              <span className={`px-1.5 py-0.5 text-[9px] font-bold uppercase rounded border ${STATUS_COLORS[task.status] || ""}`}>
                                {task.status.replace(/_/g, " ")}
                              </span>
                              <span className={`px-1.5 py-0.5 text-[9px] font-bold uppercase rounded ${PRIORITY_COLORS[task.priority] || ""}`}>
                                {task.priority}
                              </span>
                              {isEscalated && (
                                <span className="px-1.5 py-0.5 text-[9px] font-bold uppercase rounded bg-[#D4A24C]/10 text-[#D4A24C]">
                                  L{task.escalationLevel}
                                </span>
                              )}
                              {isAutoCreated && (
                                <span className="px-1.5 py-0.5 text-[9px] font-bold uppercase rounded bg-primary/10 text-primary">
                                  Auto
                                </span>
                              )}
                              {task.needsAttentionNow && (
                                <span className="px-1.5 py-0.5 text-[9px] font-bold uppercase rounded bg-[#E05252]/15 text-[#E05252] animate-pulse">
                                  !!
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-3 mt-1 text-[11px] text-muted-foreground/35">
                              <span>{TASK_TYPE_LABELS[task.taskType] || task.taskType}</span>
                              {task.shipmentId && (
                                <Link href={`/shipments/${task.shipmentId}`} onClick={(e: any) => e.stopPropagation()}>
                                  <span className="text-primary hover:text-primary/80">Shipment</span>
                                </Link>
                              )}
                              {task.dueAt && (
                                <span className={isOverdue ? "text-[#E05252]" : ""}>
                                  Due: {format(new Date(task.dueAt), "MMM d, h:mm a")}
                                </span>
                              )}
                              {task.priorityScore != null && usePrioritizedQueue && (
                                <span className="text-muted-foreground/20">Score: {Number(task.priorityScore).toFixed(0)}</span>
                              )}
                            </div>
                          </div>
                        </div>
                        <ChevronRight size={14} className="text-muted-foreground/15 shrink-0 mt-2" />
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
                  <div className="border border-border/40 rounded-lg p-6 text-center">
                    <ClipboardList size={20} className="mx-auto text-muted-foreground/15 mb-2" />
                    <p className="text-[13px] text-muted-foreground/30">Select a task to view details</p>
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
            onGenerate={() => generateNotifsMutation.mutate()}
            isGenerating={generateNotifsMutation.isPending}
          />
        )}
      </div>
    </AppLayout>
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
    <div className="border border-border/60 rounded-lg overflow-hidden">
      <div className="p-4 border-b border-border/40">
        <div className="flex items-center gap-2 mb-2">
          <TaskIcon size={13} className="text-primary/60" />
          <span className="text-[11px] text-muted-foreground/40">{TASK_TYPE_LABELS[task.taskType] || task.taskType}</span>
          {isAutoCreated && (
            <span className="px-1.5 py-0.5 text-[9px] font-bold bg-primary/10 text-primary rounded">Auto</span>
          )}
          {isEscalated && (
            <span className="px-1.5 py-0.5 text-[9px] font-bold bg-[#D4A24C]/10 text-[#D4A24C] rounded">
              Escalated L{task.escalationLevel}
            </span>
          )}
        </div>
        <h3 className="text-[13px] font-semibold text-foreground">{task.title}</h3>
        {task.description && (
          <p className="text-[11px] text-muted-foreground/40 mt-1 line-clamp-3">{task.description}</p>
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
            <span className="text-muted-foreground/40">Action Required:</span>
            <p className="text-foreground/60 mt-0.5">{task.executionNotes}</p>
          </div>
        )}
        <div className="flex justify-between items-center">
          <span className="text-muted-foreground/40">Due</span>
          {editingDue ? (
            <div className="flex items-center gap-1">
              <input
                type="datetime-local"
                className="bg-background border border-border rounded px-1 py-0.5 text-[10px] text-foreground/60 outline-none"
                value={dueInput}
                onChange={(e) => setDueInput(e.target.value)}
              />
              <button
                onClick={() => {
                  if (dueInput) onUpdate({ dueAt: new Date(dueInput).toISOString() });
                  setEditingDue(false);
                }}
                className="text-[9px] text-primary hover:text-primary/80"
              >
                Save
              </button>
            </div>
          ) : (
            <button
              onClick={() => setEditingDue(true)}
              className="text-foreground/50 hover:text-foreground"
            >
              {task.dueAt ? format(new Date(task.dueAt), "MMM d, h:mm a") : "Not set"}
            </button>
          )}
        </div>

        {task.assignedToName && (
          <div className="flex justify-between items-center">
            <span className="text-muted-foreground/40">Assigned</span>
            <span className="text-foreground/50">{task.assignedToName}</span>
          </div>
        )}

        {editingPriority ? (
          <div className="flex justify-between items-center">
            <span className="text-muted-foreground/40">Priority</span>
            <div className="flex gap-1">
              {["LOW", "MEDIUM", "HIGH", "CRITICAL"].map((p) => (
                <button
                  key={p}
                  onClick={() => {
                    onUpdate({ priority: p });
                    setEditingPriority(false);
                  }}
                  className={`px-1.5 py-0.5 text-[9px] rounded ${
                    task.priority === p ? "bg-primary/10 text-primary font-bold" : "text-muted-foreground/40 hover:text-foreground"
                  }`}
                >
                  {p}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="flex justify-between items-center">
            <span className="text-muted-foreground/40">Priority</span>
            <button
              onClick={() => setEditingPriority(true)}
              className="text-foreground/50 hover:text-foreground"
            >
              {task.priority}
            </button>
          </div>
        )}

        {task.shipmentId && (
          <div className="flex justify-between items-center">
            <span className="text-muted-foreground/40">Shipment</span>
            <Link href={`/shipments/${task.shipmentId}`}>
              <span className="text-primary hover:text-primary/80">View Shipment</span>
            </Link>
          </div>
        )}

        {isActive && (
          <div className="pt-3 border-t border-border/30 space-y-2">
            <div className="flex gap-1.5">
              {task.status === "OPEN" && (
                <button
                  onClick={() => onUpdate({ status: "IN_PROGRESS", assignedTo: currentUserId })}
                  disabled={isUpdating}
                  className="flex-1 px-2 py-1.5 text-[10px] font-medium bg-primary/10 text-primary rounded hover:bg-primary/15 disabled:opacity-50 transition-colors"
                >
                  Start
                </button>
              )}
              {task.status === "IN_PROGRESS" && (
                <button
                  onClick={() => onUpdate({ status: "BLOCKED" })}
                  disabled={isUpdating}
                  className="flex-1 px-2 py-1.5 text-[10px] font-medium bg-[#E05252]/10 text-[#E05252] rounded hover:bg-[#E05252]/15 disabled:opacity-50 transition-colors"
                >
                  Block
                </button>
              )}
              {task.status === "BLOCKED" && (
                <button
                  onClick={() => onUpdate({ status: "IN_PROGRESS" })}
                  disabled={isUpdating}
                  className="flex-1 px-2 py-1.5 text-[10px] font-medium bg-primary/10 text-primary rounded hover:bg-primary/15 disabled:opacity-50 transition-colors"
                >
                  Unblock
                </button>
              )}
            </div>

            <textarea
              placeholder="Completion notes..."
              value={completionNotes}
              onChange={(e) => setCompletionNotes(e.target.value)}
              className="w-full bg-background border border-border/60 rounded p-2 text-[11px] text-foreground/60 placeholder:text-muted-foreground/25 outline-none resize-none h-16"
            />
            <button
              onClick={() => {
                onUpdate({ status: "COMPLETED", completionNotes: completionNotes || undefined });
                setCompletionNotes("");
              }}
              disabled={isUpdating}
              className="w-full px-2 py-1.5 text-[10px] font-medium bg-primary text-primary-foreground rounded hover:bg-primary/90 disabled:opacity-50 transition-colors"
            >
              Complete Task
            </button>
          </div>
        )}

        {task.events && task.events.length > 0 && (
          <div className="pt-3 border-t border-border/30">
            <span className="text-muted-foreground/40 text-[10px] uppercase tracking-wider">History</span>
            <div className="mt-2 space-y-1.5">
              {task.events.slice(0, 5).map((ev: any, i: number) => (
                <div key={i} className="text-[10px] text-muted-foreground/35">
                  <span className="text-foreground/40">{ev.action}</span>
                  {ev.userName && <span> by {ev.userName}</span>}
                  {ev.createdAt && <span className="ml-1">{format(new Date(ev.createdAt), "MMM d")}</span>}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function WorkflowAnalyticsPanel({ analytics }: { analytics: any }) {
  if (!analytics) {
    return (
      <div className="text-center py-20">
        <BarChart3 className="w-5 h-5 text-muted-foreground/15 mx-auto mb-2" />
        <p className="text-[13px] text-muted-foreground/30">Loading analytics...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h2 className="text-[14px] font-semibold text-foreground font-heading">Workflow Analytics</h2>
      <div className="flex items-center gap-8 text-[13px]">
        <div>
          <span className="text-muted-foreground/50 text-[11px] uppercase tracking-wider">Avg Resolution</span>
          <div className="mt-0.5"><span className="text-[20px] font-bold text-foreground tabular-nums">{analytics.avgResolutionHours ? `${Math.round(analytics.avgResolutionHours)}h` : "—"}</span></div>
        </div>
        <div className="w-px h-8 bg-border/60" />
        <div>
          <span className="text-muted-foreground/50 text-[11px] uppercase tracking-wider">Completion Rate</span>
          <div className="mt-0.5"><span className="text-[20px] font-bold text-primary tabular-nums">{analytics.completionRate ? `${Math.round(analytics.completionRate)}%` : "—"}</span></div>
        </div>
        <div className="w-px h-8 bg-border/60" />
        <div>
          <span className="text-muted-foreground/50 text-[11px] uppercase tracking-wider">Auto-Processed</span>
          <div className="mt-0.5"><span className="text-[20px] font-bold text-foreground/60 tabular-nums">{analytics.autoProcessed ?? "—"}</span></div>
        </div>
      </div>
    </div>
  );
}

function NotificationsPanel({
  notifications,
  onMarkAllRead,
  isMarking,
  onGenerate,
  isGenerating,
}: {
  notifications: any[];
  onMarkAllRead: () => void;
  isMarking: boolean;
  onGenerate?: () => void;
  isGenerating?: boolean;
}) {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-[14px] font-semibold text-foreground font-heading">Notifications</h2>
        <div className="flex items-center gap-3">
          {onGenerate && (
            <button
              onClick={onGenerate}
              disabled={isGenerating}
              className="flex items-center gap-1.5 text-[11px] text-primary hover:text-primary/80 font-medium disabled:opacity-50 transition-colors"
            >
              {isGenerating ? <Loader2 size={11} className="animate-spin" /> : <Bell size={11} />}
              {isGenerating ? "Scanning..." : "Scan for alerts"}
            </button>
          )}
          <button
            onClick={onMarkAllRead}
            disabled={isMarking}
            className="text-[11px] text-primary hover:text-primary/80 font-medium disabled:opacity-50 transition-colors"
          >
            Mark all read
          </button>
        </div>
      </div>

      {notifications.length === 0 ? (
        <div className="text-center py-16">
          <Bell className="w-5 h-5 text-muted-foreground/15 mx-auto mb-2" />
          <p className="text-[13px] text-muted-foreground/30">No notifications</p>
        </div>
      ) : (
        <div className="space-y-1">
          {notifications.map((n: any) => (
            <div
              key={n.id}
              className={`px-4 py-3 rounded-lg transition-colors ${
                n.readAt ? "opacity-40" : "hover:bg-card"
              }`}
            >
              <div className="flex items-start gap-3">
                <div className={`w-1.5 h-1.5 rounded-full mt-1.5 shrink-0 ${n.readAt ? "bg-muted-foreground/15" : "bg-primary"}`} />
                <div className="flex-1 min-w-0">
                  <p className="text-[12px] text-foreground/70">{n.title || n.message}</p>
                  {n.createdAt && (
                    <span className="text-[10px] text-muted-foreground/30 mt-0.5 block">
                      {format(new Date(n.createdAt), "MMM d, h:mm a")}
                    </span>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
