import pdf from "pdf-parse";

export interface TextExtractionResult {
  text: string;
  pageCount: number;
  truncated: boolean;
}

const MAX_TEXT_LENGTH = 30_000;

export async function extractTextFromPdf(buffer: Buffer): Promise<TextExtractionResult> {
  const data = await pdf(buffer);
  const text = data.text || "";
  const truncated = text.length > MAX_TEXT_LENGTH;

  return {
    text: truncated ? text.slice(0, MAX_TEXT_LENGTH) : text,
    pageCount: data.numpages || 0,
    truncated,
  };
}

export function extractTextFromPlaintext(buffer: Buffer): TextExtractionResult {
  const raw = buffer.toString("utf-8");
  const truncated = raw.length > MAX_TEXT_LENGTH;
  return {
    text: truncated ? raw.slice(0, MAX_TEXT_LENGTH) : raw,
    pageCount: 1,
    truncated,
  };
}

const SUPPORTED_MIME_TYPES = new Set([
  "application/pdf",
  "text/plain",
  "text/csv",
  "text/html",
  "text/xml",
  "application/json",
  "application/xml",
]);

export function isSupportedMimeType(mimeType: string): boolean {
  return SUPPORTED_MIME_TYPES.has(mimeType) || mimeType.startsWith("text/");
}

export async function extractText(
  buffer: Buffer,
  mimeType: string,
): Promise<TextExtractionResult> {
  if (mimeType === "application/pdf") {
    return extractTextFromPdf(buffer);
  }

  if (mimeType.startsWith("text/") || mimeType === "application/json" || mimeType === "application/xml") {
    return extractTextFromPlaintext(buffer);
  }

  return { text: "", pageCount: 0, truncated: false };
}
