/**
 * Detects Neon mychef_runtime versus local Docker. Do not auto-send.
 */
import { createHash } from "node:crypto";

export function usesMychefInbox(): boolean {
  const url = process.env.DATABASE_URL;
  if (!url) return false;
  try {
    return decodeURIComponent(new URL(url).username) === "mychef_runtime";
  } catch {
    return false;
  }
}

export function userIdFromEmail(email: string): string {
  const hash = createHash("sha256").update(email.trim().toLowerCase()).digest();
  const bytes = Buffer.from(hash.subarray(0, 16));
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = bytes.toString("hex");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}
