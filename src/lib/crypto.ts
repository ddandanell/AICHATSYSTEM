/**
 * AES-256-GCM for provider secrets. Do not auto-send.
 */
import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

const NONCE_LENGTH = 12;
const TAG_LENGTH = 16;

function masterKey(): Buffer {
  const raw = process.env.BYOK_ENCRYPTION_KEY;
  if (!raw) throw new Error("BYOK_ENCRYPTION_KEY is not set");
  const key = Buffer.from(raw, "base64");
  if (key.length !== 32) {
    throw new Error("BYOK_ENCRYPTION_KEY must be 32 bytes, base64-encoded");
  }
  return key;
}

export function encryptSecret(plaintext: string): Buffer {
  const nonce = randomBytes(NONCE_LENGTH);
  const cipher = createCipheriv("aes-256-gcm", masterKey(), nonce);
  const ciphertext = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([nonce, ciphertext, tag]);
}

export function decryptSecret(payload: Buffer): string {
  if (payload.length < NONCE_LENGTH + TAG_LENGTH + 1) {
    throw new Error("ciphertext is truncated");
  }
  const nonce = payload.subarray(0, NONCE_LENGTH);
  const tag = payload.subarray(payload.length - TAG_LENGTH);
  const ciphertext = payload.subarray(NONCE_LENGTH, payload.length - TAG_LENGTH);
  const decipher = createDecipheriv("aes-256-gcm", masterKey(), nonce);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString(
    "utf8",
  );
}

export function keyHint(secret: string): string {
  return secret.trim().slice(-4);
}

export function asBytea(value: unknown): Buffer {
  if (Buffer.isBuffer(value)) return value;
  if (value instanceof Uint8Array) return Buffer.from(value);
  if (typeof value === "string") {
    return Buffer.from(value.replace(/^\\x/, ""), "hex");
  }
  throw new Error("encrypted_key was not bytea");
}
