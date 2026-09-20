import { createHash } from "crypto";
import { readFile } from "fs/promises";

/**
 * Computes a SHA-256 hex digest from a Buffer or file path.
 */
export async function computeSha256FromBuffer(buffer: Buffer): Promise<string> {
  return createHash("sha256").update(buffer).digest("hex");
}

export async function computeSha256FromPath(filePath: string): Promise<string> {
  const buffer = await readFile(filePath);
  return computeSha256FromBuffer(buffer);
}

/**
 * Detects MIME type from file extension.
 * Extend this map as needed.
 */
export function inferMimeType(fileName: string): string {
  const ext = fileName.split(".").pop()?.toLowerCase();
  const mimeMap: Record<string, string> = {
    pdf:  "application/pdf",
    html: "text/html",
    htm:  "text/html",
    txt:  "text/plain",
    xml:  "application/xml",
    json: "application/json",
    csv:  "text/csv",
    xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    zip:  "application/zip",
  };
  return ext ? (mimeMap[ext] ?? "application/octet-stream") : "application/octet-stream";
}
