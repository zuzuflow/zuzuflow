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
  /**
   * Resolved credential values (decrypted by the caller before passing).
   *
   * Accepts BOTH the form's field keys (host/port/user/pass/from/secure) —
   * which is what the Credentials page UI writes — AND the legacy `smtp*`
   * prefixed keys, so existing deployments that stored data with either
   * convention keep working. The form keys take precedence when both are
   * present. Values come through as strings (from the encrypted JSON blob);
   * we coerce to number/boolean where needed.
   */
  credentials?: {
    // Preferred — matches the Credentials page form fields
    host?: string;
    port?: string | number;
    secure?: string | boolean;
    user?: string;
    pass?: string;
    from?: string;
    apiKey?: string; // SendGrid credential kind stores the API key here
    // Legacy / backward-compat
    smtpHost?: string;
    smtpPort?: string | number;
    smtpSecure?: string | boolean;
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
      credentials.apiKey ??
      credentials.sendgridApiKey ??
      process.env.SENDGRID_API_KEY;
    if (!apiKey) {
      throw ApplicationFailure.create({
        message:
          "SendGrid API key not configured — add a SendGrid credential in the Credentials page or set SENDGRID_API_KEY on the worker.",
        type: "EMAIL_CONFIGURATION_ERROR",
        nonRetryable: true,
      });
    }

    const fromAddr =
      credentials.from ??
      credentials.smtpFrom ??
      process.env.SMTP_FROM ??
      "no-reply@workflow.local";

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
          from: { email: fromAddr },
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
  //
  // Resolution order (per field): form-key → legacy smtp* key → env var.
  // Port + secure are coerced from string (encrypted blobs are JSON string
  // maps) to number / boolean.
  const smtpHost = credentials.host ?? credentials.smtpHost ?? process.env.SMTP_HOST;
  if (!smtpHost) {
    throw ApplicationFailure.create({
      message:
        "SMTP host not configured — add an SMTP credential in the Credentials page, or set SMTP_HOST/SMTP_PORT/SMTP_USER/SMTP_PASS/SMTP_FROM env vars on the worker.",
      type: "EMAIL_CONFIGURATION_ERROR",
      nonRetryable: true,
    });
  }

  const rawPort = credentials.port ?? credentials.smtpPort ?? process.env.SMTP_PORT;
  const smtpPort =
    typeof rawPort === "number"
      ? rawPort
      : rawPort
        ? parseInt(String(rawPort), 10) || 587
        : 587;

  const rawSecure =
    credentials.secure ?? credentials.smtpSecure ?? process.env.SMTP_SECURE;
  const smtpSecure =
    typeof rawSecure === "boolean"
      ? rawSecure
      : String(rawSecure ?? "").toLowerCase() === "true";

  const smtpUser = credentials.user ?? credentials.smtpUser ?? process.env.SMTP_USER;
  const smtpPass = credentials.pass ?? credentials.smtpPass ?? process.env.SMTP_PASS;
  const smtpFrom =
    credentials.from ?? credentials.smtpFrom ?? process.env.SMTP_FROM ?? "no-reply@workflow.local";

  const transporter = nodemailer.createTransport({
    host: smtpHost,
    port: smtpPort,
    secure: smtpSecure,
    auth: smtpUser ? { user: smtpUser, pass: smtpPass } : undefined,
  });

  try {
    const info = await transporter.sendMail({
      from: smtpFrom,
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
