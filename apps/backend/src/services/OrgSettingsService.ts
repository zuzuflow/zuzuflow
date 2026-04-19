import crypto from "crypto";
import { prisma } from "../db/client";
import { logger } from "../logger";

// =============================================================================
// OrgSettingsService — Org-level AI builder configuration
// =============================================================================

const ALGORITHM = "aes-256-gcm" as const;

function getEncryptionKey(): Buffer {
  const raw = process.env.ENCRYPTION_KEY ?? "dev-encryption-key-32-chars-long!";
  return crypto.createHash("sha256").update(raw).digest();
}

function encrypt(plaintext: string): { encryptedData: string; iv: string } {
  const key = getEncryptionKey();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);
  const authTag = cipher.getAuthTag();
  const combined = Buffer.concat([encrypted, authTag]);
  return { encryptedData: combined.toString("hex"), iv: iv.toString("hex") };
}

function decrypt(encryptedData: string, iv: string): string {
  const key = getEncryptionKey();
  const combined = Buffer.from(encryptedData, "hex");
  const authTag = combined.subarray(combined.length - 16);
  const ciphertext = combined.subarray(0, combined.length - 16);
  const decipher = crypto.createDecipheriv(
    ALGORITHM,
    key,
    Buffer.from(iv, "hex"),
  );
  decipher.setAuthTag(authTag);
  return decipher.update(ciphertext) + decipher.final("utf8");
}

export interface AiSettingsPublic {
  aiBuilderEnabled: boolean;
  aiProvider: string | null;
  aiModel: string | null;
  hasApiKey: boolean;
}

export const orgSettingsService = {
  async getAiSettings(organizationId: string): Promise<AiSettingsPublic> {
    const row = await prisma.orgAiSettings.findUnique({
      where: { organizationId },
    });
    if (!row) {
      return {
        aiBuilderEnabled: false,
        aiProvider: null,
        aiModel: null,
        hasApiKey: false,
      };
    }
    return {
      aiBuilderEnabled: row.aiBuilderEnabled,
      aiProvider: row.aiProvider,
      aiModel: row.aiModel,
      hasApiKey: !!(row.aiApiKeyEncrypted && row.aiApiKeyIv),
    };
  },

  async updateAiSettings(
    organizationId: string,
    data: {
      aiBuilderEnabled?: boolean;
      aiProvider?: string | null;
      aiApiKey?: string | null;
      aiModel?: string | null;
    },
  ): Promise<AiSettingsPublic> {
    const updateData: Record<string, unknown> = {};

    if (data.aiBuilderEnabled !== undefined)
      updateData.aiBuilderEnabled = data.aiBuilderEnabled;
    if (data.aiProvider !== undefined) updateData.aiProvider = data.aiProvider;
    if (data.aiModel !== undefined) updateData.aiModel = data.aiModel;

    // Encrypt API key if provided; null clears it
    if (data.aiApiKey !== undefined) {
      if (data.aiApiKey) {
        const { encryptedData, iv } = encrypt(data.aiApiKey);
        updateData.aiApiKeyEncrypted = encryptedData;
        updateData.aiApiKeyIv = iv;
      } else {
        updateData.aiApiKeyEncrypted = null;
        updateData.aiApiKeyIv = null;
      }
    }

    const row = await prisma.orgAiSettings.upsert({
      where: { organizationId },
      create: { organizationId, ...updateData } as any,
      update: updateData,
    });

    logger.info("AI settings updated", { organizationId });

    return {
      aiBuilderEnabled: row.aiBuilderEnabled,
      aiProvider: row.aiProvider,
      aiModel: row.aiModel,
      hasApiKey: !!(row.aiApiKeyEncrypted && row.aiApiKeyIv),
    };
  },

  /** Returns the decrypted API key (used server-side only for LLM calls). */
  async getDecryptedApiKey(organizationId: string): Promise<string | null> {
    const row = await prisma.orgAiSettings.findUnique({
      where: { organizationId },
      select: { aiApiKeyEncrypted: true, aiApiKeyIv: true },
    });
    if (!row?.aiApiKeyEncrypted || !row?.aiApiKeyIv) return null;
    return decrypt(row.aiApiKeyEncrypted, row.aiApiKeyIv);
  },
};
