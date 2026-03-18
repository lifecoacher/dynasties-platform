import { useState, useEffect } from "react";
import { Link } from "wouter";
import { motion } from "framer-motion";
import {
  Settings,
  ChevronLeft,
  Loader2,
  Save,
  CreditCard,
  Banknote,
  Building2,
  CheckCircle2,
  Receipt,
} from "lucide-react";
import { AppLayout } from "@/components/layout/AppLayout";
import { useBillingAccount, usePaymentConfig, useChargeRules, useBillingAction } from "@/hooks/use-billing";

export default function BillingSettings() {
  const { data: account, isLoading: loadingAccount, refetch: refetchAccount } = useBillingAccount();
  const { data: payConfig } = usePaymentConfig();
  const { data: chargeRules } = useChargeRules();
  const action = useBillingAction();
  const [saving, setSaving] = useState(false);

  if (loadingAccount) {
    return (
      <AppLayout hideRightPanel>
        <div className="flex items-center justify-center h-full">
          <Loader2 className="w-6 h-6 animate-spin text-primary" />
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout hideRightPanel>
      <div className="px-8 py-8 max-w-[1000px] mx-auto">
        <div className="flex items-center gap-3 mb-8">
          <Link href="/billing">
            <button className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-white/[0.04] transition-colors">
              <ChevronLeft className="w-4 h-4" />
            </button>
          </Link>
          <div>
            <h1 className="text-[22px] font-semibold text-foreground">Billing Settings</h1>
            <p className="text-[13px] text-muted-foreground mt-0.5">Configure your billing account and preferences</p>
          </div>
        </div>

        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="bg-card border border-card-border rounded-xl p-6 mb-6">
          <div className="flex items-center gap-3 mb-5">
            <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center">
              <Building2 className="w-4.5 h-4.5 text-primary" />
            </div>
            <div>
              <h3 className="text-[14px] font-semibold text-foreground">Billing Account</h3>
              <p className="text-[12px] text-muted-foreground">Core billing configuration</p>
            </div>
          </div>
          {account ? (
            <div className="grid grid-cols-2 gap-6 text-[12px]">
              <div>
                <p className="text-muted-foreground mb-1">Legal Entity Name</p>
                <p className="text-[14px] font-medium text-foreground">{account.legalEntityName}</p>
              </div>
              <div>
                <p className="text-muted-foreground mb-1">Billing Email</p>
                <p className="text-[14px] font-medium text-foreground">{account.billingEmail}</p>
              </div>
              <div>
                <p className="text-muted-foreground mb-1">Currency</p>
                <p className="text-[14px] font-medium text-foreground">{account.currency}</p>
              </div>
              <div>
                <p className="text-muted-foreground mb-1">Invoice Prefix</p>
                <p className="text-[14px] font-mono font-medium text-foreground">{account.invoicePrefix}</p>
              </div>
              <div>
                <p className="text-muted-foreground mb-1">Default Payment Terms</p>
                <p className="text-[14px] font-medium text-foreground">{account.defaultPaymentTerms}</p>
              </div>
              <div>
                <p className="text-muted-foreground mb-1">Status</p>
                <span className={`px-2 py-0.5 rounded-full text-[11px] font-medium ${
                  account.status === "ACTIVE" ? "bg-emerald-500/10 text-emerald-400" : "bg-zinc-500/10 text-zinc-400"
                }`}>
                  {account.status}
                </span>
              </div>
            </div>
          ) : (
            <p className="text-[13px] text-muted-foreground">No billing account configured yet.</p>
          )}
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="bg-card border border-card-border rounded-xl p-6 mb-6">
          <div className="flex items-center gap-3 mb-5">
            <div className="w-9 h-9 rounded-lg bg-blue-500/10 flex items-center justify-center">
              <Banknote className="w-4.5 h-4.5 text-blue-400" />
            </div>
            <div>
              <h3 className="text-[14px] font-semibold text-foreground">Finance Settings</h3>
              <p className="text-[12px] text-muted-foreground">Balance provider and spread configuration</p>
            </div>
          </div>
          {account ? (
            <div className="grid grid-cols-2 gap-6 text-[12px]">
              <div>
                <p className="text-muted-foreground mb-1">Finance Enabled</p>
                <p className={`text-[14px] font-medium ${account.financeEnabled ? "text-emerald-400" : "text-muted-foreground"}`}>
                  {account.financeEnabled ? "Yes" : "No"}
                </p>
              </div>
              <div>
                <p className="text-muted-foreground mb-1">Spread Model</p>
                <p className="text-[14px] font-medium text-foreground">{account.spreadModel}</p>
              </div>
              <div>
                <p className="text-muted-foreground mb-1">Spread (bps)</p>
                <p className="text-[14px] font-medium text-foreground">{account.spreadBps} bps</p>
              </div>
              <div>
                <p className="text-muted-foreground mb-1">Balance Provider Status</p>
                <span className={`px-2 py-0.5 rounded-full text-[11px] font-medium ${
                  account.balanceProviderStatus === "ACTIVE" ? "bg-emerald-500/10 text-emerald-400" : "bg-zinc-500/10 text-zinc-400"
                }`}>
                  {account.balanceProviderStatus}
                </span>
              </div>
            </div>
          ) : (
            <p className="text-[13px] text-muted-foreground">Configure a billing account first.</p>
          )}
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }} className="bg-card border border-card-border rounded-xl p-6 mb-6">
          <div className="flex items-center gap-3 mb-5">
            <div className="w-9 h-9 rounded-lg bg-amber-500/10 flex items-center justify-center">
              <CreditCard className="w-4.5 h-4.5 text-amber-400" />
            </div>
            <div>
              <h3 className="text-[14px] font-semibold text-foreground">Payment Options</h3>
              <p className="text-[12px] text-muted-foreground">Accepted payment methods and customer experience</p>
            </div>
          </div>
          {payConfig ? (
            <div className="flex flex-wrap gap-3">
              {[
                { label: "Pay Now", enabled: payConfig.payNowEnabled },
                { label: "Pay Later", enabled: payConfig.payLaterEnabled },
                { label: "NET 30", enabled: payConfig.net30Enabled },
                { label: "NET 60", enabled: payConfig.net60Enabled },
                { label: "ACH", enabled: payConfig.achEnabled },
                { label: "Card", enabled: payConfig.cardEnabled },
                { label: "Wire", enabled: payConfig.wireEnabled },
                { label: "Balance Offer", enabled: payConfig.balanceOfferVisible },
              ].map((opt) => (
                <span
                  key={opt.label}
                  className={`px-3 py-1.5 rounded-lg text-[12px] font-medium border ${
                    opt.enabled
                      ? "bg-primary/5 border-primary/20 text-primary"
                      : "bg-white/[0.02] border-card-border text-muted-foreground"
                  }`}
                >
                  {opt.enabled && <CheckCircle2 className="w-3 h-3 inline mr-1 -mt-0.5" />}
                  {opt.label}
                </span>
              ))}
            </div>
          ) : (
            <p className="text-[13px] text-muted-foreground">No payment configuration found.</p>
          )}
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="bg-card border border-card-border rounded-xl p-6">
          <div className="flex items-center justify-between mb-5">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-sky-500/10 flex items-center justify-center">
                <Receipt className="w-4.5 h-4.5 text-sky-400" />
              </div>
              <div>
                <h3 className="text-[14px] font-semibold text-foreground">Charge Rules</h3>
                <p className="text-[12px] text-muted-foreground">Automated charge generation rules</p>
              </div>
            </div>
            <span className="text-[12px] text-muted-foreground">{(chargeRules || []).length} rules</span>
          </div>
          {(chargeRules || []).length > 0 ? (
            <div className="space-y-2">
              {(chargeRules || []).map((rule: any) => (
                <div key={rule.id} className="flex items-center justify-between px-4 py-3 rounded-lg bg-white/[0.02] border border-card-border">
                  <div>
                    <p className="text-[13px] font-medium text-foreground">{rule.name}</p>
                    <p className="text-[11px] text-muted-foreground mt-0.5">
                      {rule.chargeType} · {rule.calculationMethod}
                      {rule.baseAmount && ` · ${rule.currency} ${rule.baseAmount}`}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    {rule.autoApply && (
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-primary/10 text-primary">Auto</span>
                    )}
                    <span className={`w-2 h-2 rounded-full ${rule.isActive ? "bg-emerald-400" : "bg-zinc-500"}`} />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-[13px] text-muted-foreground">No charge rules configured yet.</p>
          )}
        </motion.div>
      </div>
    </AppLayout>
  );
}
