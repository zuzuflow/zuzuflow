import crypto from "crypto";
import { prisma } from "../db/client";
import { logger } from "../logger";
import { emailService } from "./EmailService";
import { config } from "../config";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const OTP_EXPIRY_MINUTES = 10;
const BACKUP_CODE_COUNT = 10;
const BACKUP_CODE_LENGTH = 10; // chars each

// ---------------------------------------------------------------------------
// TOTP (RFC 6238) — implemented with Node built-in crypto, no extra deps
// ---------------------------------------------------------------------------

const BASE32_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

function base32Encode(buf: Buffer): string {
  let bits = 0,
    value = 0,
    output = "";
  for (let i = 0; i < buf.length; i++) {
    value = (value << 8) | buf[i];
    bits += 8;
    while (bits >= 5) {
      output += BASE32_ALPHABET[(value >>> (bits - 5)) & 0x1f];
      bits -= 5;
    }
  }
  if (bits > 0) output += BASE32_ALPHABET[(value << (5 - bits)) & 0x1f];
  return output;
}

function base32Decode(str: string): Buffer {
  const s = str.toUpperCase().replace(/=+$/, "");
  let bits = 0,
    value = 0,
    index = 0;
  const output = Buffer.alloc(Math.ceil((s.length * 5) / 8));
  for (const char of s) {
    const idx = BASE32_ALPHABET.indexOf(char);
    if (idx === -1) continue;
    value = (value << 5) | idx;
    bits += 5;
    if (bits >= 8) {
      output[index++] = (value >>> (bits - 8)) & 0xff;
      bits -= 8;
    }
  }
  return output.slice(0, index);
}

function generateTotpSecret(bytes = 20): string {
  return base32Encode(crypto.randomBytes(bytes));
}

function hotpCode(keyBuf: Buffer, counter: number): string {
  const buf = Buffer.alloc(8);
  // Write counter as big-endian 64-bit (safe for JS integer range)
  buf.writeUInt32BE(Math.floor(counter / 0x100000000), 0);
  buf.writeUInt32BE(counter >>> 0, 4);
  const hmac = crypto.createHmac("sha1", keyBuf).update(buf).digest();
  const offset = hmac[hmac.length - 1] & 0x0f;
  const code =
    ((hmac[offset] & 0x7f) << 24) |
    (hmac[offset + 1] << 16) |
    (hmac[offset + 2] << 8) |
    hmac[offset + 3];
  return String(code % 1_000_000).padStart(6, "0");
}

function totpGenerate(secret: string): string {
  const key = base32Decode(secret);
  const counter = Math.floor(Date.now() / 1000 / 30);
  return hotpCode(key, counter);
}

function totpVerify(secret: string, token: string, window = 1): boolean {
  const key = base32Decode(secret);
  const counter = Math.floor(Date.now() / 1000 / 30);
  for (let i = -window; i <= window; i++) {
    if (hotpCode(key, counter + i) === token.trim()) return true;
  }
  return false;
}

function totpKeyUri(
  secret: string,
  accountName: string,
  issuer: string,
): string {
  const params = new URLSearchParams({
    secret,
    issuer,
    algorithm: "SHA1",
    digits: "6",
    period: "30",
  });
  return `otpauth://totp/${encodeURIComponent(issuer)}:${encodeURIComponent(accountName)}?${params}`;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function sha256(value: string): string {
  return crypto.createHash("sha256").update(value).digest("hex");
}

function generateNumericOtp(length = 6): string {
  // Cryptographically secure random digits
  const bytes = crypto.randomBytes(length);
  return Array.from(bytes)
    .map((b) => b % 10)
    .join("");
}

function generateBackupCode(): string {
  return crypto
    .randomBytes(Math.ceil(BACKUP_CODE_LENGTH / 2))
    .toString("hex")
    .slice(0, BACKUP_CODE_LENGTH)
    .toUpperCase();
}

function encryptSecret(secret: string): string {
  const key = Buffer.from(config.MFA_ENCRYPTION_KEY, "hex"); // 32 bytes
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv("aes-256-cbc", key, iv);
  const encrypted = Buffer.concat([
    cipher.update(secret, "utf8"),
    cipher.final(),
  ]);
  return iv.toString("hex") + ":" + encrypted.toString("hex");
}

function decryptSecret(encryptedSecret: string): string {
  const [ivHex, encHex] = encryptedSecret.split(":");
  const key = Buffer.from(config.MFA_ENCRYPTION_KEY, "hex");
  const iv = Buffer.from(ivHex, "hex");
  const enc = Buffer.from(encHex, "hex");
  const decipher = crypto.createDecipheriv("aes-256-cbc", key, iv);
  return Buffer.concat([decipher.update(enc), decipher.final()]).toString(
    "utf8",
  );
}

// ---------------------------------------------------------------------------
// MfaService
// ---------------------------------------------------------------------------

export class MfaService {
  isUserEnrolledByStatus(status: {
    totpEnabled: boolean;
    emailEnabled: boolean;
    backupCodesRemaining: number;
  }): boolean {
    return (
      status.totpEnabled ||
      status.emailEnabled ||
      status.backupCodesRemaining > 0
    );
  }

  async isUserEnrolled(userId: string): Promise<boolean> {
    const status = await this.getMfaStatus(userId);
    return this.isUserEnrolledByStatus(status);
  }

  // ── TOTP ────────────────────────────────────────────────────────────────

  /**
   * Generate a new TOTP secret and QR code URL for the user.
   * Does NOT enable TOTP yet — caller must confirm with a valid code first.
   */
  async generateTotpSetup(
    userId: string,
    username: string,
  ): Promise<{
    secret: string;
    otpauthUrl: string;
    qrCodeUrl: string;
  }> {
    const secret = generateTotpSecret(20);
    const issuer = config.MFA_ISSUER || "ZuzuFlow";
    const otpauthUrl = totpKeyUri(secret, username, issuer);

    // Store the *encrypted* pending secret temporarily (we abuse the mfaTotpSecret field before enabling)
    const encryptedSecret = encryptSecret(secret);
    await prisma.user.update({
      where: { id: userId },
      data: { mfaTotpSecret: encryptedSecret, mfaTotpEnabled: false },
    });

    // QR code via Google Charts (no external dependency)
    const qrCodeUrl = `https://chart.googleapis.com/chart?cht=qr&chs=200x200&chl=${encodeURIComponent(otpauthUrl)}`;

    return { secret, otpauthUrl, qrCodeUrl };
  }

  /**
   * Verify TOTP code and finalize TOTP setup (enable it).
   * Also generates and returns backup codes.
   */
  async enableTotp(
    userId: string,
    code: string,
  ): Promise<{ backupCodes: string[] }> {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user || !user.mfaTotpSecret) {
      throw Object.assign(new Error("TOTP setup not initiated"), {
        code: "VALIDATION_ERROR",
      });
    }

    const secret = decryptSecret(user.mfaTotpSecret);
    const isValid = totpVerify(secret, code);
    if (!isValid) {
      throw Object.assign(new Error("Invalid TOTP code"), {
        code: "VALIDATION_ERROR",
      });
    }

    const { backupCodes, hashedCodes } = this._generateBackupCodes();

    await prisma.user.update({
      where: { id: userId },
      data: { mfaTotpEnabled: true, mfaBackupCodes: hashedCodes },
    });

    logger.info("TOTP MFA enabled", { userId });
    return { backupCodes };
  }

  /**
   * Disable TOTP for a user. Requires a valid TOTP code or backup code to confirm.
   */
  async disableTotp(userId: string, code: string): Promise<void> {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user || !user.mfaTotpEnabled || !user.mfaTotpSecret) {
      throw Object.assign(new Error("TOTP is not enabled"), {
        code: "VALIDATION_ERROR",
      });
    }

    const secret = decryptSecret(user.mfaTotpSecret);
    const isTotpValid = totpVerify(secret, code);
    const isBackupValid =
      !isTotpValid && this._checkBackupCode(code, user.mfaBackupCodes);

    if (!isTotpValid && !isBackupValid) {
      throw Object.assign(new Error("Invalid code"), {
        code: "VALIDATION_ERROR",
      });
    }

    await prisma.user.update({
      where: { id: userId },
      data: { mfaTotpEnabled: false, mfaTotpSecret: null, mfaBackupCodes: [] },
    });

    logger.info("TOTP MFA disabled", { userId });
  }

  /**
   * Verify a TOTP code during login. Returns true if valid.
   */
  verifyTotpCode(encryptedSecret: string, code: string): boolean {
    const secret = decryptSecret(encryptedSecret);
    return totpVerify(secret, code);
  }

  // ── Email OTP ───────────────────────────────────────────────────────────

  /**
   * Enable email OTP for the user.
   */
  async enableEmailOtp(userId: string): Promise<void> {
    await prisma.user.update({
      where: { id: userId },
      data: { mfaEmailEnabled: true },
    });
    logger.info("Email OTP MFA enabled", { userId });
  }

  /**
   * Disable email OTP for the user.
   */
  async disableEmailOtp(userId: string): Promise<void> {
    await prisma.user.update({
      where: { id: userId },
      data: { mfaEmailEnabled: false },
    });
    logger.info("Email OTP MFA disabled", { userId });
  }

  /**
   * Send an email OTP for MFA login step.
   * Creates a short-lived challenge in the DB.
   * Returns the challengeId which the client must pass back with the code.
   */
  async sendEmailOtp(userId: string, email: string): Promise<string> {
    // Invalidate any existing unused challenges
    await prisma.mfaChallenge.updateMany({
      where: { userId, type: "email_otp", used: false },
      data: { used: true },
    });

    const otp = generateNumericOtp(6);
    const codeHash = sha256(otp);
    const expiresAt = new Date(Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000);

    const challenge = await prisma.mfaChallenge.create({
      data: { userId, type: "email_otp", codeHash, expiresAt },
    });

    // Send the email
    await emailService.sendMfaOtp(email, otp);

    logger.info("Email OTP sent", { userId, challengeId: challenge.id });
    return challenge.id;
  }

  /**
   * Verify an email OTP code against a challenge.
   */
  async verifyEmailOtp(challengeId: string, code: string): Promise<boolean> {
    const challenge = await prisma.mfaChallenge.findUnique({
      where: { id: challengeId },
    });

    if (!challenge || challenge.used || challenge.type !== "email_otp")
      return false;
    if (challenge.expiresAt < new Date()) return false;

    const hash = sha256(code.trim());
    if (
      !crypto.timingSafeEqual(
        Buffer.from(hash),
        Buffer.from(challenge.codeHash),
      )
    )
      return false;

    // Mark as used
    await prisma.mfaChallenge.update({
      where: { id: challengeId },
      data: { used: true },
    });
    return true;
  }

  // ── Login MFA challenge token ────────────────────────────────────────────

  /**
   * Create a short-lived "pending login" challenge token that allows the
   * frontend to submit the MFA code without yet receiving a full JWT.
   */
  async createLoginChallenge(userId: string): Promise<string> {
    // Invalidate any existing
    await prisma.mfaChallenge.updateMany({
      where: { userId, type: "login_pending", used: false },
      data: { used: true },
    });

    const rawToken = crypto.randomBytes(32).toString("hex");
    const codeHash = sha256(rawToken);
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes

    await prisma.mfaChallenge.create({
      data: { userId, type: "login_pending", codeHash, expiresAt },
    });

    return rawToken;
  }

  /**
   * Verify a login challenge token and return the userId if valid.
   */
  async verifyLoginChallenge(rawToken: string): Promise<string | null> {
    const hash = sha256(rawToken);
    const challenge = await prisma.mfaChallenge.findFirst({
      where: { codeHash: hash, type: "login_pending", used: false },
    });

    if (!challenge) return null;
    if (challenge.expiresAt < new Date()) return null;

    await prisma.mfaChallenge.update({
      where: { id: challenge.id },
      data: { used: true },
    });
    return challenge.userId;
  }

  // ── Backup codes ─────────────────────────────────────────────────────────

  /**
   * Check and consume a backup code. Returns true if valid.
   */
  async useBackupCode(userId: string, code: string): Promise<boolean> {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) return false;

    const normalizedCode = code.trim().toUpperCase();
    const hash = sha256(normalizedCode);
    const idx = user.mfaBackupCodes.indexOf(hash);
    if (idx === -1) return false;

    // Remove used code
    const updatedCodes = [...user.mfaBackupCodes];
    updatedCodes.splice(idx, 1);
    await prisma.user.update({
      where: { id: userId },
      data: { mfaBackupCodes: updatedCodes },
    });

    logger.info("Backup code used", { userId });
    return true;
  }

  /**
   * Regenerate backup codes. Requires a valid TOTP code.
   */
  async regenerateBackupCodes(
    userId: string,
    totpCode: string,
  ): Promise<{ backupCodes: string[] }> {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user || !user.mfaTotpEnabled || !user.mfaTotpSecret) {
      throw Object.assign(new Error("TOTP is not enabled"), {
        code: "VALIDATION_ERROR",
      });
    }

    const secret = decryptSecret(user.mfaTotpSecret);
    if (!totpVerify(secret, totpCode)) {
      throw Object.assign(new Error("Invalid TOTP code"), {
        code: "VALIDATION_ERROR",
      });
    }

    const { backupCodes, hashedCodes } = this._generateBackupCodes();
    await prisma.user.update({
      where: { id: userId },
      data: { mfaBackupCodes: hashedCodes },
    });

    return { backupCodes };
  }

  // ── Account recovery OTP ────────────────────────────────────────────────

  /**
   * Send a recovery OTP to the user's email.
   * Used when a user is locked out of MFA and wants to reset it.
   * Returns the challengeId the client must pass back with the code.
   */
  async sendRecoveryOtp(userId: string, email: string): Promise<string> {
    // Invalidate any existing unused recovery challenges
    await prisma.mfaChallenge.updateMany({
      where: { userId, type: "recovery_otp", used: false },
      data: { used: true },
    });

    const otp = generateNumericOtp(6);
    const codeHash = sha256(otp);
    const expiresAt = new Date(Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000);

    const challenge = await prisma.mfaChallenge.create({
      data: { userId, type: "recovery_otp", codeHash, expiresAt },
    });

    await emailService.sendMfaOtp(email, otp);

    logger.info("Recovery OTP sent", { userId, challengeId: challenge.id });
    return challenge.id;
  }

  /**
   * Verify a recovery OTP. Marks the challenge as used on success.
   * Returns userId on success, null on failure.
   */
  async verifyRecoveryOtp(
    challengeId: string,
    code: string,
  ): Promise<string | null> {
    const challenge = await prisma.mfaChallenge.findUnique({
      where: { id: challengeId },
    });

    if (!challenge || challenge.used || challenge.type !== "recovery_otp")
      return null;
    if (challenge.expiresAt < new Date()) return null;

    const hash = sha256(code.trim());
    if (
      !crypto.timingSafeEqual(
        Buffer.from(hash),
        Buffer.from(challenge.codeHash),
      )
    )
      return null;

    await prisma.mfaChallenge.update({
      where: { id: challengeId },
      data: { used: true },
    });
    return challenge.userId;
  }

  // ── MFA status ──────────────────────────────────────────────────────────

  async getMfaStatus(userId: string): Promise<{
    totpEnabled: boolean;
    emailEnabled: boolean;
    backupCodesRemaining: number;
  }> {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user)
      throw Object.assign(new Error("User not found"), { code: "NOT_FOUND" });
    return {
      totpEnabled: user.mfaTotpEnabled,
      emailEnabled: user.mfaEmailEnabled,
      backupCodesRemaining: user.mfaBackupCodes.length,
    };
  }

  // ── Private helpers ─────────────────────────────────────────────────────

  private _generateBackupCodes(): {
    backupCodes: string[];
    hashedCodes: string[];
  } {
    const backupCodes: string[] = [];
    const hashedCodes: string[] = [];
    for (let i = 0; i < BACKUP_CODE_COUNT; i++) {
      const code = generateBackupCode();
      backupCodes.push(code);
      hashedCodes.push(sha256(code));
    }
    return { backupCodes, hashedCodes };
  }

  private _checkBackupCode(code: string, hashedCodes: string[]): boolean {
    const hash = sha256(code.trim().toUpperCase());
    return hashedCodes.includes(hash);
  }
}

export const mfaService = new MfaService();
