import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getAuthToken } from "@workspace/api-client-react";

const BASE = import.meta.env.VITE_API_URL || "/api";

async function apiFetch(path: string, options?: RequestInit) {
  const token = getAuthToken();
  const res = await fetch(`${BASE}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options?.headers,
    },
  });
  const text = await res.text();
  let json: any;
  try {
    json = JSON.parse(text);
  } catch {
    throw new Error(`Server error (${res.status})`);
  }
  if (!res.ok) throw new Error(json.error || `Request failed (${res.status})`);
  return json.data ?? json;
}

export function useAiState(shipmentId: string | undefined) {
  return useQuery({
    queryKey: ["ai-state", shipmentId],
    queryFn: () => apiFetch(`/shipments/${shipmentId}/ai-state`),
    enabled: !!shipmentId,
    refetchInterval: 30000,
  });
}

export function useAiAnalysisHistory(shipmentId: string | undefined) {
  return useQuery({
    queryKey: ["ai-analysis-history", shipmentId],
    queryFn: () => apiFetch(`/shipments/${shipmentId}/ai-analysis-history`),
    enabled: !!shipmentId,
  });
}

export function useAiEventLog(shipmentId: string | undefined) {
  return useQuery({
    queryKey: ["ai-event-log", shipmentId],
    queryFn: () => apiFetch(`/shipments/${shipmentId}/ai-event-log`),
    enabled: !!shipmentId,
  });
}

export function useAiReanalyze(shipmentId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () =>
      apiFetch(`/shipments/${shipmentId}/ai-reanalyze`, { method: "POST", body: JSON.stringify({}) }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["ai-state", shipmentId] });
      qc.invalidateQueries({ queryKey: ["ai-analysis-history", shipmentId] });
      qc.invalidateQueries({ queryKey: ["ai-event-log", shipmentId] });
    },
  });
}

export function useRecommendationsWithTasks(shipmentId: string | undefined) {
  return useQuery({
    queryKey: ["recommendations-with-tasks", shipmentId],
    queryFn: () => apiFetch(`/shipments/${shipmentId}/recommendations/with-tasks`),
    enabled: !!shipmentId,
    refetchInterval: 15000,
  });
}

export function useAcceptRecommendation(shipmentId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (recId: string) =>
      apiFetch(`/recommendations/${recId}/accept`, { method: "POST" }),
    onSuccess: () => invalidateRecQueries(qc, shipmentId),
  });
}

export function useRejectRecommendation(shipmentId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (recId: string) =>
      apiFetch(`/recommendations/${recId}/reject`, { method: "POST" }),
    onSuccess: () => invalidateRecQueries(qc, shipmentId),
  });
}

export function useModifyRecommendation(shipmentId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ recId, modificationNotes }: { recId: string; modificationNotes: string }) =>
      apiFetch(`/recommendations/${recId}/modify`, {
        method: "POST",
        body: JSON.stringify({ modificationNotes }),
      }),
    onSuccess: () => invalidateRecQueries(qc, shipmentId),
  });
}

export function useIgnoreRecommendation(shipmentId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (recId: string) =>
      apiFetch(`/recommendations/${recId}/ignore`, { method: "POST" }),
    onSuccess: () => invalidateRecQueries(qc, shipmentId),
  });
}

function invalidateRecQueries(qc: ReturnType<typeof useQueryClient>, shipmentId: string | undefined) {
  qc.invalidateQueries({ queryKey: ["recommendations-with-tasks", shipmentId] });
  qc.invalidateQueries({ queryKey: ["ai-state", shipmentId] });
  qc.invalidateQueries({ queryKey: ["ai-analysis-history", shipmentId] });
}
