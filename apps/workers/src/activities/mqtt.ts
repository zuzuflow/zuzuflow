import { log } from "@temporalio/activity";
import { ApplicationFailure } from "@temporalio/activity";
import { interpolateTemplate } from "@workflow/shared";
import type { MqttConfig } from "@workflow/shared";

// =============================================================================
// mqttPublishActivity — publishes a message to an MQTT broker (optional)
// The mqtt package is loaded dynamically; if not installed, the activity stubs.
// =============================================================================

export interface MqttPublishInput {
  config: MqttConfig;
  message: string;
  context: Record<string, unknown>;
  resolvedPassword?: string;
}

export interface MqttPublishOutput {
  published: boolean;
  topic: string;
  brokerUrl: string;
}

export async function mqttPublishActivity(
  input: MqttPublishInput
): Promise<MqttPublishOutput> {
  const { config: cfg, message, context, resolvedPassword } = input;

  const topic = interpolateTemplate(cfg.topic, context);
  const payload = interpolateTemplate(message, context);

  log.info("MQTT publish", { brokerUrl: cfg.brokerUrl, topic, qos: cfg.qos });

  // eslint-disable-next-line @typescript-eslint/no-require-imports
  let mqtt: any;
  try {
    mqtt = require("mqtt");
  } catch {
    log.warn("mqtt package not installed — running in stub mode");
    return { published: false, topic, brokerUrl: cfg.brokerUrl };
  }

  let client: any;
  try {
    const options = {
      clientId: cfg.clientId ?? `workflow-worker-${Date.now()}`,
      clean: true,
      connectTimeout: 10_000,
      username: cfg.username,
      password: resolvedPassword ?? undefined,
    };

    client = mqtt.connect(cfg.brokerUrl, options);

    await new Promise<void>((resolve, reject) => {
      client.on("connect", resolve);
      client.on("error", reject);
      setTimeout(() => reject(new Error("MQTT connect timeout")), 10_000);
    });

    await new Promise<void>((resolve, reject) => {
      client.publish(topic, payload, { qos: cfg.qos }, (err: Error | null) => {
        if (err) reject(err);
        else resolve();
      });
    });

    client.end();
  } catch (err) {
    client?.end?.();
    throw ApplicationFailure.create({
      message: `MQTT publish failed: ${(err as Error).message}`,
      type: "MQTT_PUBLISH_ERROR",
      nonRetryable: false,
    });
  }

  return { published: true, topic, brokerUrl: cfg.brokerUrl };
}
