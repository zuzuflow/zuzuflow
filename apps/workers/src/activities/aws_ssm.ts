import {
  SSMClient,
  GetParameterCommand,
  PutParameterCommand,
  GetParametersByPathCommand,
  DeleteParameterCommand,
} from "@aws-sdk/client-ssm";
import { ApplicationFailure } from "@temporalio/activity";
import { interpolateTemplate } from "@workflow/shared";
import type { AwsSsmConfig } from "@workflow/shared";
import { buildAwsClientConfig } from "./aws_common";

export interface AwsSsmActivityInput {
  config: AwsSsmConfig;
  context: Record<string, unknown>;
  resolvedCredentials?: { accessKeyId?: string; secretAccessKey?: string };
}

export async function awsSsmActivity(input: AwsSsmActivityInput) {
  const { config: cfg, context, resolvedCredentials } = input;
  const client = new SSMClient(buildAwsClientConfig(cfg, resolvedCredentials));
  const name = interpolateTemplate(cfg.name, context);

  try {
    let result: unknown;

    switch (cfg.operation) {
      case "getParameter": {
        const resp = await client.send(new GetParameterCommand({
          Name: name,
          WithDecryption: cfg.withDecryption ?? true,
        }));
        result = {
          name: resp.Parameter?.Name,
          type: resp.Parameter?.Type,
          value: resp.Parameter?.Value,
          version: resp.Parameter?.Version,
          lastModifiedDate: resp.Parameter?.LastModifiedDate,
        };
        break;
      }
      case "putParameter": {
        const value = cfg.value ? interpolateTemplate(cfg.value, context) : "";
        const resp = await client.send(new PutParameterCommand({
          Name: name,
          Value: value,
          Type: cfg.type ?? "String",
          Overwrite: cfg.overwrite ?? true,
        }));
        result = { version: resp.Version, tier: resp.Tier };
        break;
      }
      case "getParametersByPath": {
        const path = cfg.path ? interpolateTemplate(cfg.path, context) : name;
        const resp = await client.send(new GetParametersByPathCommand({
          Path: path,
          WithDecryption: cfg.withDecryption ?? true,
          Recursive: true,
        }));
        result = {
          parameters: (resp.Parameters ?? []).map((p) => ({
            name: p.Name,
            type: p.Type,
            value: p.Value,
            version: p.Version,
          })),
        };
        break;
      }
      case "deleteParameter": {
        await client.send(new DeleteParameterCommand({ Name: name }));
        result = { deleted: true, name };
        break;
      }
      default:
        throw ApplicationFailure.create({
          message: `Unknown SSM operation: ${cfg.operation}`,
          type: "AWS_SSM_UNSUPPORTED_OP",
          nonRetryable: true,
        });
    }

    return { ok: true, result };
  } catch (err) {
    if (err instanceof ApplicationFailure) throw err;
    throw ApplicationFailure.create({
      message: `SSM ${cfg.operation} failed: ${(err as Error).message}`,
      type: "AWS_SSM_ERROR",
      nonRetryable: false,
    });
  }
}
