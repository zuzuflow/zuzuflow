import nodemailer from "nodemailer";
import { config } from "../config";
import { logger } from "../logger";
import { settingService } from "./SettingService";
import { renderEmail, escapeHtml } from "./email/template";

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
//
// All outbound messages share the branded template shell in `email/template.ts`.
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

  /** Force cache refresh on next send. */
  invalidate(): void {
    this.cache = null;
  }

  private async resolve(): Promise<CacheEntry> {
    if (this.cache && Date.now() - this.cache.loadedAt < CACHE_TTL_MS) {
      return this.cache;
    }

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

    const envTransporter = buildTransporterFromEnv();
    entry = envTransporter
      ? {
          transporter: envTransporter,
          from: config.SMTP_FROM || "noreply@zuzuflow.app",
          source: "env",
          loadedAt: Date.now(),
        }
      : {
          transporter: null,
          from: config.SMTP_FROM || "noreply@zuzuflow.app",
          source: "none",
          loadedAt: Date.now(),
        };
    this.cache = entry;
    return entry;
  }

  // ── Email verification ───────────────────────────────────────────────────

  async sendVerificationEmail(params: {
    to: string;
    verifyUrl: string;
    username: string;
    expiresInHours: number;
  }): Promise<void> {
    const entry = await this.resolve();
    const { to, verifyUrl, username, expiresInHours } = params;
    const { html, text } = renderEmail({
      preheader: `Confirm your email address to activate your ZuzuFlow account.`,
      title: "Confirm your email address",
      body: `
        <p style="margin: 0 0 14px 0;">Hi ${escapeHtml(username)},</p>
        <p style="margin: 0 0 14px 0;">Welcome to ZuzuFlow! To finish setting up your account, please confirm that this is your email address.</p>
        <p style="margin: 0;">Click the button below and you'll be signed in automatically.</p>
      `,
      cta: { label: "Verify email address", href: verifyUrl },
      footnote: `
        This link expires in ${expiresInHours} hours. If the button doesn't work, copy and paste this URL into your browser:<br/>
        <a href="${verifyUrl}" style="color: #4f46e5; word-break: break-all;">${escapeHtml(verifyUrl)}</a>
        <br/><br/>
        If you didn't create a ZuzuFlow account, you can safely ignore this email.
      `,
    });

    if (!entry.transporter) {
      logger.info(`[EmailService DEV] Verification for ${to}: ${verifyUrl}`);
      return;
    }

    try {
      await entry.transporter.sendMail({
        from: entry.from,
        to,
        subject: "Confirm your email address",
        html,
        text,
      });
      logger.info("Verification email sent", { to, source: entry.source });
    } catch (err) {
      logger.error("Failed to send verification email", {
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

  // ── MFA OTP ──────────────────────────────────────────────────────────────

  async sendMfaOtp(to: string, otp: string): Promise<void> {
    const entry = await this.resolve();
    const { html, text } = renderEmail({
      preheader: `Your ZuzuFlow verification code is ${otp}. Expires in 10 minutes.`,
      title: "Your verification code",
      body: `
        <p style="margin: 0 0 18px 0;">Use this one-time code to complete your sign in. It expires in <strong>10 minutes</strong>.</p>
        <div style="background: #eef2ff; border: 1px solid #c7d2fe; border-radius: 12px; padding: 20px; text-align: center; margin: 0;">
          <div style="font-family: 'SF Mono', Menlo, Consolas, monospace; font-size: 34px; letter-spacing: 12px; font-weight: 700; color: #1e1b4b;">
            ${escapeHtml(otp)}
          </div>
        </div>
      `,
      footnote: `If you didn't attempt to sign in, you can safely ignore this email — your account is secure.`,
    });

    if (!entry.transporter) {
      logger.info(`[EmailService DEV] MFA OTP for ${to}: ${otp}`);
      return;
    }

    try {
      await entry.transporter.sendMail({
        from: entry.from,
        to,
        subject: `${otp} is your ZuzuFlow verification code`,
        html,
        text,
      });
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

  // ── Org invite ───────────────────────────────────────────────────────────

  /**
   * Send an invite email inviting {to} to join {orgName}. Does not throw on
   * delivery failure — invite creation should still succeed so the inviter can
   * copy the accept URL manually.
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
    const ctaLabel = isExistingUser ? "Accept invite" : "Create account & join";
    const actionHint = isExistingUser
      ? "Sign in with this email address to accept the invite."
      : "You don't have a ZuzuFlow account yet — clicking the button creates one linked to your invite.";

    const { html, text } = renderEmail({
      preheader: `${inviterName} invited you to join ${orgName} on ZuzuFlow.`,
      title: `You're invited to ${escapeHtml(orgName)}`,
      body: `
        <p style="margin: 0 0 14px 0;"><strong>${escapeHtml(inviterName)}</strong> has invited you to join <strong>${escapeHtml(orgName)}</strong> on ZuzuFlow as a <strong>${escapeHtml(role)}</strong>.</p>
        <p style="margin: 0;">${escapeHtml(actionHint)}</p>
      `,
      cta: { label: ctaLabel, href: acceptUrl },
      footnote: `
        This invite expires in 7 days. If the button doesn't work, copy and paste this URL:<br/>
        <a href="${acceptUrl}" style="color: #4f46e5; word-break: break-all;">${escapeHtml(acceptUrl)}</a>
        <br/><br/>
        Didn't expect this invite? You can safely ignore this email.
      `,
    });

    if (!entry.transporter) {
      logger.info(`[EmailService DEV] Invite for ${to} (${orgName} as ${role}): ${acceptUrl}`);
      return;
    }

    try {
      await entry.transporter.sendMail({
        from: entry.from,
        to,
        subject: `${inviterName} invited you to join ${orgName} on ZuzuFlow`,
        html,
        text,
      });
      logger.info("Invite email sent", { to, orgName, source: entry.source });
    } catch (err) {
      // Don't throw — invite row is already persisted, admin can copy URL.
      logger.error("Failed to send invite email (invite still active)", {
        to,
        source: entry.source,
        error: (err as Error).message,
      });
    }
  }

  // ── Raw (used by admin test endpoint) ────────────────────────────────────

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
}

export const emailService = new EmailService();
