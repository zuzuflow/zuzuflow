import {
  SecretsManagerClient,
  GetSecretValueCommand,
  PutSecretValueCommand,
  CreateSecretCommand,
  DeleteSecretCommand,
} from "@aws-sdk/client-secrets-manager";
import { ApplicationFailure } from "@temporalio/activity";
import { interpolateTemplate } from "@workflow/shared";
import type { AwsSecretsManagerConfig } from "@workflow/shared";
import { buildAwsClientConfig } from "./aws_common";

export interface AwsSecretsManagerActivityInput {
  config: AwsSecretsManagerConfig;
  context: Record<string, unknown>;
  resolvedCredentials?: { accessKeyId?: string; secretAccessKey?: string };
}

export async function awsSecretsManagerActivity(input: AwsSecretsManagerActivityInput) {
  const { config: cfg, context, resolvedCredentials } = input;
  const client = new SecretsManagerClient(buildAwsClientConfig(cfg, resolvedCredentials));
  const secretId = interpolateTemplate(cfg.secretId, context);

  try {
    let result: unknown;

    switch (cfg.operation) {
      case "getSecretValue": {
        const resp = await client.send(new GetSecretValueCommand({ SecretId: secretId }));
        let parsedValue: unknown = resp.SecretString;
        try { parsedValue = resp.SecretString ? JSON.parse(resp.SecretString) : null; } catch { /* keep raw */ }
        result = {
          name: resp.Name,
          versionId: resp.VersionId,
          secretString: parsedValue,
          createdDate: resp.CreatedDate,
        };
        break;
      }
      case "putSecretValue": {
        const secretString = cfg.secretString ? interpolateTemplate(cfg.secretString, context) : "";
        const resp = await client.send(new PutSecretValueCommand({
          SecretId: secretId,
          SecretString: secretString,
        }));
        result = { name: resp.Name, versionId: resp.VersionId };
        break;
      }
      case "createSecret": {
        const secretString = cfg.secretString ? interpolateTemplate(cfg.secretString, context) : "";
        const resp = await client.send(new CreateSecretCommand({
          Name: secretId,
          SecretString: secretString,
          Description: cfg.description || undefined,
        }));
        result = { arn: resp.ARN, name: resp.Name, versionId: resp.VersionId };
        break;
      }
      case "deleteSecret": {
        const resp = await client.send(new DeleteSecretCommand({
          SecretId: secretId,
          ForceDeleteWithoutRecovery: false,
        }));
        result = { arn: resp.ARN, name: resp.Name, deletionDate: resp.DeletionDate };
        break;
      }
      default:
        throw ApplicationFailure.create({
          message: `Unknown Secrets Manager operation: ${cfg.operation}`,
          type: "AWS_SECRETS_UNSUPPORTED_OP",
          nonRetryable: true,
        });
    }

    return { ok: true, result };
  } catch (err) {
    if (err instanceof ApplicationFailure) throw err;
    throw ApplicationFailure.create({
      message: `Secrets Manager ${cfg.operation} failed: ${(err as Error).message}`,
      type: "AWS_SECRETS_MANAGER_ERROR",
      nonRetryable: false,
    });
  }
}
