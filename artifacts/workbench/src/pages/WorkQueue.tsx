import { useState, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link, useLocation } from "wouter";
import { motion } from "framer-motion";
import {
  ClipboardList,
  Clock,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  User,
  ChevronRight,
  Filter,
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

type QueueFilter = "all" | "my" | "compliance" | "pricing" | "carrier" | "insurance" | "documents" | "disruption" | "overdue";

const QUEUE_TABS: { value: QueueFilter; label: string; icon: any }[] = [
  { value: "all", label: "All Tasks", icon: ClipboardList },
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
  OPEN: "bg-blue-500/20 text-blue-300 border-blue-500/30",
  IN_PROGRESS: "bg-amber-500/20 text-amber-300 border-amber-500/30",
  BLOCKED: "bg-red-500/20 text-red-300 border-red-500/30",
  COMPLETED: "bg-emerald-500/20 text-emerald-300 border-emerald-500/30",
  CANCELLED: "bg-slate-500/20 text-slate-400 border-slate-500/30",
};

const PRIORITY_COLORS: Record<string, string> = {
  CRITICAL: "bg-red-500/20 text-red-300",
  HIGH: "bg-orange-500/20 text-orange-300",
  MEDIUM: "bg-amber-500/20 text-amber-300",
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
  const [, navigate] = useLocation();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [activeQueue, setActiveQueue] = useState<QueueFilter>("all");
  const [statusFilter, setStatusFilter] = useState<string>("active");
  const [selectedTask, setSelectedTask] = useState<string | null>(null);
  const userId = user?.userId;

  const buildQueryParams = () => {
    const params = new URLSearchParams();
    if (activeQueue === "my" && user?.userId) params.set("assignedTo", user.userId);
    else if (activeQueue === "overdue") params.set("overdue", "true");
    else if (activeQueue !== "all") params.set("queue", activeQueue);
    if (statusFilter === "active") {
    } else if (statusFilter !== "all") {
      params.set("status", statusFilter);
    }
    return params.toString();
  };

  const { data: tasks, isLoading, refetch } = useQuery({
    queryKey: ["tasks", activeQueue, statusFilter],
    queryFn: () => {
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

  const updateMutation = useMutation({
    mutationFn: ({ id, body }: { id: string; body: Record<string, any> }) =>
      apiPatch(`/tasks/${id}`, body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
      queryClient.invalidateQueries({ queryKey: ["task", selectedTask] });
    },
  });

  const filteredTasks = (tasks || []).filter((t: any) => {
    if (statusFilter === "active") {
      return ["OPEN", "IN_PROGRESS", "BLOCKED"].includes(t.status);
    }
    return true;
  });

  return (
    <AppLayout>
      <div className="p-6 max-w-[1400px] space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-white flex items-center gap-2">
              <ClipboardList className="w-6 h-6 text-violet-400" />
              Work Queue
            </h1>
            <p className="text-sm text-white/50 mt-1">Task management and workflow execution</p>
          </div>
          <button
            onClick={() => refetch()}
            className="flex items-center gap-2 px-3 py-1.5 text-sm bg-white/5 text-white/60 rounded-lg border border-white/10 hover:bg-white/10 transition-colors"
          >
            <RefreshCw size={14} /> Refresh
          </button>
        </div>

        {summary && (
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
            <SummaryCard label="Open" value={summary.totals?.open ?? 0} color="text-blue-400" />
            <SummaryCard label="In Progress" value={summary.totals?.inProgress ?? 0} color="text-amber-400" />
            <SummaryCard label="Blocked" value={summary.totals?.blocked ?? 0} color="text-red-400" />
            <SummaryCard label="Completed" value={summary.totals?.completed ?? 0} color="text-emerald-400" />
            <SummaryCard label="Overdue" value={summary.totals?.overdue ?? 0} color="text-red-400" />
            <SummaryCard label="My Tasks" value={summary.totals?.myTasks ?? 0} color="text-violet-400" />
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
                  ? "bg-violet-500/20 text-violet-300 border border-violet-500/30"
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
                statusFilter === s
                  ? "bg-white/10 text-white"
                  : "text-white/40 hover:text-white/60"
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
              <div className="text-white/30 text-sm py-8 text-center">No tasks in this queue</div>
            )}
            {filteredTasks.map((task: any) => {
              const TaskIcon = TASK_TYPE_ICONS[task.taskType] || ClipboardList;
              const isOverdue = task.dueAt && new Date(task.dueAt) < new Date() && ["OPEN", "IN_PROGRESS", "BLOCKED"].includes(task.status);
              return (
                <motion.div
                  key={task.id}
                  onClick={() => setSelectedTask(task.id)}
                  className={`border rounded-lg p-4 cursor-pointer transition-colors ${
                    selectedTask === task.id
                      ? "border-violet-500/40 bg-violet-500/5"
                      : isOverdue
                        ? "border-red-500/30 bg-red-500/5 hover:bg-red-500/10"
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
                        </div>
                        <div className="flex items-center gap-3 mt-1 text-[11px] text-white/40">
                          <span>{TASK_TYPE_LABELS[task.taskType] || task.taskType}</span>
                          {task.shipmentId && (
                            <Link href={`/shipments/${task.shipmentId}`} onClick={(e: any) => e.stopPropagation()}>
                              <span className="text-violet-400 hover:text-violet-300">
                                Shipment
                              </span>
                            </Link>
                          )}
                          {task.dueAt && (
                            <span className={isOverdue ? "text-red-400" : ""}>
                              Due: {format(new Date(task.dueAt), "MMM d, h:mm a")}
                            </span>
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

  return (
    <div className="border border-white/10 rounded-lg bg-white/[0.02] overflow-hidden">
      <div className="p-4 border-b border-white/10">
        <div className="flex items-center gap-2 mb-2">
          <TaskIcon size={14} className="text-violet-400" />
          <span className="text-xs text-white/40">{TASK_TYPE_LABELS[task.taskType] || task.taskType}</span>
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
                className="text-[9px] text-emerald-400 hover:text-emerald-300"
              >Save</button>
              <button onClick={() => setEditingDue(false)} className="text-[9px] text-white/30">X</button>
            </div>
          ) : (
            <span
              onClick={() => { if (isActive) { setDueInput(task.dueAt ? new Date(task.dueAt).toISOString().slice(0, 16) : ""); setEditingDue(true); } }}
              className={`font-medium cursor-pointer hover:underline ${task.dueAt && new Date(task.dueAt) < new Date() && isActive ? "text-red-400" : "text-white/70"}`}
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
              <span className="text-violet-400 hover:text-violet-300 font-mono">{task.shipmentId.slice(0, 12)}...</span>
            </Link>
          </div>
        )}
        {task.recommendationId && (
          <div className="flex justify-between">
            <span className="text-white/40">Recommendation</span>
            <span className="text-white/60 font-mono">{task.recommendationId.slice(0, 12)}...</span>
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
                className="flex items-center gap-1 px-2 py-1 text-[10px] font-medium bg-amber-500/20 text-amber-300 rounded hover:bg-amber-500/30 border border-amber-500/30 disabled:opacity-50"
              >
                <Play size={10} /> Start
              </button>
            )}
            {task.status === "IN_PROGRESS" && (
              <button
                onClick={() => onUpdate({ status: "BLOCKED" })}
                disabled={isUpdating}
                className="flex items-center gap-1 px-2 py-1 text-[10px] font-medium bg-red-500/20 text-red-300 rounded hover:bg-red-500/30 border border-red-500/30 disabled:opacity-50"
              >
                <Pause size={10} /> Block
              </button>
            )}
            {task.status === "BLOCKED" && (
              <button
                onClick={() => onUpdate({ status: "IN_PROGRESS" })}
                disabled={isUpdating}
                className="flex items-center gap-1 px-2 py-1 text-[10px] font-medium bg-amber-500/20 text-amber-300 rounded hover:bg-amber-500/30 border border-amber-500/30 disabled:opacity-50"
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
              className="w-full p-2 rounded-lg bg-white/5 border border-white/10 focus:border-violet-500/40 outline-none resize-none h-16 text-[11px] text-white/70 placeholder:text-white/20"
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
              className="flex items-center gap-1 px-3 py-1.5 text-[11px] font-medium bg-emerald-500/20 text-emerald-300 rounded-lg hover:bg-emerald-500/30 border border-emerald-500/30 disabled:opacity-50 mt-1.5 w-full justify-center"
            >
              <CheckCircle2 size={12} /> Mark Complete
            </button>
          </div>

          <div>
            <textarea
              className="w-full p-2 rounded-lg bg-white/5 border border-white/10 focus:border-violet-500/40 outline-none resize-none h-12 text-[11px] text-white/70 placeholder:text-white/20"
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
                className="text-[10px] text-violet-400 hover:text-violet-300 mt-1"
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
                  <span className="font-medium text-white/60">{evt.eventType.replace(/_/g, " ")}</span>
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
