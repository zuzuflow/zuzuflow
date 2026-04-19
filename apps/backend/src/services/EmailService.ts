import nodemailer from "nodemailer";
import { config } from "../config";
import { logger } from "../logger";

// ---------------------------------------------------------------------------
// EmailService — wraps nodemailer. Falls back to console logging when SMTP
// is not configured (useful for development).
// ---------------------------------------------------------------------------

export class EmailService {
  private transporter: nodemailer.Transporter | null = null;

  constructor() {
    if (config.SMTP_HOST && config.SMTP_USER && config.SMTP_PASS) {
      this.transporter = nodemailer.createTransport({
        host: config.SMTP_HOST,
        port: config.SMTP_PORT,
        secure: config.SMTP_SECURE,
        auth: {
          user: config.SMTP_USER,
          pass: config.SMTP_PASS,
        },
      });
      logger.info("EmailService: SMTP transporter configured", {
        host: config.SMTP_HOST,
      });
    } else {
      logger.warn(
        "EmailService: No SMTP configuration found — emails will be logged to console only",
      );
    }
  }

  async sendMfaOtp(to: string, otp: string): Promise<void> {
    const from = config.SMTP_FROM || "noreply@zuzuflow.app";
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

    if (!this.transporter) {
      logger.info(`[EmailService DEV] MFA OTP for ${to}: ${otp}`);
      return;
    }

    try {
      await this.transporter.sendMail({ from, to, subject, html });
      logger.info("MFA OTP email sent", { to });
    } catch (err) {
      logger.error("Failed to send MFA OTP email", {
        to,
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
    const from = config.SMTP_FROM || "noreply@zuzuflow.app";
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

    if (!this.transporter) {
      logger.info(`[EmailService DEV] Invite for ${to} (${orgName} as ${role}): ${acceptUrl}`);
      return;
    }

    try {
      await this.transporter.sendMail({ from, to, subject, html, text });
      logger.info("Invite email sent", { to, orgName });
    } catch (err) {
      // Don't throw — invite row is already persisted, admin can copy URL
      logger.error("Failed to send invite email (invite still active)", {
        to,
        error: (err as Error).message,
      });
    }
  }
}

export const emailService = new EmailService();
