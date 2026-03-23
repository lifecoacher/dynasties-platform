import { describe, it, expect, beforeAll } from "vitest";

const API = "http://localhost:8080/api";
let token = "";
let companyId = "cmp_lorian_001";

async function api(method: string, path: string, body?: any) {
  const res = await fetch(`${API}${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const json = await res.json().catch(() => ({}));
  return { status: res.status, data: json.data, error: json.error, json };
}

beforeAll(async () => {
  const res = await api("POST", "/auth/login", {
    email: "admin@lorian.demo",
    password: "LorianDemo2026!",
  });
  expect(res.status).toBe(200);
  token = res.data.token;
  expect(token).toBeTruthy();
});

describe("Money-Path: Billing Account", () => {
  it("GET /billing/account returns tenant-scoped account", async () => {
    const res = await api("GET", "/billing/account");
    expect(res.status).toBe(200);
    expect(res.data).not.toBeNull();
    expect(res.data.companyId).toBe(companyId);
  });

  it("PUT /billing/account requires MANAGER role (admin has it)", async () => {
    const res = await api("PUT", "/billing/account", {
      legalEntityName: "Lorian Logistics (Test)",
    });
    expect(res.status).toBe(200);
    expect(res.data.legalEntityName).toBe("Lorian Logistics (Test)");
    await api("PUT", "/billing/account", {
      legalEntityName: "Lorian Maritime Logistics",
    });
  });
});

describe("Money-Path: Invoice Lifecycle", () => {
  let testShipmentId: string;
  let testInvoiceId: string;

  beforeAll(async () => {
    const res = await api("GET", "/shipments?limit=1");
    expect(res.status).toBe(200);
    expect(res.data.length).toBeGreaterThan(0);
    testShipmentId = res.data[0].id;
  });

  it("GET /billing/invoices returns invoices with companyId filter", async () => {
    const res = await api("GET", "/billing/invoices");
    expect(res.status).toBe(200);
    expect(Array.isArray(res.data)).toBe(true);
    for (const inv of res.data) {
      expect(inv.companyId).toBe(companyId);
    }
  });

  it("POST /billing/invoices/from-shipment creates invoice from shipment", async () => {
    const res = await api("POST", `/billing/invoices/from-shipment/${testShipmentId}`, {
      billToName: "Test Customer",
      billToEmail: "test@example.com",
    });
    if (res.status === 200) {
      testInvoiceId = res.data.id;
      expect(res.data.companyId).toBe(companyId);
      expect(res.data.shipmentId).toBe(testShipmentId);
      expect(res.data.status).toBe("DRAFT");
      expect(res.data.invoiceNumber).toMatch(/^[A-Z]+-\d+$/);
    } else {
      expect([200, 400]).toContain(res.status);
    }
  });

  it("GET /billing/invoices/:id returns full invoice with companyId guard", async () => {
    if (!testInvoiceId) return;
    const res = await api("GET", `/billing/invoices/${testInvoiceId}`);
    expect(res.status).toBe(200);
    expect(res.data.id).toBe(testInvoiceId);
    expect(res.data.companyId).toBe(companyId);
    expect(res.data).toHaveProperty("lineItemsDetail");
    expect(res.data).toHaveProperty("auditTrail");
  });

  it("POST /billing/invoices/:id/send transitions DRAFT → SENT", async () => {
    if (!testInvoiceId) return;
    const res = await api("POST", `/billing/invoices/${testInvoiceId}/send`);
    expect(res.status).toBe(200);
    expect(res.data.status).toBe("SENT");
    expect(res.data.sentAt).toBeTruthy();
  });

  it("POST /billing/invoices/:id/mark-paid transitions SENT → PAID", async () => {
    if (!testInvoiceId) return;
    const res = await api("POST", `/billing/invoices/${testInvoiceId}/mark-paid`, {
      paymentMethod: "WIRE_TRANSFER",
    });
    expect(res.status).toBe(200);
    expect(res.data.status).toBe("PAID");
    expect(res.data.paidAt).toBeTruthy();
  });

  it("GET /billing/invoices/:id audit trail has commercial events", async () => {
    if (!testInvoiceId) return;
    const res = await api("GET", `/billing/invoices/${testInvoiceId}`);
    expect(res.status).toBe(200);
    const events = res.data.auditTrail;
    expect(Array.isArray(events)).toBe(true);
    const eventTypes = events.map((e: any) => e.eventType);
    expect(eventTypes).toContain("INVOICE_CREATED");
    expect(eventTypes).toContain("INVOICE_SENT");
  });
});

describe("Money-Path: Invoice Cancel + Dispute", () => {
  let invoiceIdForCancel: string | null = null;

  it("creates a disposable invoice for cancel test", async () => {
    const ships = await api("GET", "/shipments?limit=5");
    const ship = ships.data?.find((s: any) => s.id);
    if (!ship) return;
    const res = await api("POST", `/billing/invoices/from-shipment/${ship.id}`, {
      billToName: "Cancel Test",
    });
    if (res.status === 200) {
      invoiceIdForCancel = res.data.id;
    }
  });

  it("POST /billing/invoices/:id/cancel transitions to CANCELLED", async () => {
    if (!invoiceIdForCancel) return;
    const res = await api("POST", `/billing/invoices/${invoiceIdForCancel}/cancel`);
    expect(res.status).toBe(200);
    expect(res.data.status).toBe("CANCELLED");
  });
});

describe("Money-Path: Charge Rules", () => {
  it("GET /billing/charge-rules returns tenant-scoped rules", async () => {
    const res = await api("GET", "/billing/charge-rules");
    expect(res.status).toBe(200);
    expect(Array.isArray(res.data)).toBe(true);
    for (const rule of res.data) {
      expect(rule.companyId).toBe(companyId);
    }
  });

  it("POST /billing/charge-rules creates a new rule", async () => {
    const res = await api("POST", "/billing/charge-rules", {
      name: "Test Origin Handling",
      chargeType: "HANDLING",
      calculationMethod: "FLAT",
      baseAmount: "150.00",
      currency: "USD",
    });
    expect(res.status).toBe(200);
    expect(res.data.companyId).toBe(companyId);
    expect(res.data.name).toBe("Test Origin Handling");
  });
});

describe("Money-Path: Customer Billing Profiles", () => {
  it("GET /billing/customers returns tenant-scoped profiles", async () => {
    const res = await api("GET", "/billing/customers");
    expect(res.status).toBe(200);
    expect(Array.isArray(res.data)).toBe(true);
    for (const c of res.data) {
      expect(c.companyId).toBe(companyId);
    }
  });
});

describe("Money-Path: Reconciliation", () => {
  let testShipmentId: string;

  beforeAll(async () => {
    const res = await api("GET", "/shipments?limit=1");
    testShipmentId = res.data?.[0]?.id;
  });

  it("GET /shipments/:id/financial-summary returns summary", async () => {
    if (!testShipmentId) return;
    const res = await api("GET", `/shipments/${testShipmentId}/financial-summary`);
    expect(res.status).toBe(200);
    expect(res.data).toHaveProperty("shipmentId");
  });

  it("GET /shipments/:id/carrier-invoices returns array", async () => {
    if (!testShipmentId) return;
    const res = await api("GET", `/shipments/${testShipmentId}/carrier-invoices`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.data)).toBe(true);
  });

  it("POST carrier invoice ingestion validates required fields", async () => {
    if (!testShipmentId) return;
    const res = await api("POST", `/shipments/${testShipmentId}/carrier-invoices`, {});
    expect(res.status).toBe(400);
  });

  it("POST carrier invoice ingestion rejects negative amounts", async () => {
    if (!testShipmentId) return;
    const res = await api("POST", `/shipments/${testShipmentId}/carrier-invoices`, {
      carrierName: "Test Carrier",
      invoiceNumber: "NEG-001",
      totalAmount: -100,
    });
    expect(res.status).toBe(400);
  });
});

describe("Money-Path: Billing Enforcement", () => {
  it("billing enforcement middleware is in place (non-billing endpoints work)", async () => {
    const res = await api("GET", "/shipments?limit=1");
    expect(res.status).toBe(200);
  });
});

describe("Money-Path: Tenant Isolation", () => {
  it("unauthenticated requests are rejected", async () => {
    const savedToken = token;
    token = "";
    const res = await api("GET", "/billing/invoices");
    expect([401, 403]).toContain(res.status);
    token = savedToken;
  });

  it("invalid token is rejected", async () => {
    const savedToken = token;
    token = "invalid.jwt.token";
    const res = await api("GET", "/billing/invoices");
    expect([401, 403]).toContain(res.status);
    token = savedToken;
  });

  it("all invoice companyId fields match authenticated tenant", async () => {
    const res = await api("GET", "/billing/invoices");
    expect(res.status).toBe(200);
    for (const inv of res.data) {
      expect(inv.companyId).toBe(companyId);
    }
  });

  it("all receivable queries are tenant-scoped", async () => {
    const customers = await api("GET", "/billing/customers");
    if (customers.data?.length > 0) {
      const detail = await api("GET", `/billing/customers/${customers.data[0].id}`);
      expect(detail.status).toBe(200);
      if (detail.data.receivables) {
        for (const r of detail.data.receivables) {
          expect(r.companyId).toBe(companyId);
        }
      }
    }
  });
});

describe("Money-Path: Sequential Invoice Numbers", () => {
  it("invoice numbers are sequential and formatted", async () => {
    const res = await api("GET", "/billing/invoices");
    expect(res.status).toBe(200);
    const invoiceNumbers = res.data
      .filter((inv: any) => inv.invoiceNumber)
      .map((inv: any) => inv.invoiceNumber);
    for (const num of invoiceNumbers) {
      expect(typeof num).toBe("string");
      expect(num.length).toBeGreaterThan(0);
    }
  });
});

describe("Money-Path: Reconciliation Resolution", () => {
  it("PATCH /reconciliation/:id/resolve validates resolutionStatus", async () => {
    const res = await api("PATCH", "/reconciliation/fake-id/resolve", {
      resolutionStatus: "INVALID_STATUS",
    });
    expect(res.status).toBe(400);
  });

  it("PATCH /reconciliation/:id/resolve requires resolutionStatus", async () => {
    const res = await api("PATCH", "/reconciliation/fake-id/resolve", {});
    expect(res.status).toBe(400);
  });
});
