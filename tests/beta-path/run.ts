const API = "http://localhost:8080/api";
let passed = 0;
let failed = 0;

function assert(condition: boolean, msg: string) {
  if (!condition) throw new Error(`Assertion failed: ${msg}`);
}

async function api(method: string, path: string, body?: any, token?: string) {
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

async function test(name: string, fn: () => Promise<void>) {
  try {
    await fn();
    console.log(`  \u2705 ${name}`);
    passed++;
  } catch (err: any) {
    console.error(`  \u274C ${name}: ${err.message}`);
    failed++;
  }
}

async function main() {
  console.log("\n\uD83D\uDE80 BETA PATH END-TO-END TEST SUITE\n");
  const suffix = Date.now();
  const testEmail = `beta-test-${suffix}@testcorp.example`;
  const testPassword = "BetaTest2026!";
  const testCompany = `TestCorp ${suffix}`;
  let newToken = "";
  let newCompanyId = "";
  let newUserId = "";

  // ══════════════════════════════════════════════
  // PHASE 1: Tenant Registration
  // ══════════════════════════════════════════════
  console.log("-- Phase 1: Tenant Registration --");

  await test("Register new tenant (company + admin user)", async () => {
    const res = await api("POST", "/auth/register", {
      companyName: testCompany,
      industry: "freight_forwarding",
      country: "US",
      name: "Beta Tester",
      email: testEmail,
      password: testPassword,
    });
    assert(res.status === 201, `Expected 201, got ${res.status}: ${res.error || ""}`);
    assert(!!res.data.token, "Should return token");
    assert(!!res.data.company?.id, "Should return company");
    newToken = res.data.token;
    newCompanyId = res.data.company.id;
    newUserId = res.data.user.id;
  });

  await test("Login with new credentials", async () => {
    const res = await api("POST", "/auth/login", {
      email: testEmail,
      password: testPassword,
    });
    assert(res.status === 200, `Expected 200, got ${res.status}`);
    newToken = res.data.token;
    assert(res.data.user.companyId === newCompanyId, "Company ID should match");
  });

  await test("GET /auth/me returns correct tenant", async () => {
    const res = await api("GET", "/auth/me", undefined, newToken);
    assert(res.status === 200, `Expected 200, got ${res.status}`);
    assert(res.data.companyId === newCompanyId, "companyId mismatch");
    assert(res.data.email === testEmail, "email mismatch");
  });

  await test("Duplicate registration rejected", async () => {
    const res = await api("POST", "/auth/register", {
      companyName: "Another Corp",
      name: "Dup User",
      email: testEmail,
      password: testPassword,
    });
    assert(res.status === 409, `Expected 409, got ${res.status}`);
  });

  // ══════════════════════════════════════════════
  // PHASE 2: Billing Enforcement (new tenant)
  // ══════════════════════════════════════════════
  console.log("\n-- Phase 2: Billing Enforcement --");

  await test("New tenant read operations succeed (no active billing required for reads)", async () => {
    const res = await api("GET", "/shipments?limit=1", undefined, newToken);
    assert(res.status === 200, `Expected 200, got ${res.status}`);
    assert(Array.isArray(res.data), "Should return array");
    assert(res.data.length === 0, "New tenant should have 0 shipments");
  });

  await test("New tenant write operations blocked without billing", async () => {
    const res = await api("POST", "/shipments", {
      reference: "TEST-001",
      status: "DRAFT",
    }, newToken);
    assert(res.status === 403, `Expected 403 billing block, got ${res.status}: ${JSON.stringify(res.json)}`);
    const body = res.json as any;
    assert(
      body.code === "BILLING_INACTIVE" || body.code === "BILLING_LOOKUP_FAILED",
      `Expected billing error code, got: ${body.code}`,
    );
  });

  await test("Billing error response explains what to do", async () => {
    const res = await api("POST", "/shipments", { reference: "TEST-002" }, newToken);
    const body = res.json as any;
    assert(typeof body.message === "string", "Should include message");
    assert(body.message.length > 10, "Message should be descriptive");
  });

  // ══════════════════════════════════════════════
  // PHASE 3: Tenant Isolation
  // ══════════════════════════════════════════════
  console.log("\n-- Phase 3: Tenant Isolation --");

  let lorianToken = "";
  await test("Login as existing Lorian tenant", async () => {
    const res = await api("POST", "/auth/login", {
      email: "admin@lorian.demo",
      password: "LorianDemo2026!",
    });
    assert(res.status === 200, `Expected 200, got ${res.status}`);
    lorianToken = res.data.token;
  });

  await test("Lorian tenant sees only their shipments", async () => {
    const res = await api("GET", "/shipments?limit=100", undefined, lorianToken);
    assert(res.status === 200, `Expected 200, got ${res.status}`);
    assert(res.data.length > 0, "Lorian should have shipments");
    for (const s of res.data) {
      assert(s.companyId === "cmp_lorian_001", `Shipment ${s.id} has wrong companyId: ${s.companyId}`);
    }
  });

  await test("New tenant sees 0 shipments (isolated from Lorian)", async () => {
    const res = await api("GET", "/shipments?limit=100", undefined, newToken);
    assert(res.status === 200, `Expected 200, got ${res.status}`);
    assert(res.data.length === 0, `New tenant should see 0 shipments, got ${res.data.length}`);
  });

  await test("New tenant sees 0 invoices (isolated from Lorian)", async () => {
    const res = await api("GET", "/billing/invoices", undefined, newToken);
    assert(res.status === 200, `Expected 200, got ${res.status}`);
    assert(res.data.length === 0, `New tenant should see 0 invoices, got ${res.data.length}`);
  });

  await test("New tenant sees 0 entities (isolated from Lorian)", async () => {
    const res = await api("GET", "/entities", undefined, newToken);
    assert(res.status === 200, `Expected 200, got ${res.status}`);
    assert(res.data.length === 0, `New tenant should see 0 entities, got ${res.data.length}`);
  });

  // ══════════════════════════════════════════════
  // PHASE 4: Lorian Full Journey (shipment → docs → invoice → reconciliation)
  // ══════════════════════════════════════════════
  console.log("\n-- Phase 4: Lorian Full Journey --");

  let testShipmentId = "";
  await test("Fetch existing Lorian shipment", async () => {
    const res = await api("GET", "/shipments?limit=1", undefined, lorianToken);
    assert(res.status === 200 && res.data.length > 0, "Should have shipments");
    testShipmentId = res.data[0].id;
  });

  await test("Shipment detail accessible", async () => {
    const res = await api("GET", `/shipments/${testShipmentId}`, undefined, lorianToken);
    assert(res.status === 200, `Expected 200, got ${res.status}`);
    assert(res.data.id === testShipmentId, "ID mismatch");
    assert(res.data.companyId === "cmp_lorian_001", "companyId mismatch");
  });

  await test("Event timeline accessible", async () => {
    const res = await api("GET", `/shipments/${testShipmentId}/timeline`, undefined, lorianToken);
    assert(res.status === 200, `Expected 200, got ${res.status}`);
  });

  await test("Document readiness check works", async () => {
    const res = await api("GET", `/shipments/${testShipmentId}/generated-documents`, undefined, lorianToken);
    assert(res.status === 200, `Expected 200, got ${res.status}`);
    assert(Array.isArray(res.data), "Should return array of doc readiness");
  });

  await test("Invoice creation from shipment works", async () => {
    const res = await api("POST", `/billing/invoices/from-shipment/${testShipmentId}`, {
      billToName: "Beta Journey Test",
    }, lorianToken);
    assert(res.status === 200, `Expected 200, got ${res.status}: ${res.error || ""}`);
    assert(res.data.companyId === "cmp_lorian_001", "Invoice companyId mismatch");
  });

  await test("Reconciliation summary accessible", async () => {
    const res = await api("GET", `/shipments/${testShipmentId}/financial-summary`, undefined, lorianToken);
    assert(res.status === 200, `Expected 200, got ${res.status}`);
    assert("expectedTotal" in res.data, "Missing expectedTotal");
  });

  await test("Carrier invoices endpoint accessible", async () => {
    const res = await api("GET", `/shipments/${testShipmentId}/carrier-invoices`, undefined, lorianToken);
    assert(res.status === 200, `Expected 200, got ${res.status}`);
    assert(Array.isArray(res.data), "Should be array");
  });

  // ══════════════════════════════════════════════
  // PHASE 5: Error Handling Verification
  // ══════════════════════════════════════════════
  console.log("\n-- Phase 5: Error Handling --");

  await test("Unauthenticated requests return clear error", async () => {
    const res = await api("GET", "/shipments");
    assert([401, 403].includes(res.status), `Expected 401/403, got ${res.status}`);
  });

  await test("Invalid endpoint returns 404", async () => {
    const res = await api("GET", "/nonexistent-endpoint", undefined, lorianToken);
    assert(res.status === 404, `Expected 404, got ${res.status}`);
  });

  await test("Accessing other tenant's shipment returns 404", async () => {
    if (testShipmentId) {
      const res = await api("GET", `/shipments/${testShipmentId}`, undefined, newToken);
      assert(res.status === 404 || (res.status === 200 && !res.data), `Should not find other tenant's shipment (got ${res.status})`);
    }
  });

  await test("Billing status returns structured response", async () => {
    const res = await api("GET", "/stripe/status", undefined, newToken);
    if (res.status === 200) {
      assert(res.data !== undefined, "Should return data");
    }
  });

  // ══════════════════════════════════════════════
  // PHASE 6: Accounting Demo Mode
  // ══════════════════════════════════════════════
  console.log("\n-- Phase 6: Accounting Demo Mode --");

  await test("Accounting status indicates demo mode", async () => {
    const res = await api("GET", "/accounting/status", undefined, lorianToken);
    assert(res.status === 200, `Expected 200, got ${res.status}`);
    if (res.data.isDemoMode) {
      assert(typeof res.data.demoWarning === "string", "Demo mode should include warning text");
    }
  });

  // ══════════════════════════════════════════════
  // PHASE 7: Exceptions & Alerts
  // ══════════════════════════════════════════════
  console.log("\n-- Phase 7: Exceptions & Alerts --");

  await test("Alert summary accessible for Lorian", async () => {
    const res = await api("GET", "/exceptions/alerts/summary", undefined, lorianToken);
    assert(res.status === 200, `Expected 200, got ${res.status}`);
    assert(typeof res.data.total === "number", "Should have total count");
  });

  await test("New tenant has empty alerts", async () => {
    const res = await api("GET", "/exceptions/alerts/summary", undefined, newToken);
    assert(res.status === 200, `Expected 200, got ${res.status}`);
    assert(res.data.total === 0, `New tenant should have 0 alerts, got ${res.data.total}`);
  });

  // ══════════════════════════════════════════════
  // PHASE 8: Quotes
  // ══════════════════════════════════════════════
  console.log("\n-- Phase 8: Quotes --");

  await test("Quotes list accessible for Lorian", async () => {
    const res = await api("GET", "/quotes", undefined, lorianToken);
    assert(res.status === 200, `Expected 200, got ${res.status}`);
    assert(Array.isArray(res.data), "Should return array");
  });

  await test("New tenant sees 0 quotes", async () => {
    const res = await api("GET", "/quotes", undefined, newToken);
    assert(res.status === 200, `Expected 200, got ${res.status}`);
    assert(res.data.length === 0, `New tenant should see 0 quotes, got ${res.data.length}`);
  });

  // Summary
  console.log("\n" + "\u2550".repeat(50));
  console.log(`  RESULTS: ${passed} passed, ${failed} failed`);
  console.log("\u2550".repeat(50) + "\n");
  if (failed > 0) process.exit(1);
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
