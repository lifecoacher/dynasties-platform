import crypto from "node:crypto";

export function computeFingerprint(...parts: (string | number | undefined | null)[]): string {
  const normalized = parts
    .map((p) => (p == null ? "" : String(p).trim().toLowerCase()))
    .join("|");
  return crypto.createHash("sha256").update(normalized).digest("hex").slice(0, 40);
}
