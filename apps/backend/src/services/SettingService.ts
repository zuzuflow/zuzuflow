import crypto from "crypto";
import { prisma } from "../db/client";

// =============================================================================
// SettingService — encrypted key-value settings store
//
// Sensitive settings (git tokens) are AES-256-GCM encrypted before storage.
// =============================================================================

const ALGORITHM = "aes-256-gcm" as const;
// Keys whose values contain secrets — stored AES-256-GCM encrypted.
// Keep in sync with apps/zuzuflow-admin SettingService.
const SENSITIVE_KEYS = new Set(["git", "platform.smtp"]);

function getKey(): Buffer {
  const raw = process.env.ENCRYPTION_KEY ?? "dev-encryption-key-32-chars-long!";
  return crypto.createHash("sha256").update(raw).digest();
}

function encrypt(plain: string): string {
  const key = getKey();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  const enc = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  // format: iv(24 hex) + ":" + tag(32 hex) + ":" + data(hex)
  return iv.toString("hex") + ":" + tag.toString("hex") + ":" + Buffer.concat([enc, tag]).toString("hex");
}

function decrypt(stored: string): string {
  // Legacy plain-text check (no colons = not encrypted)
  if (!stored.includes(":")) return stored;
  const [ivHex, , combined] = stored.split(":");
  const key = getKey();
  const combinedBuf = Buffer.from(combined, "hex");
  const authTag = combinedBuf.subarray(combinedBuf.length - 16);
  const ciphertext = combinedBuf.subarray(0, combinedBuf.length - 16);
  const decipher = crypto.createDecipheriv(ALGORITHM, key, Buffer.from(ivHex, "hex"));
  decipher.setAuthTag(authTag);
  return decipher.update(ciphertext) + decipher.final("utf8");
}

export class SettingService {
  async get(key: string): Promise<unknown | null> {
    const row = await prisma.setting.findUnique({ where: { key } });
    if (!row) return null;
    const raw = SENSITIVE_KEYS.has(key) ? decrypt(row.value) : row.value;
    try { return JSON.parse(raw); } catch { return raw; }
  }

  async set(key: string, value: unknown): Promise<void> {
    const serialized = JSON.stringify(value);
    const stored = SENSITIVE_KEYS.has(key) ? encrypt(serialized) : serialized;
    await prisma.setting.upsert({
      where: { key },
      create: { key, value: stored },
      update: { value: stored },
    });
  }

  async getAll(): Promise<Record<string, unknown>> {
    const rows = await prisma.setting.findMany();
    const out: Record<string, unknown> = {};
    for (const row of rows) {
      const raw = SENSITIVE_KEYS.has(row.key) ? decrypt(row.value) : row.value;
      try { out[row.key] = JSON.parse(raw); } catch { out[row.key] = raw; }
    }
    return out;
  }
}

export const settingService = new SettingService();
