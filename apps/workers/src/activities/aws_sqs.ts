import {
  SQSClient,
  SendMessageCommand,
  ReceiveMessageCommand,
  DeleteMessageCommand,
  PurgeQueueCommand,
} from "@aws-sdk/client-sqs";
import { ApplicationFailure } from "@temporalio/activity";
import { interpolateTemplate } from "@workflow/shared";
import type { AwsSqsConfig } from "@workflow/shared";
import { buildAwsClientConfig } from "./aws_common";

export interface AwsSqsActivityInput {
  config: AwsSqsConfig;
  context: Record<string, unknown>;
  resolvedCredentials?: { accessKeyId?: string; secretAccessKey?: string };
}

export async function awsSqsActivity(input: AwsSqsActivityInput) {
  const { config: cfg, context, resolvedCredentials } = input;
  const client = new SQSClient(buildAwsClientConfig(cfg, resolvedCredentials));
  const queueUrl = interpolateTemplate(cfg.queueUrl, context);

  try {
    let result: unknown;

    switch (cfg.operation) {
      case "sendMessage": {
        const body = cfg.messageBody ? interpolateTemplate(cfg.messageBody, context) : "";
        const resp = await client.send(new SendMessageCommand({
          QueueUrl: queueUrl,
          MessageBody: body,
          DelaySeconds: cfg.delaySeconds,
          MessageGroupId: cfg.messageGroupId ? interpolateTemplate(cfg.messageGroupId, context) : undefined,
        }));
        result = { messageId: resp.MessageId, sequenceNumber: resp.SequenceNumber };
        break;
      }
      case "receiveMessage": {
        const resp = await client.send(new ReceiveMessageCommand({
          QueueUrl: queueUrl,
          MaxNumberOfMessages: cfg.maxMessages ?? 1,
          WaitTimeSeconds: cfg.waitTimeSeconds ?? 0,
        }));
        result = { messages: resp.Messages ?? [] };
        break;
      }
      case "deleteMessage": {
        const receiptHandle = cfg.receiptHandle ? interpolateTemplate(cfg.receiptHandle, context) : "";
        await client.send(new DeleteMessageCommand({
          QueueUrl: queueUrl,
          ReceiptHandle: receiptHandle,
        }));
        result = { deleted: true };
        break;
      }
      case "purgeQueue": {
        await client.send(new PurgeQueueCommand({ QueueUrl: queueUrl }));
        result = { purged: true };
        break;
      }
      default:
        throw ApplicationFailure.create({
          message: `Unknown SQS operation: ${cfg.operation}`,
          type: "AWS_SQS_UNSUPPORTED_OP",
          nonRetryable: true,
        });
    }

    return { ok: true, result };
  } catch (err) {
    if (err instanceof ApplicationFailure) throw err;
    throw ApplicationFailure.create({
      message: `SQS ${cfg.operation} failed: ${(err as Error).message}`,
      type: "AWS_SQS_ERROR",
      nonRetryable: false,
    });
  }
}
