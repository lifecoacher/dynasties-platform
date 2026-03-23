const API = "http://localhost:8080/api";
let token = "";
const companyId = "cmp_lorian_001";
let passed = 0;
let failed = 0;
let skipped = 0;

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
  return { status: res.status, data: (json as any).data, error: (json as any).error, json };
}

function assert(condition: boolean, msg: string) {
  if (!condition) throw new Error(`Assertion failed: ${msg}`);
}

async function test(name: string, fn: () => Promise<void>) {
  try {
    await fn();
    console.log(`  ✅ ${name}`);
    passed++;
  } catch (err: any) {
    console.error(`  ❌ ${name}: ${err.message}`);
    failed++;
  }
}

function skip(name: string) {
  console.log(`  ⏭️  ${name} (skipped — no test data)`);
  skipped++;
}

async function main() {
  console.log("\n🏦 MONEY-PATH TEST SUITE\n");

  // Auth
  console.log("── Authentication ──");
  const loginRes = await api("POST", "/auth/login", {
    email: "admin@lorian.demo",
    password: "LorianDemo2026!",
  });
  assert(loginRes.status === 200, "Login should succeed");
  token = loginRes.data.token;
  assert(!!token, "Token should be present");
  console.log("  ✅ Login successful\n");

  // 1. Billing Account
  console.log("── Billing Account ──");
  await test("GET /billing/account is tenant-scoped", async () => {
    const res = await api("GET", "/billing/account");
    assert(res.status === 200, `Expected 200, got ${res.status}`);
    assert(res.data !== null, "Account should exist");
    assert(res.data.companyId === companyId, `companyId mismatch: ${res.data.companyId}`);
  });

  await test("PUT /billing/account updates billing account", async () => {
    const res = await api("PUT", "/billing/account", { legalEntityName: "Lorian Test" });
    assert(res.status === 200, `Expected 200, got ${res.status}`);
    assert(res.data.legalEntityName === "Lorian Test", "Name should update");
    await api("PUT", "/billing/account", { legalEntityName: "Lorian Maritime Logistics" });
  });

  // 2. Invoice Lifecycle
  console.log("\n── Invoice Lifecycle ──");
  const shipsRes = await api("GET", "/shipments?limit=5");
  assert(shipsRes.status === 200, "Should fetch shipments");
  const testShipment = shipsRes.data?.[0];
  let testInvoiceId: string | null = null;

  if (testShipment) {
    await test("POST invoice from shipment creates DRAFT", async () => {
      const res = await api("POST", `/billing/invoices/from-shipment/${testShipment.id}`, {
        billToName: "Test Customer",
        billToEmail: "test@example.com",
      });
      assert(res.status === 200, `Expected 200, got ${res.status}: ${res.error || ""}`);
      testInvoiceId = res.data.id;
      assert(res.data.companyId === companyId, "Invoice companyId mismatch");
      assert(res.data.shipmentId === testShipment.id, "shipmentId mismatch");
      assert(res.data.status === "DRAFT", `Expected DRAFT, got ${res.data.status}`);
      assert(/^[A-Z]+-\d+$/.test(res.data.invoiceNumber), `Bad invoice number: ${res.data.invoiceNumber}`);
    });

    if (testInvoiceId) {
      await test("GET /billing/invoices/:id returns full detail", async () => {
        const res = await api("GET", `/billing/invoices/${testInvoiceId}`);
        assert(res.status === 200, `Expected 200, got ${res.status}`);
        assert(res.data.id === testInvoiceId, "ID mismatch");
        assert(res.data.companyId === companyId, "companyId mismatch");
        assert("lineItemsDetail" in res.data, "Missing lineItemsDetail");
        assert("auditTrail" in res.data, "Missing auditTrail");
      });

      await test("POST send transitions DRAFT → SENT", async () => {
        const res = await api("POST", `/billing/invoices/${testInvoiceId}/send`);
        assert(res.status === 200, `Expected 200, got ${res.status}: ${res.error || ""}`);
        assert(res.data.status === "SENT", `Expected SENT, got ${res.data.status}`);
        assert(!!res.data.sentAt, "sentAt should be set");
      });

      await test("POST mark-paid transitions SENT → PAID", async () => {
        const res = await api("POST", `/billing/invoices/${testInvoiceId}/mark-paid`, {
          paymentMethod: "WIRE_TRANSFER",
        });
        assert(res.status === 200, `Expected 200, got ${res.status}: ${res.error || ""}`);
        assert(res.data.status === "PAID", `Expected PAID, got ${res.data.status}`);
        assert(!!res.data.paidAt, "paidAt should be set");
      });

      await test("Audit trail has CREATED + SENT events", async () => {
        const res = await api("GET", `/billing/invoices/${testInvoiceId}`);
        assert(res.status === 200, `Expected 200, got ${res.status}`);
        const types = res.data.auditTrail.map((e: any) => e.eventType);
        assert(types.includes("INVOICE_CREATED"), `Missing INVOICE_CREATED in [${types}]`);
        assert(types.includes("INVOICE_SENT"), `Missing INVOICE_SENT in [${types}]`);
      });
    } else {
      skip("Invoice detail, send, mark-paid, audit trail");
    }

    // Cancel flow
    await test("Invoice cancel flow", async () => {
      const res = await api("POST", `/billing/invoices/from-shipment/${testShipment.id}`, {
        billToName: "Cancel Test",
      });
      assert(res.status === 200, `Create failed: ${res.error || ""}`);
      const cancelRes = await api("POST", `/billing/invoices/${res.data.id}/cancel`);
      assert(cancelRes.status === 200, `Cancel failed: ${cancelRes.error || ""}`);
      assert(cancelRes.data.status === "CANCELLED", `Expected CANCELLED, got ${cancelRes.data.status}`);
    });
  } else {
    skip("Invoice lifecycle (no shipments)");
  }

  // 3. Invoice listing tenant isolation
  console.log("\n── Tenant Isolation ──");
  await test("All invoices belong to authenticated tenant", async () => {
    const res = await api("GET", "/billing/invoices");
    assert(res.status === 200, `Expected 200, got ${res.status}`);
    for (const inv of res.data) {
      assert(inv.companyId === companyId, `Invoice ${inv.id} has wrong companyId: ${inv.companyId}`);
    }
  });

  await test("Unauthenticated request rejected", async () => {
    const saved = token;
    token = "";
    const res = await api("GET", "/billing/invoices");
    assert([401, 403].includes(res.status), `Expected 401/403, got ${res.status}`);
    token = saved;
  });

  await test("Invalid token rejected", async () => {
    const saved = token;
    token = "invalid.jwt.token";
    const res = await api("GET", "/billing/invoices");
    assert([401, 403].includes(res.status), `Expected 401/403, got ${res.status}`);
    token = saved;
  });

  // 4. Charge Rules
  console.log("\n── Charge Rules ──");
  await test("GET charge-rules returns tenant-scoped rules", async () => {
    const res = await api("GET", "/billing/charge-rules");
    assert(res.status === 200, `Expected 200, got ${res.status}`);
    assert(Array.isArray(res.data), "Should be array");
    for (const rule of res.data) {
      assert(rule.companyId === companyId, `Rule ${rule.id} has wrong companyId`);
    }
  });

  await test("POST charge-rule creates tenant-scoped rule", async () => {
    const res = await api("POST", "/billing/charge-rules", {
      name: "Test Handling Fee",
      chargeType: "HANDLING",
      calculationMethod: "FLAT",
      baseAmount: "150.00",
      currency: "USD",
    });
    assert(res.status === 200, `Expected 200, got ${res.status}: ${res.error || ""}`);
    assert(res.data.companyId === companyId, "companyId mismatch");
    assert(res.data.name === "Test Handling Fee", "Name mismatch");
  });

  // 5. Customer Billing Profiles
  console.log("\n── Customer Profiles ──");
  await test("GET customer profiles are tenant-scoped", async () => {
    const res = await api("GET", "/billing/customers");
    assert(res.status === 200, `Expected 200, got ${res.status}`);
    for (const c of res.data) {
      assert(c.companyId === companyId, `Customer ${c.id} has wrong companyId`);
    }
  });

  // 6. Reconciliation
  console.log("\n── Reconciliation ──");
  if (testShipment) {
    await test("Financial summary endpoint works", async () => {
      const res = await api("GET", `/shipments/${testShipment.id}/financial-summary`);
      assert(res.status === 200, `Expected 200, got ${res.status}`);
      assert("expectedTotal" in res.data, "Missing expectedTotal in summary");
      assert("actualTotal" in res.data, "Missing actualTotal in summary");
    });

    await test("Carrier invoices endpoint returns array", async () => {
      const res = await api("GET", `/shipments/${testShipment.id}/carrier-invoices`);
      assert(res.status === 200, `Expected 200, got ${res.status}`);
      assert(Array.isArray(res.data), "Should be array");
    });

    await test("Carrier invoice ingestion validates required fields", async () => {
      const res = await api("POST", `/shipments/${testShipment.id}/carrier-invoices`, {});
      assert(res.status === 400, `Expected 400, got ${res.status}`);
    });

    await test("Carrier invoice rejects negative amounts", async () => {
      const res = await api("POST", `/shipments/${testShipment.id}/carrier-invoices`, {
        carrierName: "Test",
        invoiceNumber: "NEG-001",
        totalAmount: -100,
      });
      assert(res.status === 400, `Expected 400, got ${res.status}`);
    });
  }

  // 7. Reconciliation resolution validation
  console.log("\n── Reconciliation Resolution ──");
  await test("Resolution rejects invalid status", async () => {
    const res = await api("PATCH", "/reconciliation/fake-id/resolve", {
      resolutionStatus: "BOGUS",
    });
    assert(res.status === 400, `Expected 400, got ${res.status}`);
  });

  await test("Resolution requires resolutionStatus", async () => {
    const res = await api("PATCH", "/reconciliation/fake-id/resolve", {});
    assert(res.status === 400, `Expected 400, got ${res.status}`);
  });

  // 8. Invoice number sequential format
  console.log("\n── Invoice Number Format ──");
  await test("Invoice numbers are non-empty strings", async () => {
    const res = await api("GET", "/billing/invoices");
    assert(res.status === 200, `Expected 200, got ${res.status}`);
    for (const inv of res.data) {
      if (inv.invoiceNumber) {
        assert(typeof inv.invoiceNumber === "string", "Should be string");
        assert(inv.invoiceNumber.length > 0, "Should be non-empty");
      }
    }
  });

  // Summary
  console.log("\n" + "═".repeat(50));
  console.log(`  RESULTS: ${passed} passed, ${failed} failed, ${skipped} skipped`);
  console.log("═".repeat(50) + "\n");

  if (failed > 0) process.exit(1);
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
