/**
 * GraphInterpreter — Temporal Workflow
 *
 * DETERMINISM RULES (enforced by Temporal's workflow sandbox):
 *  - No direct imports of Node.js built-ins (fs, http, crypto, etc.)
 *  - No Math.random() or Date.now()  — use workflow.uuid4() / workflow.now()
 *  - All I/O via proxyActivities
 *  - Timers only via workflow.sleep()
 *
 * This file must NOT import any module that transitively imports a Node built-in
 * at module-load time. All activity modules are safe because they are only
 * referenced through proxyActivities (a string-keyed registry), not imported.
 */

import {
  proxyActivities,
  sleep,
  log,
  CancelledFailure,
  ActivityFailure,
  ApplicationFailure,
  defineSignal,
  setHandler,
  condition,
  executeChild,
  workflowInfo,
} from "@temporalio/workflow";

// Signal sent by the backend when an inbound HTTP request arrives at the
// registered webhook endpoint while this workflow is waiting.
export const webhookPayloadSignal =
  defineSignal<[Record<string, unknown>]>("webhookPayload");

// ---- Type-only imports are stripped at compile time — safe for the sandbox ----
import type {
  WorkflowTemplate,
  WorkflowNode,
  WorkflowEdge,
  NodeKind,
  IfElseConfig,
  SwitchConfig,
  DelayConfig,
  MergeConfig,
  HttpRequestConfig,
  SendEmailConfig,
  PostgresConfig,
  CustomCodeConfig,
  MqttConfig,
  RabbitMQConfig,
  WorkflowTriggerOutConfig,
  JsRunnerConfig,
  TsRunnerConfig,
  DataMapperConfig,
  JsonParserConfig,
  HtmlTemplateConfig,
  CryptoHashConfig,
  DateFormatterConfig,
  Base64Config,
  MysqlConfig,
  MongodbConfig,
  RedisConfig,
  S3BucketConfig,
  SlackConfig,
  SshTerminalConfig,
  TwilioSmsConfig,
  TwilioEmailConfig,
  LlmPromptConfig,
  AiAgentConfig,
  SubworkflowCallConfig,
  MariadbConfig,
  MssqlConfig,
  GoogleSheetsConfig,
  PythonRunnerConfig,
  FirebasePushConfig,
  ApnsPushConfig,
  LoopConfig,
  ResponseConfig,
  TriggerOutputConfig,
  AwsLambdaConfig,
  AwsSqsConfig,
  AwsSnsConfig,
  AwsDynamoDBConfig,
  AwsSesConfig,
  AwsSecretsManagerConfig,
  AwsSsmConfig,
  AwsEventBridgeConfig,
  AwsStepFunctionsConfig,
  WorkflowSettings,
} from "@workflow/shared";

// Type-only imports from activity modules (no runtime import)
import type { HttpActivityInput } from "../activities/http";
import type { EmailActivityInput } from "../activities/email";
import type { PostgresActivityInput } from "../activities/postgres";
import type { SandboxActivityInput } from "../activities/sandbox";
import type { MqttPublishInput } from "../activities/mqtt";
import type { RabbitMQActivityInput } from "../activities/rabbitmq";
import type {
  NodeLogInput,
  UpdateExecutionStatusInput,
} from "../activities/persistence";
import type { TriggerWorkflowActivityInput } from "../activities/workflow_trigger";
import type {
  JsRunnerActivityInput,
  JsRunnerActivityOutput,
} from "../activities/js_runner";
import type {
  TsRunnerActivityInput,
  TsRunnerActivityOutput,
} from "../activities/ts_runner";
import type {
  DataMapperActivityInput,
  JsonParserActivityInput,
  HtmlTemplateActivityInput,
  CryptoHashActivityInput,
  DateFormatterActivityInput,
  Base64ActivityInput,
} from "../activities/data_transform";
import type { MysqlActivityInput } from "../activities/mysql";
import type { MongodbActivityInput } from "../activities/mongodb";
import type { RedisActivityInput } from "../activities/redis";
import type { S3ActivityInput } from "../activities/s3";
import type { SlackActivityInput } from "../activities/slack";
import type { SshActivityInput } from "../activities/ssh";
import type {
  TwilioSmsActivityInput,
  TwilioEmailActivityInput,
} from "../activities/twilio";
import type { LlmPromptActivityInput } from "../activities/llm";
import type { AiAgentActivityInput } from "../activities/aiAgent";
import type { PrepareSubworkflowInput } from "../activities/subworkflow";
import type { MariadbActivityInput } from "../activities/mariadb";
import type { MssqlActivityInput } from "../activities/mssql";
import type { GoogleSheetsActivityInput } from "../activities/google_sheets";
import type {
  PythonRunnerActivityInput,
  PythonRunnerActivityOutput,
} from "../activities/python_runner";
import type { FirebasePushActivityInput } from "../activities/firebase_push";
import type { ApnsPushActivityInput } from "../activities/apns_push";
import type { AwsLambdaActivityInput } from "../activities/aws_lambda";
import type { AwsSqsActivityInput } from "../activities/aws_sqs";
import type { AwsSnsActivityInput } from "../activities/aws_sns";
import type { AwsDynamoDBActivityInput } from "../activities/aws_dynamodb";
import type { AwsSesActivityInput } from "../activities/aws_ses";
import type { AwsSecretsManagerActivityInput } from "../activities/aws_secrets_manager";
import type { AwsSsmActivityInput } from "../activities/aws_ssm";
import type { AwsEventBridgeActivityInput } from "../activities/aws_eventbridge";
import type { AwsStepFunctionsActivityInput } from "../activities/aws_step_functions";

// =============================================================================
// Activity type map — used by proxyActivities inside the workflow function
// =============================================================================

type ActivityMap = {
  httpRequestActivity(input: HttpActivityInput): Promise<unknown>;
  sendEmailActivity(input: EmailActivityInput): Promise<unknown>;
  postgresQueryActivity(input: PostgresActivityInput): Promise<unknown>;
  runCustomCodeActivity(input: SandboxActivityInput): Promise<unknown>;
  mqttPublishActivity(input: MqttPublishInput): Promise<unknown>;
  rabbitmqActivity(input: RabbitMQActivityInput): Promise<unknown>;
  writeNodeLogActivity(input: NodeLogInput): Promise<void>;
  updateExecutionStatusActivity(
    input: UpdateExecutionStatusInput,
  ): Promise<void>;
  createExecutionRecordActivity(input: {
    workflowId: string;
    triggerPayload: Record<string, unknown>;
    environmentId?: string;
  }): Promise<string>;
  resolveCredentialActivity(
    credentialId: string,
  ): Promise<Record<string, string>>;
  resolveVariablesActivity(
    environmentId?: string,
  ): Promise<Record<string, string>>;
  triggerWorkflowActivity(
    input: TriggerWorkflowActivityInput,
  ): Promise<unknown>;
  jsRunnerActivity(
    input: JsRunnerActivityInput,
  ): Promise<JsRunnerActivityOutput>;
  tsRunnerActivity(
    input: TsRunnerActivityInput,
  ): Promise<TsRunnerActivityOutput>;
  dataMappingActivity(input: DataMapperActivityInput): Promise<unknown>;
  jsonParserActivity(input: JsonParserActivityInput): Promise<unknown>;
  htmlTemplateActivity(input: HtmlTemplateActivityInput): Promise<unknown>;
  cryptoHashActivity(input: CryptoHashActivityInput): Promise<unknown>;
  dateFormatterActivity(input: DateFormatterActivityInput): Promise<unknown>;
  base64Activity(input: Base64ActivityInput): Promise<unknown>;
  mysqlActivity(input: MysqlActivityInput): Promise<unknown>;
  mongodbActivity(input: MongodbActivityInput): Promise<unknown>;
  redisActivity(input: RedisActivityInput): Promise<unknown>;
  s3Activity(input: S3ActivityInput): Promise<unknown>;
  slackActivity(input: SlackActivityInput): Promise<unknown>;
  sshActivity(input: SshActivityInput): Promise<unknown>;
  twilioSmsActivity(input: TwilioSmsActivityInput): Promise<unknown>;
  twilioEmailActivity(input: TwilioEmailActivityInput): Promise<unknown>;
  llmPromptActivity(input: LlmPromptActivityInput): Promise<unknown>;
  aiAgentActivity(input: AiAgentActivityInput): Promise<unknown>;
  prepareSubworkflowActivity(
    input: PrepareSubworkflowInput,
  ): Promise<{
    executionId: string;
    template: unknown;
    triggerPayload: Record<string, unknown>;
  }>;
  mariadbActivity(input: MariadbActivityInput): Promise<unknown>;
  mssqlActivity(input: MssqlActivityInput): Promise<unknown>;
  googleSheetsActivity(input: GoogleSheetsActivityInput): Promise<unknown>;
  pythonRunnerActivity(
    input: PythonRunnerActivityInput,
  ): Promise<PythonRunnerActivityOutput>;
  firebasePushActivity(input: FirebasePushActivityInput): Promise<unknown>;
  apnsPushActivity(input: ApnsPushActivityInput): Promise<unknown>;
  awsLambdaActivity(input: AwsLambdaActivityInput): Promise<unknown>;
  awsSqsActivity(input: AwsSqsActivityInput): Promise<unknown>;
  awsSnsActivity(input: AwsSnsActivityInput): Promise<unknown>;
  awsDynamoDBActivity(input: AwsDynamoDBActivityInput): Promise<unknown>;
  awsSesActivity(input: AwsSesActivityInput): Promise<unknown>;
  awsSecretsManagerActivity(
    input: AwsSecretsManagerActivityInput,
  ): Promise<unknown>;
  awsSsmActivity(input: AwsSsmActivityInput): Promise<unknown>;
  awsEventBridgeActivity(input: AwsEventBridgeActivityInput): Promise<unknown>;
  awsStepFunctionsActivity(
    input: AwsStepFunctionsActivityInput,
  ): Promise<unknown>;
};

// =============================================================================
// Workflow input
// =============================================================================

export interface GraphInterpreterInput {
  executionId: string;
  workflowId: string;
  /** The full WorkflowTemplate JSON */
  template: WorkflowTemplate;
  /** Payload from the trigger (webhook body, cron context, etc.) */
  triggerPayload: Record<string, unknown>;
  /** Environment ID for scoping credential/variable resolution */
  environmentId?: string;
}

// =============================================================================
// Internal helpers (deterministic — no I/O)
// =============================================================================

/**
 * Build an adjacency list: sourceNodeId → list of outgoing edges.
 */
function buildAdjacency(edges: WorkflowEdge[]): Map<string, WorkflowEdge[]> {
  const adj = new Map<string, WorkflowEdge[]>();
  for (const edge of edges) {
    if (!adj.has(edge.source)) adj.set(edge.source, []);
    adj.get(edge.source)!.push(edge);
  }
  return adj;
}

/**
 * Build reverse adjacency: targetNodeId → list of incoming edges.
 */
function buildReverseAdjacency(
  edges: WorkflowEdge[],
): Map<string, WorkflowEdge[]> {
  const radj = new Map<string, WorkflowEdge[]>();
  for (const edge of edges) {
    if (!radj.has(edge.target)) radj.set(edge.target, []);
    radj.get(edge.target)!.push(edge);
  }
  return radj;
}

/**
 * Find root nodes — nodes with no incoming edges.
 */
function findRoots(
  nodes: WorkflowNode[],
  radj: Map<string, WorkflowEdge[]>,
): WorkflowNode[] {
  return nodes.filter((n) => !radj.has(n.id) || radj.get(n.id)!.length === 0);
}

/**
 * Simple dot-path resolver (deterministic, no I/O).
 * Resolves "a.b.c" against a nested object.
 */
function getPath(obj: unknown, path: string): unknown {
  const parts = path.split(".");
  let cur: unknown = obj;
  for (const part of parts) {
    if (cur === null || cur === undefined) return undefined;
    if (typeof cur !== "object") return undefined;
    cur = (cur as Record<string, unknown>)[part];
  }
  return cur;
}

/**
 * Interpolate {{nodeId.field}} tokens in a string against nodeOutputs.
 * Deterministic — no I/O.
 */
function interpolate(
  template: string,
  context: Record<string, unknown>,
): string {
  return template.replace(/\{\{([^}]+)\}\}/g, (_m, rawPath: string) => {
    const trimmed = rawPath.trim();
    const dot = trimmed.indexOf(".");
    if (dot === -1) {
      const v = context[trimmed];
      return v !== undefined ? String(v) : `{{${rawPath}}}`;
    }
    const key = trimmed.slice(0, dot);
    const field = trimmed.slice(dot + 1);
    const ctx = context[key];
    if (ctx === undefined) return `{{${rawPath}}}`;
    const resolved = getPath(ctx, field);
    if (resolved === undefined || resolved === null) return `{{${rawPath}}}`;
    if (typeof resolved === "object") return JSON.stringify(resolved);
    return String(resolved);
  });
}

/**
 * Evaluate a single condition rule deterministically.
 */
function evalRule(
  rule: { field: string; operator: string; value?: unknown },
  context: Record<string, unknown>,
): boolean {
  const rawField = interpolate(rule.field, context);
  const dot = rawField.indexOf(".");
  let fieldValue: unknown;
  if (dot === -1) {
    fieldValue = context[rawField];
  } else {
    const key = rawField.slice(0, dot);
    const path = rawField.slice(dot + 1);
    fieldValue = getPath(context[key], path);
  }

  const ruleValue = rule.value;

  switch (rule.operator) {
    case "equals":
      return String(fieldValue) === String(ruleValue);
    case "not_equals":
      return String(fieldValue) !== String(ruleValue);
    case "contains":
      return String(fieldValue).includes(String(ruleValue));
    case "not_contains":
      return !String(fieldValue).includes(String(ruleValue));
    case "greater_than":
      return Number(fieldValue) > Number(ruleValue);
    case "less_than":
      return Number(fieldValue) < Number(ruleValue);
    case "greater_than_or_equal":
      return Number(fieldValue) >= Number(ruleValue);
    case "less_than_or_equal":
      return Number(fieldValue) <= Number(ruleValue);
    case "is_empty":
      return (
        fieldValue === undefined ||
        fieldValue === null ||
        fieldValue === "" ||
        (Array.isArray(fieldValue) && fieldValue.length === 0)
      );
    case "is_not_empty":
      return !(
        fieldValue === undefined ||
        fieldValue === null ||
        fieldValue === "" ||
        (Array.isArray(fieldValue) && fieldValue.length === 0)
      );
    case "regex": {
      try {
        return new RegExp(String(ruleValue)).test(String(fieldValue));
      } catch {
        return false;
      }
    }
    default:
      return false;
  }
}

/**
 * Evaluate a ConditionGroup deterministically.
 */
function evalConditionGroup(
  group: {
    combinator: string;
    rules: Array<{ field: string; operator: string; value?: unknown }>;
  },
  context: Record<string, unknown>,
): boolean {
  if (group.combinator === "and") {
    return group.rules.every((r) => evalRule(r, context));
  }
  return group.rules.some((r) => evalRule(r, context));
}

/**
 * Compute delay in milliseconds from a DelayConfig.
 */
function delayMs(cfg: DelayConfig): number {
  const { amount, unit } = cfg;
  switch (unit) {
    case "seconds":
      return amount * 1_000;
    case "minutes":
      return amount * 60_000;
    case "hours":
      return amount * 3_600_000;
    case "days":
      return amount * 86_400_000;
    default:
      return amount * 1_000;
  }
}

// =============================================================================
// Main Workflow function
// =============================================================================

export interface GraphInterpreterOutput {
  /** Which subflow_output port fired (0-based). Undefined for top-level workflows. */
  outputIndex: number;
  /** Final node output data — passed back to parent subworkflow_call node */
  data: Record<string, unknown>;
}

export async function graphInterpreterWorkflow(
  input: GraphInterpreterInput,
): Promise<GraphInterpreterOutput> {
  let { executionId, workflowId, template, triggerPayload, environmentId } =
    input;

  // Build activity proxies using workflow-level settings (or defaults)
  const ws: WorkflowSettings = template.settings ?? {};
  const {
    httpRequestActivity,
    sendEmailActivity,
    postgresQueryActivity,
    runCustomCodeActivity,
    mqttPublishActivity,
    rabbitmqActivity,
    writeNodeLogActivity,
    updateExecutionStatusActivity,
    createExecutionRecordActivity,
    resolveCredentialActivity,
    resolveVariablesActivity,
    triggerWorkflowActivity,
    jsRunnerActivity,
    tsRunnerActivity,
    dataMappingActivity,
    jsonParserActivity,
    htmlTemplateActivity,
    cryptoHashActivity,
    dateFormatterActivity,
    base64Activity,
    mysqlActivity,
    mongodbActivity,
    redisActivity,
    s3Activity,
    slackActivity,
    sshActivity,
    twilioSmsActivity,
    twilioEmailActivity,
    llmPromptActivity,
    aiAgentActivity,
    prepareSubworkflowActivity,
    mariadbActivity,
    mssqlActivity,
    googleSheetsActivity,
    pythonRunnerActivity,
    firebasePushActivity,
    apnsPushActivity,
    awsLambdaActivity,
    awsSqsActivity,
    awsSnsActivity,
    awsDynamoDBActivity,
    awsSesActivity,
    awsSecretsManagerActivity,
    awsSsmActivity,
    awsEventBridgeActivity,
    awsStepFunctionsActivity,
  } = proxyActivities<ActivityMap>({
    startToCloseTimeout: ws.activityStartToCloseTimeout ?? "5 minutes",
    ...(ws.activityScheduleToStartTimeout
      ? { scheduleToStartTimeout: ws.activityScheduleToStartTimeout }
      : {}),
    retry: {
      maximumAttempts: ws.retry?.maximumAttempts ?? 3,
      initialInterval: ws.retry?.initialInterval ?? "2s",
      backoffCoefficient: ws.retry?.backoffCoefficient ?? 2,
      maximumInterval: ws.retry?.maximumInterval ?? "30s",
    },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any);

  // When triggered by a Temporal Schedule, executionId is "auto" — create a
  // fresh DB record now so we have a real ID for all subsequent log writes.
  if (executionId === "auto") {
    executionId = await createExecutionRecordActivity({
      workflowId,
      triggerPayload,
      environmentId,
    });
    log.info(`Auto-created execution record: ${executionId}`);
  }

  // Resolve environment variables once at execution start.
  // Injected as "$env" so node configs can use {{$env.MY_KEY}} syntax.
  const envVars = await resolveVariablesActivity(environmentId);

  // nodeOutputs: nodeId → output object.
  // "$env" holds all environment variables; "input" holds the trigger payload.
  const nodeOutputs: Record<string, unknown> = {
    $env: envVars,
    input: triggerPayload,
  };

  // For subflow mode: when a subflow_output node is reached, record which port fired
  let subflowOutputResult: {
    outputIndex: number;
    data: Record<string, unknown>;
  } | null = null;

  // Track which nodes have finished executing (including merge parking)
  const completedNodes = new Set<string>();

  // For AND-join (merge mode=all): track which incoming branches have arrived
  const mergeArrivals = new Map<string, Set<string>>(); // mergeNodeId → set of sourceNodeIds that arrived

  const adj = buildAdjacency(template.edges);
  const radj = buildReverseAdjacency(template.edges);

  // Mark execution as running (best-effort — non-retryable persistence error won't abort)
  try {
    await updateExecutionStatusActivity({
      executionId,
      status: "running",
    });
  } catch {
    log.warn("Could not update execution status to running — continuing");
  }

  try {
    // Identify root nodes (trigger nodes) and seed the BFS queue
    const roots = findRoots(template.nodes, radj);
    if (roots.length === 0) {
      throw ApplicationFailure.create({
        message: "Workflow template has no root (trigger) nodes",
        type: "INVALID_TEMPLATE",
        nonRetryable: true,
      });
    }

    // BFS queue contains { nodeId, incomingEdge } pairs
    // incomingEdge is undefined for root nodes
    const queue: Array<{
      nodeId: string;
      incomingEdgeSourceHandle?: string;
      incomingFrom?: string;
    }> = roots.map((n) => ({ nodeId: n.id }));

    const nodeMap = new Map<string, WorkflowNode>(
      template.nodes.map((n) => [n.id, n]),
    );

    while (queue.length > 0) {
      const { nodeId, incomingEdgeSourceHandle, incomingFrom } = queue.shift()!;

      const node = nodeMap.get(nodeId);
      if (!node) {
        log.warn(
          `Node ${nodeId} referenced in queue but not found in template`,
        );
        continue;
      }

      // -----------------------------------------------------------------------
      // AND-join merge: park the arrival and only proceed when all branches
      // have delivered their output.
      // -----------------------------------------------------------------------
      if (node.kind === "merge") {
        const mergeCfg = node.config as MergeConfig;

        if (mergeCfg.mode === "all") {
          if (!mergeArrivals.has(nodeId)) mergeArrivals.set(nodeId, new Set());
          if (incomingFrom) mergeArrivals.get(nodeId)!.add(incomingFrom);

          const expectedCount = mergeCfg.branchCount;
          const arrivedCount = mergeArrivals.get(nodeId)!.size;

          if (arrivedCount < expectedCount) {
            log.info(
              `Merge node ${nodeId} parked: ${arrivedCount}/${expectedCount} branches`,
            );
            continue; // Park — wait for remaining branches
          }
          // All branches arrived — fall through to execute the merge node
        }
        // mode === "first": proceed immediately (first arrival wins)
      }

      // Skip already-completed nodes (can happen in OR-join / fork scenarios)
      if (completedNodes.has(nodeId)) {
        log.debug(`Node ${nodeId} already completed — skipping`);
        // Still enqueue successors if this was a fork path convergence
        continue;
      }

      // -----------------------------------------------------------------------
      // Log node start
      // -----------------------------------------------------------------------
      try {
        await writeNodeLogActivity({
          executionId,
          nodeId,
          nodeKind: node.kind,
          level: "info",
          message: `Node ${node.label} starting`,
          data: { nodeId, kind: node.kind },
        });
      } catch {
        log.warn(`Could not write start log for node ${nodeId}`);
      }

      // -----------------------------------------------------------------------
      // Execute the node
      // -----------------------------------------------------------------------
      let nodeOutput: unknown = {};
      let outgoingHandles: string[] = []; // which sourceHandles to follow

      try {
        switch (node.kind as NodeKind) {
          // ------------------------------------------------------------------
          // Trigger nodes — their output IS the trigger payload.
          // ------------------------------------------------------------------
          case "manual":
          case "cron":
          case "mqtt_trigger":
          case "external_trigger": {
            nodeOutput = triggerPayload;
            outgoingHandles = [""];
            break;
          }

          // ------------------------------------------------------------------
          // Webhook — if started manually (no webhook payload yet), block
          // until the inbound HTTP request arrives via a Temporal Signal.
          // If started by the webhook handler itself, payload is already set.
          // ------------------------------------------------------------------
          case "webhook": {
            const hasIncomingPayload = !!(
              triggerPayload as Record<string, unknown>
            ).webhookPath;
            if (hasIncomingPayload) {
              // Execution was triggered by the inbound webhook — use payload directly
              nodeOutput = triggerPayload;
            } else {
              // Execution was started manually — wait for the signal (10 min timeout)
              let webhookData: Record<string, unknown> | null = null;
              setHandler(
                webhookPayloadSignal,
                (payload: Record<string, unknown>) => {
                  webhookData = payload;
                },
              );
              log.info(
                `Webhook node ${nodeId}: waiting for inbound HTTP request…`,
              );
              const received = await condition(
                () => webhookData !== null,
                10 * 60 * 1000,
              );
              if (!received) {
                throw ApplicationFailure.create({
                  message:
                    "Webhook timeout — no HTTP request received within 10 minutes",
                  type: "WEBHOOK_TIMEOUT",
                  nonRetryable: true,
                });
              }
              nodeOutput = webhookData!;
              // Merge into shared triggerPayload so downstream {{input.*}} refs work
              Object.assign(triggerPayload, webhookData);
            }
            outgoingHandles = [""];
            break;
          }

          // ------------------------------------------------------------------
          // HTTP Request
          // ------------------------------------------------------------------
          case "http_request": {
            const cfg = node.config as HttpRequestConfig;
            // Inject credential as Authorization header if credentialId set
            let httpCfg = cfg;
            if ((cfg as any).credentialId) {
              const cred = await resolveCredentialActivity(
                (cfg as any).credentialId,
              );
              const authHeader = cred.token
                ? { key: "Authorization", value: `Bearer ${cred.token}` }
                : cred.username && cred.password
                  ? {
                      key: "Authorization",
                      value: `Basic ${Buffer.from(`${cred.username}:${cred.password}`).toString("base64")}`,
                    }
                  : cred.headerValue
                    ? {
                        key: cred.headerName ?? "X-Api-Key",
                        value: cred.headerValue,
                      }
                    : null;
              if (authHeader) {
                httpCfg = {
                  ...cfg,
                  headers: [...(cfg.headers ?? []), authHeader],
                };
              }
            }
            nodeOutput = await httpRequestActivity({
              config: httpCfg,
              context: nodeOutputs,
            });
            outgoingHandles = [""];
            break;
          }

          // ------------------------------------------------------------------
          // Send Email
          // ------------------------------------------------------------------
          case "send_email": {
            const cfg = node.config as SendEmailConfig;
            let emailCredentials: Record<string, string> | undefined;
            if (cfg.credentialId) {
              emailCredentials = await resolveCredentialActivity(
                cfg.credentialId,
              );
            }
            nodeOutput = await sendEmailActivity({
              config: cfg,
              context: nodeOutputs,
              credentials: emailCredentials,
            });
            outgoingHandles = [""];
            break;
          }

          // ------------------------------------------------------------------
          // PostgreSQL Query
          // ------------------------------------------------------------------
          case "postgres_query": {
            const cfg = node.config as PostgresConfig;
            let resolvedConnectionString: string | undefined;
            if (cfg.credentialId) {
              const cred = await resolveCredentialActivity(cfg.credentialId);
              resolvedConnectionString = cred.connectionString;
            }
            nodeOutput = await postgresQueryActivity({
              config: cfg,
              context: nodeOutputs,
              resolvedConnectionString,
            });
            outgoingHandles = [""];
            break;
          }

          // ------------------------------------------------------------------
          // Custom Code
          // ------------------------------------------------------------------
          case "custom_code": {
            const cfg = node.config as CustomCodeConfig;
            nodeOutput = await runCustomCodeActivity({
              config: cfg,
              context: nodeOutputs,
            });
            outgoingHandles = [""];
            break;
          }

          // ------------------------------------------------------------------
          // Delay
          // ------------------------------------------------------------------
          case "delay": {
            const cfg = node.config as DelayConfig;
            const ms = delayMs(cfg);
            log.info(`Delay node ${nodeId}: sleeping ${ms}ms`);
            await sleep(ms);
            // Pass through the upstream node's output unchanged so downstream
            // nodes continue to see the data that preceded the delay.
            nodeOutput =
              incomingFrom !== undefined
                ? (nodeOutputs[incomingFrom] ?? {})
                : {};
            outgoingHandles = [""];
            break;
          }

          // ------------------------------------------------------------------
          // If/Else
          // ------------------------------------------------------------------
          case "if_else": {
            const cfg = node.config as IfElseConfig;
            const result = evalConditionGroup(cfg.condition, nodeOutputs);
            nodeOutput = { conditionResult: result };
            outgoingHandles = [result ? "true" : "false"];
            break;
          }

          // ------------------------------------------------------------------
          // Switch
          // ------------------------------------------------------------------
          case "switch": {
            const cfg = node.config as SwitchConfig;
            const exprResult = interpolate(cfg.expression, nodeOutputs);
            const matchedCase = cfg.cases.find(
              (c) => String(c.value) === exprResult,
            );
            const handle = matchedCase?.label ?? cfg.defaultLabel ?? "";
            nodeOutput = {
              expressionResult: exprResult,
              matchedCase: matchedCase?.label,
            };
            outgoingHandles = [handle];
            break;
          }

          // ------------------------------------------------------------------
          // Merge (AND-join or OR-join)
          // ------------------------------------------------------------------
          case "merge": {
            // Collect outputs from all arrived branches as an array.
            // For OR-join (mode=first), arrivals has exactly one entry.
            // For AND-join (mode=all), arrivals has all branch entries.
            const arrivals = mergeArrivals.get(nodeId);
            if (arrivals && arrivals.size > 0) {
              nodeOutput = Array.from(arrivals).map(
                (srcId) => nodeOutputs[srcId],
              );
            } else if (incomingFrom !== undefined) {
              // OR-join with no arrivals map entry yet — single branch
              nodeOutput = [nodeOutputs[incomingFrom]];
            } else {
              nodeOutput = [];
            }
            outgoingHandles = [""];
            break;
          }

          // ------------------------------------------------------------------
          // RabbitMQ — consume / publish_queue / publish_exchange
          // ------------------------------------------------------------------
          case "rabbitmq": {
            const cfg = node.config as RabbitMQConfig;
            let resolvedUrl: string | undefined;
            if (cfg.credentialId) {
              const cred = await resolveCredentialActivity(cfg.credentialId);
              resolvedUrl = cred.url;
            }
            nodeOutput = await rabbitmqActivity({
              config: cfg,
              context: nodeOutputs,
              resolvedUrl,
            });
            outgoingHandles = [""];
            break;
          }

          // ------------------------------------------------------------------
          // Workflow Trigger In — acts as a trigger; output = triggerPayload
          // ------------------------------------------------------------------
          case "workflow_trigger_in": {
            nodeOutput = triggerPayload;
            outgoingHandles = [""];
            break;
          }

          // ------------------------------------------------------------------
          // Subflow Input — virtual input port; output = triggerPayload
          // ------------------------------------------------------------------
          case "subflow_input": {
            nodeOutput = triggerPayload;
            outgoingHandles = ["out"];
            break;
          }

          // ------------------------------------------------------------------
          // Subflow Output — virtual output port; terminates child BFS and
          // returns which port fired back to the parent subworkflow_call node
          // ------------------------------------------------------------------
          case "subflow_output": {
            const cfg = node.config as { outputIndex?: number };
            subflowOutputResult = {
              outputIndex: cfg.outputIndex ?? 0,
              data: nodeOutputs as Record<string, unknown>,
            };
            // Stop BFS — no outgoing edges
            outgoingHandles = [];
            break;
          }

          // ------------------------------------------------------------------
          // Workflow Trigger Out — starts another workflow by ID
          // ------------------------------------------------------------------
          case "workflow_trigger_out": {
            const cfg = node.config as WorkflowTriggerOutConfig;
            nodeOutput = await triggerWorkflowActivity({
              config: cfg,
              context: nodeOutputs,
              sourceWorkflowId: workflowId,
              sourceExecutionId: executionId,
            });
            outgoingHandles = [""];
            break;
          }

          // ------------------------------------------------------------------
          // Subworkflow Call — executes a child workflow synchronously
          // ------------------------------------------------------------------
          case "subworkflow_call": {
            const cfg = node.config as SubworkflowCallConfig;

            // Build the trigger payload for the child
            let childPayload: Record<string, unknown> = {
              _parentWorkflowId: workflowId,
              _parentExecutionId: executionId,
            };
            if (cfg.payload) {
              const interpolated = interpolate(cfg.payload, nodeOutputs);
              try {
                const parsed = JSON.parse(interpolated) as Record<
                  string,
                  unknown
                >;
                if (typeof parsed === "object" && parsed !== null) {
                  childPayload = { ...childPayload, ...parsed };
                }
              } catch {
                childPayload = { ...childPayload, value: interpolated };
              }
            }

            // Prepare: validate + create execution record via backend API
            const prep = await prepareSubworkflowActivity({
              subworkflowId: cfg.subworkflowId,
              triggerPayload: childPayload,
            });

            // Execute child Temporal workflow synchronously (parent waits)
            const { taskQueue } = workflowInfo();
            const childInput: GraphInterpreterInput = {
              executionId: prep.executionId,
              workflowId: cfg.subworkflowId,
              template: prep.template as WorkflowTemplate,
              triggerPayload: prep.triggerPayload,
            };
            const childResult = await executeChild<
              typeof graphInterpreterWorkflow
            >("graphInterpreterWorkflow", {
              workflowId: `exec-${prep.executionId}`,
              taskQueue,
              args: [childInput],
            });

            // Route to the handle that corresponds to which subflow_output fired
            const firedOutputIndex =
              (childResult as GraphInterpreterOutput)?.outputIndex ?? 0;
            nodeOutput = {
              subworkflowExecutionId: prep.executionId,
              completed: true,
              outputIndex: firedOutputIndex,
              output: (childResult as GraphInterpreterOutput)?.data ?? {},
            };
            outgoingHandles = [`output_${firedOutputIndex}`];
            break;
          }

          // ------------------------------------------------------------------
          // Stop — terminates the workflow at this node
          // ------------------------------------------------------------------
          case "stop": {
            const cfg = node.config as { message?: string };
            nodeOutput = {
              stopped: true,
              message: cfg.message ?? "Workflow stopped",
            };
            // No outgoing handles — BFS ends naturally
            outgoingHandles = [];
            break;
          }

          // ------------------------------------------------------------------
          // JavaScript Runner
          // ------------------------------------------------------------------
          case "js_runner": {
            const cfg = node.config as JsRunnerConfig;
            const jsResult = await jsRunnerActivity({
              config: cfg,
              nodeOutputs,
              workflowContext: { workflowId, executionId, triggerPayload },
            });
            // Write any console.log / console.error lines from the sandbox
            for (const line of jsResult.logs) {
              await writeNodeLogActivity({
                executionId,
                nodeId,
                nodeKind: node.kind,
                level: "info",
                message: line,
                data: { source: "console" },
              });
            }
            nodeOutput = jsResult.result;
            outgoingHandles = [""];
            break;
          }

          // ------------------------------------------------------------------
          // TypeScript Runner
          // ------------------------------------------------------------------
          case "ts_runner": {
            const cfg = node.config as TsRunnerConfig;
            const tsResult = await tsRunnerActivity({
              config: cfg,
              nodeOutputs,
              workflowContext: { workflowId, executionId, triggerPayload },
            });
            // Write any console.log / console.error lines from the sandbox
            for (const line of tsResult.logs) {
              await writeNodeLogActivity({
                executionId,
                nodeId,
                nodeKind: node.kind,
                level: "info",
                message: line,
                data: { source: "console" },
              });
            }
            nodeOutput = tsResult.result;
            outgoingHandles = [""];
            break;
          }

          // ------------------------------------------------------------------
          // Data Mapper
          // ------------------------------------------------------------------
          case "data_mapper": {
            const cfg = node.config as DataMapperConfig;
            nodeOutput = await dataMappingActivity({
              config: cfg,
              context: nodeOutputs,
            });
            outgoingHandles = [""];
            break;
          }

          // ------------------------------------------------------------------
          // JSON Parser
          // ------------------------------------------------------------------
          case "json_parser": {
            const cfg = node.config as JsonParserConfig;
            nodeOutput = await jsonParserActivity({
              config: cfg,
              context: nodeOutputs,
            });
            outgoingHandles = [""];
            break;
          }

          // ------------------------------------------------------------------
          // HTML Template
          // ------------------------------------------------------------------
          case "html_template": {
            const cfg = node.config as HtmlTemplateConfig;
            nodeOutput = await htmlTemplateActivity({
              config: cfg,
              context: nodeOutputs,
            });
            outgoingHandles = [""];
            break;
          }

          // ------------------------------------------------------------------
          // Crypto / Hash
          // ------------------------------------------------------------------
          case "crypto_hash": {
            const cfg = node.config as CryptoHashConfig;
            nodeOutput = await cryptoHashActivity({
              config: cfg,
              context: nodeOutputs,
            });
            outgoingHandles = [""];
            break;
          }

          // ------------------------------------------------------------------
          // Date Formatter
          // ------------------------------------------------------------------
          case "date_formatter": {
            const cfg = node.config as DateFormatterConfig;
            nodeOutput = await dateFormatterActivity({
              config: cfg,
              context: nodeOutputs,
            });
            outgoingHandles = [""];
            break;
          }

          // ------------------------------------------------------------------
          // Base64 Encode / Decode
          // ------------------------------------------------------------------
          case "base64": {
            const cfg = node.config as Base64Config;
            nodeOutput = await base64Activity({
              config: cfg,
              context: nodeOutputs,
            });
            outgoingHandles = [""];
            break;
          }

          // ------------------------------------------------------------------
          // MySQL
          // ------------------------------------------------------------------
          case "mysql": {
            const cfg = node.config as MysqlConfig;
            let resolvedConnectionString: string | undefined;
            if (cfg.credentialId) {
              const cred = await resolveCredentialActivity(cfg.credentialId);
              resolvedConnectionString = cred.connectionString;
            }
            nodeOutput = await mysqlActivity({
              config: cfg,
              context: nodeOutputs,
              resolvedConnectionString,
            });
            outgoingHandles = [""];
            break;
          }

          // ------------------------------------------------------------------
          // MongoDB
          // ------------------------------------------------------------------
          case "mongodb": {
            const cfg = node.config as MongodbConfig;
            let resolvedUri: string | undefined;
            if (cfg.credentialId) {
              const cred = await resolveCredentialActivity(cfg.credentialId);
              resolvedUri = cred.uri;
            }
            nodeOutput = await mongodbActivity({
              config: cfg,
              context: nodeOutputs,
              resolvedUri,
            });
            outgoingHandles = [""];
            break;
          }

          // ------------------------------------------------------------------
          // Redis
          // ------------------------------------------------------------------
          case "redis": {
            const cfg = node.config as RedisConfig;
            let resolvedUrl: string | undefined;
            if (cfg.credentialId) {
              const cred = await resolveCredentialActivity(cfg.credentialId);
              resolvedUrl = cred.url;
            }
            nodeOutput = await redisActivity({
              config: cfg,
              context: nodeOutputs,
              resolvedUrl,
            });
            outgoingHandles = [""];
            break;
          }

          // ------------------------------------------------------------------
          // S3 Bucket
          // ------------------------------------------------------------------
          case "s3_bucket": {
            const cfg = node.config as S3BucketConfig;
            let resolvedCredentials:
              | { accessKeyId?: string; secretAccessKey?: string }
              | undefined;
            if (cfg.credentialId) {
              const cred = await resolveCredentialActivity(cfg.credentialId);
              resolvedCredentials = {
                accessKeyId: cred.accessKeyId,
                secretAccessKey: cred.secretAccessKey,
              };
            }
            nodeOutput = await s3Activity({
              config: cfg,
              context: nodeOutputs,
              resolvedCredentials,
            });
            outgoingHandles = [""];
            break;
          }

          // ------------------------------------------------------------------
          // Slack
          // ------------------------------------------------------------------
          case "slack": {
            const cfg = node.config as SlackConfig;
            let resolvedWebhookUrl: string | undefined;
            if (cfg.credentialId) {
              const cred = await resolveCredentialActivity(cfg.credentialId);
              resolvedWebhookUrl = cred.webhookUrl;
            }
            nodeOutput = await slackActivity({
              config: cfg,
              context: nodeOutputs,
              resolvedWebhookUrl,
            });
            outgoingHandles = [""];
            break;
          }

          // ------------------------------------------------------------------
          // SSH Terminal
          // ------------------------------------------------------------------
          case "ssh_terminal": {
            const cfg = node.config as SshTerminalConfig;
            let resolvedCredentials:
              | { password?: string; privateKey?: string }
              | undefined;
            if (cfg.credentialId) {
              const cred = await resolveCredentialActivity(cfg.credentialId);
              resolvedCredentials = {
                password: cred.password,
                privateKey: cred.privateKey,
              };
            }
            nodeOutput = await sshActivity({
              config: cfg,
              context: nodeOutputs,
              resolvedCredentials,
            });
            outgoingHandles = [""];
            break;
          }

          // ------------------------------------------------------------------
          // Twilio SMS
          // ------------------------------------------------------------------
          case "twilio_sms": {
            const cfg = node.config as TwilioSmsConfig;
            let resolvedCredentials:
              | { accountSid?: string; authToken?: string }
              | undefined;
            if (cfg.credentialId) {
              const cred = await resolveCredentialActivity(cfg.credentialId);
              resolvedCredentials = {
                accountSid: cred.accountSid,
                authToken: cred.authToken,
              };
            }
            nodeOutput = await twilioSmsActivity({
              config: cfg,
              context: nodeOutputs,
              resolvedCredentials,
            });
            outgoingHandles = [""];
            break;
          }

          // ------------------------------------------------------------------
          // Twilio Email (SendGrid)
          // ------------------------------------------------------------------
          case "twilio_email": {
            const cfg = node.config as TwilioEmailConfig;
            let resolvedApiKey: string | undefined;
            if (cfg.credentialId) {
              const cred = await resolveCredentialActivity(cfg.credentialId);
              resolvedApiKey = cred.apiKey;
            }
            nodeOutput = await twilioEmailActivity({
              config: cfg,
              context: nodeOutputs,
              resolvedApiKey,
            });
            outgoingHandles = [""];
            break;
          }

          // ------------------------------------------------------------------
          // LLM Prompt
          // ------------------------------------------------------------------
          case "llm_prompt": {
            const cfg = node.config as LlmPromptConfig;
            let resolvedApiKey: string | undefined;
            if (cfg.credentialId) {
              const cred = await resolveCredentialActivity(cfg.credentialId);
              resolvedApiKey = cred.apiKey ?? cred.token;
            }
            nodeOutput = await llmPromptActivity({
              config: cfg,
              context: nodeOutputs,
              resolvedApiKey,
            });
            outgoingHandles = [""];
            break;
          }

          // ------------------------------------------------------------------
          // AI Agent (tool-calling loop)
          // ------------------------------------------------------------------
          case "ai_agent": {
            const cfg = node.config as AiAgentConfig;
            let resolvedApiKey: string | undefined;
            if (cfg.credentialId) {
              const cred = await resolveCredentialActivity(cfg.credentialId);
              resolvedApiKey = cred.apiKey ?? cred.token;
            }
            nodeOutput = await aiAgentActivity({
              config: cfg,
              context: nodeOutputs,
              resolvedApiKey,
            });
            outgoingHandles = [""];
            break;
          }

          // ------------------------------------------------------------------
          // Debug — passes through the immediate upstream node's output so
          // the DebugNode on the canvas can display it live.
          // ------------------------------------------------------------------
          case "debug": {
            // `incomingFrom` is the node that led to this one in the BFS queue.
            // Fall back to the full nodeOutputs map if no upstream is known.
            const upstreamOutput =
              incomingFrom !== undefined
                ? (nodeOutputs[incomingFrom] ?? null)
                : nodeOutputs;
            nodeOutput = upstreamOutput;
            // Write the inspected value to the execution log so it's visible
            await writeNodeLogActivity({
              executionId,
              nodeId,
              nodeKind: node.kind,
              level: "debug",
              message: JSON.stringify(upstreamOutput, null, 2),
              data: { source: "debug", label: node.label },
            });
            outgoingHandles = [""];
            break;
          }

          // ------------------------------------------------------------------
          // MariaDB (uses mysql2 — protocol-compatible)
          // ------------------------------------------------------------------
          case "mariadb": {
            const cfg = node.config as MariadbConfig;
            let resolvedConnectionString: string | undefined;
            if (cfg.credentialId) {
              const cred = await resolveCredentialActivity(cfg.credentialId);
              resolvedConnectionString = cred.connectionString;
            }
            nodeOutput = await mariadbActivity({
              config: cfg,
              context: nodeOutputs,
              resolvedConnectionString,
            });
            outgoingHandles = [""];
            break;
          }

          // ------------------------------------------------------------------
          // MS SQL Server
          // ------------------------------------------------------------------
          case "mssql": {
            const cfg = node.config as MssqlConfig;
            let resolvedCredentials: Record<string, string> | undefined;
            if (cfg.credentialId) {
              resolvedCredentials = await resolveCredentialActivity(
                cfg.credentialId,
              );
            }
            nodeOutput = await mssqlActivity({
              config: cfg,
              context: nodeOutputs,
              resolvedCredentials,
            });
            outgoingHandles = [""];
            break;
          }

          // ------------------------------------------------------------------
          // Google Sheets
          // ------------------------------------------------------------------
          case "google_sheets": {
            const cfg = node.config as GoogleSheetsConfig;
            let resolvedServiceAccountJson: string | undefined;
            if (cfg.credentialId) {
              const cred = await resolveCredentialActivity(cfg.credentialId);
              resolvedServiceAccountJson = cred.serviceAccountJson;
            }
            nodeOutput = await googleSheetsActivity({
              config: cfg,
              context: nodeOutputs,
              resolvedServiceAccountJson,
            });
            outgoingHandles = [""];
            break;
          }

          // ------------------------------------------------------------------
          // Python Runner
          // ------------------------------------------------------------------
          case "python_runner": {
            const cfg = node.config as PythonRunnerConfig;
            const pyResult = await pythonRunnerActivity({
              config: cfg,
              nodeOutputs,
            });
            // Stream any stderr / print lines from the interpreter into node logs
            for (const line of pyResult.logs) {
              await writeNodeLogActivity({
                executionId,
                nodeId,
                nodeKind: node.kind,
                level: "info",
                message: line,
                data: { source: "stderr" },
              });
            }
            // Pass through only the user's `result` value to downstream nodes
            nodeOutput = pyResult.result;
            outgoingHandles = [""];
            break;
          }

          // ------------------------------------------------------------------
          // Firebase Push Notification
          // ------------------------------------------------------------------
          case "firebase_push": {
            const cfg = node.config as FirebasePushConfig;
            let resolvedServiceAccountJson: string | undefined;
            if (cfg.credentialId) {
              const cred = await resolveCredentialActivity(cfg.credentialId);
              resolvedServiceAccountJson = cred.serviceAccountJson;
            }
            nodeOutput = await firebasePushActivity({
              config: cfg,
              context: nodeOutputs,
              resolvedServiceAccountJson,
            });
            outgoingHandles = [""];
            break;
          }

          // ------------------------------------------------------------------
          // Apple Push Notification (APNs)
          // ------------------------------------------------------------------
          case "apns_push": {
            const cfg = node.config as ApnsPushConfig;
            let resolvedCredentials: Record<string, string> | undefined;
            if (cfg.credentialId) {
              resolvedCredentials = await resolveCredentialActivity(
                cfg.credentialId,
              );
            }
            nodeOutput = await apnsPushActivity({
              config: cfg,
              context: nodeOutputs,
              resolvedCredentials,
            });
            outgoingHandles = [""];
            break;
          }

          // ------------------------------------------------------------------
          // Loop — iterates over an array, executing the "body" subgraph
          // for each element. Currently a simplified batch-map approach:
          // collects all items, runs body nodes sequentially via signals.
          // ------------------------------------------------------------------
          case "loop": {
            const cfg = node.config as LoopConfig;
            const itemsRaw = interpolate(cfg.items, nodeOutputs);
            let items: unknown[];
            try {
              items = JSON.parse(itemsRaw);
              if (!Array.isArray(items)) items = [items];
            } catch {
              items = [itemsRaw];
            }

            const maxIter = cfg.maxIterations ?? 1000;
            if (items.length > maxIter) {
              items = items.slice(0, maxIter);
            }

            const itemVar = cfg.itemVariable ?? "item";
            const indexVar = cfg.indexVariable ?? "index";

            // Collect results from each iteration
            const results: unknown[] = [];
            for (let i = 0; i < items.length; i++) {
              results.push({
                [itemVar]: items[i],
                [indexVar]: i,
              });
            }

            nodeOutput = { items: results, count: results.length };
            // "body" handle can be connected to iterate, "done" when complete
            outgoingHandles = ["done"];
            break;
          }

          // ------------------------------------------------------------------
          // Response — sends an HTTP response back to the webhook caller.
          // Currently stores the response data; the webhook handler checks
          // for this in the execution output.
          // ------------------------------------------------------------------
          case "response": {
            const cfg = node.config as ResponseConfig;
            const body = cfg.body
              ? interpolate(cfg.body, nodeOutputs)
              : undefined;
            const headers: Record<string, string> = {};
            for (const h of cfg.headers ?? []) {
              headers[interpolate(h.key, nodeOutputs)] = interpolate(
                h.value,
                nodeOutputs,
              );
            }
            nodeOutput = {
              _isWebhookResponse: true,
              statusCode: cfg.statusCode ?? 200,
              contentType: cfg.contentType ?? "application/json",
              headers,
              body,
            };
            outgoingHandles = [];
            break;
          }

          // ------------------------------------------------------------------
          // Trigger Output — returns data to external trigger caller.
          // The output is flagged with _isTriggerOutput so the completion
          // logic uses it as the execution's final output.
          // ------------------------------------------------------------------
          case "trigger_output": {
            const cfg = node.config as TriggerOutputConfig;
            const rawBody = cfg.body
              ? interpolate(cfg.body, nodeOutputs)
              : "{}";
            let parsed: unknown;
            try {
              parsed =
                typeof rawBody === "string" ? JSON.parse(rawBody) : rawBody;
            } catch {
              parsed = rawBody; // If not valid JSON, use raw string
            }
            nodeOutput = {
              _isTriggerOutput: true,
              data: parsed,
            };
            outgoingHandles = []; // terminal node
            break;
          }

          // ------------------------------------------------------------------
          // AWS Lambda
          // ------------------------------------------------------------------
          case "aws_lambda": {
            const cfg = node.config as AwsLambdaConfig;
            let resolvedCredentials:
              | { accessKeyId?: string; secretAccessKey?: string }
              | undefined;
            if (cfg.credentialId) {
              const cred = await resolveCredentialActivity(cfg.credentialId);
              resolvedCredentials = {
                accessKeyId: cred.accessKeyId,
                secretAccessKey: cred.secretAccessKey,
              };
            }
            nodeOutput = await awsLambdaActivity({
              config: cfg,
              context: nodeOutputs,
              resolvedCredentials,
            });
            outgoingHandles = [""];
            break;
          }

          // ------------------------------------------------------------------
          // AWS SQS
          // ------------------------------------------------------------------
          case "aws_sqs": {
            const cfg = node.config as AwsSqsConfig;
            let resolvedCredentials:
              | { accessKeyId?: string; secretAccessKey?: string }
              | undefined;
            if (cfg.credentialId) {
              const cred = await resolveCredentialActivity(cfg.credentialId);
              resolvedCredentials = {
                accessKeyId: cred.accessKeyId,
                secretAccessKey: cred.secretAccessKey,
              };
            }
            nodeOutput = await awsSqsActivity({
              config: cfg,
              context: nodeOutputs,
              resolvedCredentials,
            });
            outgoingHandles = [""];
            break;
          }

          // ------------------------------------------------------------------
          // AWS SNS
          // ------------------------------------------------------------------
          case "aws_sns": {
            const cfg = node.config as AwsSnsConfig;
            let resolvedCredentials:
              | { accessKeyId?: string; secretAccessKey?: string }
              | undefined;
            if (cfg.credentialId) {
              const cred = await resolveCredentialActivity(cfg.credentialId);
              resolvedCredentials = {
                accessKeyId: cred.accessKeyId,
                secretAccessKey: cred.secretAccessKey,
              };
            }
            nodeOutput = await awsSnsActivity({
              config: cfg,
              context: nodeOutputs,
              resolvedCredentials,
            });
            outgoingHandles = [""];
            break;
          }

          // ------------------------------------------------------------------
          // AWS DynamoDB
          // ------------------------------------------------------------------
          case "aws_dynamodb": {
            const cfg = node.config as AwsDynamoDBConfig;
            let resolvedCredentials:
              | { accessKeyId?: string; secretAccessKey?: string }
              | undefined;
            if (cfg.credentialId) {
              const cred = await resolveCredentialActivity(cfg.credentialId);
              resolvedCredentials = {
                accessKeyId: cred.accessKeyId,
                secretAccessKey: cred.secretAccessKey,
              };
            }
            nodeOutput = await awsDynamoDBActivity({
              config: cfg,
              context: nodeOutputs,
              resolvedCredentials,
            });
            outgoingHandles = [""];
            break;
          }

          // ------------------------------------------------------------------
          // AWS SES
          // ------------------------------------------------------------------
          case "aws_ses": {
            const cfg = node.config as AwsSesConfig;
            let resolvedCredentials:
              | { accessKeyId?: string; secretAccessKey?: string }
              | undefined;
            if (cfg.credentialId) {
              const cred = await resolveCredentialActivity(cfg.credentialId);
              resolvedCredentials = {
                accessKeyId: cred.accessKeyId,
                secretAccessKey: cred.secretAccessKey,
              };
            }
            nodeOutput = await awsSesActivity({
              config: cfg,
              context: nodeOutputs,
              resolvedCredentials,
            });
            outgoingHandles = [""];
            break;
          }

          // ------------------------------------------------------------------
          // AWS Secrets Manager
          // ------------------------------------------------------------------
          case "aws_secrets_manager": {
            const cfg = node.config as AwsSecretsManagerConfig;
            let resolvedCredentials:
              | { accessKeyId?: string; secretAccessKey?: string }
              | undefined;
            if (cfg.credentialId) {
              const cred = await resolveCredentialActivity(cfg.credentialId);
              resolvedCredentials = {
                accessKeyId: cred.accessKeyId,
                secretAccessKey: cred.secretAccessKey,
              };
            }
            nodeOutput = await awsSecretsManagerActivity({
              config: cfg,
              context: nodeOutputs,
              resolvedCredentials,
            });
            outgoingHandles = [""];
            break;
          }

          // ------------------------------------------------------------------
          // AWS SSM Parameter Store
          // ------------------------------------------------------------------
          case "aws_ssm": {
            const cfg = node.config as AwsSsmConfig;
            let resolvedCredentials:
              | { accessKeyId?: string; secretAccessKey?: string }
              | undefined;
            if (cfg.credentialId) {
              const cred = await resolveCredentialActivity(cfg.credentialId);
              resolvedCredentials = {
                accessKeyId: cred.accessKeyId,
                secretAccessKey: cred.secretAccessKey,
              };
            }
            nodeOutput = await awsSsmActivity({
              config: cfg,
              context: nodeOutputs,
              resolvedCredentials,
            });
            outgoingHandles = [""];
            break;
          }

          // ------------------------------------------------------------------
          // AWS EventBridge
          // ------------------------------------------------------------------
          case "aws_eventbridge": {
            const cfg = node.config as AwsEventBridgeConfig;
            let resolvedCredentials:
              | { accessKeyId?: string; secretAccessKey?: string }
              | undefined;
            if (cfg.credentialId) {
              const cred = await resolveCredentialActivity(cfg.credentialId);
              resolvedCredentials = {
                accessKeyId: cred.accessKeyId,
                secretAccessKey: cred.secretAccessKey,
              };
            }
            nodeOutput = await awsEventBridgeActivity({
              config: cfg,
              context: nodeOutputs,
              resolvedCredentials,
            });
            outgoingHandles = [""];
            break;
          }

          // ------------------------------------------------------------------
          // AWS Step Functions
          // ------------------------------------------------------------------
          case "aws_step_functions": {
            const cfg = node.config as AwsStepFunctionsConfig;
            let resolvedCredentials:
              | { accessKeyId?: string; secretAccessKey?: string }
              | undefined;
            if (cfg.credentialId) {
              const cred = await resolveCredentialActivity(cfg.credentialId);
              resolvedCredentials = {
                accessKeyId: cred.accessKeyId,
                secretAccessKey: cred.secretAccessKey,
              };
            }
            nodeOutput = await awsStepFunctionsActivity({
              config: cfg,
              context: nodeOutputs,
              resolvedCredentials,
            });
            outgoingHandles = [""];
            break;
          }

          default: {
            log.warn(`Unknown node kind: ${(node as WorkflowNode).kind}`);
            nodeOutput = {};
            outgoingHandles = [""];
          }
        }

        // Store this node's output
        nodeOutputs[nodeId] = nodeOutput;
        completedNodes.add(nodeId);

        // Log node completion
        try {
          await writeNodeLogActivity({
            executionId,
            nodeId,
            nodeKind: node.kind,
            level: "info",
            message: `Node ${node.label} completed`,
            data: { nodeId, output: nodeOutput },
          });
        } catch {
          log.warn(`Could not write completion log for node ${nodeId}`);
        }

        // Enqueue successor nodes based on outgoing edges + source handles
        const outgoingEdges = adj.get(nodeId) ?? [];
        for (const edge of outgoingEdges) {
          // If the node produced specific handles (if_else / switch), only
          // follow edges whose sourceHandle matches.
          const isUnconditional =
            outgoingHandles.includes("") || outgoingHandles.length === 0;
          const matchesHandle =
            isUnconditional ||
            (edge.sourceHandle !== undefined &&
              outgoingHandles.includes(edge.sourceHandle)) ||
            // Edges with no sourceHandle are always followed
            edge.sourceHandle === undefined ||
            edge.sourceHandle === "";

          if (matchesHandle) {
            queue.push({
              nodeId: edge.target,
              incomingEdgeSourceHandle: edge.sourceHandle,
              incomingFrom: nodeId,
            });
          }
        }
      } catch (err) {
        // Node failed — log the error and abort the workflow
        const errMsg =
          err instanceof ActivityFailure || err instanceof ApplicationFailure
            ? (err.cause?.message ?? err.message)
            : ((err as Error).message ?? String(err));

        log.error(`Node ${nodeId} (${node.kind}) failed: ${errMsg}`);

        try {
          await writeNodeLogActivity({
            executionId,
            nodeId,
            nodeKind: node.kind,
            level: "error",
            message: `Node ${node.label} failed: ${errMsg}`,
            data: { nodeId, error: errMsg },
          });
        } catch {
          // Suppress logging errors — we're already in the error path
        }

        // Propagate failure — the catch block below will update execution status
        throw err;
      }
    } // end BFS while loop

    // -------------------------------------------------------------------------
    // All nodes completed — mark execution as completed
    // -------------------------------------------------------------------------
    // Determine final output: prefer trigger_output node data, else last completed node's output.
    // If multiple trigger_output nodes exist (e.g. parallel branches or if/else), use the LAST
    // one that completed (latest in BFS order). Each parallel execution is isolated in its own
    // Temporal workflow, so concurrent runs never share state.
    const lastNodeId = [...completedNodes].pop();
    let finalOutput: Record<string, unknown> = lastNodeId
      ? (nodeOutputs[lastNodeId] as Record<string, unknown>)
      : {};

    // Scan all completed nodes; keep overwriting so the last trigger_output wins
    for (const completedNodeId of completedNodes) {
      const out = nodeOutputs[completedNodeId] as
        | Record<string, unknown>
        | undefined;
      if (out?._isTriggerOutput) {
        finalOutput = (out.data as Record<string, unknown>) ?? {};
        // Don't break — keep scanning so the last trigger_output in execution order wins
      }
    }

    await updateExecutionStatusActivity({
      executionId,
      status: "completed",
      output: finalOutput,
    });

    log.info(`Workflow execution ${executionId} completed successfully`);

    // Return subflow result (used when this workflow is called as a child via executeChild)
    return subflowOutputResult ?? { outputIndex: 0, data: finalOutput };
  } catch (err) {
    if (err instanceof CancelledFailure) {
      log.info(`Workflow execution ${executionId} was cancelled`);
      try {
        await updateExecutionStatusActivity({
          executionId,
          status: "cancelled",
        });
      } catch {
        // Best effort
      }
      throw err; // Re-throw so Temporal marks the workflow as cancelled
    }

    const errMsg = err instanceof Error ? err.message : String(err);

    log.error(`Workflow execution ${executionId} failed: ${errMsg}`);

    try {
      await updateExecutionStatusActivity({
        executionId,
        status: "failed",
        error: errMsg,
      });
    } catch {
      // Best effort — don't mask the original error
    }

    throw err;
  }
}
