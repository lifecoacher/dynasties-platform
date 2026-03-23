import pg from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import * as schema from "../../lib/db/src/schema";
import { sql } from "drizzle-orm";

const { Pool } = pg;
const DATABASE_URL = process.env.DATABASE_URL!;
let passed = 0;
let failed = 0;

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

async function main() {
  console.log("\n🔒 RLS ENFORCEMENT PROOF TESTS\n");
  const pool = new Pool({ connectionString: DATABASE_URL });

  console.log("── Superuser baseline ──");
  await test("Superuser sees all tenant data (bypasses RLS)", async () => {
    const client = await pool.connect();
    try {
      const res = await client.query("SELECT count(*) FROM shipments");
      const count = parseInt(res.rows[0].count);
      assert(count > 0, `Expected rows, got ${count}`);
      console.log(`    (superuser sees ${count} shipments)`);
    } finally {
      client.release();
    }
  });

  console.log("\n── app_user without context ──");
  await test("app_user with NO tenant context sees 0 rows", async () => {
    const client = await pool.connect();
    try {
      await client.query("SET ROLE app_user");
      const res = await client.query("SELECT count(*) FROM shipments");
      const count = parseInt(res.rows[0].count);
      assert(count === 0, `Expected 0 rows (RLS blocks), got ${count}`);
    } finally {
      await client.query("RESET ROLE").catch(() => {});
      client.release();
    }
  });

  await test("app_user with NO context sees 0 invoices", async () => {
    const client = await pool.connect();
    try {
      await client.query("SET ROLE app_user");
      const res = await client.query("SELECT count(*) FROM invoices");
      assert(parseInt(res.rows[0].count) === 0, "Should see 0 invoices");
    } finally {
      await client.query("RESET ROLE").catch(() => {});
      client.release();
    }
  });

  await test("app_user with NO context sees 0 entities", async () => {
    const client = await pool.connect();
    try {
      await client.query("SET ROLE app_user");
      const res = await client.query("SELECT count(*) FROM entities");
      assert(parseInt(res.rows[0].count) === 0, "Should see 0 entities");
    } finally {
      await client.query("RESET ROLE").catch(() => {});
      client.release();
    }
  });

  await test("app_user with NO context sees 0 exceptions", async () => {
    const client = await pool.connect();
    try {
      await client.query("SET ROLE app_user");
      const res = await client.query("SELECT count(*) FROM exceptions");
      assert(parseInt(res.rows[0].count) === 0, "Should see 0 exceptions");
    } finally {
      await client.query("RESET ROLE").catch(() => {});
      client.release();
    }
  });

  console.log("\n── Correct tenant context ──");
  const LORIAN = "cmp_lorian_001";

  await test("app_user with correct tenant sees tenant data", async () => {
    const client = await pool.connect();
    try {
      await client.query("SET ROLE app_user");
      await client.query(`SET app.current_company_id = '${LORIAN}'`);
      const res = await client.query("SELECT count(*) FROM shipments");
      const count = parseInt(res.rows[0].count);
      assert(count > 0, `Expected rows for tenant, got ${count}`);
      console.log(`    (Lorian tenant sees ${count} shipments)`);
    } finally {
      await client.query("RESET app.current_company_id").catch(() => {});
      await client.query("RESET ROLE").catch(() => {});
      client.release();
    }
  });

  await test("All returned shipments belong to the correct tenant", async () => {
    const client = await pool.connect();
    try {
      await client.query("SET ROLE app_user");
      await client.query(`SET app.current_company_id = '${LORIAN}'`);
      const res = await client.query('SELECT DISTINCT "company_id" FROM shipments');
      assert(res.rows.length === 1, `Expected 1 distinct companyId, got ${res.rows.length}`);
      assert(res.rows[0].company_id === LORIAN, `Expected ${LORIAN}, got ${res.rows[0].company_id}`);
    } finally {
      await client.query("RESET app.current_company_id").catch(() => {});
      await client.query("RESET ROLE").catch(() => {});
      client.release();
    }
  });

  console.log("\n── Cross-tenant isolation ──");
  const FAKE_TENANT = "cmp_attacker_999";

  await test("Wrong tenant context sees 0 shipments", async () => {
    const client = await pool.connect();
    try {
      await client.query("SET ROLE app_user");
      await client.query(`SET app.current_company_id = '${FAKE_TENANT}'`);
      const res = await client.query("SELECT count(*) FROM shipments");
      assert(parseInt(res.rows[0].count) === 0, "Cross-tenant should see 0 shipments");
    } finally {
      await client.query("RESET app.current_company_id").catch(() => {});
      await client.query("RESET ROLE").catch(() => {});
      client.release();
    }
  });

  await test("Wrong tenant sees 0 invoices", async () => {
    const client = await pool.connect();
    try {
      await client.query("SET ROLE app_user");
      await client.query(`SET app.current_company_id = '${FAKE_TENANT}'`);
      const res = await client.query("SELECT count(*) FROM invoices");
      assert(parseInt(res.rows[0].count) === 0, "Cross-tenant should see 0 invoices");
    } finally {
      await client.query("RESET app.current_company_id").catch(() => {});
      await client.query("RESET ROLE").catch(() => {});
      client.release();
    }
  });

  await test("Wrong tenant sees 0 entities", async () => {
    const client = await pool.connect();
    try {
      await client.query("SET ROLE app_user");
      await client.query(`SET app.current_company_id = '${FAKE_TENANT}'`);
      const res = await client.query("SELECT count(*) FROM entities");
      assert(parseInt(res.rows[0].count) === 0, "Cross-tenant should see 0 entities");
    } finally {
      await client.query("RESET app.current_company_id").catch(() => {});
      await client.query("RESET ROLE").catch(() => {});
      client.release();
    }
  });

  await test("Wrong tenant sees 0 billing_accounts", async () => {
    const client = await pool.connect();
    try {
      await client.query("SET ROLE app_user");
      await client.query(`SET app.current_company_id = '${FAKE_TENANT}'`);
      const res = await client.query("SELECT count(*) FROM billing_accounts");
      assert(parseInt(res.rows[0].count) === 0, "Cross-tenant should see 0 billing_accounts");
    } finally {
      await client.query("RESET app.current_company_id").catch(() => {});
      await client.query("RESET ROLE").catch(() => {});
      client.release();
    }
  });

  await test("Wrong tenant sees 0 carrier_invoices", async () => {
    const client = await pool.connect();
    try {
      await client.query("SET ROLE app_user");
      await client.query(`SET app.current_company_id = '${FAKE_TENANT}'`);
      const res = await client.query("SELECT count(*) FROM carrier_invoices");
      assert(parseInt(res.rows[0].count) === 0, "Cross-tenant should see 0 carrier invoices");
    } finally {
      await client.query("RESET app.current_company_id").catch(() => {});
      await client.query("RESET ROLE").catch(() => {});
      client.release();
    }
  });

  console.log("\n── Drizzle ORM through tenant context ──");
  await test("Drizzle queries through runWithTenant are RLS-scoped", async () => {
    const { runWithTenant, db } = await import("../../lib/db/src/index");
    const result = await runWithTenant(LORIAN, async () => {
      return db.select({ count: sql<number>`count(*)` }).from(schema.shipmentsTable);
    });
    const count = Number(result[0].count);
    assert(count > 0, `Expected rows via Drizzle, got ${count}`);
    console.log(`    (Drizzle runWithTenant sees ${count} shipments)`);
  });

  await test("Drizzle queries through runWithTenant with wrong tenant see 0", async () => {
    const { runWithTenant, db } = await import("../../lib/db/src/index");
    const result = await runWithTenant(FAKE_TENANT, async () => {
      return db.select({ count: sql<number>`count(*)` }).from(schema.shipmentsTable);
    });
    const count = Number(result[0].count);
    assert(count === 0, `Expected 0 via Drizzle cross-tenant, got ${count}`);
  });

  await test("Even missing WHERE filters do not leak rows under RLS", async () => {
    const { runWithTenant, db } = await import("../../lib/db/src/index");
    const result = await runWithTenant(FAKE_TENANT, async () => {
      return db.select().from(schema.shipmentsTable);
    });
    assert(result.length === 0, `Unfiltered query returned ${result.length} rows (should be 0)`);
  });

  // Summary
  await pool.end();
  console.log("\n" + "═".repeat(50));
  console.log(`  RESULTS: ${passed} passed, ${failed} failed`);
  console.log("═".repeat(50) + "\n");
  if (failed > 0) process.exit(1);
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
