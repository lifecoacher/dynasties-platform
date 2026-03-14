import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { ingestedDocumentsTable, ingestedEmailsTable } from "@workspace/db/schema";
import { eq } from "drizzle-orm";

const router: IRouter = Router();

router.get("/documents", async (_req, res) => {
  const documents = await db
    .select()
    .from(ingestedDocumentsTable)
    .orderBy(ingestedDocumentsTable.createdAt)
    .limit(50);
  res.json({ data: documents });
});

router.get("/documents/:id", async (req, res) => {
  const { id } = req.params;
  const [doc] = await db
    .select()
    .from(ingestedDocumentsTable)
    .where(eq(ingestedDocumentsTable.id, id))
    .limit(1);

  if (!doc) {
    res.status(404).json({ error: "Document not found" });
    return;
  }
  res.json({ data: doc });
});

router.get("/emails", async (_req, res) => {
  const emails = await db
    .select()
    .from(ingestedEmailsTable)
    .orderBy(ingestedEmailsTable.createdAt)
    .limit(50);
  res.json({ data: emails });
});

export default router;
