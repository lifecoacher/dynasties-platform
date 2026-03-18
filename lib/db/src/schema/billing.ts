import {
  pgTable,
  text,
  numeric,
  real,
  boolean,
  integer,
  jsonb,
  timestamp,
  index,
} from "drizzle-orm/pg-core";
import { companiesTable } from "./companies";
import { shipmentsTable } from "./shipments";
import { invoicesTable } from "./invoices";

export const billingAccountsTable = pgTable(
  "billing_accounts",
  {
    id: text("id").primaryKey(),
    companyId: text("company_id")
      .notNull()
      .references(() => companiesTable.id),
    legalEntityName: text("legal_entity_name").notNull(),
    billingEmail: text("billing_email").notNull(),
    currency: text("currency").notNull().default("USD"),
    invoicePrefix: text("invoice_prefix").notNull().default("INV"),
    defaultPaymentTerms: text("default_payment_terms", {
      enum: ["DUE_ON_RECEIPT", "NET_15", "NET_30", "NET_60", "NET_90"],
    })
      .notNull()
      .default("NET_30"),
    collectionsContactName: text("collections_contact_name"),
    collectionsContactEmail: text("collections_contact_email"),
    collectionsContactPhone: text("collections_contact_phone"),
    paymentProviderStatus: text("payment_provider_status", {
      enum: ["NOT_CONNECTED", "PENDING", "ACTIVE", "SUSPENDED"],
    })
      .notNull()
      .default("NOT_CONNECTED"),
    balanceProviderStatus: text("balance_provider_status", {
      enum: ["NOT_CONNECTED", "PENDING", "ACTIVE", "SUSPENDED"],
    })
      .notNull()
      .default("NOT_CONNECTED"),
    financeEnabled: boolean("finance_enabled").notNull().default(false),
    spreadModel: text("spread_model", {
      enum: ["PASS_THROUGH", "ABSORBED", "MARKUP", "PLATFORM_FEE"],
    })
      .notNull()
      .default("PASS_THROUGH"),
    spreadBps: integer("spread_bps").notNull().default(0),
    platformFeeAmount: numeric("platform_fee_amount", {
      precision: 12,
      scale: 2,
    }).default("0"),
    platformFeeCurrency: text("platform_fee_currency").default("USD"),
    branding: jsonb("branding").$type<{
      logoUrl?: string;
      accentColor?: string;
      companyName?: string;
    }>(),
    status: text("status", {
      enum: ["ACTIVE", "SUSPENDED", "CLOSED"],
    })
      .notNull()
      .default("ACTIVE"),
    metadata: jsonb("metadata"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at")
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    index("billing_accounts_company_id_idx").on(table.companyId),
  ],
);

export const customerBillingProfilesTable = pgTable(
  "customer_billing_profiles",
  {
    id: text("id").primaryKey(),
    companyId: text("company_id")
      .notNull()
      .references(() => companiesTable.id),
    billingAccountId: text("billing_account_id")
      .notNull()
      .references(() => billingAccountsTable.id),
    customerName: text("customer_name").notNull(),
    customerExternalId: text("customer_external_id"),
    billingEmail: text("billing_email").notNull(),
    billingAddress: text("billing_address"),
    billingCity: text("billing_city"),
    billingCountry: text("billing_country"),
    paymentTerms: text("payment_terms", {
      enum: ["DUE_ON_RECEIPT", "NET_15", "NET_30", "NET_60", "NET_90"],
    })
      .notNull()
      .default("NET_30"),
    creditLimit: numeric("credit_limit", { precision: 14, scale: 2 }),
    currentExposure: numeric("current_exposure", {
      precision: 14,
      scale: 2,
    })
      .notNull()
      .default("0"),
    riskStatus: text("risk_status", {
      enum: ["LOW", "MEDIUM", "HIGH", "CRITICAL", "HOLD"],
    })
      .notNull()
      .default("LOW"),
    balanceEligibility: text("balance_eligibility", {
      enum: ["ELIGIBLE", "INELIGIBLE", "PENDING_REVIEW", "NOT_ASSESSED"],
    })
      .notNull()
      .default("NOT_ASSESSED"),
    preferredPaymentMethod: text("preferred_payment_method", {
      enum: ["ACH", "WIRE", "CARD", "CHECK"],
    }),
    defaultCurrency: text("default_currency").notNull().default("USD"),
    notes: text("notes"),
    entityId: text("entity_id"),
    status: text("status", {
      enum: ["ACTIVE", "SUSPENDED", "ARCHIVED"],
    })
      .notNull()
      .default("ACTIVE"),
    metadata: jsonb("metadata"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at")
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    index("cbp_company_id_idx").on(table.companyId),
    index("cbp_billing_account_id_idx").on(table.billingAccountId),
    index("cbp_status_idx").on(table.status),
    index("cbp_risk_status_idx").on(table.riskStatus),
  ],
);

export const chargeRulesTable = pgTable(
  "charge_rules",
  {
    id: text("id").primaryKey(),
    companyId: text("company_id")
      .notNull()
      .references(() => companiesTable.id),
    billingAccountId: text("billing_account_id")
      .notNull()
      .references(() => billingAccountsTable.id),
    name: text("name").notNull(),
    chargeType: text("charge_type", {
      enum: [
        "BASE_FREIGHT",
        "INSURANCE",
        "CUSTOMS_HANDLING",
        "STORAGE",
        "DELAY_FEE",
        "FUEL_SURCHARGE",
        "DISRUPTION_SURCHARGE",
        "DOCUMENTATION",
        "MANUAL_ADJUSTMENT",
      ],
    }).notNull(),
    calculationMethod: text("calculation_method", {
      enum: ["FLAT", "PER_UNIT", "PERCENTAGE", "TIERED"],
    })
      .notNull()
      .default("FLAT"),
    baseAmount: numeric("base_amount", { precision: 12, scale: 2 }),
    ratePerUnit: numeric("rate_per_unit", { precision: 12, scale: 4 }),
    percentageBasis: real("percentage_basis"),
    currency: text("currency").notNull().default("USD"),
    applicableCustomerId: text("applicable_customer_id"),
    applicableLaneOrigin: text("applicable_lane_origin"),
    applicableLaneDestination: text("applicable_lane_destination"),
    applicableCommodity: text("applicable_commodity"),
    autoApply: boolean("auto_apply").notNull().default(false),
    priority: integer("priority").notNull().default(100),
    isActive: boolean("is_active").notNull().default(true),
    metadata: jsonb("metadata"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at")
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    index("charge_rules_company_id_idx").on(table.companyId),
    index("charge_rules_billing_account_idx").on(table.billingAccountId),
    index("charge_rules_charge_type_idx").on(table.chargeType),
    index("charge_rules_active_idx").on(table.isActive),
  ],
);

export const invoiceLineItemsTable = pgTable(
  "invoice_line_items",
  {
    id: text("id").primaryKey(),
    invoiceId: text("invoice_id")
      .notNull()
      .references(() => invoicesTable.id),
    lineType: text("line_type", {
      enum: [
        "FREIGHT",
        "INSURANCE",
        "CUSTOMS",
        "STORAGE",
        "SURCHARGE",
        "FEE",
        "DISCOUNT",
        "FINANCE_FEE",
        "PLATFORM_FEE",
        "ADJUSTMENT",
      ],
    }).notNull(),
    description: text("description").notNull(),
    quantity: real("quantity").notNull().default(1),
    unitPrice: numeric("unit_price", { precision: 12, scale: 2 }).notNull(),
    amount: numeric("amount", { precision: 12, scale: 2 }).notNull(),
    shipmentId: text("shipment_id"),
    shipmentReference: text("shipment_reference"),
    chargeRuleId: text("charge_rule_id"),
    sourceEventId: text("source_event_id"),
    editable: boolean("editable").notNull().default(true),
    metadata: jsonb("metadata"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => [
    index("ili_invoice_id_idx").on(table.invoiceId),
    index("ili_shipment_id_idx").on(table.shipmentId),
  ],
);

export const receivablesTable = pgTable(
  "receivables",
  {
    id: text("id").primaryKey(),
    companyId: text("company_id")
      .notNull()
      .references(() => companiesTable.id),
    invoiceId: text("invoice_id")
      .notNull()
      .references(() => invoicesTable.id)
      .unique(),
    customerBillingProfileId: text("customer_billing_profile_id")
      .notNull()
      .references(() => customerBillingProfilesTable.id),
    originalAmount: numeric("original_amount", {
      precision: 14,
      scale: 2,
    }).notNull(),
    outstandingAmount: numeric("outstanding_amount", {
      precision: 14,
      scale: 2,
    }).notNull(),
    currency: text("currency").notNull().default("USD"),
    dueDate: timestamp("due_date").notNull(),
    daysOverdue: integer("days_overdue").notNull().default(0),
    collectionsStatus: text("collections_status", {
      enum: [
        "CURRENT",
        "REMINDER_SENT",
        "FOLLOW_UP",
        "ESCALATED",
        "COLLECTIONS",
        "WRITTEN_OFF",
        "FINANCED",
      ],
    })
      .notNull()
      .default("CURRENT"),
    disputeStatus: text("dispute_status", {
      enum: ["NONE", "OPEN", "UNDER_REVIEW", "RESOLVED", "REJECTED"],
    })
      .notNull()
      .default("NONE"),
    disputeReason: text("dispute_reason"),
    financeStatus: text("finance_status", {
      enum: ["NONE", "PENDING", "ACCEPTED", "APPROVED", "FUNDED", "REPAID", "DECLINED"],
    })
      .notNull()
      .default("NONE"),
    receivableTransferred: boolean("receivable_transferred").notNull().default(false),
    settlementStatus: text("settlement_status", {
      enum: ["UNSETTLED", "PARTIALLY_SETTLED", "SETTLED"],
    })
      .notNull()
      .default("UNSETTLED"),
    payments: jsonb("payments").$type<
      Array<{
        amount: string;
        method: string;
        date: string;
        reference: string;
      }>
    >(),
    metadata: jsonb("metadata"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at")
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    index("receivables_company_id_idx").on(table.companyId),
    index("receivables_invoice_id_idx").on(table.invoiceId),
    index("receivables_customer_id_idx").on(
      table.customerBillingProfileId,
    ),
    index("receivables_collections_status_idx").on(
      table.collectionsStatus,
    ),
    index("receivables_due_date_idx").on(table.dueDate),
  ],
);

export const paymentOptionConfigsTable = pgTable(
  "payment_option_configs",
  {
    id: text("id").primaryKey(),
    companyId: text("company_id")
      .notNull()
      .references(() => companiesTable.id),
    billingAccountId: text("billing_account_id")
      .notNull()
      .references(() => billingAccountsTable.id),
    payNowEnabled: boolean("pay_now_enabled").notNull().default(true),
    payLaterEnabled: boolean("pay_later_enabled").notNull().default(false),
    net30Enabled: boolean("net_30_enabled").notNull().default(true),
    net60Enabled: boolean("net_60_enabled").notNull().default(false),
    achEnabled: boolean("ach_enabled").notNull().default(true),
    cardEnabled: boolean("card_enabled").notNull().default(true),
    wireEnabled: boolean("wire_enabled").notNull().default(false),
    balanceOfferVisible: boolean("balance_offer_visible")
      .notNull()
      .default(false),
    feeHandling: text("fee_handling", {
      enum: ["PASS_THROUGH", "ABSORBED", "SPLIT"],
    })
      .notNull()
      .default("PASS_THROUGH"),
    metadata: jsonb("metadata"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at")
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    index("poc_company_id_idx").on(table.companyId),
    index("poc_billing_account_id_idx").on(table.billingAccountId),
  ],
);

export const balanceFinancingRecordsTable = pgTable(
  "balance_financing_records",
  {
    id: text("id").primaryKey(),
    companyId: text("company_id")
      .notNull()
      .references(() => companiesTable.id),
    invoiceId: text("invoice_id")
      .notNull()
      .references(() => invoicesTable.id),
    customerBillingProfileId: text("customer_billing_profile_id")
      .notNull()
      .references(() => customerBillingProfilesTable.id),
    applicationStatus: text("application_status", {
      enum: [
        "REQUESTED",
        "ACCEPTED",
        "APPROVED",
        "DECLINED",
        "FUNDED",
        "REPAID",
        "FAILED",
        "CANCELLED",
      ],
    }).notNull(),
    termDays: integer("term_days"),
    financedAmount: numeric("financed_amount", {
      precision: 14,
      scale: 2,
    }),
    providerFeeRate: real("provider_fee_rate"),
    providerFeeAmount: numeric("provider_fee_amount", {
      precision: 12,
      scale: 2,
    }),
    clientFacingFeeRate: real("client_facing_fee_rate"),
    clientFacingFeeAmount: numeric("client_facing_fee_amount", {
      precision: 12,
      scale: 2,
    }),
    dynastiesSpreadAmount: numeric("dynasties_spread_amount", {
      precision: 12,
      scale: 2,
    }),
    providerExternalRef: text("provider_external_ref"),
    providerName: text("provider_name").notNull().default("balance"),
    settlementStatus: text("settlement_status", {
      enum: ["PENDING", "SETTLED", "FAILED"],
    })
      .notNull()
      .default("PENDING"),
    declineReason: text("decline_reason"),
    requestedAt: timestamp("requested_at").notNull().defaultNow(),
    acceptedAt: timestamp("accepted_at"),
    decidedAt: timestamp("decided_at"),
    fundedAt: timestamp("funded_at"),
    repaidAt: timestamp("repaid_at"),
    metadata: jsonb("metadata"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at")
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    index("bfr_company_id_idx").on(table.companyId),
    index("bfr_invoice_id_idx").on(table.invoiceId),
    index("bfr_customer_id_idx").on(
      table.customerBillingProfileId,
    ),
    index("bfr_status_idx").on(table.applicationStatus),
  ],
);

export const commercialEventsTable = pgTable(
  "commercial_events",
  {
    id: text("id").primaryKey(),
    companyId: text("company_id")
      .notNull()
      .references(() => companiesTable.id),
    eventType: text("event_type", {
      enum: [
        "INVOICE_CREATED",
        "INVOICE_SENT",
        "INVOICE_PAID",
        "INVOICE_PARTIALLY_PAID",
        "INVOICE_OVERDUE",
        "INVOICE_DISPUTED",
        "INVOICE_CANCELLED",
        "PAY_NOW_SELECTED",
        "PAY_LATER_SELECTED",
        "BALANCE_REQUESTED",
        "BALANCE_ACCEPTED",
        "BALANCE_APPROVED",
        "BALANCE_DECLINED",
        "BALANCE_FUNDED",
        "BALANCE_REPAID",
        "SPREAD_RECORDED",
        "CREDIT_LIMIT_EXCEEDED",
        "CUSTOMER_CREATED",
        "CUSTOMER_SUSPENDED",
        "CHARGE_GENERATED",
        "PAYMENT_RECEIVED",
      ],
    }).notNull(),
    entityType: text("entity_type", {
      enum: [
        "INVOICE",
        "CUSTOMER",
        "RECEIVABLE",
        "FINANCING",
        "CHARGE",
        "PAYMENT",
      ],
    }).notNull(),
    entityId: text("entity_id").notNull(),
    actorType: text("actor_type", {
      enum: ["USER", "SYSTEM", "PROVIDER"],
    })
      .notNull()
      .default("SYSTEM"),
    actorId: text("actor_id"),
    amount: numeric("amount", { precision: 14, scale: 2 }),
    currency: text("currency"),
    description: text("description"),
    metadata: jsonb("metadata"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => [
    index("ce_company_id_idx").on(table.companyId),
    index("ce_event_type_idx").on(table.eventType),
    index("ce_entity_id_idx").on(table.entityId),
    index("ce_created_at_idx").on(table.createdAt),
  ],
);

export type BillingAccount = typeof billingAccountsTable.$inferSelect;
export type InsertBillingAccount = typeof billingAccountsTable.$inferInsert;
export type CustomerBillingProfile = typeof customerBillingProfilesTable.$inferSelect;
export type InsertCustomerBillingProfile = typeof customerBillingProfilesTable.$inferInsert;
export type ChargeRule = typeof chargeRulesTable.$inferSelect;
export type InvoiceLine = typeof invoiceLineItemsTable.$inferSelect;
export type Receivable = typeof receivablesTable.$inferSelect;
export type BalanceFinancingRecord = typeof balanceFinancingRecordsTable.$inferSelect;
export type CommercialEvent = typeof commercialEventsTable.$inferSelect;
