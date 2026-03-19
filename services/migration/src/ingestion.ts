import { parse } from "csv-parse/sync";
import * as XLSX from "xlsx";

export interface ParsedFile {
  fileName: string;
  headers: string[];
  rows: Record<string, any>[];
  rowCount: number;
  sampleRows: Record<string, any>[];
}

export function parseCSV(buffer: Buffer, fileName: string): ParsedFile {
  const content = buffer.toString("utf-8");

  const lines = content.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length === 0) {
    return { fileName, headers: [], rows: [], rowCount: 0, sampleRows: [] };
  }

  let headerRowIndex = 0;
  for (let i = 0; i < Math.min(lines.length, 5); i++) {
    const cols = lines[i].split(",").map((c) => c.trim());
    const nonEmpty = cols.filter((c) => c.length > 0 && !/^\d+(\.\d+)?$/.test(c));
    if (nonEmpty.length > cols.length * 0.5) {
      headerRowIndex = i;
      break;
    }
  }

  const dataContent = lines.slice(headerRowIndex).join("\n");

  const records: Record<string, any>[] = parse(dataContent, {
    columns: true,
    skip_empty_lines: true,
    trim: true,
    relax_column_count: true,
    cast: false,
  });

  const headers = records.length > 0 ? Object.keys(records[0]) : [];
  const cleaned = records.filter((r) => {
    const values = Object.values(r);
    return values.some((v) => v !== "" && v != null);
  });

  return {
    fileName,
    headers,
    rows: cleaned,
    rowCount: cleaned.length,
    sampleRows: cleaned.slice(0, 5),
  };
}

export function parseXLSX(buffer: Buffer, fileName: string): ParsedFile[] {
  const workbook = XLSX.read(buffer, { type: "buffer", cellDates: true });
  const results: ParsedFile[] = [];

  for (const sheetName of workbook.SheetNames) {
    const sheet = workbook.Sheets[sheetName];
    const jsonData = XLSX.utils.sheet_to_json<Record<string, any>>(sheet, {
      defval: "",
      raw: false,
    });

    if (jsonData.length === 0) continue;

    const headers = Object.keys(jsonData[0]);
    const cleaned = jsonData.filter((r) => {
      const values = Object.values(r);
      return values.some((v) => v !== "" && v != null);
    });

    const sheetFileName = workbook.SheetNames.length > 1
      ? `${fileName} [${sheetName}]`
      : fileName;

    results.push({
      fileName: sheetFileName,
      headers,
      rows: cleaned,
      rowCount: cleaned.length,
      sampleRows: cleaned.slice(0, 5),
    });
  }

  return results;
}

export function parseFile(buffer: Buffer, fileName: string, mimeType: string): ParsedFile[] {
  const ext = fileName.toLowerCase().split(".").pop();

  if (ext === "csv" || mimeType === "text/csv") {
    return [parseCSV(buffer, fileName)];
  }

  if (
    ext === "xlsx" || ext === "xls" ||
    mimeType === "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" ||
    mimeType === "application/vnd.ms-excel"
  ) {
    return parseXLSX(buffer, fileName);
  }

  throw new Error(`Unsupported file type: ${ext} (${mimeType})`);
}
