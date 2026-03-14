import { promises as fs } from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

const DATA_DIR = path.resolve(process.cwd(), ".data", "uploads");

async function ensureDir(dir: string): Promise<void> {
  await fs.mkdir(dir, { recursive: true });
}

function sanitizeSegment(segment: string): string {
  return segment.replace(/[^a-zA-Z0-9_\-\.]/g, "_").slice(0, 100);
}

function resolveAndValidatePath(key: string): string {
  const segments = key.split("/").map(sanitizeSegment);
  const safePath = path.join(DATA_DIR, ...segments);
  const resolved = path.resolve(safePath);

  if (!resolved.startsWith(DATA_DIR)) {
    throw new Error("Path traversal detected: resolved path escapes storage root");
  }

  return resolved;
}

export interface StorageResult {
  key: string;
  size: number;
}

export async function storeFile(
  buffer: Buffer,
  fileName: string,
  prefix?: string,
): Promise<StorageResult> {
  const hash = crypto.createHash("sha256").update(buffer).digest("hex").slice(0, 12);
  const ext = path.extname(fileName);
  const baseName = path.basename(fileName, ext);
  const safeBase = baseName.replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 80);
  const key = prefix
    ? `${sanitizeSegment(prefix)}/${hash}_${safeBase}${ext}`
    : `${hash}_${safeBase}${ext}`;

  const fullPath = resolveAndValidatePath(key);
  await ensureDir(path.dirname(fullPath));
  await fs.writeFile(fullPath, buffer);

  return { key, size: buffer.length };
}

export async function readFile(key: string): Promise<Buffer> {
  const fullPath = resolveAndValidatePath(key);
  return fs.readFile(fullPath);
}

export async function fileExists(key: string): Promise<boolean> {
  try {
    await fs.access(resolveAndValidatePath(key));
    return true;
  } catch {
    return false;
  }
}

export async function deleteFile(key: string): Promise<void> {
  const fullPath = resolveAndValidatePath(key);
  await fs.unlink(fullPath);
}
