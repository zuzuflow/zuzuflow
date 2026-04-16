import { ApplicationFailure } from "@temporalio/activity";
import { interpolateTemplate } from "@workflow/shared";
import type { SlackConfig } from "@workflow/shared";

// =============================================================================
// slackActivity — sends a Slack message via Incoming Webhook or Web API
// =============================================================================

export interface SlackActivityInput {
  config: SlackConfig;
  context: Record<string, unknown>;
  resolvedWebhookUrl?: string;
}

export interface SlackActivityOutput {
  ok: boolean;
  channel?: string;
}

export async function slackActivity(
  input: SlackActivityInput
): Promise<SlackActivityOutput> {
  const { config: cfg, context, resolvedWebhookUrl } = input;

  const webhookUrl = resolvedWebhookUrl ?? cfg.webhookUrl ?? "";
  if (!webhookUrl) {
    throw ApplicationFailure.create({
      message: "Slack: no webhook URL provided",
      type: "SLACK_CONFIG_ERROR",
      nonRetryable: true,
    });
  }

  const message = interpolateTemplate(cfg.message, context);
  const channel = cfg.channel ? interpolateTemplate(cfg.channel, context) : undefined;
  const username = cfg.username ? interpolateTemplate(cfg.username, context) : undefined;
  const iconEmoji = cfg.iconEmoji;

  const payload: Record<string, unknown> = { text: message };
  if (channel) payload.channel = channel;
  if (username) payload.username = username;
  if (iconEmoji) payload.icon_emoji = iconEmoji;

  const res = await fetch(webhookUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const body = await res.text();
    throw ApplicationFailure.create({
      message: `Slack webhook returned ${res.status}: ${body}`,
      type: "SLACK_WEBHOOK_ERROR",
      nonRetryable: res.status >= 400 && res.status < 500,
    });
  }

  return { ok: true, channel };
}
