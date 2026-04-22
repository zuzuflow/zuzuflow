import crypto from "crypto";
import { prisma } from "../db/client";
import { config } from "../config";
import { logger } from "../logger";

// =============================================================================
// EmailVerificationService — one-shot email verification tokens.
//
// Flow:
//   1. User signs up → issueToken(userId, email) → raw token + verify URL
//   2. We email the URL; only sha256(token) is stored
//   3. User clicks → consumeToken(raw) → marks User.emailVerifiedAt + returns userId
//
// Tokens are single-use (`usedAt` is set on consumption) and expire after
// VERIFICATION_EXPIRY_HOURS. Resending issues a fresh token; the old one
// stays in the DB for auditability but is effectively dead once the newer
// token is consumed (we only accept matches against not-yet-used rows).
// =============================================================================

const VERIFICATION_EXPIRY_HOURS = 24;

function hashToken(raw: string): string {
  return crypto.createHash("sha256").update(raw).digest("hex");
}

function appUrl(): string {
  return config.APP_URL || config.CORS_ORIGINS[0] || "http://localhost:3000";
}

export class EmailVerificationService {
  /**
   * Create a new verification token for a user. Returns the raw token and the
   * full verify URL. The caller is expected to email the URL to the user.
   */
  async issueToken(
    userId: string,
    email: string,
  ): Promise<{ rawToken: string; verifyUrl: string; expiresAt: Date }> {
    const rawToken = crypto.randomBytes(32).toString("hex");
    const tokenHash = hashToken(rawToken);
    const expiresAt = new Date(
      Date.now() + VERIFICATION_EXPIRY_HOURS * 60 * 60 * 1000,
    );

    await prisma.emailVerificationToken.create({
      data: {
        userId,
        tokenHash,
        email: email.trim().toLowerCase(),
        expiresAt,
      },
    });

    const verifyUrl = `${appUrl()}/verify-email?token=${rawToken}`;
    return { rawToken, verifyUrl, expiresAt };
  }

  /**
   * Verify a token and mark the user's email as verified.
   *
   * Throws with code:
   *   - NOT_FOUND  → unknown token
   *   - EXPIRED    → token past expiresAt
   *   - ALREADY_USED → token has already been consumed
   */
  async consumeToken(rawToken: string): Promise<{ userId: string; email: string }> {
    const tokenHash = hashToken(rawToken);
    const row = await prisma.emailVerificationToken.findUnique({
      where: { tokenHash },
    });
    if (!row) {
      throw Object.assign(new Error("Verification link is invalid"), {
        code: "NOT_FOUND",
      });
    }
    if (row.usedAt) {
      throw Object.assign(new Error("Verification link has already been used"), {
        code: "ALREADY_USED",
      });
    }
    if (row.expiresAt.getTime() < Date.now()) {
      throw Object.assign(new Error("Verification link has expired"), {
        code: "EXPIRED",
      });
    }

    await prisma.$transaction([
      prisma.emailVerificationToken.update({
        where: { id: row.id },
        data: { usedAt: new Date() },
      }),
      prisma.user.update({
        where: { id: row.userId },
        data: { emailVerifiedAt: new Date() },
      }),
    ]);

    logger.info("Email verified", { userId: row.userId, email: row.email });
    return { userId: row.userId, email: row.email };
  }

  /**
   * Delete expired / used tokens older than 7 days. Safe to call from a cron.
   */
  async prune(): Promise<number> {
    const cutoff = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const result = await prisma.emailVerificationToken.deleteMany({
      where: {
        OR: [
          { expiresAt: { lt: cutoff } },
          { usedAt: { lt: cutoff } },
        ],
      },
    });
    return result.count;
  }
}

export const emailVerificationService = new EmailVerificationService();
