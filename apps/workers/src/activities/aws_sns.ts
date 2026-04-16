import { SNSClient, PublishCommand } from "@aws-sdk/client-sns";
import { ApplicationFailure } from "@temporalio/activity";
import { interpolateTemplate } from "@workflow/shared";
import type { AwsSnsConfig } from "@workflow/shared";
import { buildAwsClientConfig } from "./aws_common";

export interface AwsSnsActivityInput {
  config: AwsSnsConfig;
  context: Record<string, unknown>;
  resolvedCredentials?: { accessKeyId?: string; secretAccessKey?: string };
}

export async function awsSnsActivity(input: AwsSnsActivityInput) {
  const { config: cfg, context, resolvedCredentials } = input;
  const client = new SNSClient(buildAwsClientConfig(cfg, resolvedCredentials));
  const topicArn = interpolateTemplate(cfg.topicArn, context);
  const message = interpolateTemplate(cfg.message, context);

  try {
    const resp = await client.send(new PublishCommand({
      TopicArn: topicArn,
      Message: message,
      Subject: cfg.subject ? interpolateTemplate(cfg.subject, context) : undefined,
    }));

    return {
      ok: true,
      result: { messageId: resp.MessageId, sequenceNumber: resp.SequenceNumber },
    };
  } catch (err) {
    throw ApplicationFailure.create({
      message: `SNS publish failed: ${(err as Error).message}`,
      type: "AWS_SNS_ERROR",
      nonRetryable: false,
    });
  }
}
