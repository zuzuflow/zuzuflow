import { EventBridgeClient, PutEventsCommand } from "@aws-sdk/client-eventbridge";
import { ApplicationFailure } from "@temporalio/activity";
import { interpolateTemplate } from "@workflow/shared";
import type { AwsEventBridgeConfig } from "@workflow/shared";
import { buildAwsClientConfig } from "./aws_common";

export interface AwsEventBridgeActivityInput {
  config: AwsEventBridgeConfig;
  context: Record<string, unknown>;
  resolvedCredentials?: { accessKeyId?: string; secretAccessKey?: string };
}

export async function awsEventBridgeActivity(input: AwsEventBridgeActivityInput) {
  const { config: cfg, context, resolvedCredentials } = input;
  const client = new EventBridgeClient(buildAwsClientConfig(cfg, resolvedCredentials));

  try {
    const resp = await client.send(new PutEventsCommand({
      Entries: [{
        EventBusName: cfg.eventBusName ? interpolateTemplate(cfg.eventBusName, context) : undefined,
        Source: interpolateTemplate(cfg.source, context),
        DetailType: interpolateTemplate(cfg.detailType, context),
        Detail: interpolateTemplate(cfg.detail, context),
      }],
    }));

    return {
      ok: true,
      result: {
        failedEntryCount: resp.FailedEntryCount,
        entries: resp.Entries?.map((e) => ({
          eventId: e.EventId,
          errorCode: e.ErrorCode,
          errorMessage: e.ErrorMessage,
        })),
      },
    };
  } catch (err) {
    throw ApplicationFailure.create({
      message: `EventBridge putEvents failed: ${(err as Error).message}`,
      type: "AWS_EVENTBRIDGE_ERROR",
      nonRetryable: false,
    });
  }
}
