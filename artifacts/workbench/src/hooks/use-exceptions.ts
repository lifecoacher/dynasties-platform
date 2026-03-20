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
  const json = await res.json();
  if (!res.ok) throw new Error(json.error || "Request failed");
  return json;
}

export function useListExceptions(filters?: { status?: string; severity?: string; shipmentId?: string }) {
  const params = new URLSearchParams();
  if (filters?.status) params.set("status", filters.status);
  if (filters?.severity) params.set("severity", filters.severity);
  if (filters?.shipmentId) params.set("shipmentId", filters.shipmentId);
  const qs = params.toString();
  return useQuery({
    queryKey: ["exceptions", filters],
    queryFn: () => apiFetch(`/exceptions${qs ? `?${qs}` : ""}`),
  });
}

export function useException(id: string | undefined) {
  return useQuery({
    queryKey: ["exception", id],
    queryFn: () => apiFetch(`/exceptions/${id}`),
    enabled: !!id,
  });
}

export function useAlertsSummary() {
  return useQuery({
    queryKey: ["alerts-summary"],
    queryFn: () => apiFetch("/exceptions/alerts/summary"),
    refetchInterval: 30000,
  });
}

export function useShipmentAlerts(shipmentId: string | undefined) {
  return useQuery({
    queryKey: ["shipment-alerts", shipmentId],
    queryFn: () => apiFetch(`/exceptions/alerts/shipment/${shipmentId}`),
    enabled: !!shipmentId,
  });
}

export function useDetectExceptions() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (shipmentId: string) =>
      apiFetch(`/exceptions/detect/${shipmentId}`, { method: "POST" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["exceptions"] });
      qc.invalidateQueries({ queryKey: ["shipment-alerts"] });
      qc.invalidateQueries({ queryKey: ["alerts-summary"] });
    },
  });
}

export function useCreateException() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Record<string, unknown>) =>
      apiFetch("/exceptions", { method: "POST", body: JSON.stringify(data) }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["exceptions"] });
      qc.invalidateQueries({ queryKey: ["alerts-summary"] });
    },
  });
}

export function useUpdateException() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...data }: { id: string; [key: string]: unknown }) =>
      apiFetch(`/exceptions/${id}`, { method: "PATCH", body: JSON.stringify(data) }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["exceptions"] });
      qc.invalidateQueries({ queryKey: ["shipment-alerts"] });
      qc.invalidateQueries({ queryKey: ["alerts-summary"] });
    },
  });
}

export function useAssignException() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, assignedToUserId }: { id: string; assignedToUserId: string }) =>
      apiFetch(`/exceptions/${id}/assign`, { method: "POST", body: JSON.stringify({ assignedToUserId }) }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["exceptions"] });
      qc.invalidateQueries({ queryKey: ["shipment-alerts"] });
    },
  });
}

export function useEscalateException() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, reason }: { id: string; reason?: string }) =>
      apiFetch(`/exceptions/${id}/escalate`, { method: "POST", body: JSON.stringify({ reason }) }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["exceptions"] });
      qc.invalidateQueries({ queryKey: ["shipment-alerts"] });
      qc.invalidateQueries({ queryKey: ["alerts-summary"] });
    },
  });
}

export function useResolveException() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, resolutionNotes }: { id: string; resolutionNotes: string }) =>
      apiFetch(`/exceptions/${id}/resolve`, { method: "POST", body: JSON.stringify({ resolutionNotes }) }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["exceptions"] });
      qc.invalidateQueries({ queryKey: ["shipment-alerts"] });
      qc.invalidateQueries({ queryKey: ["alerts-summary"] });
    },
  });
}
