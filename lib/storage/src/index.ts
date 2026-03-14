import { promises as fs } from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

let s3Client: import("@aws-sdk/client-s3").S3Client | null = null;
let s3Loaded = false;

async function getS3(): Promise<import("@aws-sdk/client-s3").S3Client | null> {
  if (s3Loaded) return s3Client;
  s3Loaded = true;

  const bucket = process.env.S3_BUCKET_RAW_DOCUMENTS;
  if (!bucket || process.env.STORAGE_BACKEND === "local") return null;

  try {
    const { S3Client } = await import("@aws-sdk/client-s3");
    const opts: ConstructorParameters<typeof S3Client>[0] = {
      region: process.env.AWS_REGION || "us-east-1",
    };
    if (process.env.S3_ENDPOINT) {
      opts.endpoint = process.env.S3_ENDPOINT;
      opts.forcePathStyle = true;
    }
    s3Client = new S3Client(opts);
    return s3Client;
  } catch {
    console.warn("[storage] @aws-sdk/client-s3 not available, falling back to local filesystem");
    return null;
  }
}

function getBucket(prefix?: string): string {
  if (prefix === "generated" || prefix === "invoices" || prefix === "documents") {
    return process.env.S3_BUCKET_GENERATED_DOCUMENTS || "dynasties-generated-documents";
  }
  return process.env.S3_BUCKET_RAW_DOCUMENTS || "dynasties-raw-documents";
}

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

  const client = await getS3();
  if (client) {
    const { PutObjectCommand } = await import("@aws-sdk/client-s3");
    await client.send(
      new PutObjectCommand({
        Bucket: getBucket(prefix),
        Key: key,
        Body: buffer,
        ContentLength: buffer.length,
      }),
    );
    return { key, size: buffer.length };
  }

  const fullPath = resolveAndValidatePath(key);
  await ensureDir(path.dirname(fullPath));
  await fs.writeFile(fullPath, buffer);

  return { key, size: buffer.length };
}

export async function readFile(key: string, prefix?: string): Promise<Buffer> {
  const client = await getS3();
  if (client) {
    const { GetObjectCommand } = await import("@aws-sdk/client-s3");
    const resp = await client.send(
      new GetObjectCommand({
        Bucket: getBucket(prefix),
        Key: key,
      }),
    );
    const stream = resp.Body;
    if (!stream) throw new Error(`Empty response for key=${key}`);
    const chunks: Uint8Array[] = [];
    for await (const chunk of stream as AsyncIterable<Uint8Array>) {
      chunks.push(chunk);
    }
    return Buffer.concat(chunks);
  }

  const fullPath = resolveAndValidatePath(key);
  return fs.readFile(fullPath);
}

export async function fileExists(key: string, prefix?: string): Promise<boolean> {
  const client = await getS3();
  if (client) {
    try {
      const { HeadObjectCommand } = await import("@aws-sdk/client-s3");
      await client.send(
        new HeadObjectCommand({
          Bucket: getBucket(prefix),
          Key: key,
        }),
      );
      return true;
    } catch {
      return false;
    }
  }

  try {
    await fs.access(resolveAndValidatePath(key));
    return true;
  } catch {
    return false;
  }
}

export async function deleteFile(key: string, prefix?: string): Promise<void> {
  const client = await getS3();
  if (client) {
    const { DeleteObjectCommand } = await import("@aws-sdk/client-s3");
    await client.send(
      new DeleteObjectCommand({
        Bucket: getBucket(prefix),
        Key: key,
      }),
    );
    return;
  }

  const fullPath = resolveAndValidatePath(key);
  await fs.unlink(fullPath);
}
