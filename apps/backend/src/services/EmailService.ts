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
}

export const emailService = new EmailService();
