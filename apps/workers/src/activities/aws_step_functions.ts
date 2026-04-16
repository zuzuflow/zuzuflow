import {
  SFNClient,
  StartExecutionCommand,
  DescribeExecutionCommand,
  StopExecutionCommand,
} from "@aws-sdk/client-sfn";
import { ApplicationFailure } from "@temporalio/activity";
import { interpolateTemplate } from "@workflow/shared";
import type { AwsStepFunctionsConfig } from "@workflow/shared";
import { buildAwsClientConfig } from "./aws_common";

export interface AwsStepFunctionsActivityInput {
  config: AwsStepFunctionsConfig;
  context: Record<string, unknown>;
  resolvedCredentials?: { accessKeyId?: string; secretAccessKey?: string };
}

export async function awsStepFunctionsActivity(input: AwsStepFunctionsActivityInput) {
  const { config: cfg, context, resolvedCredentials } = input;
  const client = new SFNClient(buildAwsClientConfig(cfg, resolvedCredentials));
  const stateMachineArn = interpolateTemplate(cfg.stateMachineArn, context);

  try {
    let result: unknown;

    switch (cfg.operation) {
      case "startExecution": {
        const resp = await client.send(new StartExecutionCommand({
          stateMachineArn,
          name: cfg.executionName ? interpolateTemplate(cfg.executionName, context) : undefined,
          input: cfg.input ? interpolateTemplate(cfg.input, context) : undefined,
        }));
        result = {
          executionArn: resp.executionArn,
          startDate: resp.startDate,
        };
        break;
      }
      case "describeExecution": {
        const executionArn = cfg.executionArn ? interpolateTemplate(cfg.executionArn, context) : "";
        const resp = await client.send(new DescribeExecutionCommand({ executionArn }));
        let parsedOutput: unknown = resp.output;
        try { parsedOutput = resp.output ? JSON.parse(resp.output) : null; } catch { /* keep raw */ }
        result = {
          executionArn: resp.executionArn,
          status: resp.status,
          input: resp.input,
          output: parsedOutput,
          startDate: resp.startDate,
          stopDate: resp.stopDate,
        };
        break;
      }
      case "stopExecution": {
        const executionArn = cfg.executionArn ? interpolateTemplate(cfg.executionArn, context) : "";
        const resp = await client.send(new StopExecutionCommand({
          executionArn,
          cause: cfg.cause ? interpolateTemplate(cfg.cause, context) : undefined,
        }));
        result = { stopDate: resp.stopDate };
        break;
      }
      default:
        throw ApplicationFailure.create({
          message: `Unknown Step Functions operation: ${cfg.operation}`,
          type: "AWS_SFN_UNSUPPORTED_OP",
          nonRetryable: true,
        });
    }

    return { ok: true, result };
  } catch (err) {
    if (err instanceof ApplicationFailure) throw err;
    throw ApplicationFailure.create({
      message: `Step Functions ${cfg.operation} failed: ${(err as Error).message}`,
      type: "AWS_STEP_FUNCTIONS_ERROR",
      nonRetryable: false,
    });
  }
}
