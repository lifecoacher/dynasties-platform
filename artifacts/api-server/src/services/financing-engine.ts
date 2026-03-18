const PROVIDER_RATE = 0.025;
const PLATFORM_SPREAD = 0.005;
const CUSTOMER_RATE = PROVIDER_RATE + PLATFORM_SPREAD;

export interface FinancingTerms {
  eligible: boolean;
  providerRate: number;
  platformSpread: number;
  customerRate: number;
  outstandingAmount: number;
  financingFee: number;
  advanceAmount: number;
  platformRevenue: number;
}

export function computeFinancingTerms(params: {
  invoiceStatus: string;
  outstandingAmount: number;
  financeEligible: boolean;
}): FinancingTerms {
  const eligible =
    params.financeEligible &&
    params.invoiceStatus === "OVERDUE" &&
    params.outstandingAmount > 0;

  if (!eligible) {
    return {
      eligible: false,
      providerRate: 0,
      platformSpread: 0,
      customerRate: 0,
      outstandingAmount: params.outstandingAmount,
      financingFee: 0,
      advanceAmount: 0,
      platformRevenue: 0,
    };
  }

  const amt = params.outstandingAmount;
  const financingFee = Math.round(amt * CUSTOMER_RATE * 100) / 100;
  const advanceAmount = Math.round((amt - financingFee) * 100) / 100;
  const platformRevenue = Math.round(amt * PLATFORM_SPREAD * 100) / 100;

  return {
    eligible: true,
    providerRate: PROVIDER_RATE,
    platformSpread: PLATFORM_SPREAD,
    customerRate: CUSTOMER_RATE,
    outstandingAmount: amt,
    financingFee,
    advanceAmount,
    platformRevenue,
  };
}

const VALID_TRANSITIONS: Record<string, string[]> = {
  NONE: ["OFFERED"],
  OFFERED: ["FUNDED", "DECLINED"],
  FUNDED: ["REPAID"],
};

export function validateFinanceTransition(
  current: string,
  next: string,
): { valid: boolean; error?: string } {
  const allowed = VALID_TRANSITIONS[current];
  if (!allowed || !allowed.includes(next)) {
    return {
      valid: false,
      error: `Invalid financing transition: ${current} → ${next}`,
    };
  }
  return { valid: true };
}
