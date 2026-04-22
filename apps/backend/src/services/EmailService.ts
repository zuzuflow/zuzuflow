import nodemailer from "nodemailer";
import { config } from "../config";
import { logger } from "../logger";
import { settingService } from "./SettingService";

// ---------------------------------------------------------------------------
// EmailService — wraps nodemailer with DB-backed configuration.
//
// Config resolution order (first non-empty wins):
//   1. DB setting "platform.smtp" (written by admin UI)
//   2. Env SMTP_* vars (OSS self-host default)
//   3. No transport → falls back to console logging (dev)
//
// The DB-backed config is cached for CACHE_TTL_MS; admin writes become visible
// within that window without a restart.
// ---------------------------------------------------------------------------

const CACHE_TTL_MS = 30_000;

export interface SmtpConfig {
  host: string;
  port: number;
  secure: boolean;
  user: string;
  pass: string;
  from?: string;
}

interface CacheEntry {
  transporter: nodemailer.Transporter | null;
  from: string;
  source: "db" | "env" | "none";
  loadedAt: number;
}

function buildTransporterFromDb(cfg: SmtpConfig): nodemailer.Transporter {
  return nodemailer.createTransport({
    host: cfg.host,
    port: cfg.port,
    secure: cfg.secure,
    auth: { user: cfg.user, pass: cfg.pass },
  });
}

function buildTransporterFromEnv(): nodemailer.Transporter | null {
  if (!config.SMTP_HOST || !config.SMTP_USER || !config.SMTP_PASS) return null;
  return nodemailer.createTransport({
    host: config.SMTP_HOST,
    port: config.SMTP_PORT,
    secure: config.SMTP_SECURE,
    auth: { user: config.SMTP_USER, pass: config.SMTP_PASS },
  });
}

export class EmailService {
  private cache: CacheEntry | null = null;

  /** Force the cache to refresh on next send — call from admin webhook if you want sub-TTL propagation. */
  invalidate(): void {
    this.cache = null;
  }

  private async resolve(): Promise<CacheEntry> {
    if (this.cache && Date.now() - this.cache.loadedAt < CACHE_TTL_MS) {
      return this.cache;
    }

    // 1. Try DB first.
    let entry: CacheEntry;
    try {
      const dbCfg = (await settingService.get("platform.smtp")) as SmtpConfig | null;
      if (dbCfg && dbCfg.host && dbCfg.user && dbCfg.pass) {
        entry = {
          transporter: buildTransporterFromDb(dbCfg),
          from: dbCfg.from || config.SMTP_FROM || "noreply@zuzuflow.app",
          source: "db",
          loadedAt: Date.now(),
        };
        this.cache = entry;
        return entry;
      }
    } catch (err) {
      logger.warn("EmailService: failed to read platform.smtp from DB, falling back to env", {
        error: (err as Error).message,
      });
    }

    // 2. Env fallback.
    const envTransporter = buildTransporterFromEnv();
    if (envTransporter) {
      entry = {
        transporter: envTransporter,
        from: config.SMTP_FROM || "noreply@zuzuflow.app",
        source: "env",
        loadedAt: Date.now(),
      };
    } else {
      entry = {
        transporter: null,
        from: config.SMTP_FROM || "noreply@zuzuflow.app",
        source: "none",
        loadedAt: Date.now(),
      };
    }
    this.cache = entry;
    return entry;
  }

  /** Send a raw email. Returns {ok, source} for test endpoints. Throws only on delivery error. */
  async sendRaw(params: {
    to: string;
    subject: string;
    html: string;
    text?: string;
  }): Promise<{ ok: boolean; source: "db" | "env" | "none" }> {
    const entry = await this.resolve();
    if (!entry.transporter) {
      logger.info(`[EmailService DEV] would send "${params.subject}" to ${params.to}`);
      return { ok: false, source: "none" };
    }
    await entry.transporter.sendMail({ from: entry.from, ...params });
    return { ok: true, source: entry.source as "db" | "env" };
  }

  async sendMfaOtp(to: string, otp: string): Promise<void> {
    const entry = await this.resolve();
    const subject = "Your ZuzuFlow login verification code";
    const html = `
      <div style="font-family: sans-serif; max-width: 420px; margin: 0 auto;">
        <h2 style="color: #4f46e5;">ZuzuFlow — Verification Code</h2>
        <p>Use the code below to complete your login. This code expires in 10 minutes.</p>
        <div style="background: #f3f4f6; border-radius: 8px; padding: 20px; text-align: center; margin: 24px 0;">
          <span style="font-size: 36px; letter-spacing: 8px; font-weight: bold; color: #111827;">${otp}</span>
        </div>
        <p style="color: #6b7280; font-size: 13px;">
          If you did not attempt to log in, you can safely ignore this email.
        </p>
      </div>
    `;

    if (!entry.transporter) {
      logger.info(`[EmailService DEV] MFA OTP for ${to}: ${otp}`);
      return;
    }

    try {
      await entry.transporter.sendMail({ from: entry.from, to, subject, html });
      logger.info("MFA OTP email sent", { to, source: entry.source });
    } catch (err) {
      logger.error("Failed to send MFA OTP email", {
        to,
        source: entry.source,
        error: (err as Error).message,
      });
      throw Object.assign(
        new Error("Failed to send verification email. Please try again."),
        { code: "EMAIL_ERROR" },
      );
    }
  }

  /**
   * Send an invite email inviting {to} to join {orgName}. Does not throw on
   * delivery failure — invite creation should still succeed so the inviter can
   * copy the accept URL manually. Logs the URL to the console when SMTP isn't
   * configured (dev mode).
   */
  async sendOrgInvite(params: {
    to: string;
    orgName: string;
    inviterName: string;
    acceptUrl: string;
    role: string;
    isExistingUser: boolean;
  }): Promise<void> {
    const { to, orgName, inviterName, acceptUrl, role, isExistingUser } = params;
    const entry = await this.resolve();
    const subject = `You've been invited to join ${orgName} on ZuzuFlow`;
    const ctaLabel = isExistingUser ? "Accept invite" : "Sign up and join";
    const actionHint = isExistingUser
      ? "Sign in with this email address to accept the invite."
      : "You don't have a ZuzuFlow account yet — clicking the button creates one tied to your invite.";

    const html = `
      <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto; color: #111827;">
        <h2 style="color: #4f46e5;">ZuzuFlow — Organization Invite</h2>
        <p><strong>${inviterName}</strong> invited you to join <strong>${orgName}</strong> as a <strong>${role}</strong>.</p>
        <div style="margin: 28px 0; text-align: center;">
          <a href="${acceptUrl}"
             style="display: inline-block; padding: 12px 24px; background: #4f46e5; color: white;
                    text-decoration: none; border-radius: 8px; font-weight: 600;">
            ${ctaLabel}
          </a>
        </div>
        <p style="color: #6b7280; font-size: 13px;">${actionHint}</p>
        <p style="color: #6b7280; font-size: 13px; word-break: break-all;">
          Or open this link: <br/>
          <a href="${acceptUrl}">${acceptUrl}</a>
        </p>
        <p style="color: #9ca3af; font-size: 12px; margin-top: 32px;">
          This invite expires in 7 days. If you didn't expect this, you can ignore this email.
        </p>
      </div>
    `;
    const text =
      `${inviterName} invited you to join ${orgName} on ZuzuFlow as a ${role}.\n\n` +
      `Accept: ${acceptUrl}\n\n` +
      `This invite expires in 7 days. If you didn't expect this, ignore this email.`;

    if (!entry.transporter) {
      logger.info(`[EmailService DEV] Invite for ${to} (${orgName} as ${role}): ${acceptUrl}`);
      return;
    }

    try {
      await entry.transporter.sendMail({ from: entry.from, to, subject, html, text });
      logger.info("Invite email sent", { to, orgName, source: entry.source });
    } catch (err) {
      // Don't throw — invite row is already persisted, admin can copy URL
      logger.error("Failed to send invite email (invite still active)", {
        to,
        source: entry.source,
        error: (err as Error).message,
      });
    }
  }
}

export const emailService = new EmailService();
