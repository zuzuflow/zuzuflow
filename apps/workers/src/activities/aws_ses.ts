import {
  SESClient,
  SendEmailCommand,
  SendRawEmailCommand,
  SendTemplatedEmailCommand,
} from "@aws-sdk/client-ses";
import { ApplicationFailure } from "@temporalio/activity";
import { interpolateTemplate } from "@workflow/shared";
import type { AwsSesConfig } from "@workflow/shared";
import { buildAwsClientConfig } from "./aws_common";

export interface AwsSesActivityInput {
  config: AwsSesConfig;
  context: Record<string, unknown>;
  resolvedCredentials?: { accessKeyId?: string; secretAccessKey?: string };
}

function splitAddresses(value: string, context: Record<string, unknown>): string[] {
  return interpolateTemplate(value, context).split(",").map((s) => s.trim()).filter(Boolean);
}

export async function awsSesActivity(input: AwsSesActivityInput) {
  const { config: cfg, context, resolvedCredentials } = input;
  const client = new SESClient(buildAwsClientConfig(cfg, resolvedCredentials));

  try {
    let result: unknown;

    switch (cfg.operation) {
      case "sendEmail": {
        const resp = await client.send(new SendEmailCommand({
          Source: interpolateTemplate(cfg.from, context),
          Destination: {
            ToAddresses: splitAddresses(cfg.to, context),
            CcAddresses: cfg.cc ? splitAddresses(cfg.cc, context) : undefined,
            BccAddresses: cfg.bcc ? splitAddresses(cfg.bcc, context) : undefined,
          },
          Message: {
            Subject: { Data: cfg.subject ? interpolateTemplate(cfg.subject, context) : "" },
            Body: {
              ...(cfg.textBody && { Text: { Data: interpolateTemplate(cfg.textBody, context) } }),
              ...(cfg.htmlBody && { Html: { Data: interpolateTemplate(cfg.htmlBody, context) } }),
            },
          },
        }));
        result = { messageId: resp.MessageId };
        break;
      }
      case "sendTemplatedEmail": {
        const resp = await client.send(new SendTemplatedEmailCommand({
          Source: interpolateTemplate(cfg.from, context),
          Destination: {
            ToAddresses: splitAddresses(cfg.to, context),
            CcAddresses: cfg.cc ? splitAddresses(cfg.cc, context) : undefined,
            BccAddresses: cfg.bcc ? splitAddresses(cfg.bcc, context) : undefined,
          },
          Template: cfg.templateName || "",
          TemplateData: cfg.templateData ? interpolateTemplate(cfg.templateData, context) : "{}",
        }));
        result = { messageId: resp.MessageId };
        break;
      }
      case "sendRawEmail": {
        const rawData = cfg.rawMessage ? interpolateTemplate(cfg.rawMessage, context) : "";
        const resp = await client.send(new SendRawEmailCommand({
          RawMessage: { Data: new TextEncoder().encode(rawData) },
        }));
        result = { messageId: resp.MessageId };
        break;
      }
      default:
        throw ApplicationFailure.create({
          message: `Unknown SES operation: ${cfg.operation}`,
          type: "AWS_SES_UNSUPPORTED_OP",
          nonRetryable: true,
        });
    }

    return { ok: true, result };
  } catch (err) {
    if (err instanceof ApplicationFailure) throw err;
    throw ApplicationFailure.create({
      message: `SES ${cfg.operation} failed: ${(err as Error).message}`,
      type: "AWS_SES_ERROR",
      nonRetryable: false,
    });
  }
}
