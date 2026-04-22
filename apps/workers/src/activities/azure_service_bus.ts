import { ApplicationFailure } from "@temporalio/activity";
import { interpolateTemplate } from "@workflow/shared";
import type { AzureServiceBusConfig } from "@workflow/shared";

export interface AzureServiceBusActivityInput {
  config: AzureServiceBusConfig;
  context: Record<string, unknown>;
  resolvedCredentials?: { connectionString?: string };
}

export interface AzureServiceBusActivityOutput {
  result: unknown;
  ok: boolean;
}

/**
 * Azure Service Bus — queue and topic messaging. Requires a connection
 * string in the credential (Service Bus doesn't use the same shared-key
 * model as Storage). Lazy-loads @azure/service-bus so the ~8 MB SDK
 * doesn't sit in the worker heap for workflows that never touch it.
 */
export async function azureServiceBusActivity(
  input: AzureServiceBusActivityInput,
): Promise<AzureServiceBusActivityOutput> {
  const { config: cfg, context, resolvedCredentials } = input;
  const conn = resolvedCredentials?.connectionString;
  if (!conn) {
    throw ApplicationFailure.create({
      message:
        "Azure Service Bus requires a connection string in the credential.",
      type: "AUTH_ERROR",
      nonRetryable: true,
    });
  }

  const { ServiceBusClient } = await import("@azure/service-bus");
  const client = new ServiceBusClient(conn);
  const entity = interpolateTemplate(cfg.entityName, context);

  try {
    switch (cfg.operation) {
      case "sendMessage": {
        const sender = client.createSender(entity);
        try {
          const body = cfg.messageBody
            ? interpolateTemplate(cfg.messageBody, context)
            : "";
          await sender.sendMessages({
            body,
            contentType: cfg.contentType,
          });
          return { ok: true, result: { sent: true, entity } };
        } finally {
          await sender.close();
        }
      }

      case "receiveMessages":
      case "peekMessages": {
        const receiver = cfg.subscriptionName
          ? client.createReceiver(entity, cfg.subscriptionName)
          : client.createReceiver(entity);
        try {
          const max = Math.min(Math.max(cfg.maxMessages ?? 1, 1), 100);
          const msgs =
            cfg.operation === "peekMessages"
              ? await receiver.peekMessages(max)
              : await receiver.receiveMessages(max, {
                  maxWaitTimeInMs: (cfg.maxWaitTimeSeconds ?? 5) * 1000,
                });
          // For receiveMessages, auto-complete so the message isn't
          // redelivered on the next run. Workflows that want manual ack
          // should add a dedicated "ack" operation later.
          if (cfg.operation === "receiveMessages") {
            for (const m of msgs as Array<{ lockToken?: string }>) {
              try {
                await (
                  receiver as unknown as {
                    completeMessage: (msg: unknown) => Promise<void>;
                  }
                ).completeMessage(m);
              } catch {
                /* best-effort */
              }
            }
          }
          const items = (msgs as unknown as Array<Record<string, unknown>>).map((m) => ({
            messageId: m.messageId,
            body: m.body,
            contentType: m.contentType,
            enqueuedTimeUtc: (m.enqueuedTimeUtc as Date | undefined)?.toISOString(),
            sequenceNumber: m.sequenceNumber?.toString?.(),
          }));
          return { ok: true, result: { items, count: items.length } };
        } finally {
          await receiver.close();
        }
      }

      default:
        throw ApplicationFailure.create({
          message: `Unsupported Azure Service Bus operation: ${(cfg as { operation?: string }).operation}`,
          type: "VALIDATION_ERROR",
          nonRetryable: true,
        });
    }
  } catch (err) {
    if (err instanceof ApplicationFailure) throw err;
    throw ApplicationFailure.create({
      message: `Azure Service Bus ${cfg.operation} failed: ${(err as Error).message}`,
      type: "UPSTREAM_ERROR",
      nonRetryable: false,
    });
  } finally {
    await client.close();
  }
}
