import { LambdaClient, InvokeCommand } from "@aws-sdk/client-lambda";
import { ApplicationFailure } from "@temporalio/activity";
import { interpolateTemplate } from "@workflow/shared";
import type { AwsLambdaConfig } from "@workflow/shared";
import { buildAwsClientConfig } from "./aws_common";

export interface AwsLambdaActivityInput {
  config: AwsLambdaConfig;
  context: Record<string, unknown>;
  resolvedCredentials?: { accessKeyId?: string; secretAccessKey?: string };
}

export async function awsLambdaActivity(input: AwsLambdaActivityInput) {
  const { config: cfg, context, resolvedCredentials } = input;
  const client = new LambdaClient(buildAwsClientConfig(cfg, resolvedCredentials));
  const functionName = interpolateTemplate(cfg.functionName, context);

  try {
    const payload = cfg.payload ? interpolateTemplate(cfg.payload, context) : undefined;

    const resp = await client.send(new InvokeCommand({
      FunctionName: functionName,
      InvocationType: cfg.operation === "invokeAsync" ? "Event" : (cfg.invocationType ?? "RequestResponse"),
      Payload: payload ? new TextEncoder().encode(payload) : undefined,
      Qualifier: cfg.qualifier || undefined,
    }));

    const responsePayload = resp.Payload ? new TextDecoder().decode(resp.Payload) : null;
    let parsed: unknown = responsePayload;
    try { parsed = responsePayload ? JSON.parse(responsePayload) : null; } catch { /* keep raw */ }

    return {
      ok: true,
      result: {
        statusCode: resp.StatusCode,
        functionError: resp.FunctionError,
        payload: parsed,
        executedVersion: resp.ExecutedVersion,
      },
    };
  } catch (err) {
    throw ApplicationFailure.create({
      message: `Lambda ${cfg.operation} failed: ${(err as Error).message}`,
      type: "AWS_LAMBDA_ERROR",
      nonRetryable: false,
    });
  }
}
