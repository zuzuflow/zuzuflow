import crypto from "crypto";
import { prisma } from "../db/client";
import { logger } from "../logger";

// =============================================================================
// CredentialService — AES-256-GCM encrypted secret storage
//
// Credentials are JSON blobs (e.g. postgres connection strings, SMTP config,
// API keys) stored encrypted in the DB.  The encryption key is loaded from
// ENCRYPTION_KEY env var; in production use a 32-byte random secret.
// =============================================================================

const ALGORITHM = "aes-256-gcm" as const;

function getEncryptionKey(): Buffer {
  const raw = process.env.ENCRYPTION_KEY ?? "dev-encryption-key-32-chars-long!";
  // Derive a 32-byte key via SHA-256 so any string length works
  return crypto.createHash("sha256").update(raw).digest();
}

function encrypt(plaintext: string): { encryptedData: string; iv: string } {
  const key = getEncryptionKey();
  const iv = crypto.randomBytes(12); // 96-bit IV for GCM
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);
  const authTag = cipher.getAuthTag();
  // Store authTag appended to ciphertext (last 16 bytes)
  const combined = Buffer.concat([encrypted, authTag]);
  return {
    encryptedData: combined.toString("hex"),
    iv: iv.toString("hex"),
  };
}

function decrypt(encryptedData: string, iv: string): string {
  const key = getEncryptionKey();
  const combined = Buffer.from(encryptedData, "hex");
  const authTag = combined.subarray(combined.length - 16);
  const ciphertext = combined.subarray(0, combined.length - 16);
  const decipher = crypto.createDecipheriv(
    ALGORITHM,
    key,
    Buffer.from(iv, "hex")
  );
  decipher.setAuthTag(authTag);
  return decipher.update(ciphertext) + decipher.final("utf8");
}

// ─── Credential kind definitions ──────────────────────────────────────────────

export const CREDENTIAL_KINDS = [
  "postgres",
  "mysql",
  "mariadb",
  "mssql",
  "mongodb",
  "redis",
  "smtp",
  "sendgrid",
  "mqtt",
  "rabbitmq",
  "http_bearer",
  "http_basic",
  "http_api_key",
  "webhook_hmac",
  "webhook_basic",
  "webhook_jwt",
  "aws",
  "azure",
  "gcp",
  "oracle",
  "oci",
  "google_sheets",
  "firebase",
  "apns",
  "slack",
  "ssh",
  "twilio",
  "openai",
  "anthropic",
  "gemini",
  "huggingface",
  // SaaS Integrations (Phase 2)
  "stripe",
  "github",
  "discord",
  "notion",
  "salesforce",
  "jira",
  "ms_teams",
  "hubspot",
  "airtable",
  "pagerduty",
  "gitlab",
  "linear",
  "telegram",
  "sentry",
  "shopify",
  "mailchimp",
  "google_drive_oauth",
  "dropbox",
  "datadog",
  "paypal",
  "square",
  "resend",
  "onedrive",
  "box",
  "circleci",
  "whatsapp_business",
  "pipedrive",
  "customer_io",
  // Phase 3: Streaming + Analytics
  "kafka",
  "nats",
  "snowflake",
  "clickhouse",
  "elasticsearch",
  // Phase 4: AI ecosystem provider credentials
  "stability",
  "assemblyai",
  "elevenlabs",
  "cohere",
  "pinecone",
  "weaviate",
  "qdrant",
  "generic",
] as const;

export type CredentialKind = (typeof CREDENTIAL_KINDS)[number];

// ─── Public types ─────────────────────────────────────────────────────────────

export interface CredentialListItem {
  id: string;
  name: string;
  kind: string;
  createdAt: string;
  updatedAt: string;
}

export interface CredentialDetail extends CredentialListItem {
  /** Decrypted data — only returned by resolve endpoint, never by list/get */
  data?: Record<string, string>;
}

// ─── Service ─────────────────────────────────────────────────────────────────

export class CredentialService {
  // ---------------------------------------------------------------------------
  // List (no decryption)
  // ---------------------------------------------------------------------------
  async listCredentials(environmentId: string): Promise<CredentialListItem[]> {
    const rows = await prisma.storedCredential.findMany({
      where: { environmentId },
      orderBy: { updatedAt: "desc" },
      select: { id: true, name: true, kind: true, createdAt: true, updatedAt: true },
    });
    return rows.map((r) => ({
      ...r,
      createdAt: r.createdAt.toISOString(),
      updatedAt: r.updatedAt.toISOString(),
    }));
  }

  // ---------------------------------------------------------------------------
  // Create
  // ---------------------------------------------------------------------------
  async createCredential(input: {
    name: string;
    kind: string;
    data: Record<string, string>;
    environmentId: string;
  }): Promise<CredentialListItem> {
    const { encryptedData, iv } = encrypt(JSON.stringify(input.data));
    const cred = await prisma.storedCredential.create({
      data: { name: input.name, kind: input.kind, encryptedData, iv, environmentId: input.environmentId },
    });
    logger.info("Credential created", { id: cred.id, kind: cred.kind });
    return {
      id: cred.id,
      name: cred.name,
      kind: cred.kind,
      createdAt: cred.createdAt.toISOString(),
      updatedAt: cred.updatedAt.toISOString(),
    };
  }

  // ---------------------------------------------------------------------------
  // Update
  // ---------------------------------------------------------------------------
  async updateCredential(
    id: string,
    input: { name?: string; data?: Record<string, string> }
  ): Promise<CredentialListItem> {
    const existing = await prisma.storedCredential.findUnique({ where: { id } });
    if (!existing) {
      throw Object.assign(new Error(`Credential ${id} not found`), { code: "NOT_FOUND" });
    }
    const updateData: Record<string, unknown> = {};
    if (input.name) updateData.name = input.name;
    if (input.data) {
      const { encryptedData, iv } = encrypt(JSON.stringify(input.data));
      updateData.encryptedData = encryptedData;
      updateData.iv = iv;
    }
    const cred = await prisma.storedCredential.update({ where: { id }, data: updateData as any });
    logger.info("Credential updated", { id });
    return {
      id: cred.id,
      name: cred.name,
      kind: cred.kind,
      createdAt: cred.createdAt.toISOString(),
      updatedAt: cred.updatedAt.toISOString(),
    };
  }

  // ---------------------------------------------------------------------------
  // Delete
  // ---------------------------------------------------------------------------
  async deleteCredential(id: string): Promise<void> {
    const existing = await prisma.storedCredential.findUnique({ where: { id } });
    if (!existing) {
      throw Object.assign(new Error(`Credential ${id} not found`), { code: "NOT_FOUND" });
    }
    await prisma.storedCredential.delete({ where: { id } });
    logger.info("Credential deleted", { id });
  }

  // ---------------------------------------------------------------------------
  // Resolve — decrypt and return data (internal only, called by worker)
  // ---------------------------------------------------------------------------
  async resolveCredential(id: string): Promise<Record<string, string>> {
    const cred = await prisma.storedCredential.findUnique({ where: { id } });
    if (!cred) {
      throw Object.assign(new Error(`Credential ${id} not found`), { code: "NOT_FOUND" });
    }
    const data = JSON.parse(decrypt(cred.encryptedData, cred.iv)) as Record<string, string>;
    return data;
  }
}

export const credentialService = new CredentialService();
