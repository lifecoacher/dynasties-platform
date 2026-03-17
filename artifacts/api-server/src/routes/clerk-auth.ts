import { Router, type IRouter } from "express";
import { db, type DbTransaction } from "@workspace/db";
import { usersTable, companiesTable, eventsTable } from "@workspace/db/schema";
import { eq } from "drizzle-orm";
import { generateId } from "@workspace/shared-utils";
import bcrypt from "bcryptjs";
import { signToken } from "../middlewares/auth.js";

const router: IRouter = Router();

function getClerkVerifier() {
  const secretKey = process.env.CLERK_SECRET_KEY;
  if (!secretKey) return null;

  return async (token: string): Promise<{ sub: string; email?: string; first_name?: string; last_name?: string } | null> => {
    try {
      const { createClerkClient } = await import("@clerk/express");
      const clerk = createClerkClient({ secretKey });
      const verified = await (clerk as any).verifyToken(token);
      if (!verified || !verified.sub) return null;

      const user = await clerk.users.getUser(verified.sub);
      return {
        sub: verified.sub,
        email: user.emailAddresses?.[0]?.emailAddress,
        first_name: user.firstName ?? undefined,
        last_name: user.lastName ?? undefined,
      };
    } catch (err) {
      console.error("[clerk-sync] token verification failed:", err);
      return null;
    }
  };
}

router.post("/auth/clerk-sync", async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith("Bearer ")) {
      res.status(401).json({ error: "Missing Clerk session token" });
      return;
    }

    const clerkToken = authHeader.slice(7);
    const verifier = getClerkVerifier();

    if (!verifier) {
      res.status(503).json({ error: "Clerk is not configured on this server" });
      return;
    }

    const clerkUser = await verifier(clerkToken);
    if (!clerkUser || !clerkUser.email) {
      res.status(401).json({ error: "Invalid or expired Clerk token" });
      return;
    }

    const clerkUserId = clerkUser.sub;
    const normalizedEmail = clerkUser.email.toLowerCase().trim();
    const displayName = [clerkUser.first_name, clerkUser.last_name].filter(Boolean).join(" ") || normalizedEmail.split("@")[0];

    const [existingByClerk] = await db
      .select()
      .from(usersTable)
      .where(eq(usersTable.clerkId, clerkUserId))
      .limit(1);

    if (existingByClerk) {
      if (!existingByClerk.isActive) {
        res.status(403).json({ error: "Account is deactivated" });
        return;
      }

      await db
        .update(usersTable)
        .set({ lastLoginAt: new Date() })
        .where(eq(usersTable.id, existingByClerk.id));

      const token = signToken({
        userId: existingByClerk.id,
        companyId: existingByClerk.companyId,
        email: existingByClerk.email,
        role: existingByClerk.role as "ADMIN" | "MANAGER" | "OPERATOR" | "VIEWER",
      });

      res.json({
        data: {
          token,
          user: {
            id: existingByClerk.id,
            email: existingByClerk.email,
            name: existingByClerk.name,
            role: existingByClerk.role,
            companyId: existingByClerk.companyId,
          },
          isNewUser: false,
        },
      });
      return;
    }

    const [existingByEmail] = await db
      .select()
      .from(usersTable)
      .where(eq(usersTable.email, normalizedEmail))
      .limit(1);

    if (existingByEmail) {
      if (!existingByEmail.isActive) {
        res.status(403).json({ error: "Account is deactivated" });
        return;
      }

      await db
        .update(usersTable)
        .set({ clerkId: clerkUserId, lastLoginAt: new Date() })
        .where(eq(usersTable.id, existingByEmail.id));

      const token = signToken({
        userId: existingByEmail.id,
        companyId: existingByEmail.companyId,
        email: existingByEmail.email,
        role: existingByEmail.role as "ADMIN" | "MANAGER" | "OPERATOR" | "VIEWER",
      });

      res.json({
        data: {
          token,
          user: {
            id: existingByEmail.id,
            email: existingByEmail.email,
            name: existingByEmail.name,
            role: existingByEmail.role,
            companyId: existingByEmail.companyId,
          },
          isNewUser: false,
        },
      });
      return;
    }

    const orgName = `${displayName}'s Organization`;
    const slug = orgName
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 100);

    const companyId = generateId();
    const userId = generateId();
    const placeholderHash = await bcrypt.hash(generateId(), 10);

    await db.transaction(async (tx: DbTransaction) => {
      await tx.insert(companiesTable).values({
        id: companyId,
        name: orgName,
        slug: `${slug}-${Date.now()}`,
        contactEmail: normalizedEmail,
        settings: {},
      });

      await tx.insert(usersTable).values({
        id: userId,
        companyId,
        email: normalizedEmail,
        name: displayName,
        passwordHash: placeholderHash,
        clerkId: clerkUserId,
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
        metadata: { name: orgName, source: "clerk-signup" },
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
        user: { id: userId, email: normalizedEmail, name: displayName, role: "ADMIN", companyId },
        company: { id: companyId, name: orgName, slug },
        isNewUser: true,
      },
    });
  } catch (err) {
    console.error("[clerk-sync] error:", err);
    res.status(500).json({ error: "Clerk sync failed" });
  }
});

export default router;
