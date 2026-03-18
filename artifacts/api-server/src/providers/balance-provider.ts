export interface FinanceOffer {
  offerId: string;
  termDays: number;
  financedAmount: number;
  providerFeeRate: number;
  providerFeeAmount: number;
  status: "AVAILABLE" | "EXPIRED";
  expiresAt: string;
}

export interface FinanceApplication {
  applicationId: string;
  status: "APPROVED" | "DECLINED" | "PENDING";
  termDays?: number;
  financedAmount?: number;
  providerFeeRate?: number;
  providerFeeAmount?: number;
  declineReason?: string;
  externalRef?: string;
}

export interface FinanceSettlement {
  status: "FUNDED" | "REPAID" | "FAILED";
  settledAt?: string;
}

export interface BalanceProvider {
  name: string;
  mode: "SANDBOX" | "LIVE";
  requestOffer(params: {
    invoiceId: string;
    amount: number;
    currency: string;
    customerName: string;
    customerEmail: string;
  }): Promise<FinanceOffer[]>;
  applyForFinancing(params: {
    offerId: string;
    invoiceId: string;
    termDays: number;
  }): Promise<FinanceApplication>;
  checkStatus(externalRef: string): Promise<FinanceSettlement>;
}

export class SandboxBalanceProvider implements BalanceProvider {
  name = "balance-sandbox";
  mode = "SANDBOX" as const;

  async requestOffer(params: {
    invoiceId: string;
    amount: number;
    currency: string;
    customerName: string;
    customerEmail: string;
  }): Promise<FinanceOffer[]> {
    const baseId = params.invoiceId.slice(-8);
    const offers: FinanceOffer[] = [];
    if (params.amount >= 1000 && params.amount <= 500000) {
      offers.push({
        offerId: `offer_30_${baseId}`,
        termDays: 30,
        financedAmount: params.amount,
        providerFeeRate: 0.02,
        providerFeeAmount: Math.round(params.amount * 0.02 * 100) / 100,
        status: "AVAILABLE",
        expiresAt: new Date(Date.now() + 7 * 86400000).toISOString(),
      });
    }
    if (params.amount >= 5000 && params.amount <= 500000) {
      offers.push({
        offerId: `offer_60_${baseId}`,
        termDays: 60,
        financedAmount: params.amount,
        providerFeeRate: 0.035,
        providerFeeAmount: Math.round(params.amount * 0.035 * 100) / 100,
        status: "AVAILABLE",
        expiresAt: new Date(Date.now() + 7 * 86400000).toISOString(),
      });
    }
    return offers;
  }

  async applyForFinancing(params: {
    offerId: string;
    invoiceId: string;
    termDays: number;
  }): Promise<FinanceApplication> {
    const hash = params.invoiceId.split("").reduce((a, c) => a + c.charCodeAt(0), 0);
    const approved = hash % 5 !== 0;
    if (approved) {
      const rate = params.termDays <= 30 ? 0.02 : 0.035;
      const amount = 10000;
      return {
        applicationId: `app_${params.offerId}`,
        status: "APPROVED",
        termDays: params.termDays,
        financedAmount: amount,
        providerFeeRate: rate,
        providerFeeAmount: Math.round(amount * rate * 100) / 100,
        externalRef: `bal_${Date.now().toString(36)}`,
      };
    }
    return {
      applicationId: `app_${params.offerId}`,
      status: "DECLINED",
      declineReason: "Insufficient credit history for requested term",
    };
  }

  async checkStatus(externalRef: string): Promise<FinanceSettlement> {
    return {
      status: "FUNDED",
      settledAt: new Date().toISOString(),
    };
  }
}

export interface SpreadCalculation {
  providerFeeRate: number;
  providerFeeAmount: number;
  clientFacingFeeRate: number;
  clientFacingFeeAmount: number;
  dynastiesSpreadAmount: number;
}

export function calculateSpread(params: {
  financedAmount: number;
  providerFeeRate: number;
  spreadModel: "PASS_THROUGH" | "ABSORBED" | "MARKUP" | "PLATFORM_FEE";
  spreadBps: number;
  platformFeeAmount: number;
}): SpreadCalculation {
  const providerFeeAmount = Math.round(params.financedAmount * params.providerFeeRate * 100) / 100;
  switch (params.spreadModel) {
    case "PASS_THROUGH":
      return {
        providerFeeRate: params.providerFeeRate,
        providerFeeAmount,
        clientFacingFeeRate: params.providerFeeRate,
        clientFacingFeeAmount: providerFeeAmount,
        dynastiesSpreadAmount: 0,
      };
    case "ABSORBED":
      return {
        providerFeeRate: params.providerFeeRate,
        providerFeeAmount,
        clientFacingFeeRate: 0,
        clientFacingFeeAmount: 0,
        dynastiesSpreadAmount: 0,
      };
    case "MARKUP": {
      const markupRate = params.spreadBps / 10000;
      const clientRate = params.providerFeeRate + markupRate;
      const clientFee = Math.round(params.financedAmount * clientRate * 100) / 100;
      const spread = Math.round((clientFee - providerFeeAmount) * 100) / 100;
      return {
        providerFeeRate: params.providerFeeRate,
        providerFeeAmount,
        clientFacingFeeRate: clientRate,
        clientFacingFeeAmount: clientFee,
        dynastiesSpreadAmount: spread,
      };
    }
    case "PLATFORM_FEE": {
      const platformFee = Number(params.platformFeeAmount) || 0;
      return {
        providerFeeRate: params.providerFeeRate,
        providerFeeAmount,
        clientFacingFeeRate: params.providerFeeRate,
        clientFacingFeeAmount: providerFeeAmount,
        dynastiesSpreadAmount: platformFee,
      };
    }
  }
}

let providerInstance: BalanceProvider | null = null;

export function getBalanceProvider(): BalanceProvider {
  if (!providerInstance) {
    providerInstance = new SandboxBalanceProvider();
  }
  return providerInstance;
}
