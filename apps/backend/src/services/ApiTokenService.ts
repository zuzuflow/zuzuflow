import crypto from "crypto";
import { prisma } from "../db/client";
import { logger } from "../logger";

export interface ApiTokenPublic {
  id: string;
  name: string;
  userId: string;
  createdAt: string;
  lastUsedAt: string | null;
}

export interface ApiTokenCreated extends ApiTokenPublic {
  /** The raw token — shown ONCE, never stored plain. */
  token: string;
}

function hashToken(raw: string): string {
  return crypto.createHash("sha256").update(raw).digest("hex");
}

export class ApiTokenService {
  /**
   * Generate a new API token. Returns the raw token once — store it securely.
   * Only the SHA-256 hash is persisted.
   */
  async createToken(userId: string, name: string): Promise<ApiTokenCreated> {
    if (!name.trim()) throw Object.assign(new Error("name is required"), { code: "VALIDATION_ERROR" });

    // Ensure user exists
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw Object.assign(new Error("User not found"), { code: "NOT_FOUND" });

    // wf_ prefix makes them recognisable; crypto-random 32 bytes = 64 hex chars
    const raw = "wf_" + crypto.randomBytes(32).toString("hex");
    const tokenHash = hashToken(raw);

    const record = await prisma.apiToken.create({
      data: { name: name.trim(), tokenHash, userId },
    });

    logger.info("API token created", { tokenId: record.id, userId, name });

    return {
      id: record.id,
      name: record.name,
      userId: record.userId,
      createdAt: record.createdAt.toISOString(),
      lastUsedAt: null,
      token: raw,
    };
  }

  /** List all tokens for a user (raw token never returned). */
  async listTokens(userId: string): Promise<ApiTokenPublic[]> {
    const rows = await prisma.apiToken.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
    });
    return rows.map((r) => ({
      id: r.id,
      name: r.name,
      userId: r.userId,
      createdAt: r.createdAt.toISOString(),
      lastUsedAt: r.lastUsedAt?.toISOString() ?? null,
    }));
  }

  /** Revoke (delete) a token by id. */
  async revokeToken(id: string, userId: string): Promise<void> {
    const token = await prisma.apiToken.findUnique({ where: { id } });
    if (!token || token.userId !== userId) {
      throw Object.assign(new Error("Token not found"), { code: "NOT_FOUND" });
    }
    await prisma.apiToken.delete({ where: { id } });
    logger.info("API token revoked", { tokenId: id, userId });
  }

  /**
   * Verify a raw API token string. Updates lastUsedAt on success.
   * Returns true/false — used in auth middleware.
   */
  async verifyRawToken(raw: string): Promise<boolean> {
    const tokenHash = hashToken(raw);
    const record = await prisma.apiToken.findUnique({ where: { tokenHash } });
    if (!record) return false;

    // Update lastUsedAt without blocking the request (fire-and-forget)
    prisma.apiToken.update({ where: { id: record.id }, data: { lastUsedAt: new Date() } }).catch(() => {});
    return true;
  }
}

export const apiTokenService = new ApiTokenService();
