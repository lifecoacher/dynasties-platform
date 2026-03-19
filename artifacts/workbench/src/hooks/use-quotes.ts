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

export function useListQuotes(status?: string) {
  return useQuery({
    queryKey: ["quotes", status],
    queryFn: () => apiFetch(`/quotes${status ? `?status=${status}` : ""}`),
  });
}

export function useQuote(id: string | undefined) {
  return useQuery({
    queryKey: ["quote", id],
    queryFn: () => apiFetch(`/quotes/${id}`),
    enabled: !!id,
  });
}

export function useCreateQuote() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Record<string, unknown>) =>
      apiFetch("/quotes", { method: "POST", body: JSON.stringify(data) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["quotes"] }),
  });
}

export function useUpdateQuote() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Record<string, unknown> }) =>
      apiFetch(`/quotes/${id}`, { method: "PUT", body: JSON.stringify(data) }),
    onSuccess: (_d, v) => {
      qc.invalidateQueries({ queryKey: ["quotes"] });
      qc.invalidateQueries({ queryKey: ["quote", v.id] });
    },
  });
}

export function useAddLineItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ quoteId, data }: { quoteId: string; data: Record<string, unknown> }) =>
      apiFetch(`/quotes/${quoteId}/line-items`, { method: "POST", body: JSON.stringify(data) }),
    onSuccess: (_d, v) => qc.invalidateQueries({ queryKey: ["quote", v.quoteId] }),
  });
}

export function useDeleteLineItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ quoteId, itemId }: { quoteId: string; itemId: string }) =>
      apiFetch(`/quotes/${quoteId}/line-items/${itemId}`, { method: "DELETE" }),
    onSuccess: (_d, v) => qc.invalidateQueries({ queryKey: ["quote", v.quoteId] }),
  });
}

export function useQuoteAction() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, action }: { id: string; action: "send" | "accept" | "reject" | "convert" }) =>
      apiFetch(`/quotes/${id}/${action}`, { method: "POST", body: JSON.stringify({}) }),
    onSuccess: (_d, v) => {
      qc.invalidateQueries({ queryKey: ["quotes"] });
      qc.invalidateQueries({ queryKey: ["quote", v.id] });
    },
  });
}
