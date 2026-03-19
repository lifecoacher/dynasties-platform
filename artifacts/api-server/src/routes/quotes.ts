import { Router } from "express";
import { z } from "zod";
import { getCompanyId } from "../middlewares/tenant.js";
import { validateBody } from "../middlewares/validate.js";
import {
  createQuote,
  updateQuote,
  getQuote,
  listQuotes,
  addLineItem,
  updateLineItem,
  deleteLineItem,
  getLineItems,
  sendQuote,
  acceptQuote,
  rejectQuote,
  convertQuoteToShipment,
} from "../services/quote-service.js";

const router = Router();

const createQuoteSchema = z.object({
  customerId: z.string().optional(),
  origin: z.string().optional(),
  destination: z.string().optional(),
  portOfLoading: z.string().optional(),
  portOfDischarge: z.string().optional(),
  incoterms: z.string().optional(),
  cargoSummary: z.string().optional(),
  commodity: z.string().optional(),
  hsCode: z.string().optional(),
  quantity: z.number().int().positive().optional(),
  packageCount: z.number().int().positive().optional(),
  grossWeight: z.number().positive().optional(),
  weightUnit: z.enum(["KG", "LB"]).optional(),
  volume: z.number().positive().optional(),
  volumeUnit: z.enum(["CBM", "CFT"]).optional(),
  currency: z.string().optional(),
  validUntil: z.string().optional(),
  notes: z.string().optional(),
});

const updateQuoteSchema = createQuoteSchema.partial();

const lineItemSchema = z.object({
  chargeType: z.enum([
    "FREIGHT", "FUEL_SURCHARGE", "CUSTOMS", "DOCUMENTATION",
    "STORAGE", "INSURANCE", "HANDLING", "PORT_CHARGES", "INSPECTION", "OTHER",
  ]),
  description: z.string().min(1),
  quantity: z.number().positive().optional(),
  unitPrice: z.string(),
  amount: z.string(),
  currency: z.string().optional(),
  metadata: z.record(z.unknown()).optional(),
});

function p(req: any, name: string): string {
  return String(req.params[name]);
}

router.get("/quotes", async (req, res) => {
  try {
    const companyId = getCompanyId(req);
    const status = typeof req.query.status === "string" ? req.query.status : undefined;
    const limit = parseInt(String(req.query.limit)) || 50;
    const offset = parseInt(String(req.query.offset)) || 0;
    const result = await listQuotes(companyId, { status, limit, offset });
    res.json({ data: result.quotes, total: result.total });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.get("/quotes/:id", async (req, res): Promise<void> => {
  try {
    const companyId = getCompanyId(req);
    const quote = await getQuote(p(req, "id"), companyId);
    if (!quote) { res.status(404).json({ error: "Quote not found" }); return; }

    const lineItems = await getLineItems(quote.id);
    res.json({ data: { ...quote, lineItems } });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.post("/quotes", validateBody(createQuoteSchema), async (req, res) => {
  try {
    const companyId = getCompanyId(req);
    const userId = (req as any).user?.id;
    const quote = await createQuote({
      ...req.body,
      companyId,
      createdBy: userId,
    });
    res.status(201).json({ data: quote });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.put("/quotes/:id", validateBody(updateQuoteSchema), async (req, res): Promise<void> => {
  try {
    const companyId = getCompanyId(req);
    const quote = await updateQuote(p(req, "id"), companyId, req.body);
    if (!quote) { res.status(404).json({ error: "Quote not found" }); return; }
    res.json({ data: quote });
  } catch (err: any) {
    if (err.message.includes("DRAFT")) {
      res.status(400).json({ error: err.message }); return;
    }
    res.status(500).json({ error: err.message });
  }
});

router.post("/quotes/:id/line-items", validateBody(lineItemSchema), async (req, res): Promise<void> => {
  try {
    const companyId = getCompanyId(req);
    const item = await addLineItem(p(req, "id"), companyId, req.body);
    res.status(201).json({ data: item });
  } catch (err: any) {
    if (err.message.includes("not found") || err.message.includes("DRAFT")) {
      res.status(400).json({ error: err.message }); return;
    }
    res.status(500).json({ error: err.message });
  }
});

router.get("/quotes/:id/line-items", async (req, res): Promise<void> => {
  try {
    const companyId = getCompanyId(req);
    const quote = await getQuote(p(req, "id"), companyId);
    if (!quote) { res.status(404).json({ error: "Quote not found" }); return; }
    const items = await getLineItems(quote.id);
    res.json({ data: items });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.put("/quotes/:quoteId/line-items/:itemId", validateBody(lineItemSchema.partial()), async (req, res): Promise<void> => {
  try {
    const companyId = getCompanyId(req);
    const item = await updateLineItem(p(req, "itemId"), p(req, "quoteId"), companyId, req.body);
    if (!item) { res.status(404).json({ error: "Line item not found" }); return; }
    res.json({ data: item });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

router.delete("/quotes/:quoteId/line-items/:itemId", async (req, res) => {
  try {
    const companyId = getCompanyId(req);
    await deleteLineItem(p(req, "itemId"), p(req, "quoteId"), companyId);
    res.json({ data: { deleted: true } });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

router.post("/quotes/:id/send", async (req, res) => {
  try {
    const companyId = getCompanyId(req);
    const userId = (req as any).user?.id;
    const quote = await sendQuote(p(req, "id"), companyId, userId);
    res.json({ data: quote });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

router.post("/quotes/:id/accept", async (req, res) => {
  try {
    const companyId = getCompanyId(req);
    const userId = (req as any).user?.id;
    const quote = await acceptQuote(p(req, "id"), companyId, userId);
    res.json({ data: quote });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

router.post("/quotes/:id/reject", async (req, res) => {
  try {
    const companyId = getCompanyId(req);
    const userId = (req as any).user?.id;
    const quote = await rejectQuote(p(req, "id"), companyId, userId);
    res.json({ data: quote });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

router.post("/quotes/:id/convert", async (req, res) => {
  try {
    const companyId = getCompanyId(req);
    const userId = (req as any).user?.id;
    const result = await convertQuoteToShipment(p(req, "id"), companyId, userId);
    res.json({ data: result });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

export default router;
