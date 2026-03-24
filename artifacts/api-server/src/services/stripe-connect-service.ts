import { db } from "@workspace/db";
import { companiesTable } from "@workspace/db/schema";
import { eq } from "drizzle-orm";
import { getUncachableStripeClient } from "../stripeClient.js";

export interface ConnectStatus {
  stripeConnectAccountId: string | null;
  connectOnboardingStarted: boolean;
  connectOnboardingCompleted: boolean;
  connectChargesEnabled: boolean;
  connectPayoutsEnabled: boolean;
  requirements?: {
    currentlyDue: string[];
    eventuallyDue: string[];
    pastDue: string[];
    disabledReason: string | null;
  };
}

export class StripeConnectService {
  async createConnectAccount(companyId: string, companyName: string, email: string): Promise<string> {
    const [company] = await db.select().from(companiesTable).where(eq(companiesTable.id, companyId)).limit(1);

    if (company?.stripeConnectAccountId) {
      return company.stripeConnectAccountId;
    }

    const stripe = await getUncachableStripeClient();
    const account = await stripe.accounts.create({
      type: "standard",
      email,
      business_profile: {
        name: companyName,
      },
      metadata: {
        dynastiesCompanyId: companyId,
      },
    });

    await db.update(companiesTable)
      .set({
        stripeConnectAccountId: account.id,
        connectOnboardingStarted: true,
      })
      .where(eq(companiesTable.id, companyId));

    console.log(`[connect] Created Connect account ${account.id} for company ${companyId}`);
    return account.id;
  }

  async createOnboardingLink(connectAccountId: string, returnUrl: string, refreshUrl: string): Promise<string> {
    const stripe = await getUncachableStripeClient();
    const link = await stripe.accountLinks.create({
      account: connectAccountId,
      refresh_url: refreshUrl,
      return_url: returnUrl,
      type: "account_onboarding",
    });
    return link.url;
  }

  async syncConnectStatus(companyId: string): Promise<ConnectStatus> {
    const [company] = await db.select().from(companiesTable).where(eq(companiesTable.id, companyId)).limit(1);

    if (!company?.stripeConnectAccountId) {
      return {
        stripeConnectAccountId: null,
        connectOnboardingStarted: false,
        connectOnboardingCompleted: false,
        connectChargesEnabled: false,
        connectPayoutsEnabled: false,
      };
    }

    const stripe = await getUncachableStripeClient();
    const account = await stripe.accounts.retrieve(company.stripeConnectAccountId);

    const chargesEnabled = account.charges_enabled ?? false;
    const payoutsEnabled = account.payouts_enabled ?? false;
    const detailsSubmitted = account.details_submitted ?? false;

    await db.update(companiesTable)
      .set({
        connectOnboardingCompleted: detailsSubmitted,
        connectChargesEnabled: chargesEnabled,
        connectPayoutsEnabled: payoutsEnabled,
      })
      .where(eq(companiesTable.id, companyId));

    const requirements = account.requirements ? {
      currentlyDue: (account.requirements.currently_due ?? []) as string[],
      eventuallyDue: (account.requirements.eventually_due ?? []) as string[],
      pastDue: (account.requirements.past_due ?? []) as string[],
      disabledReason: account.requirements.disabled_reason ?? null,
    } : undefined;

    console.log(`[connect] Synced Connect status for company ${companyId}: charges=${chargesEnabled} payouts=${payoutsEnabled} submitted=${detailsSubmitted}`);

    return {
      stripeConnectAccountId: company.stripeConnectAccountId,
      connectOnboardingStarted: company.connectOnboardingStarted,
      connectOnboardingCompleted: detailsSubmitted,
      connectChargesEnabled: chargesEnabled,
      connectPayoutsEnabled: payoutsEnabled,
      requirements,
    };
  }

  async getLocalConnectStatus(companyId: string): Promise<ConnectStatus> {
    const [company] = await db.select().from(companiesTable).where(eq(companiesTable.id, companyId)).limit(1);

    if (!company) {
      return {
        stripeConnectAccountId: null,
        connectOnboardingStarted: false,
        connectOnboardingCompleted: false,
        connectChargesEnabled: false,
        connectPayoutsEnabled: false,
      };
    }

    return {
      stripeConnectAccountId: company.stripeConnectAccountId,
      connectOnboardingStarted: company.connectOnboardingStarted,
      connectOnboardingCompleted: company.connectOnboardingCompleted,
      connectChargesEnabled: company.connectChargesEnabled,
      connectPayoutsEnabled: company.connectPayoutsEnabled,
    };
  }
}

export const stripeConnectService = new StripeConnectService();
