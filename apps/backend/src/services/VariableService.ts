import crypto from "crypto";
import { prisma } from "../db/client";
import { logger } from "../logger";

// =============================================================================
// VariableService — environment variable store
//
// Variables are referenced in node configs as {{$env.MY_KEY}}.
// Non-secret values are stored in plain text.
// Secret values are encrypted with AES-256-GCM (same key as credentials).
// =============================================================================

const ALGORITHM = "aes-256-gcm" as const;

function getEncryptionKey(): Buffer {
  const raw = process.env.ENCRYPTION_KEY ?? "dev-encryption-key-32-chars-long!";
  return crypto.createHash("sha256").update(raw).digest();
}

function encryptValue(plaintext: string): { value: string; iv: string } {
  const key = getEncryptionKey();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return {
    value: Buffer.concat([encrypted, authTag]).toString("hex"),
    iv: iv.toString("hex"),
  };
}

function decryptValue(encryptedHex: string, ivHex: string): string {
  const key = getEncryptionKey();
  const combined = Buffer.from(encryptedHex, "hex");
  const authTag = combined.subarray(combined.length - 16);
  const ciphertext = combined.subarray(0, combined.length - 16);
  const decipher = crypto.createDecipheriv(ALGORITHM, key, Buffer.from(ivHex, "hex"));
  decipher.setAuthTag(authTag);
  return decipher.update(ciphertext) + decipher.final("utf8");
}

// ─── Public types ─────────────────────────────────────────────────────────────

export interface VariableItem {
  id: string;
  key: string;
  /** Returned as "••••••" for secret variables in list/get */
  value: string;
  description: string | null;
  isSecret: boolean;
  createdAt: string;
  updatedAt: string;
}

// ─── Service ─────────────────────────────────────────────────────────────────

export class VariableService {
  // ---------------------------------------------------------------------------
  // List (secrets masked)
  // ---------------------------------------------------------------------------
  async listVariables(environmentId: string): Promise<VariableItem[]> {
    const rows = await prisma.variable.findMany({ where: { environmentId }, orderBy: { key: "asc" } });
    return rows.map((r) => ({
      id: r.id,
      key: r.key,
      value: r.isSecret ? "••••••" : r.value,
      description: r.description,
      isSecret: r.isSecret,
      createdAt: r.createdAt.toISOString(),
      updatedAt: r.updatedAt.toISOString(),
    }));
  }

  // ---------------------------------------------------------------------------
  // Create
  // ---------------------------------------------------------------------------
  async createVariable(input: {
    key: string;
    value: string;
    description?: string;
    isSecret?: boolean;
    environmentId: string;
  }): Promise<VariableItem> {
    const isSecret = input.isSecret ?? false;
    let storedValue = input.value;
    let iv: string | undefined;
    if (isSecret) {
      const enc = encryptValue(input.value);
      storedValue = enc.value;
      iv = enc.iv;
    }
    const row = await prisma.variable.create({
      data: {
        key: input.key,
        value: storedValue,
        description: input.description ?? null,
        isSecret,
        iv: iv ?? null,
        environmentId: input.environmentId,
      },
    });
    logger.info("Variable created", { key: row.key, isSecret });
    return { ...row, value: isSecret ? "••••••" : row.value, createdAt: row.createdAt.toISOString(), updatedAt: row.updatedAt.toISOString() };
  }

  // ---------------------------------------------------------------------------
  // Update
  // ---------------------------------------------------------------------------
  async updateVariable(
    id: string,
    input: { key?: string; value?: string; description?: string }
  ): Promise<VariableItem> {
    const existing = await prisma.variable.findUnique({ where: { id } });
    if (!existing) throw Object.assign(new Error(`Variable ${id} not found`), { code: "NOT_FOUND" });

    const data: Record<string, unknown> = {};
    if (input.key !== undefined) data.key = input.key;
    if (input.description !== undefined) data.description = input.description;
    if (input.value !== undefined) {
      if (existing.isSecret) {
        const enc = encryptValue(input.value);
        data.value = enc.value;
        data.iv = enc.iv;
      } else {
        data.value = input.value;
      }
    }

    const row = await prisma.variable.update({ where: { id }, data: data as any });
    logger.info("Variable updated", { key: row.key });
    return { ...row, value: row.isSecret ? "••••••" : row.value, createdAt: row.createdAt.toISOString(), updatedAt: row.updatedAt.toISOString() };
  }

  // ---------------------------------------------------------------------------
  // Delete
  // ---------------------------------------------------------------------------
  async deleteVariable(id: string): Promise<void> {
    const existing = await prisma.variable.findUnique({ where: { id } });
    if (!existing) throw Object.assign(new Error(`Variable ${id} not found`), { code: "NOT_FOUND" });
    await prisma.variable.delete({ where: { id } });
    logger.info("Variable deleted", { key: existing.key });
  }

  // ---------------------------------------------------------------------------
  // Resolve all — returns plain-text values for all variables (worker use only)
  // ---------------------------------------------------------------------------
  async resolveAllVariables(environmentId: string): Promise<Record<string, string>> {
    const rows = await prisma.variable.findMany({ where: { environmentId }, orderBy: { key: "asc" } });
    const result: Record<string, string> = {};
    for (const row of rows) {
      result[row.key] = row.isSecret && row.iv
        ? decryptValue(row.value, row.iv)
        : row.value;
    }
    return result;
  }
}

export const variableService = new VariableService();
