import type { Request, Response, NextFunction } from "express";
import { z } from "zod";

export function validateBody<T extends z.ZodType>(schema: T) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      const errors = result.error.flatten();
      res.status(400).json({ error: "Validation failed", details: errors });
      return;
    }
    req.body = result.data;
    next();
  };
}
