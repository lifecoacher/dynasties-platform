import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { entitiesTable } from "@workspace/db/schema";
import { eq, and, desc, inArray } from "drizzle-orm";
import { generateId } from "@workspace/shared-utils";
import { getCompanyId } from "../middlewares/tenant.js";
import { requireMinRole } from "../middlewares/auth.js";
import { parsePagination, paginatedResponse } from "../middlewares/pagination.js";
import { customerImportRowSchema } from "../schemas/index.js";
import { z } from "zod";

const router: IRouter = Router();

function normalizeEntityName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

router.get("/customers", async (req, res) => {
  const companyId = getCompanyId(req);
  const pg = parsePagination(req);

  const customers = await db
    .select()
    .from(entitiesTable)
    .where(and(eq(entitiesTable.companyId, companyId), eq(entitiesTable.entityType, "CUSTOMER")))
    .orderBy(desc(entitiesTable.createdAt))
    .limit(pg.limit)
    .offset(pg.offset);

  res.json(paginatedResponse(customers, pg));
});

router.get("/customers/:id", async (req, res) => {
  const companyId = getCompanyId(req);
  const { id } = req.params;

  const [customer] = await db
    .select()
    .from(entitiesTable)
    .where(and(eq(entitiesTable.id, id), eq(entitiesTable.companyId, companyId), eq(entitiesTable.entityType, "CUSTOMER")))
    .limit(1);

  if (!customer) {
    res.status(404).json({ error: "Customer not found" });
    return;
  }
  res.json({ data: customer });
});

router.post("/customers", requireMinRole("OPERATOR"), async (req, res) => {
  const companyId = getCompanyId(req);
  const parsed = customerImportRowSchema.safeParse(req.body);

  if (!parsed.success) {
    res.status(400).json({ error: "Invalid customer data", details: parsed.error.issues });
    return;
  }

  const { customerName, companyName, email, phone, country, address, city, taxId } = parsed.data;
  const customerId = generateId();

  await db.insert(entitiesTable).values({
    id: customerId,
    companyId,
    name: customerName,
    normalizedName: normalizeEntityName(customerName),
    entityType: "CUSTOMER",
    status: "VERIFIED",
    address: address || null,
    city: city || null,
    country: country || null,
    contactEmail: email || null,
    contactPhone: phone || null,
    taxId: taxId || null,
    metadata: companyName ? { companyName } : null,
  });

  res.status(201).json({ data: { id: customerId, name: customerName } });
});

router.post("/customers/import", requireMinRole("OPERATOR"), async (req, res) => {
  const companyId = getCompanyId(req);
  const { rows } = req.body;

  if (!Array.isArray(rows) || rows.length === 0) {
    res.status(400).json({ error: "Request body must contain a 'rows' array with at least one customer" });
    return;
  }

  if (rows.length > 500) {
    res.status(400).json({ error: "Maximum 500 customers per import" });
    return;
  }

  const results: { imported: number; failed: number; errors: Array<{ row: number; error: string }> } = {
    imported: 0,
    failed: 0,
    errors: [],
  };

  const batchSchema = z.array(customerImportRowSchema);
  const parsed = batchSchema.safeParse(rows);

  if (!parsed.success) {
    for (const issue of parsed.error.issues) {
      const rowIndex = issue.path[0];
      results.errors.push({ row: Number(rowIndex) + 1, error: issue.message });
    }
    results.failed = rows.length;
    res.status(400).json({ data: results });
    return;
  }

  const validRows = parsed.data;

  const normalizedNames = validRows.map((r) => normalizeEntityName(r.customerName));
  const existingEntities = await db
    .select({ normalizedName: entitiesTable.normalizedName })
    .from(entitiesTable)
    .where(
      and(
        eq(entitiesTable.companyId, companyId),
        eq(entitiesTable.entityType, "CUSTOMER"),
        inArray(entitiesTable.normalizedName, normalizedNames),
      ),
    );
  const existingSet = new Set(existingEntities.map((e) => e.normalizedName));

  const insertValues = [];
  for (let i = 0; i < validRows.length; i++) {
    const row = validRows[i];
    const nn = normalizeEntityName(row.customerName);
    if (existingSet.has(nn)) {
      results.failed++;
      results.errors.push({ row: i + 1, error: `Customer "${row.customerName}" already exists` });
      continue;
    }
    existingSet.add(nn);
    insertValues.push({
      id: generateId(),
      companyId,
      name: row.customerName,
      normalizedName: nn,
      entityType: "CUSTOMER" as const,
      status: "VERIFIED" as const,
      address: row.address || null,
      city: row.city || null,
      country: row.country || null,
      contactEmail: row.email || null,
      contactPhone: row.phone || null,
      taxId: row.taxId || null,
      metadata: row.companyName ? { companyName: row.companyName } : null,
    });
  }

  if (insertValues.length > 0) {
    try {
      await db.insert(entitiesTable).values(insertValues);
      results.imported = insertValues.length;
    } catch (err) {
      console.error("[customer-import] batch insert error:", err);
      results.failed += insertValues.length;
      results.imported = 0;
      results.errors.push({ row: 0, error: "Database insert failed" });
    }
  }

  res.status(results.failed > 0 && results.imported > 0 ? 207 : results.imported > 0 ? 201 : 400).json({ data: results });
});

export default router;
