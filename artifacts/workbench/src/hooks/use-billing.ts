import { useState, useEffect, useCallback } from "react";
import { useAuth } from "./use-auth";

function getBaseUrl() {
  return import.meta.env.BASE_URL.replace(/\/$/, "");
}

function useBillingFetch<T>(path: string, deps: unknown[] = []) {
  const { token } = useAuth();
  const [data, setData] = useState<T | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refetch = useCallback(() => {
    if (!token) return;
    setIsLoading(true);
    fetch(`${getBaseUrl()}/api/billing/${path}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => r.json())
      .then((body) => {
        setData(body.data ?? null);
        setError(null);
      })
      .catch((e) => setError(e.message))
      .finally(() => setIsLoading(false));
  }, [token, path, ...deps]);

  useEffect(() => { refetch(); }, [refetch]);

  return { data, isLoading, error, refetch };
}

export function useBillingAccount() {
  return useBillingFetch<any>("account");
}

export function useBillingCustomers() {
  return useBillingFetch<any[]>("customers");
}

export function useBillingCustomer(id: string) {
  return useBillingFetch<any>(`customers/${id}`, [id]);
}

export function useBillingInvoices(status?: string) {
  const path = status ? `invoices?status=${status}` : "invoices";
  return useBillingFetch<any[]>(path, [status]);
}

export function useBillingInvoice(id: string) {
  return useBillingFetch<any>(`invoices/${id}`, [id]);
}

export function useReceivablesOverview() {
  return useBillingFetch<any>("receivables/overview");
}

export function useChargeRules() {
  return useBillingFetch<any[]>("charge-rules");
}

export function usePaymentConfig() {
  return useBillingFetch<any>("payment-config");
}

export function useBillingAction() {
  const { token } = useAuth();

  return useCallback(
    async (path: string, method: string = "POST", body?: any) => {
      const res = await fetch(`${getBaseUrl()}/api/billing/${path}`, {
        method,
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: body ? JSON.stringify(body) : undefined,
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Request failed");
      return json.data;
    },
    [token],
  );
}
