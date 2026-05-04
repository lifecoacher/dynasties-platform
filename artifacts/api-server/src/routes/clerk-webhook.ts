import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { usersTable, companiesTable, eventsTable } from "@workspace/db/schema";
import { eq } from "drizzle-orm";
import { generateId } from "@workspace/shared-utils";
import crypto from "node:crypto";

const router: IRouter = Router();

function verifyClerkWebhookSignature(
  payload: string,
  headers: Record<string, string | string[] | undefined>,
  secret: string,
): boolean {
  const svixId = headers["svix-id"] as string;
  const svixTimestamp = headers["svix-timestamp"] as string;
  const svixSignature = headers["svix-signature"] as string;

  if (!svixId || !svixTimestamp || !svixSignature) return false;

  const timestampSec = parseInt(svixTimestamp, 10);
  const now = Math.floor(Date.now() / 1000);
  if (Math.abs(now - timestampSec) > 300) return false;

  const signedContent = `${svixId}.${svixTimestamp}.${payload}`;
  const secretBytes = Buffer.from(secret.replace(/^whsec_/, ""), "base64");
  const computedSig = crypto
    .createHmac("sha256", secretBytes)
    .update(signedContent)
    .digest("base64");

  const signatures = svixSignature.split(" ");
  for (const sig of signatures) {
    const sigValue = sig.replace(/^v1,/, "");
    if (sigValue === computedSig) return true;
  }

  return false;
}

router.post("/auth/clerk-webhook", async (req, res) => {
  const isDemoMode = process.env.VITE_DEMO_MODE === "true";
  const webhookSecret = process.env.CLERK_WEBHOOK_SECRET;

  if (!webhookSecret && process.env.NODE_ENV === "production") {
    console.error("[clerk-webhook] CLERK_WEBHOOK_SECRET not set in production");
    res.status(500).json({ error: "Webhook not configured" });
    return;
  }

  const rawBody = typeof req.body === "string" ? req.body : JSON.stringify(req.body);

  if (webhookSecret) {
    const valid = verifyClerkWebhookSignature(rawBody, req.headers, webhookSecret);
    if (!valid) {
      console.warn("[clerk-webhook] Invalid signature");
      res.status(401).json({ error: "Invalid webhook signature" });
      return;
    }
  }

  const event = typeof req.body === "string" ? JSON.parse(req.body) : req.body;
  const { type, data } = event;

  console.log(`[clerk-webhook] Received event: ${type}`);

  try {
    switch (type) {
      case "user.created": {
        if (isDemoMode) {
          console.log("[clerk-webhook] Demo mode — skipping user.created (handled by demo bridge)");
          break;
        }

        const clerkId = data.id;
        const email = data.email_addresses?.[0]?.email_address;
        const name = [data.first_name, data.last_name].filter(Boolean).join(" ") || email;

        if (!email) break;

        const [existing] = await db
          .select()
          .from(usersTable)
          .where(eq(usersTable.clerkId, clerkId))
          .limit(1);

        if (existing) break;

        const companyId = generateId("cmp");
        const userId = generateId("usr");

        await db.transaction(async (tx) => {
          await tx.insert(companiesTable).values({
            id: companyId,
            name: `${name}'s Organization`,
            industry: "FREIGHT_FORWARDING",
            billingStatus: "TRIAL",
            planType: "STARTER",
          });

          await tx.insert(usersTable).values({
            id: userId,
            companyId,
            email,
            name,
            clerkId,
            role: "ADMIN",
            isActive: true,
          });

          await tx.insert(eventsTable).values({
            id: generateId("evt"),
            companyId,
            eventType: "USER_CREATED_VIA_WEBHOOK",
            entityType: "USER",
            entityId: userId,
            actorType: "SYSTEM",
            metadata: { clerkId, email, source: "clerk-webhook" },
          });
        });

        console.log(`[clerk-webhook] Created user ${userId} + company ${companyId} for ${email}`);
        break;
      }

      case "user.updated": {
        const clerkId = data.id;
        const email = data.email_addresses?.[0]?.email_address;
        const name = [data.first_name, data.last_name].filter(Boolean).join(" ");

        const [user] = await db
          .select()
          .from(usersTable)
          .where(eq(usersTable.clerkId, clerkId))
          .limit(1);

        if (!user) break;

        const updates: Record<string, unknown> = {};
        if (email && email !== user.email) updates.email = email;
        if (name && name !== user.name) updates.name = name;

        if (Object.keys(updates).length > 0) {
          await db
            .update(usersTable)
            .set(updates)
            .where(eq(usersTable.id, user.id));
          console.log(`[clerk-webhook] Updated user ${user.id}: ${Object.keys(updates).join(", ")}`);
        }
        break;
      }

      case "user.deleted": {
        const clerkId = data.id;

        const [user] = await db
          .select()
          .from(usersTable)
          .where(eq(usersTable.clerkId, clerkId))
          .limit(1);

        if (!user) break;

        await db
          .update(usersTable)
          .set({ isActive: false, clerkId: null })
          .where(eq(usersTable.id, user.id));

        console.log(`[clerk-webhook] Deactivated user ${user.id} (clerk_id: ${clerkId})`);
        break;
      }

      default:
        console.log(`[clerk-webhook] Unhandled event type: ${type}`);
    }

    res.status(200).json({ received: true });
  } catch (err: any) {
    console.error(`[clerk-webhook] Error processing ${type}:`, err.message);
    res.status(500).json({ error: "Webhook processing failed" });
  }
});

export default router;
