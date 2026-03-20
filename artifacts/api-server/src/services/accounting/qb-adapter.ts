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
    return { success: true, companyName: "Lorian Logistics (QB Sandbox)", realmId: "demo-realm-lorian-001" };
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

const adapterCache = new Map<string, DemoQuickBooksAdapter>();

export function getQuickBooksAdapter(connectionId: string): QuickBooksAdapter {
  let adapter = adapterCache.get(connectionId);
  if (!adapter) {
    adapter = new DemoQuickBooksAdapter();
    adapterCache.set(connectionId, adapter);
  }
  return adapter;
}

export function getDemoAdapter(connectionId: string): DemoQuickBooksAdapter {
  return getQuickBooksAdapter(connectionId) as DemoQuickBooksAdapter;
}
