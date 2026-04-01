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
