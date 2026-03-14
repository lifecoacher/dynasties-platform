import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { usersTable, companiesTable } from "@workspace/db/schema";
import { eq } from "drizzle-orm";
import { generateId } from "@workspace/shared-utils";
import bcrypt from "bcryptjs";
import { signToken, requireAuth } from "../middlewares/auth.js";
import { validateBody } from "../middlewares/validate.js";
import { loginSchema } from "../schemas/index.js";

const router: IRouter = Router();

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
