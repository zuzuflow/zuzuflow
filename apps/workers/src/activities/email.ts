import nodemailer from "nodemailer";
import axios from "axios";
import { ApplicationFailure } from "@temporalio/activity";
import { interpolateTemplate } from "@workflow/shared";
import type { SendEmailConfig } from "@workflow/shared";

// =============================================================================
// sendEmailActivity — SMTP via nodemailer or SendGrid via REST API
// =============================================================================

export interface EmailActivityInput {
  config: SendEmailConfig;
  /** nodeOutputs context for interpolation */
  context: Record<string, unknown>;
  /** Resolved credential values (decrypted by the caller before passing) */
  credentials?: {
    smtpHost?: string;
    smtpPort?: number;
    smtpSecure?: boolean;
    smtpUser?: string;
    smtpPass?: string;
    smtpFrom?: string;
    sendgridApiKey?: string;
  };
}

export interface EmailActivityOutput {
  success: boolean;
  messageId?: string;
  provider: string;
}

export async function sendEmailActivity(
  input: EmailActivityInput
): Promise<EmailActivityOutput> {
  const { config: cfg, context, credentials = {} } = input;

  // Interpolate all string fields
  const toRaw = cfg.to;
  const toAddresses = Array.isArray(toRaw)
    ? toRaw.map((t) => interpolateTemplate(t, context))
    : [interpolateTemplate(toRaw, context)];

  const subject = interpolateTemplate(cfg.subject, context);
  const body = cfg.body ? interpolateTemplate(cfg.body, context) : undefined;
  const htmlBody = cfg.htmlBody
    ? interpolateTemplate(cfg.htmlBody, context)
    : undefined;

  const cc = cfg.cc
    ? (Array.isArray(cfg.cc)
        ? cfg.cc.map((a) => interpolateTemplate(a, context))
        : [interpolateTemplate(cfg.cc, context)])
    : undefined;

  const bcc = cfg.bcc
    ? (Array.isArray(cfg.bcc)
        ? cfg.bcc.map((a) => interpolateTemplate(a, context))
        : [interpolateTemplate(cfg.bcc, context)])
    : undefined;

  if (cfg.provider === "sendgrid") {
    const apiKey =
      credentials.sendgridApiKey ?? process.env.SENDGRID_API_KEY;
    if (!apiKey) {
      throw ApplicationFailure.create({
        message: "SendGrid API key not configured",
        type: "EMAIL_CONFIGURATION_ERROR",
        nonRetryable: true,
      });
    }

    try {
      await axios.post(
        "https://api.sendgrid.com/v3/mail/send",
        {
          personalizations: [
            {
              to: toAddresses.map((email) => ({ email })),
              ...(cc ? { cc: cc.map((email) => ({ email })) } : {}),
              ...(bcc ? { bcc: bcc.map((email) => ({ email })) } : {}),
              subject,
            },
          ],
          from: { email: credentials.smtpFrom ?? process.env.SMTP_FROM ?? "no-reply@workflow.local" },
          content: htmlBody
            ? [
                { type: "text/html", value: htmlBody },
                ...(body ? [{ type: "text/plain", value: body }] : []),
              ]
            : [{ type: "text/plain", value: body ?? "" }],
        },
        {
          headers: {
            Authorization: `Bearer ${apiKey}`,
            "Content-Type": "application/json",
          },
        }
      );

      return { success: true, provider: "sendgrid" };
    } catch (err) {
      const status = (err as any)?.response?.status;
      throw ApplicationFailure.create({
        message: `SendGrid email failed: ${(err as Error).message}`,
        type: "EMAIL_SEND_ERROR",
        nonRetryable: status >= 400 && status < 500,
      });
    }
  }

  // SMTP via nodemailer
  const smtpHost = credentials.smtpHost ?? process.env.SMTP_HOST;
  if (!smtpHost) {
    throw ApplicationFailure.create({
      message: "SMTP host not configured",
      type: "EMAIL_CONFIGURATION_ERROR",
      nonRetryable: true,
    });
  }

  const transporter = nodemailer.createTransport({
    host: smtpHost,
    port: credentials.smtpPort ?? parseInt(process.env.SMTP_PORT ?? "587", 10),
    secure: credentials.smtpSecure ?? process.env.SMTP_SECURE === "true",
    auth:
      credentials.smtpUser || process.env.SMTP_USER
        ? {
            user: credentials.smtpUser ?? process.env.SMTP_USER,
            pass: credentials.smtpPass ?? process.env.SMTP_PASS,
          }
        : undefined,
  });

  try {
    const info = await transporter.sendMail({
      from: credentials.smtpFrom ?? process.env.SMTP_FROM ?? "no-reply@workflow.local",
      to: toAddresses.join(", "),
      cc: cc?.join(", "),
      bcc: bcc?.join(", "),
      subject,
      text: body,
      html: htmlBody,
    });

    return { success: true, messageId: info.messageId, provider: "smtp" };
  } catch (err) {
    throw ApplicationFailure.create({
      message: `SMTP send failed: ${(err as Error).message}`,
      type: "EMAIL_SEND_ERROR",
      nonRetryable: false,
    });
  }
}
