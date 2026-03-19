import { useState, useEffect, useCallback } from "react";
import { useAuth } from "./use-auth";

function getBaseUrl() {
  return import.meta.env.BASE_URL.replace(/\/$/, "");
}

export interface SubscriptionInfo {
  billingStatus: string;
  planType: string | null;
  stripePriceId: string | null;
  stripeCustomerId: string | null;
  stripeSubscriptionId: string | null;
  seatLimit: number;
  shipmentLimitMonthly: number;
  seatsUsed: number;
  shipmentsUsedThisCycle: number;
  shipmentUsagePercent: number;
  shipmentWarning: string | null;
  currentPeriodStart: string | null;
  currentPeriodEnd: string | null;
  trialEndsAt: string | null;
  deploymentFeeStatus: string;
  onboardingPaid: boolean;
  onboardingCompletedAt: string | null;
  monthlyPrice: number | null;
  deploymentFeeCents: number | null;
  deploymentFeeRequirement: string | null;
  subscription: any;
}

export interface PlanConfigInfo {
  planType: string;
  name: string;
  description: string;
  monthlyPrice: number;
  annualPrice: number;
  seatLimit: number;
  shipmentLimit: number;
  deploymentFeeCents: number;
  deploymentFeeRequirement: string;
  trialDays: number;
  features: string[];
}

export interface PlanInfo {
  id: string;
  name: string;
  description: string;
  planType: string;
  features: string[];
  metadata: Record<string, string>;
  prices: Array<{
    id: string;
    unitAmount: number;
    currency: string;
    interval: string | null;
    type: string;
    priceType: string;
  }>;
}

export function useSubscription() {
  const { token } = useAuth();
  const [data, setData] = useState<SubscriptionInfo | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const refetch = useCallback(() => {
    if (!token) return;
    setIsLoading(true);
    fetch(`${getBaseUrl()}/api/stripe/subscription`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => r.json())
      .then((body) => setData(body.data ?? null))
      .catch(() => {})
      .finally(() => setIsLoading(false));
  }, [token]);

  useEffect(() => { refetch(); }, [refetch]);
  return { data, isLoading, refetch };
}

export function usePlans() {
  const { token } = useAuth();
  const [plans, setPlans] = useState<PlanInfo[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!token) return;
    fetch(`${getBaseUrl()}/api/stripe/plans`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => r.json())
      .then((body) => setPlans(body.data ?? []))
      .catch(() => {})
      .finally(() => setIsLoading(false));
  }, [token]);

  return { plans, isLoading };
}

export function usePlanConfig() {
  const { token } = useAuth();
  const [configs, setConfigs] = useState<PlanConfigInfo[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!token) return;
    fetch(`${getBaseUrl()}/api/stripe/plan-config`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => r.json())
      .then((body) => setConfigs(body.data ?? []))
      .catch(() => {})
      .finally(() => setIsLoading(false));
  }, [token]);

  return { configs, isLoading };
}

export function useCheckout() {
  const { token } = useAuth();
  const [isLoading, setIsLoading] = useState(false);

  const startCheckout = async (planType: string) => {
    if (!token) return;
    setIsLoading(true);
    try {
      const res = await fetch(`${getBaseUrl()}/api/stripe/checkout`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ planType }),
      });
      const body = await res.json();
      if (body.data?.url) {
        window.location.href = body.data.url;
      }
    } catch {
    } finally {
      setIsLoading(false);
    }
  };

  return { startCheckout, isLoading };
}

export function usePortal() {
  const { token } = useAuth();
  const [isLoading, setIsLoading] = useState(false);

  const openPortal = async () => {
    if (!token) return;
    setIsLoading(true);
    try {
      const res = await fetch(`${getBaseUrl()}/api/stripe/portal`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({}),
      });
      const body = await res.json();
      if (body.data?.url) {
        window.location.href = body.data.url;
      }
    } catch {
    } finally {
      setIsLoading(false);
    }
  };

  return { openPortal, isLoading };
}

export function useDemoActivate() {
  const { token } = useAuth();
  const [isLoading, setIsLoading] = useState(false);

  const activate = async (planType: string) => {
    if (!token) return;
    setIsLoading(true);
    try {
      const res = await fetch(`${getBaseUrl()}/api/stripe/activate-demo`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ planType }),
      });
      return await res.json();
    } catch {
      return null;
    } finally {
      setIsLoading(false);
    }
  };

  return { activate, isLoading };
}

export function useStartTrial() {
  const { token } = useAuth();
  const [isLoading, setIsLoading] = useState(false);

  const startTrial = async (planType: string) => {
    if (!token) return;
    setIsLoading(true);
    try {
      const res = await fetch(`${getBaseUrl()}/api/stripe/start-trial`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ planType }),
      });
      return await res.json();
    } catch {
      return null;
    } finally {
      setIsLoading(false);
    }
  };

  return { startTrial, isLoading };
}
