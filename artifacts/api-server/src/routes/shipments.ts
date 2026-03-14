import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { shipmentsTable, complianceScreeningsTable, riskScoresTable, insuranceQuotesTable } from "@workspace/db/schema";
import { eq } from "drizzle-orm";

const router: IRouter = Router();

router.get("/shipments", async (_req, res) => {
  const shipments = await db
    .select()
    .from(shipmentsTable)
    .orderBy(shipmentsTable.createdAt)
    .limit(50);
  res.json({ data: shipments });
});

router.get("/shipments/:id", async (req, res) => {
  const { id } = req.params;
  const [shipment] = await db
    .select()
    .from(shipmentsTable)
    .where(eq(shipmentsTable.id, id))
    .limit(1);

  if (!shipment) {
    res.status(404).json({ error: "Shipment not found" });
    return;
  }
  res.json({ data: shipment });
});

router.get("/shipments/:id/compliance", async (req, res) => {
  const { id } = req.params;
  const screenings = await db
    .select()
    .from(complianceScreeningsTable)
    .where(eq(complianceScreeningsTable.shipmentId, id));
  res.json({ data: screenings });
});

router.get("/shipments/:id/risk", async (req, res) => {
  const { id } = req.params;
  const [riskScore] = await db
    .select()
    .from(riskScoresTable)
    .where(eq(riskScoresTable.shipmentId, id))
    .limit(1);
  res.json({ data: riskScore ?? null });
});

router.get("/shipments/:id/insurance", async (req, res) => {
  const { id } = req.params;
  const [quote] = await db
    .select()
    .from(insuranceQuotesTable)
    .where(eq(insuranceQuotesTable.shipmentId, id))
    .limit(1);
  res.json({ data: quote ?? null });
});

export default router;
