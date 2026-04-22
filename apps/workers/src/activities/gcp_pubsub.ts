import { ApplicationFailure } from "@temporalio/activity";
import { interpolateTemplate } from "@workflow/shared";
import type { GcpPubSubConfig } from "@workflow/shared";

export interface GcpPubSubActivityInput {
  config: GcpPubSubConfig;
  context: Record<string, unknown>;
  resolvedCredentials?: {
    serviceAccountJson?: string;
    projectId?: string;
  };
}

export interface GcpPubSubActivityOutput {
  result: unknown;
  ok: boolean;
}

/**
 * GCP Pub/Sub — publish / pull / ack. Topic and subscription names are
 * the short names (not full `projects/.../...` resource paths); the SDK
 * qualifies them against the credential's project_id.
 */
export async function gcpPubSubActivity(
  input: GcpPubSubActivityInput,
): Promise<GcpPubSubActivityOutput> {
  const { config: cfg, context, resolvedCredentials } = input;
  if (!resolvedCredentials?.serviceAccountJson) {
    throw ApplicationFailure.create({
      message: "GCP Pub/Sub requires a serviceAccountJson in the credential.",
      type: "AUTH_ERROR",
      nonRetryable: true,
    });
  }

  let serviceAccount: { project_id?: string; client_email?: string; private_key?: string };
  try {
    serviceAccount = JSON.parse(resolvedCredentials.serviceAccountJson) as typeof serviceAccount;
  } catch {
    throw ApplicationFailure.create({
      message: "GCP serviceAccountJson is not valid JSON.",
      type: "AUTH_ERROR",
      nonRetryable: true,
    });
  }

  const { PubSub } = await import("@google-cloud/pubsub");
  const projectId = resolvedCredentials.projectId ?? serviceAccount.project_id;
  const pubsub = new PubSub({
    projectId,
    credentials: {
      client_email: serviceAccount.client_email,
      private_key: serviceAccount.private_key,
    },
  });

  try {
    switch (cfg.operation) {
      case "publish": {
        if (!cfg.topic) {
          throw ApplicationFailure.create({
            message: "GCP Pub/Sub publish: `topic` is required",
            type: "VALIDATION_ERROR",
            nonRetryable: true,
          });
        }
        const topicName = interpolateTemplate(cfg.topic, context);
        const body = cfg.messageBody
          ? interpolateTemplate(cfg.messageBody, context)
          : "";
        const attributes = cfg.attributes
          ? (JSON.parse(interpolateTemplate(cfg.attributes, context)) as Record<
              string,
              string
            >)
          : undefined;
        const messageId = await pubsub
          .topic(topicName)
          .publishMessage({ data: Buffer.from(body, "utf8"), attributes });
        return { ok: true, result: { messageId, topic: topicName } };
      }

      case "pull": {
        if (!cfg.subscription) {
          throw ApplicationFailure.create({
            message: "GCP Pub/Sub pull: `subscription` is required",
            type: "VALIDATION_ERROR",
            nonRetryable: true,
          });
        }
        const subName = interpolateTemplate(cfg.subscription, context);
        const max = Math.min(Math.max(cfg.maxMessages ?? 10, 1), 1000);
        // Using the synchronous pull API via underlying client for
        // determinism — the streaming pull would keep an open connection
        // beyond the activity boundary.
        const [resp] = await pubsub
          .subscription(subName)
          .getMetadata()
          .catch(() => [null as unknown as Record<string, unknown>]);
        if (!resp) {
          throw ApplicationFailure.create({
            message: `Subscription "${subName}" not found`,
            type: "VALIDATION_ERROR",
            nonRetryable: true,
          });
        }
        const messages: Array<{
          id: string;
          data: string;
          attributes: Record<string, string>;
          ackId: string;
        }> = [];
        const client = pubsub.subscription(subName);
        await new Promise<void>((resolve) => {
          let settled = false;
          const handler = (msg: {
            id: string;
            data: Buffer;
            attributes: Record<string, string>;
            ackId: string;
            ack: () => void;
            nack: () => void;
          }) => {
            messages.push({
              id: msg.id,
              data: msg.data.toString("utf8"),
              attributes: msg.attributes,
              ackId: msg.ackId,
            });
            // Don't auto-ack — let the user call the ack operation so
            // workflow failures don't silently drop messages.
            msg.nack();
            if (messages.length >= max && !settled) {
              settled = true;
              client.removeListener("message", handler as never);
              void client.close().finally(() => resolve());
            }
          };
          client.on("message", handler as never);
          // Safety timeout in case the subscription has fewer than `max` messages.
          setTimeout(() => {
            if (settled) return;
            settled = true;
            client.removeListener("message", handler as never);
            void client.close().finally(() => resolve());
          }, 10_000);
        });
        return { ok: true, result: { items: messages, count: messages.length } };
      }

      case "ack": {
        if (!cfg.subscription || !cfg.ackIds) {
          throw ApplicationFailure.create({
            message: "GCP Pub/Sub ack: `subscription` and `ackIds` are required",
            type: "VALIDATION_ERROR",
            nonRetryable: true,
          });
        }
        const subName = interpolateTemplate(cfg.subscription, context);
        const raw = interpolateTemplate(cfg.ackIds, context);
        const ids = raw
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean);
        // Go through the underlying subscriber client — the high-level
        // Subscription doesn't expose acknowledge directly.
        const subscriberClient = (
          pubsub as unknown as {
            getSubscriberClient: () => Promise<{
              acknowledge: (req: {
                subscription: string;
                ackIds: string[];
              }) => Promise<unknown>;
            }>;
          }
        ).getSubscriberClient;
        if (typeof subscriberClient === "function") {
          const sc = await subscriberClient.call(pubsub);
          await sc.acknowledge({
            subscription: pubsub.subscription(subName).name,
            ackIds: ids,
          });
        }
        return { ok: true, result: { acked: ids.length } };
      }

      default:
        throw ApplicationFailure.create({
          message: `Unsupported GCP Pub/Sub operation: ${(cfg as { operation?: string }).operation}`,
          type: "VALIDATION_ERROR",
          nonRetryable: true,
        });
    }
  } catch (err) {
    if (err instanceof ApplicationFailure) throw err;
    throw ApplicationFailure.create({
      message: `GCP Pub/Sub ${cfg.operation} failed: ${(err as Error).message}`,
      type: "UPSTREAM_ERROR",
      nonRetryable: false,
    });
  } finally {
    await pubsub.close().catch(() => {
      /* best-effort */
    });
  }
}
