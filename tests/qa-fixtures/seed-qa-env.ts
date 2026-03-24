import pg from "pg";
import bcrypt from "bcryptjs";

const DATABASE_URL = process.env.DATABASE_URL!;
const pool = new pg.Pool({ connectionString: DATABASE_URL });

async function seedQA() {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    console.log("=== SEEDING QA WORKSPACES ===");

    const password = await bcrypt.hash("LorianDemo2026!", 12);

    const workspaces = [
      {
        id: "cmp_qa_trial",
        name: "QA Trial Workspace",
        slug: "qa-trial",
        planType: "STARTER",
        billingStatus: "TRIAL",
        seatLimit: 3,
        shipmentLimitMonthly: 40,
        trialEndsAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(),
        currentPeriodStart: new Date().toISOString(),
        currentPeriodEnd: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(),
      },
      {
        id: "cmp_qa_active",
        name: "QA Active Paid Workspace",
        slug: "qa-active-paid",
        planType: "GROWTH",
        billingStatus: "ACTIVE",
        seatLimit: 10,
        shipmentLimitMonthly: 250,
        trialEndsAt: null,
        currentPeriodStart: new Date().toISOString(),
        currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      },
      {
        id: "cmp_qa_pastdue",
        name: "QA Failed Billing Workspace",
        slug: "qa-failed-billing",
        planType: "STARTER",
        billingStatus: "PAST_DUE",
        seatLimit: 3,
        shipmentLimitMonthly: 40,
        trialEndsAt: null,
        currentPeriodStart: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
        currentPeriodEnd: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
      },
      {
        id: "cmp_qa_inactive",
        name: "QA Inactive Workspace",
        slug: "qa-inactive",
        planType: null,
        billingStatus: "INACTIVE",
        seatLimit: 3,
        shipmentLimitMonthly: 40,
        trialEndsAt: null,
        currentPeriodStart: null,
        currentPeriodEnd: null,
      },
      {
        id: "cmp_qa_seatfull",
        name: "QA Seat Limit Reached",
        slug: "qa-seat-full",
        planType: "STARTER",
        billingStatus: "ACTIVE",
        seatLimit: 3,
        shipmentLimitMonthly: 40,
        trialEndsAt: null,
        currentPeriodStart: new Date().toISOString(),
        currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      },
      {
        id: "cmp_qa_seatavail",
        name: "QA Seat Available Workspace",
        slug: "qa-seat-available",
        planType: "GROWTH",
        billingStatus: "ACTIVE",
        seatLimit: 10,
        shipmentLimitMonthly: 250,
        trialEndsAt: null,
        currentPeriodStart: new Date().toISOString(),
        currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      },
    ];

    for (const ws of workspaces) {
      await client.query(
        `INSERT INTO companies (id, name, slug, plan_type, billing_status, seat_limit, shipment_limit_monthly, trial_ends_at, current_period_start, current_period_end, shipments_used_this_cycle)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 0)
         ON CONFLICT (id) DO UPDATE SET
           billing_status = EXCLUDED.billing_status,
           plan_type = EXCLUDED.plan_type,
           seat_limit = EXCLUDED.seat_limit,
           shipment_limit_monthly = EXCLUDED.shipment_limit_monthly,
           trial_ends_at = EXCLUDED.trial_ends_at,
           current_period_start = EXCLUDED.current_period_start,
           current_period_end = EXCLUDED.current_period_end`,
        [ws.id, ws.name, ws.slug, ws.planType, ws.billingStatus, ws.seatLimit, ws.shipmentLimitMonthly, ws.trialEndsAt, ws.currentPeriodStart, ws.currentPeriodEnd]
      );
      console.log(`  ✅ ${ws.name} (${ws.billingStatus})`);
    }

    console.log("\n=== SEEDING QA USERS ===");

    const users = [
      { id: "usr_qa_trial_admin", email: "admin@qa-trial.demo", name: "Trial Admin", role: "ADMIN", companyId: "cmp_qa_trial" },
      { id: "usr_qa_active_admin", email: "admin@qa-active.demo", name: "Active Admin", role: "ADMIN", companyId: "cmp_qa_active" },
      { id: "usr_qa_active_ops", email: "ops@qa-active.demo", name: "Active Operator", role: "OPERATOR", companyId: "cmp_qa_active" },
      { id: "usr_qa_active_viewer", email: "viewer@qa-active.demo", name: "Active Viewer", role: "VIEWER", companyId: "cmp_qa_active" },
      { id: "usr_qa_pastdue_admin", email: "admin@qa-pastdue.demo", name: "PastDue Admin", role: "ADMIN", companyId: "cmp_qa_pastdue" },
      { id: "usr_qa_inactive_admin", email: "admin@qa-inactive.demo", name: "Inactive Admin", role: "ADMIN", companyId: "cmp_qa_inactive" },
      { id: "usr_qa_seatfull_admin", email: "admin@qa-seatfull.demo", name: "SeatFull Admin", role: "ADMIN", companyId: "cmp_qa_seatfull" },
      { id: "usr_qa_seatfull_ops1", email: "ops1@qa-seatfull.demo", name: "SeatFull Ops 1", role: "OPERATOR", companyId: "cmp_qa_seatfull" },
      { id: "usr_qa_seatfull_ops2", email: "ops2@qa-seatfull.demo", name: "SeatFull Ops 2", role: "OPERATOR", companyId: "cmp_qa_seatfull" },
      { id: "usr_qa_seatavail_admin", email: "admin@qa-seatavail.demo", name: "SeatAvail Admin", role: "ADMIN", companyId: "cmp_qa_seatavail" },
      { id: "usr_qa_seatavail_ops", email: "ops@qa-seatavail.demo", name: "SeatAvail Ops", role: "OPERATOR", companyId: "cmp_qa_seatavail" },
    ];

    for (const u of users) {
      await client.query(
        `INSERT INTO users (id, email, name, role, company_id, password_hash, is_active)
         VALUES ($1, $2, $3, $4, $5, $6, true)
         ON CONFLICT (id) DO UPDATE SET
           email = EXCLUDED.email,
           password_hash = EXCLUDED.password_hash,
           role = EXCLUDED.role`,
        [u.id, u.email, u.name, u.role, u.companyId, password]
      );
      console.log(`  ✅ ${u.email} (${u.role} @ ${u.companyId})`);
    }

    console.log("\n=== LINKING ENTITIES TO LORIAN SHIPMENTS ===");

    const entityLinks = await client.query(
      `SELECT id, name, entity_type FROM entities WHERE company_id = 'cmp_lorian_001' LIMIT 25`
    );

    const shippers = entityLinks.rows.filter((e: any) => e.entity_type === "SHIPPER");
    const consignees = entityLinks.rows.filter((e: any) => e.entity_type === "CONSIGNEE" || e.entity_type === "CUSTOMER");
    const allEntities = entityLinks.rows;

    const shipments = await client.query(
      `SELECT id, reference FROM shipments WHERE company_id = 'cmp_lorian_001' ORDER BY created_at DESC LIMIT 10`
    );

    let linked = 0;
    for (let i = 0; i < Math.min(shipments.rows.length, 6); i++) {
      const shp = shipments.rows[i];
      const shipperEntity = shippers[i % Math.max(shippers.length, 1)] || allEntities[i % allEntities.length];
      const consigneeEntity = consignees[i % Math.max(consignees.length, 1)] || allEntities[(i + 1) % allEntities.length];

      if (shipperEntity && consigneeEntity && shipperEntity.id !== consigneeEntity.id) {
        await client.query(
          `UPDATE shipments SET shipper_id = $1, consignee_id = $2 WHERE id = $3 AND shipper_id IS NULL`,
          [shipperEntity.id, consigneeEntity.id, shp.id]
        );
        linked++;
        console.log(`  ✅ ${shp.reference}: shipper=${shipperEntity.name}, consignee=${consigneeEntity.name}`);
      }
    }
    console.log(`  Linked ${linked} shipments to entities`);

    console.log("\n=== SEEDING CARRIER INVOICES ===");

    const lorianShipments = await client.query(
      `SELECT id, reference, cargo_value FROM shipments WHERE company_id = 'cmp_lorian_001' AND cargo_value > 0 LIMIT 3`
    );

    for (const shp of lorianShipments.rows) {
      const carrierInvId = `cinv_qa_${shp.id.slice(-8)}`;
      const baseAmount = Number(shp.cargo_value) || 10000;
      const variance = Math.round(baseAmount * 0.03);
      const invoiceAmount = baseAmount + variance;

      await client.query(
        `INSERT INTO carrier_invoices (id, shipment_id, company_id, carrier_name, invoice_number, invoice_date, total_amount, currency, created_at, updated_at)
         VALUES ($1, $2, 'cmp_lorian_001', 'Maersk Line', $3, NOW(), $4, 'USD', NOW(), NOW())
         ON CONFLICT (id) DO NOTHING`,
        [carrierInvId, shp.id, `MAERSK-QA-${shp.reference}`, invoiceAmount]
      );
      console.log(`  ✅ Carrier invoice for ${shp.reference}: $${invoiceAmount} (+${variance} variance)`);
    }

    await client.query("COMMIT");
    console.log("\n=== QA SEED COMPLETE ===");

  } catch (err) {
    await client.query("ROLLBACK");
    console.error("Seed failed:", err);
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
}

seedQA().catch((err) => {
  console.error(err);
  process.exit(1);
});
