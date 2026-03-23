import { useQuery } from "@tanstack/react-query";
import { getAuthToken } from "@workspace/api-client-react";

const BASE = `${import.meta.env.BASE_URL}api`;

export interface DashboardStats {
  shipments: {
    total: number;
    active: number;
    pendingReview: number;
    inTransit: number;
    draft: number;
    delivered: number;
  };
  compliance: {
    total: number;
    clear: number;
    flagged: number;
    unscreened: number;
  };
  risk: {
    total: number;
    high: number;
    medium: number;
    low: number;
  };
  recommendations: {
    total: number;
    pending: number;
    critical: number;
    high: number;
  };
  tasks: {
    total: number;
    open: number;
    overdue: number;
  };
}

export function useDashboardStats() {
  return useQuery<DashboardStats>({
    queryKey: ["dashboard", "stats"],
    queryFn: async () => {
      const token = getAuthToken();
      const res = await fetch(`${BASE}/dashboard/stats`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error(`Dashboard stats error: ${res.status}`);
      const json = await res.json();
      return json.data;
    },
    staleTime: 30_000,
    refetchInterval: 60_000,
  });
}
