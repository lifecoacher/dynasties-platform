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

export function useAccountingStatus() {
  return useQuery({
    queryKey: ["accounting", "status"],
    queryFn: () => apiFetch("/accounting/status"),
  });
}

export function useConnectAccounting() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => apiFetch("/accounting/connect", { method: "POST" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["accounting"] }),
  });
}

export function useDisconnectAccounting() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => apiFetch("/accounting/disconnect", { method: "POST" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["accounting"] }),
  });
}

export function useSyncCustomer() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (customerBillingProfileId: string) =>
      apiFetch("/accounting/sync/customer", {
        method: "POST",
        body: JSON.stringify({ customerBillingProfileId }),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["accounting"] }),
  });
}

export function useSyncInvoice() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (invoiceId: string) =>
      apiFetch("/accounting/sync/invoice", {
        method: "POST",
        body: JSON.stringify({ invoiceId }),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["accounting"] }),
  });
}

export function useRefreshPaymentStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (invoiceId: string) =>
      apiFetch("/accounting/sync/payment-status", {
        method: "POST",
        body: JSON.stringify({ invoiceId }),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["accounting"] });
      qc.invalidateQueries({ queryKey: ["billing"] });
    },
  });
}

export function useAccountingMappings(entityType?: string) {
  const params = entityType ? `?entityType=${entityType}` : "";
  return useQuery({
    queryKey: ["accounting", "mappings", entityType],
    queryFn: () => apiFetch(`/accounting/mappings${params}`),
  });
}

export function useInvoiceSyncStatus(invoiceId: string | undefined) {
  return useQuery({
    queryKey: ["accounting", "invoice-sync", invoiceId],
    queryFn: () => apiFetch(`/accounting/invoice-sync/${invoiceId}`),
    enabled: !!invoiceId,
  });
}

export function useSimulateDemoPayment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (invoiceId: string) =>
      apiFetch("/accounting/demo/simulate-payment", {
        method: "POST",
        body: JSON.stringify({ invoiceId }),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["accounting"] });
      qc.invalidateQueries({ queryKey: ["billing"] });
    },
  });
}
