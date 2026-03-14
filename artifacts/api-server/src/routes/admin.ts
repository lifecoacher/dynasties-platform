import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { companiesTable, usersTable, eventsTable } from "@workspace/db/schema";
import { eq } from "drizzle-orm";
import { generateId } from "@workspace/shared-utils";
import bcrypt from "bcryptjs";
import { requireAuth, requireRole } from "../middlewares/auth.js";

const router: IRouter = Router();

const adminGuard = [requireAuth, requireRole("ADMIN")] as const;

router.post("/admin/companies", ...adminGuard, async (req, res) => {
  const { name, slug, contactEmail, sesEmailAddress } = req.body as {
    name: string;
    slug: string;
    contactEmail?: string;
    sesEmailAddress?: string;
  };

  if (!name || !slug) {
    res.status(400).json({ error: "name and slug are required" });
    return;
  }

  const existing = await db
    .select({ id: companiesTable.id })
    .from(companiesTable)
    .where(eq(companiesTable.slug, slug.toLowerCase().trim()))
    .limit(1);

  if (existing.length > 0) {
    res.status(409).json({ error: "Company with this slug already exists" });
    return;
  }

  const companyId = generateId();
  await db.insert(companiesTable).values({
    id: companyId,
    name,
    slug: slug.toLowerCase().trim(),
    contactEmail: contactEmail || null,
    sesEmailAddress: sesEmailAddress || null,
    settings: {},
  });

  await db.insert(eventsTable).values({
    id: generateId(),
    companyId,
    eventType: "COMPANY_CREATED",
    entityType: "company",
    entityId: companyId,
    actorType: "USER",
    userId: req.user!.userId,
    metadata: { name, slug },
  });

  const [created] = await db
    .select()
    .from(companiesTable)
    .where(eq(companiesTable.id, companyId))
    .limit(1);

  res.status(201).json({ data: created });
});

router.get("/admin/companies", ...adminGuard, async (_req, res) => {
  const companies = await db.select().from(companiesTable);
  res.json({ data: companies });
});

router.post("/admin/users", ...adminGuard, async (req, res) => {
  const { email, name, password, role, companyId } = req.body as {
    email: string;
    name: string;
    password: string;
    role: string;
    companyId: string;
  };

  if (!email || !name || !password || !role || !companyId) {
    res.status(400).json({ error: "email, name, password, role, and companyId are required" });
    return;
  }

  const validRoles = ["ADMIN", "MANAGER", "OPERATOR", "VIEWER"];
  if (!validRoles.includes(role)) {
    res.status(400).json({ error: `Invalid role. Must be one of: ${validRoles.join(", ")}` });
    return;
  }

  const [company] = await db
    .select({ id: companiesTable.id })
    .from(companiesTable)
    .where(eq(companiesTable.id, companyId))
    .limit(1);

  if (!company) {
    res.status(404).json({ error: "Company not found" });
    return;
  }

  const existing = await db
    .select({ id: usersTable.id })
    .from(usersTable)
    .where(eq(usersTable.email, email.toLowerCase().trim()))
    .limit(1);

  if (existing.length > 0) {
    res.status(409).json({ error: "User with this email already exists" });
    return;
  }

  const passwordHash = await bcrypt.hash(password, 12);
  const userId = generateId();

  await db.insert(usersTable).values({
    id: userId,
    companyId,
    email: email.toLowerCase().trim(),
    name,
    passwordHash,
    role: role as "ADMIN" | "MANAGER" | "OPERATOR" | "VIEWER",
    isActive: true,
  });

  await db.insert(eventsTable).values({
    id: generateId(),
    companyId,
    eventType: "USER_CREATED",
    entityType: "user",
    entityId: userId,
    actorType: "USER",
    userId: req.user!.userId,
    metadata: { email, role },
  });

  res.status(201).json({
    data: {
      id: userId,
      email: email.toLowerCase().trim(),
      name,
      role,
      companyId,
      isActive: true,
    },
  });
});

router.get("/admin/users", ...adminGuard, async (_req, res) => {
  const users = await db
    .select({
      id: usersTable.id,
      email: usersTable.email,
      name: usersTable.name,
      role: usersTable.role,
      companyId: usersTable.companyId,
      isActive: usersTable.isActive,
      lastLoginAt: usersTable.lastLoginAt,
      createdAt: usersTable.createdAt,
    })
    .from(usersTable);
  res.json({ data: users });
});

export default router;
