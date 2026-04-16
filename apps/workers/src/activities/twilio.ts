import twilio from "twilio";
import sgMail from "@sendgrid/mail";
import { ApplicationFailure } from "@temporalio/activity";
import { interpolateTemplate } from "@workflow/shared";
import type { TwilioSmsConfig, TwilioEmailConfig } from "@workflow/shared";

// =============================================================================
// twilioSmsActivity — sends an SMS via Twilio
// =============================================================================

export interface TwilioSmsActivityInput {
  config: TwilioSmsConfig;
  context: Record<string, unknown>;
  resolvedCredentials?: { accountSid?: string; authToken?: string };
}

export interface TwilioSmsActivityOutput {
  sid: string;
  status: string;
  to: string;
}

export async function twilioSmsActivity(
  input: TwilioSmsActivityInput
): Promise<TwilioSmsActivityOutput> {
  const { config: cfg, context, resolvedCredentials } = input;

  const accountSid = resolvedCredentials?.accountSid ?? cfg.accountSid ?? "";
  const authToken = resolvedCredentials?.authToken ?? cfg.authToken ?? "";

  if (!accountSid || !authToken) {
    throw ApplicationFailure.create({
      message: "Twilio SMS: accountSid and authToken are required",
      type: "TWILIO_CONFIG_ERROR",
      nonRetryable: true,
    });
  }

  const from = interpolateTemplate(cfg.from, context);
  const to = interpolateTemplate(cfg.to, context);
  const body = interpolateTemplate(cfg.body, context);

  try {
    const client = twilio(accountSid, authToken);
    const message = await client.messages.create({ from, to, body });
    return { sid: message.sid, status: message.status, to: message.to };
  } catch (err) {
    throw ApplicationFailure.create({
      message: `Twilio SMS failed: ${(err as Error).message}`,
      type: "TWILIO_SMS_ERROR",
      nonRetryable: false,
    });
  }
}

// =============================================================================
// twilioEmailActivity — sends email via SendGrid
// =============================================================================

export interface TwilioEmailActivityInput {
  config: TwilioEmailConfig;
  context: Record<string, unknown>;
  resolvedApiKey?: string;
}

export interface TwilioEmailActivityOutput {
  accepted: boolean;
  to: string;
  subject: string;
}

export async function twilioEmailActivity(
  input: TwilioEmailActivityInput
): Promise<TwilioEmailActivityOutput> {
  const { config: cfg, context, resolvedApiKey } = input;

  const apiKey = resolvedApiKey ?? cfg.apiKey ?? "";
  if (!apiKey) {
    throw ApplicationFailure.create({
      message: "Twilio Email (SendGrid): API key is required",
      type: "SENDGRID_CONFIG_ERROR",
      nonRetryable: true,
    });
  }

  sgMail.setApiKey(apiKey);

  const from = interpolateTemplate(cfg.from, context);
  const to = interpolateTemplate(cfg.to, context);
  const subject = interpolateTemplate(cfg.subject, context);
  const text = cfg.body ? interpolateTemplate(cfg.body, context) : undefined;
  const html = cfg.htmlBody ? interpolateTemplate(cfg.htmlBody, context) : undefined;

  try {
    await sgMail.send({
      from,
      to,
      subject,
      text: text ?? ' ',
      ...(html ? { html } : {}),
    });
    return { accepted: true, to, subject };
  } catch (err) {
    throw ApplicationFailure.create({
      message: `SendGrid email failed: ${(err as Error).message}`,
      type: "SENDGRID_EMAIL_ERROR",
      nonRetryable: false,
    });
  }
}
