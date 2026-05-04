import { db } from "@workspace/db";
import { accountingConnectionsTable } from "@workspace/db/schema";
import { eq } from "drizzle-orm";

export interface QBCustomer {
  Id: string;
  DisplayName: string;
  PrimaryEmailAddr?: { Address: string };
  BillAddr?: {
    Line1?: string;
    City?: string;
    Country?: string;
  };
  Balance?: number;
  Active?: boolean;
}

export interface QBInvoiceLine {
  Amount: number;
  Description?: string;
  DetailType: "SalesItemLineDetail";
  SalesItemLineDetail: {
    Qty: number;
    UnitPrice: number;
  };
}

export interface QBInvoice {
  Id: string;
  DocNumber: string;
  CustomerRef: { value: string; name?: string };
  Line: QBInvoiceLine[];
  TotalAmt: number;
  Balance: number;
  DueDate?: string;
  CurrencyRef?: { value: string };
  TxnDate?: string;
  EmailStatus?: string;
  DepositToAccountRef?: { value: string };
  LinkedTxn?: Array<{ TxnId: string; TxnType: string }>;
}

export interface QBPayment {
  Id: string;
  TotalAmt: number;
  TxnDate: string;
  CustomerRef: { value: string };
  Line: Array<{
    Amount: number;
    LinkedTxn: Array<{ TxnId: string; TxnType: string }>;
  }>;
}

export interface QuickBooksAdapter {
  createCustomer(data: {
    displayName: string;
    email: string;
    address?: string;
    city?: string;
    country?: string;
  }): Promise<QBCustomer>;

  findCustomerByName(name: string): Promise<QBCustomer | null>;

  updateCustomer(id: string, data: Partial<{
    displayName: string;
    email: string;
  }>): Promise<QBCustomer>;

  createInvoice(data: {
    customerRefId: string;
    docNumber: string;
    lineItems: Array<{
      description: string;
      amount: number;
      quantity: number;
      unitPrice: number;
    }>;
    totalAmount: number;
    dueDate?: string;
    currency?: string;
  }): Promise<QBInvoice>;

  updateInvoice(id: string, data: {
    lineItems: Array<{
      description: string;
      amount: number;
      quantity: number;
      unitPrice: number;
    }>;
    totalAmount: number;
    dueDate?: string;
  }): Promise<QBInvoice>;

  getInvoice(id: string): Promise<QBInvoice | null>;

  getPaymentsForInvoice(invoiceId: string): Promise<QBPayment[]>;

  testConnection(): Promise<{ success: boolean; companyName: string; realmId: string }>;
}

let demoIdCounter = 1000;

export class DemoQuickBooksAdapter implements QuickBooksAdapter {
  private customers: Map<string, QBCustomer> = new Map();
  private invoices: Map<string, QBInvoice> = new Map();
  private payments: Map<string, QBPayment[]> = new Map();

  async testConnection() {
    return { success: true, companyName: "QuickBooks Sandbox (Demo)", realmId: "demo-realm" };
  }

  async createCustomer(data: {
    displayName: string;
    email: string;
    address?: string;
    city?: string;
    country?: string;
  }): Promise<QBCustomer> {
    const id = String(++demoIdCounter);
    const customer: QBCustomer = {
      Id: id,
      DisplayName: data.displayName,
      PrimaryEmailAddr: { Address: data.email },
      BillAddr: {
        Line1: data.address,
        City: data.city,
        Country: data.country,
      },
      Balance: 0,
      Active: true,
    };
    this.customers.set(id, customer);
    return customer;
  }

  async findCustomerByName(name: string): Promise<QBCustomer | null> {
    for (const c of this.customers.values()) {
      if (c.DisplayName.toLowerCase() === name.toLowerCase()) return c;
    }
    return null;
  }

  async updateCustomer(id: string, data: Partial<{ displayName: string; email: string }>): Promise<QBCustomer> {
    const existing = this.customers.get(id);
    if (!existing) throw new Error(`Customer ${id} not found`);
    if (data.displayName) existing.DisplayName = data.displayName;
    if (data.email) existing.PrimaryEmailAddr = { Address: data.email };
    return existing;
  }

  async createInvoice(data: {
    customerRefId: string;
    docNumber: string;
    lineItems: Array<{ description: string; amount: number; quantity: number; unitPrice: number }>;
    totalAmount: number;
    dueDate?: string;
    currency?: string;
  }): Promise<QBInvoice> {
    const id = String(++demoIdCounter);
    const customer = this.customers.get(data.customerRefId);
    const invoice: QBInvoice = {
      Id: id,
      DocNumber: data.docNumber,
      CustomerRef: { value: data.customerRefId, name: customer?.DisplayName },
      Line: data.lineItems.map((li) => ({
        Amount: li.amount,
        Description: li.description,
        DetailType: "SalesItemLineDetail" as const,
        SalesItemLineDetail: { Qty: li.quantity, UnitPrice: li.unitPrice },
      })),
      TotalAmt: data.totalAmount,
      Balance: data.totalAmount,
      DueDate: data.dueDate,
      CurrencyRef: { value: data.currency || "USD" },
      TxnDate: new Date().toISOString().slice(0, 10),
    };
    this.invoices.set(id, invoice);
    return invoice;
  }

  async updateInvoice(id: string, data: {
    lineItems: Array<{ description: string; amount: number; quantity: number; unitPrice: number }>;
    totalAmount: number;
    dueDate?: string;
  }): Promise<QBInvoice> {
    const existing = this.invoices.get(id);
    if (!existing) throw new Error(`Invoice ${id} not found`);
    existing.Line = data.lineItems.map((li) => ({
      Amount: li.amount,
      Description: li.description,
      DetailType: "SalesItemLineDetail" as const,
      SalesItemLineDetail: { Qty: li.quantity, UnitPrice: li.unitPrice },
    }));
    existing.TotalAmt = data.totalAmount;
    existing.Balance = data.totalAmount;
    if (data.dueDate) existing.DueDate = data.dueDate;
    return existing;
  }

  async getInvoice(id: string): Promise<QBInvoice | null> {
    return this.invoices.get(id) ?? null;
  }

  async getPaymentsForInvoice(invoiceId: string): Promise<QBPayment[]> {
    return this.payments.get(invoiceId) ?? [];
  }

  simulatePayment(invoiceId: string, amount: number) {
    const invoice = this.invoices.get(invoiceId);
    if (!invoice) return;
    invoice.Balance = Math.max(0, invoice.Balance - amount);
    const paymentId = String(++demoIdCounter);
    const payment: QBPayment = {
      Id: paymentId,
      TotalAmt: amount,
      TxnDate: new Date().toISOString().slice(0, 10),
      CustomerRef: invoice.CustomerRef,
      Line: [{ Amount: amount, LinkedTxn: [{ TxnId: invoiceId, TxnType: "Invoice" }] }],
    };
    const existing = this.payments.get(invoiceId) || [];
    existing.push(payment);
    this.payments.set(invoiceId, existing);
  }
}

export class RealQuickBooksAdapter implements QuickBooksAdapter {
  private connectionId: string;
  private baseUrl = "https://quickbooks.api.intuit.com/v3";
  private sandboxUrl = "https://sandbox-quickbooks.api.intuit.com/v3";

  constructor(connectionId: string) {
    this.connectionId = connectionId;
  }

  private get apiBase(): string {
    return process.env.QB_SANDBOX === "true" ? this.sandboxUrl : this.baseUrl;
  }

  private async getTokens(): Promise<{ accessToken: string; realmId: string }> {
    const [conn] = await db
      .select()
      .from(accountingConnectionsTable)
      .where(eq(accountingConnectionsTable.id, this.connectionId))
      .limit(1);

    if (!conn) throw new Error("QuickBooks connection not found");
    if (!conn.tokenEncrypted || !conn.realmId) {
      throw new Error("QuickBooks tokens not available — please reconnect");
    }

    if (conn.tokenExpiresAt && conn.tokenExpiresAt < new Date()) {
      return this.refreshAccessToken(conn);
    }

    return { accessToken: conn.tokenEncrypted, realmId: conn.realmId };
  }

  private async refreshAccessToken(conn: any): Promise<{ accessToken: string; realmId: string }> {
    const clientId = process.env.QB_CLIENT_ID;
    const clientSecret = process.env.QB_CLIENT_SECRET;

    if (!clientId || !clientSecret) {
      throw new Error("QB_CLIENT_ID and QB_CLIENT_SECRET required for token refresh");
    }

    const resp = await fetch("https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        "Authorization": "Basic " + Buffer.from(`${clientId}:${clientSecret}`).toString("base64"),
      },
      body: new URLSearchParams({
        grant_type: "refresh_token",
        refresh_token: conn.refreshTokenEncrypted!,
      }),
    });

    if (!resp.ok) {
      const body = await resp.text();
      await db
        .update(accountingConnectionsTable)
        .set({ connectionStatus: "EXPIRED", lastSyncError: `Token refresh failed: ${resp.status}` })
        .where(eq(accountingConnectionsTable.id, this.connectionId));
      throw new Error(`QuickBooks token refresh failed (${resp.status}): ${body}`);
    }

    const tokens = await resp.json() as any;
    const expiresAt = new Date(Date.now() + (tokens.expires_in - 60) * 1000);

    await db
      .update(accountingConnectionsTable)
      .set({
        tokenEncrypted: tokens.access_token,
        refreshTokenEncrypted: tokens.refresh_token,
        tokenExpiresAt: expiresAt,
        connectionStatus: "CONNECTED",
        lastSyncError: null,
      })
      .where(eq(accountingConnectionsTable.id, this.connectionId));

    return { accessToken: tokens.access_token, realmId: conn.realmId };
  }

  private async qbFetch(method: string, path: string, body?: unknown): Promise<any> {
    const { accessToken, realmId } = await this.getTokens();
    const url = `${this.apiBase}/company/${realmId}${path}`;

    const resp = await fetch(url, {
      method,
      headers: {
        "Authorization": `Bearer ${accessToken}`,
        "Accept": "application/json",
        "Content-Type": "application/json",
      },
      body: body ? JSON.stringify(body) : undefined,
    });

    if (!resp.ok) {
      const errorBody = await resp.text();
      throw new Error(`QuickBooks API error (${resp.status}): ${errorBody}`);
    }

    return resp.json();
  }

  async testConnection(): Promise<{ success: boolean; companyName: string; realmId: string }> {
    try {
      const { realmId } = await this.getTokens();
      const data = await this.qbFetch("GET", "/companyinfo/" + realmId);
      return {
        success: true,
        companyName: data.CompanyInfo?.CompanyName || "Unknown",
        realmId,
      };
    } catch (err: any) {
      return { success: false, companyName: "", realmId: "" };
    }
  }

  async createCustomer(data: {
    displayName: string;
    email: string;
    address?: string;
    city?: string;
    country?: string;
  }): Promise<QBCustomer> {
    const body: any = { DisplayName: data.displayName };
    if (data.email) body.PrimaryEmailAddr = { Address: data.email };
    if (data.address || data.city || data.country) {
      body.BillAddr = { Line1: data.address, City: data.city, Country: data.country };
    }

    const resp = await this.qbFetch("POST", "/customer", body);
    return resp.Customer;
  }

  async findCustomerByName(name: string): Promise<QBCustomer | null> {
    const encodedName = encodeURIComponent(name.replace(/'/g, "\\'"));
    const resp = await this.qbFetch("GET", `/query?query=select * from Customer where DisplayName = '${encodedName}'`);
    const customers = resp.QueryResponse?.Customer;
    return customers?.[0] || null;
  }

  async updateCustomer(id: string, data: Partial<{ displayName: string; email: string }>): Promise<QBCustomer> {
    const existing = await this.qbFetch("GET", `/customer/${id}`);
    const customer = existing.Customer;

    const body: any = { ...customer, sparse: true };
    if (data.displayName) body.DisplayName = data.displayName;
    if (data.email) body.PrimaryEmailAddr = { Address: data.email };

    const resp = await this.qbFetch("POST", "/customer", body);
    return resp.Customer;
  }

  async createInvoice(data: {
    customerRefId: string;
    docNumber: string;
    lineItems: Array<{ description: string; amount: number; quantity: number; unitPrice: number }>;
    totalAmount: number;
    dueDate?: string;
    currency?: string;
  }): Promise<QBInvoice> {
    const body: any = {
      CustomerRef: { value: data.customerRefId },
      DocNumber: data.docNumber,
      Line: data.lineItems.map((li) => ({
        Amount: li.amount,
        Description: li.description,
        DetailType: "SalesItemLineDetail",
        SalesItemLineDetail: {
          Qty: li.quantity,
          UnitPrice: li.unitPrice,
          ItemRef: { value: "1", name: "Services" },
        },
      })),
    };
    if (data.dueDate) body.DueDate = data.dueDate;
    if (data.currency) body.CurrencyRef = { value: data.currency };

    const resp = await this.qbFetch("POST", "/invoice", body);
    return resp.Invoice;
  }

  async updateInvoice(id: string, data: {
    lineItems: Array<{ description: string; amount: number; quantity: number; unitPrice: number }>;
    totalAmount: number;
    dueDate?: string;
  }): Promise<QBInvoice> {
    const existing = await this.qbFetch("GET", `/invoice/${id}`);
    const invoice = existing.Invoice;

    const body: any = {
      ...invoice,
      sparse: true,
      Line: data.lineItems.map((li) => ({
        Amount: li.amount,
        Description: li.description,
        DetailType: "SalesItemLineDetail",
        SalesItemLineDetail: {
          Qty: li.quantity,
          UnitPrice: li.unitPrice,
          ItemRef: { value: "1", name: "Services" },
        },
      })),
    };
    if (data.dueDate) body.DueDate = data.dueDate;

    const resp = await this.qbFetch("POST", "/invoice", body);
    return resp.Invoice;
  }

  async getInvoice(id: string): Promise<QBInvoice | null> {
    try {
      const resp = await this.qbFetch("GET", `/invoice/${id}`);
      return resp.Invoice || null;
    } catch {
      return null;
    }
  }

  async getPaymentsForInvoice(invoiceId: string): Promise<QBPayment[]> {
    const resp = await this.qbFetch(
      "GET",
      `/query?query=select * from Payment where Line.LinkedTxn.TxnId = '${invoiceId}'`,
    );
    return resp.QueryResponse?.Payment || [];
  }
}

const demoAdapterCache = new Map<string, DemoQuickBooksAdapter>();
const realAdapterCache = new Map<string, RealQuickBooksAdapter>();

function isDemoMode(): boolean {
  return process.env.VITE_DEMO_MODE === "true" || process.env.QB_MODE === "demo";
}

export function getQuickBooksAdapter(connectionId: string): QuickBooksAdapter {
  if (isDemoMode()) {
    let adapter = demoAdapterCache.get(connectionId);
    if (!adapter) {
      adapter = new DemoQuickBooksAdapter();
      demoAdapterCache.set(connectionId, adapter);
    }
    return adapter;
  }

  let adapter = realAdapterCache.get(connectionId);
  if (!adapter) {
    adapter = new RealQuickBooksAdapter(connectionId);
    realAdapterCache.set(connectionId, adapter);
  }
  return adapter;
}

export function getDemoAdapter(connectionId: string): DemoQuickBooksAdapter {
  let adapter = demoAdapterCache.get(connectionId);
  if (!adapter) {
    adapter = new DemoQuickBooksAdapter();
    demoAdapterCache.set(connectionId, adapter);
  }
  return adapter;
}
