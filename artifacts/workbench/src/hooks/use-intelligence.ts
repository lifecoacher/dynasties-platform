import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getAuthToken } from "@workspace/api-client-react";

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

async function apiPost<T>(path: string, body: Record<string, unknown>): Promise<T> {
  const token = getAuthToken();
  const res = await fetch(`${BASE}${path}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  const json = await res.json();
  return json.data;
}

export function useHighRiskPorts() {
  return useQuery({
    queryKey: ["intelligence", "ports", "high-risk"],
    queryFn: () => apiFetch<any[]>("/intelligence/ports/high-risk"),
    staleTime: 60_000,
  });
}

export function useActiveDisruptions() {
  return useQuery({
    queryKey: ["intelligence", "disruptions"],
    queryFn: () => apiFetch<any[]>("/intelligence/disruptions"),
    staleTime: 60_000,
  });
}

export function useWeatherRisks() {
  return useQuery({
    queryKey: ["intelligence", "weather-risks"],
    queryFn: () => apiFetch<any[]>("/intelligence/weather-risks"),
    staleTime: 60_000,
  });
}

export function useSanctionsAlerts() {
  return useQuery({
    queryKey: ["intelligence", "sanctions-alerts"],
    queryFn: () => apiFetch<{ sanctions: any[]; deniedParties: any[] }>("/intelligence/sanctions-alerts"),
    staleTime: 120_000,
  });
}

export function useCongestion() {
  return useQuery({
    queryKey: ["intelligence", "congestion"],
    queryFn: () => apiFetch<any[]>("/intelligence/congestion"),
    staleTime: 60_000,
  });
}

export function useVesselPositions() {
  return useQuery({
    queryKey: ["intelligence", "vessels"],
    queryFn: () => apiFetch<any[]>("/intelligence/vessels"),
    staleTime: 30_000,
  });
}

export function useIngestionRuns() {
  return useQuery({
    queryKey: ["intelligence", "ingestion-runs"],
    queryFn: () => apiFetch<any[]>("/intelligence/ingestion-runs"),
    staleTime: 30_000,
  });
}

export function useTriggerIngestion() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (sourceType: string) => apiPost<any>("/intelligence/ingest", { sourceType }),
    onSuccess: () => {
      setTimeout(() => {
        qc.invalidateQueries({ queryKey: ["intelligence"] });
      }, 3000);
    },
  });
}
