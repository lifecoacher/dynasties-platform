import { Router, type IRouter } from "express";
import { db, type DbTransaction } from "@workspace/db";
import { usersTable, companiesTable, eventsTable } from "@workspace/db/schema";
import { eq } from "drizzle-orm";
import { generateId } from "@workspace/shared-utils";
import bcrypt from "bcryptjs";
import { signToken, requireAuth } from "../middlewares/auth.js";
import { validateBody } from "../middlewares/validate.js";
import { loginSchema, registerSchema } from "../schemas/index.js";

const router: IRouter = Router();

router.post("/auth/register", validateBody(registerSchema), async (req, res) => {
  try {
    const { companyName, industry, country, tradeLanes, contactPhone, name, email, password } = req.body;

    const normalizedEmail = email.toLowerCase().trim();

    const [existingUser] = await db
      .select({ id: usersTable.id })
      .from(usersTable)
      .where(eq(usersTable.email, normalizedEmail))
      .limit(1);

    if (existingUser) {
      res.status(409).json({ error: "An account with this email already exists" });
      return;
    }

    const slug = companyName
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 100);

    const [existingCompany] = await db
      .select({ id: companiesTable.id })
      .from(companiesTable)
      .where(eq(companiesTable.slug, slug))
      .limit(1);

    if (existingCompany) {
      res.status(409).json({ error: "An organization with a similar name already exists" });
      return;
    }

    const companyId = generateId();
    const userId = generateId();
    const passwordHash = await bcrypt.hash(password, 12);

    await db.transaction(async (tx: DbTransaction) => {
      await tx.insert(companiesTable).values({
        id: companyId,
        name: companyName,
        slug,
        industry: industry || null,
        country: country || null,
        tradeLanes: tradeLanes || null,
        contactEmail: normalizedEmail,
        contactPhone: contactPhone || null,
        settings: {},
      });

      await tx.insert(usersTable).values({
        id: userId,
        companyId,
        email: normalizedEmail,
        name,
        passwordHash,
        role: "ADMIN",
        isActive: true,
      });

      await tx.insert(eventsTable).values({
        id: generateId(),
        companyId,
        eventType: "COMPANY_CREATED",
        entityType: "company",
        entityId: companyId,
        actorType: "USER",
        userId,
        metadata: { name: companyName, industry, country },
      });
    });

    const token = signToken({
      userId,
      companyId,
      email: normalizedEmail,
      role: "ADMIN",
    });

    res.status(201).json({
      data: {
        token,
        user: { id: userId, email: normalizedEmail, name, role: "ADMIN", companyId },
        company: { id: companyId, name: companyName, slug },
      },
    });
  } catch (err) {
    console.error("[auth/register] error:", err);
    res.status(500).json({ error: "Registration failed" });
  }
});

router.post("/auth/login", validateBody(loginSchema), async (req, res) => {
  const { email, password } = req.body;

  const [user] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.email, email.toLowerCase().trim()))
    .limit(1);

  if (!user || !user.passwordHash) {
    res.status(401).json({ error: "Invalid credentials" });
    return;
  }

  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) {
    res.status(401).json({ error: "Invalid credentials" });
    return;
  }

  if (!user.isActive) {
    res.status(403).json({ error: "Account is disabled" });
    return;
  }

  await db
    .update(usersTable)
    .set({ lastLoginAt: new Date() })
    .where(eq(usersTable.id, user.id));

  const token = signToken({
    userId: user.id,
    companyId: user.companyId,
    email: user.email,
    role: user.role as "ADMIN" | "MANAGER" | "OPERATOR" | "VIEWER",
  });

  res.json({
    data: {
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        companyId: user.companyId,
      },
    },
  });
});

router.get("/auth/me", requireAuth, async (req, res) => {
  const userId = req.user!.userId;

  const [user] = await db
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
    .where(eq(usersTable.id, userId))
    .limit(1);

  if (!user) {
    res.status(404).json({ error: "User not found" });
    return;
  }

  const [company] = await db
    .select({ id: companiesTable.id, name: companiesTable.name, slug: companiesTable.slug })
    .from(companiesTable)
    .where(eq(companiesTable.id, user.companyId))
    .limit(1);

  res.json({ data: { ...user, company: company || null } });
});

export default router;
