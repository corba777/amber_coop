import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";

export function fileHash(path: string): string {
  const digest = createHash("sha256").update(readFileSync(path)).digest("hex");
  return digest.slice(0, 12);
}

export function contentHash(content: string | Buffer): string {
  const digest = createHash("sha256").update(content).digest("hex");
  return digest.slice(0, 12);
}
