import {
  DynamoDBClient,
  GetItemCommand,
  PutItemCommand,
  UpdateItemCommand,
  DeleteItemCommand,
  QueryCommand,
  ScanCommand,
} from "@aws-sdk/client-dynamodb";
import { marshall, unmarshall } from "@aws-sdk/util-dynamodb";
import { ApplicationFailure } from "@temporalio/activity";
import { interpolateTemplate } from "@workflow/shared";
import type { AwsDynamoDBConfig } from "@workflow/shared";
import { buildAwsClientConfig } from "./aws_common";

export interface AwsDynamoDBActivityInput {
  config: AwsDynamoDBConfig;
  context: Record<string, unknown>;
  resolvedCredentials?: { accessKeyId?: string; secretAccessKey?: string };
}

function parseAndMarshall(json: string, context: Record<string, unknown>) {
  const interpolated = interpolateTemplate(json, context);
  return marshall(JSON.parse(interpolated), { removeUndefinedValues: true });
}

function parseExprAttrValues(json: string, context: Record<string, unknown>) {
  const interpolated = interpolateTemplate(json, context);
  const raw = JSON.parse(interpolated) as Record<string, unknown>;
  return marshall(raw, { removeUndefinedValues: true });
}

function parseExprAttrNames(json: string, context: Record<string, unknown>): Record<string, string> {
  const interpolated = interpolateTemplate(json, context);
  return JSON.parse(interpolated);
}

export async function awsDynamoDBActivity(input: AwsDynamoDBActivityInput) {
  const { config: cfg, context, resolvedCredentials } = input;
  const client = new DynamoDBClient(buildAwsClientConfig(cfg, resolvedCredentials));
  const tableName = interpolateTemplate(cfg.tableName, context);

  try {
    let result: unknown;

    switch (cfg.operation) {
      case "getItem": {
        const resp = await client.send(new GetItemCommand({
          TableName: tableName,
          Key: cfg.key ? parseAndMarshall(cfg.key, context) : undefined,
        }));
        result = resp.Item ? unmarshall(resp.Item) : null;
        break;
      }
      case "putItem": {
        const resp = await client.send(new PutItemCommand({
          TableName: tableName,
          Item: cfg.item ? parseAndMarshall(cfg.item, context) : undefined,
          ConditionExpression: cfg.conditionExpression || undefined,
          ExpressionAttributeNames: cfg.expressionAttributeNames ? parseExprAttrNames(cfg.expressionAttributeNames, context) : undefined,
          ExpressionAttributeValues: cfg.expressionAttributeValues ? parseExprAttrValues(cfg.expressionAttributeValues, context) : undefined,
        }));
        result = { ok: true, consumedCapacity: resp.ConsumedCapacity };
        break;
      }
      case "updateItem": {
        const resp = await client.send(new UpdateItemCommand({
          TableName: tableName,
          Key: cfg.key ? parseAndMarshall(cfg.key, context) : undefined,
          UpdateExpression: cfg.updateExpression || undefined,
          ConditionExpression: cfg.conditionExpression || undefined,
          ExpressionAttributeNames: cfg.expressionAttributeNames ? parseExprAttrNames(cfg.expressionAttributeNames, context) : undefined,
          ExpressionAttributeValues: cfg.expressionAttributeValues ? parseExprAttrValues(cfg.expressionAttributeValues, context) : undefined,
          ReturnValues: "ALL_NEW",
        }));
        result = resp.Attributes ? unmarshall(resp.Attributes) : null;
        break;
      }
      case "deleteItem": {
        await client.send(new DeleteItemCommand({
          TableName: tableName,
          Key: cfg.key ? parseAndMarshall(cfg.key, context) : undefined,
          ConditionExpression: cfg.conditionExpression || undefined,
          ExpressionAttributeNames: cfg.expressionAttributeNames ? parseExprAttrNames(cfg.expressionAttributeNames, context) : undefined,
          ExpressionAttributeValues: cfg.expressionAttributeValues ? parseExprAttrValues(cfg.expressionAttributeValues, context) : undefined,
        }));
        result = { deleted: true };
        break;
      }
      case "query": {
        const resp = await client.send(new QueryCommand({
          TableName: tableName,
          IndexName: cfg.indexName || undefined,
          KeyConditionExpression: cfg.keyConditionExpression || undefined,
          FilterExpression: cfg.filterExpression || undefined,
          ExpressionAttributeNames: cfg.expressionAttributeNames ? parseExprAttrNames(cfg.expressionAttributeNames, context) : undefined,
          ExpressionAttributeValues: cfg.expressionAttributeValues ? parseExprAttrValues(cfg.expressionAttributeValues, context) : undefined,
          Limit: cfg.limit || undefined,
          ScanIndexForward: cfg.scanForward ?? true,
        }));
        result = {
          items: (resp.Items ?? []).map((item) => unmarshall(item)),
          count: resp.Count,
          scannedCount: resp.ScannedCount,
        };
        break;
      }
      case "scan": {
        const resp = await client.send(new ScanCommand({
          TableName: tableName,
          IndexName: cfg.indexName || undefined,
          FilterExpression: cfg.filterExpression || undefined,
          ExpressionAttributeNames: cfg.expressionAttributeNames ? parseExprAttrNames(cfg.expressionAttributeNames, context) : undefined,
          ExpressionAttributeValues: cfg.expressionAttributeValues ? parseExprAttrValues(cfg.expressionAttributeValues, context) : undefined,
          Limit: cfg.limit || undefined,
        }));
        result = {
          items: (resp.Items ?? []).map((item) => unmarshall(item)),
          count: resp.Count,
          scannedCount: resp.ScannedCount,
        };
        break;
      }
      default:
        throw ApplicationFailure.create({
          message: `Unknown DynamoDB operation: ${cfg.operation}`,
          type: "AWS_DYNAMODB_UNSUPPORTED_OP",
          nonRetryable: true,
        });
    }

    return { ok: true, result };
  } catch (err) {
    if (err instanceof ApplicationFailure) throw err;
    throw ApplicationFailure.create({
      message: `DynamoDB ${cfg.operation} failed: ${(err as Error).message}`,
      type: "AWS_DYNAMODB_ERROR",
      nonRetryable: false,
    });
  }
}
