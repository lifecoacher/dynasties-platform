import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import {
  hsCodesTable,
  portsTable,
  containerTypesTable,
  currenciesTable,
  countriesTable,
  incotermsTable,
} from "@workspace/db/schema";
import { ilike, eq, or, and } from "drizzle-orm";

const router: IRouter = Router();

router.get("/reference/hs-codes", async (req, res) => {
  const search = req.query.q as string | undefined;
  const limit = Math.min(Number(req.query.limit) || 50, 200);

  if (search) {
    const data = await db
      .select()
      .from(hsCodesTable)
      .where(or(ilike(hsCodesTable.code, `${search}%`), ilike(hsCodesTable.description, `%${search}%`)))
      .limit(limit);
    res.json({ data });
  } else {
    const data = await db.select().from(hsCodesTable).limit(limit);
    res.json({ data });
  }
});

router.get("/reference/ports", async (req, res) => {
  const search = req.query.q as string | undefined;
  const type = req.query.type as string | undefined;
  const country = req.query.country as string | undefined;
  const limit = Math.min(Number(req.query.limit) || 50, 500);

  const conditions = [eq(portsTable.isActive, true)];
  if (search) {
    conditions.push(
      or(ilike(portsTable.locode, `%${search}%`), ilike(portsTable.name, `%${search}%`))!,
    );
  }
  if (type) {
    conditions.push(eq(portsTable.portType, type as any));
  }
  if (country) {
    conditions.push(eq(portsTable.countryCode, country.toUpperCase()));
  }

  const where = conditions.length === 1 ? conditions[0] : and(...conditions);
  const data = await db.select().from(portsTable).where(where).limit(limit);
  res.json({ data });
});

router.get("/reference/container-types", async (_req, res) => {
  const data = await db.select().from(containerTypesTable);
  res.json({ data });
});

router.get("/reference/currencies", async (_req, res) => {
  const data = await db.select().from(currenciesTable);
  res.json({ data });
});

router.get("/reference/countries", async (req, res) => {
  const search = req.query.q as string | undefined;
  const limit = Math.min(Number(req.query.limit) || 250, 300);

  if (search) {
    const data = await db
      .select()
      .from(countriesTable)
      .where(or(ilike(countriesTable.name, `%${search}%`), ilike(countriesTable.code, `${search}%`)))
      .limit(limit);
    res.json({ data });
  } else {
    const data = await db.select().from(countriesTable).limit(limit);
    res.json({ data });
  }
});

router.get("/reference/incoterms", async (_req, res) => {
  const data = await db.select().from(incotermsTable);
  res.json({ data });
});

export default router;
