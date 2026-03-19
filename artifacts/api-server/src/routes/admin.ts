import { Router, type IRouter } from "express";
import { db, type DbTransaction } from "@workspace/db";
import { companiesTable, usersTable, eventsTable } from "@workspace/db/schema";
import { eq, and } from "drizzle-orm";
import { generateId } from "@workspace/shared-utils";
import bcrypt from "bcryptjs";
import { requireAuth, requireRole, refreshRole } from "../middlewares/auth.js";
import { getCompanyId } from "../middlewares/tenant.js";
import { validateBody } from "../middlewares/validate.js";
import { createCompanySchema, createUserSchema, inviteUserSchema } from "../schemas/index.js";
import { checkSeatLimit } from "../middlewares/billing-enforcement.js";

const router: IRouter = Router();

const adminGuard = [requireAuth, refreshRole, requireRole("ADMIN")] as const;

router.post("/admin/companies", ...adminGuard, validateBody(createCompanySchema), async (req, res) => {
  const { name, slug, contactEmail, sesEmailAddress } = req.body;

  const companyId = getCompanyId(req);

  const existing = await db
    .select({ id: companiesTable.id })
    .from(companiesTable)
    .where(eq(companiesTable.slug, slug.toLowerCase().trim()))
    .limit(1);

  if (existing.length > 0) {
    res.status(409).json({ error: "Company with this slug already exists" });
    return;
  }

  const newCompanyId = generateId();

  await db.transaction(async (tx: DbTransaction) => {
    await tx.insert(companiesTable).values({
      id: newCompanyId,
      name,
      slug: slug.toLowerCase().trim(),
      contactEmail: contactEmail || null,
      sesEmailAddress: sesEmailAddress || null,
      settings: {},
    });

    await tx.insert(eventsTable).values({
      id: generateId(),
      companyId,
      eventType: "COMPANY_CREATED",
      entityType: "company",
      entityId: newCompanyId,
      actorType: "USER",
      userId: req.user!.userId,
      metadata: { name, slug },
    });
  });

  const [created] = await db
    .select()
    .from(companiesTable)
    .where(eq(companiesTable.id, newCompanyId))
    .limit(1);

  res.status(201).json({ data: created });
});

router.get("/admin/companies", ...adminGuard, async (req, res) => {
  const companyId = getCompanyId(req);
  const companies = await db
    .select()
    .from(companiesTable)
    .where(eq(companiesTable.id, companyId));
  res.json({ data: companies });
});

router.post("/admin/users", ...adminGuard, validateBody(createUserSchema), async (req, res) => {
  const { email, name, password, role, companyId: targetCompanyId } = req.body;

  const callerCompanyId = getCompanyId(req);
  const companyId = targetCompanyId || callerCompanyId;

  if (companyId !== callerCompanyId) {
    res.status(403).json({ error: "Cannot create users in another company" });
    return;
  }

  const seatInfo = await checkSeatLimit(companyId);
  if (!seatInfo.allowed) {
    res.status(403).json({
      error: "Seat limit reached",
      code: "SEAT_LIMIT_EXCEEDED",
      message: `Your plan allows ${seatInfo.limit} team members. You currently have ${seatInfo.used}. Upgrade your plan for more seats.`,
    });
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

  await db.transaction(async (tx: DbTransaction) => {
    await tx.insert(usersTable).values({
      id: userId,
      companyId,
      email: email.toLowerCase().trim(),
      name,
      passwordHash,
      role: role as "ADMIN" | "MANAGER" | "OPERATOR" | "VIEWER",
      isActive: true,
    });

    await tx.insert(eventsTable).values({
      id: generateId(),
      companyId,
      eventType: "USER_CREATED",
      entityType: "user",
      entityId: userId,
      actorType: "USER",
      userId: req.user!.userId,
      metadata: { email, role },
    });
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

router.post("/admin/invite", ...adminGuard, validateBody(inviteUserSchema), async (req, res) => {
  const { email, name, role } = req.body;
  const companyId = getCompanyId(req);
  const normalizedEmail = email.toLowerCase().trim();

  const seatInfo = await checkSeatLimit(companyId);
  if (!seatInfo.allowed) {
    res.status(403).json({
      error: "Seat limit reached",
      code: "SEAT_LIMIT_EXCEEDED",
      message: `Your plan allows ${seatInfo.limit} team members. You currently have ${seatInfo.used}. Upgrade your plan for more seats.`,
    });
    return;
  }

  const [existing] = await db
    .select({ id: usersTable.id })
    .from(usersTable)
    .where(eq(usersTable.email, normalizedEmail))
    .limit(1);

  if (existing) {
    res.status(409).json({ error: "User with this email already exists" });
    return;
  }

  const crypto = await import("node:crypto");
  const tempPassword = `Dyn-${crypto.randomBytes(8).toString("base64url")}!`;
  const passwordHash = await bcrypt.hash(tempPassword, 12);
  const userId = generateId();

  await db.transaction(async (tx: DbTransaction) => {
    await tx.insert(usersTable).values({
      id: userId,
      companyId,
      email: normalizedEmail,
      name,
      passwordHash,
      role: role as "ADMIN" | "MANAGER" | "OPERATOR" | "VIEWER",
      isActive: true,
    });

    await tx.insert(eventsTable).values({
      id: generateId(),
      companyId,
      eventType: "USER_INVITED",
      entityType: "user",
      entityId: userId,
      actorType: "USER",
      userId: req.user!.userId,
      metadata: { email: normalizedEmail, role },
    });
  });

  res.status(201).json({
    data: {
      id: userId,
      email: normalizedEmail,
      name,
      role,
      companyId,
      temporaryPassword: tempPassword,
      message: "User invited. Share the temporary password with them securely.",
    },
  });
});

router.get("/admin/users", ...adminGuard, async (req, res) => {
  const companyId = getCompanyId(req);
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
    .from(usersTable)
    .where(eq(usersTable.companyId, companyId));
  res.json({ data: users });
});

export default router;
