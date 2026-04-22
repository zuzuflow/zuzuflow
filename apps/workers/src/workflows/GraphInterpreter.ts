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
  CustomBuilderConfig,
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
  AzureBlobConfig,
  AzureServiceBusConfig,
  AzureCosmosConfig,
  AzureKeyVaultConfig,
  AzureFunctionsConfig,
  GcpStorageConfig,
  GcpPubSubConfig,
  GcpBigQueryConfig,
  OracleDbConfig,
  OciObjectStorageConfig,
  StripeConfig,
  GithubConfig,
  DiscordConfig,
  NotionConfig,
  SalesforceConfig,
  JiraConfig,
  MsTeamsConfig,
  HubspotConfig,
  AirtableConfig,
  PagerDutyConfig,
  GitlabConfig,
  LinearConfig,
  TelegramConfig,
  SendgridConfig,
  SentryConfig,
  ShopifyConfig,
  MailchimpConfig,
  GoogleDriveConfig,
  DropboxConfig,
  DatadogConfig,
  PaypalConfig,
  SquareConfig,
  ResendConfig,
  OneDriveConfig,
  BoxConfig,
  CircleCIConfig,
  WhatsappConfig,
  PipedriveConfig,
  CustomerIoConfig,
  KafkaConfig,
  NatsConfig,
  SnowflakeConfig,
  ClickhouseConfig,
  ElasticsearchConfig,
  AiImageConfig,
  AiTranscribeConfig,
  AiTtsConfig,
  AiEmbedConfig,
  VectorDbConfig,
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
import type { AzureBlobActivityInput } from "../activities/azure_blob";
import type { AzureServiceBusActivityInput } from "../activities/azure_service_bus";
import type { AzureCosmosActivityInput } from "../activities/azure_cosmos_db";
import type { AzureKeyVaultActivityInput } from "../activities/azure_key_vault";
import type { AzureFunctionsActivityInput } from "../activities/azure_functions";
import type { GcpStorageActivityInput } from "../activities/gcp_storage";
import type { GcpPubSubActivityInput } from "../activities/gcp_pubsub";
import type { GcpBigQueryActivityInput } from "../activities/gcp_bigquery";
import type { OracleDbActivityInput } from "../activities/oracle_db";
import type { OciObjectStorageActivityInput } from "../activities/oci_object_storage";
import type { StripeActivityInput } from "../activities/stripe";
import type { GithubActivityInput } from "../activities/github";
import type { DiscordActivityInput } from "../activities/discord";
import type { NotionActivityInput } from "../activities/notion";
import type { SalesforceActivityInput } from "../activities/salesforce";
import type { JiraActivityInput } from "../activities/jira";
import type { MsTeamsActivityInput } from "../activities/ms_teams";
import type { HubspotActivityInput } from "../activities/hubspot";
import type { AirtableActivityInput } from "../activities/airtable";
import type { PagerDutyActivityInput } from "../activities/pagerduty";
import type { GitlabActivityInput } from "../activities/gitlab";
import type { LinearActivityInput } from "../activities/linear";
import type { TelegramActivityInput } from "../activities/telegram";
import type { SendgridActivityInput } from "../activities/sendgrid";
import type { SentryActivityInput } from "../activities/sentry";
import type { ShopifyActivityInput } from "../activities/shopify";
import type { MailchimpActivityInput } from "../activities/mailchimp";
import type { GoogleDriveActivityInput } from "../activities/google_drive";
import type { DropboxActivityInput } from "../activities/dropbox";
import type { DatadogActivityInput } from "../activities/datadog";
import type { PaypalActivityInput } from "../activities/paypal";
import type { SquareActivityInput } from "../activities/square";
import type { ResendActivityInput } from "../activities/resend";
import type { OneDriveActivityInput } from "../activities/onedrive";
import type { BoxActivityInput } from "../activities/box";
import type { CircleCIActivityInput } from "../activities/circleci";
import type { WhatsappActivityInput } from "../activities/whatsapp_business";
import type { PipedriveActivityInput } from "../activities/pipedrive";
import type { CustomerIoActivityInput } from "../activities/customer_io";
import type { KafkaActivityInput } from "../activities/kafka";
import type { NatsActivityInput } from "../activities/nats";
import type { SnowflakeActivityInput } from "../activities/snowflake";
import type { ClickhouseActivityInput } from "../activities/clickhouse";
import type { ElasticsearchActivityInput } from "../activities/elasticsearch";
import type { AiImageActivityInput } from "../activities/ai_image";
import type { AiTranscribeActivityInput } from "../activities/ai_transcribe";
import type { AiTtsActivityInput } from "../activities/ai_tts";
import type { AiEmbedActivityInput } from "../activities/ai_embed";
import type { VectorDbActivityInput } from "../activities/vector_db";

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
  azureBlobActivity(input: AzureBlobActivityInput): Promise<unknown>;
  azureServiceBusActivity(
    input: AzureServiceBusActivityInput,
  ): Promise<unknown>;
  azureCosmosActivity(input: AzureCosmosActivityInput): Promise<unknown>;
  azureKeyVaultActivity(input: AzureKeyVaultActivityInput): Promise<unknown>;
  azureFunctionsActivity(input: AzureFunctionsActivityInput): Promise<unknown>;
  gcpStorageActivity(input: GcpStorageActivityInput): Promise<unknown>;
  gcpPubSubActivity(input: GcpPubSubActivityInput): Promise<unknown>;
  gcpBigQueryActivity(input: GcpBigQueryActivityInput): Promise<unknown>;
  oracleDbActivity(input: OracleDbActivityInput): Promise<unknown>;
  ociObjectStorageActivity(
    input: OciObjectStorageActivityInput,
  ): Promise<unknown>;
  // SaaS Integrations (Phase 2)
  stripeActivity(input: StripeActivityInput): Promise<unknown>;
  githubActivity(input: GithubActivityInput): Promise<unknown>;
  discordActivity(input: DiscordActivityInput): Promise<unknown>;
  notionActivity(input: NotionActivityInput): Promise<unknown>;
  salesforceActivity(input: SalesforceActivityInput): Promise<unknown>;
  jiraActivity(input: JiraActivityInput): Promise<unknown>;
  msTeamsActivity(input: MsTeamsActivityInput): Promise<unknown>;
  hubspotActivity(input: HubspotActivityInput): Promise<unknown>;
  airtableActivity(input: AirtableActivityInput): Promise<unknown>;
  pagerdutyActivity(input: PagerDutyActivityInput): Promise<unknown>;
  gitlabActivity(input: GitlabActivityInput): Promise<unknown>;
  linearActivity(input: LinearActivityInput): Promise<unknown>;
  telegramActivity(input: TelegramActivityInput): Promise<unknown>;
  sendgridActivity(input: SendgridActivityInput): Promise<unknown>;
  sentryActivity(input: SentryActivityInput): Promise<unknown>;
  shopifyActivity(input: ShopifyActivityInput): Promise<unknown>;
  mailchimpActivity(input: MailchimpActivityInput): Promise<unknown>;
  googleDriveActivity(input: GoogleDriveActivityInput): Promise<unknown>;
  dropboxActivity(input: DropboxActivityInput): Promise<unknown>;
  datadogActivity(input: DatadogActivityInput): Promise<unknown>;
  paypalActivity(input: PaypalActivityInput): Promise<unknown>;
  squareActivity(input: SquareActivityInput): Promise<unknown>;
  resendActivity(input: ResendActivityInput): Promise<unknown>;
  onedriveActivity(input: OneDriveActivityInput): Promise<unknown>;
  boxActivity(input: BoxActivityInput): Promise<unknown>;
  circleciActivity(input: CircleCIActivityInput): Promise<unknown>;
  whatsappActivity(input: WhatsappActivityInput): Promise<unknown>;
  pipedriveActivity(input: PipedriveActivityInput): Promise<unknown>;
  customerIoActivity(input: CustomerIoActivityInput): Promise<unknown>;
  // Phase 3: Streaming + Analytics
  kafkaActivity(input: KafkaActivityInput): Promise<unknown>;
  natsActivity(input: NatsActivityInput): Promise<unknown>;
  snowflakeActivity(input: SnowflakeActivityInput): Promise<unknown>;
  clickhouseActivity(input: ClickhouseActivityInput): Promise<unknown>;
  elasticsearchActivity(input: ElasticsearchActivityInput): Promise<unknown>;
  // Phase 4: AI ecosystem
  aiImageActivity(input: AiImageActivityInput): Promise<unknown>;
  aiTranscribeActivity(input: AiTranscribeActivityInput): Promise<unknown>;
  aiTtsActivity(input: AiTtsActivityInput): Promise<unknown>;
  aiEmbedActivity(input: AiEmbedActivityInput): Promise<unknown>;
  vectorDbActivity(input: VectorDbActivityInput): Promise<unknown>;
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
    azureBlobActivity,
    azureServiceBusActivity,
    azureCosmosActivity,
    azureKeyVaultActivity,
    azureFunctionsActivity,
    gcpStorageActivity,
    gcpPubSubActivity,
    gcpBigQueryActivity,
    oracleDbActivity,
    ociObjectStorageActivity,
    stripeActivity,
    githubActivity,
    discordActivity,
    notionActivity,
    salesforceActivity,
    jiraActivity,
    msTeamsActivity,
    hubspotActivity,
    airtableActivity,
    pagerdutyActivity,
    gitlabActivity,
    linearActivity,
    telegramActivity,
    sendgridActivity,
    sentryActivity,
    shopifyActivity,
    mailchimpActivity,
    googleDriveActivity,
    dropboxActivity,
    datadogActivity,
    paypalActivity,
    squareActivity,
    resendActivity,
    onedriveActivity,
    boxActivity,
    circleciActivity,
    whatsappActivity,
    pipedriveActivity,
    customerIoActivity,
    kafkaActivity,
    natsActivity,
    snowflakeActivity,
    clickhouseActivity,
    elasticsearchActivity,
    aiImageActivity,
    aiTranscribeActivity,
    aiTtsActivity,
    aiEmbedActivity,
    vectorDbActivity,
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
          //
          // Special case for "manual" / "Immediate": if no explicit trigger
          // payload was passed on /executions/start, use the configured
          // static value (coerced by its valueType). An explicit payload
          // always wins so SDK callers can override from the outside.
          // ------------------------------------------------------------------
          case "manual": {
            const hasExplicit =
              triggerPayload &&
              typeof triggerPayload === "object" &&
              Object.keys(triggerPayload as Record<string, unknown>).length > 0;
            if (hasExplicit) {
              nodeOutput = triggerPayload;
            } else {
              const cfg = node.config as {
                value?: string;
                valueType?: "string" | "number" | "boolean" | "json";
              };
              const raw = cfg.value;
              if (raw !== undefined && raw !== "") {
                const type = cfg.valueType ?? "json";
                if (type === "string") {
                  nodeOutput = raw;
                } else if (type === "number") {
                  const n = Number(raw);
                  nodeOutput = Number.isFinite(n) ? n : raw;
                } else if (type === "boolean") {
                  nodeOutput = raw.trim().toLowerCase() === "true";
                } else {
                  try {
                    nodeOutput = JSON.parse(raw);
                  } catch {
                    nodeOutput = raw;
                  }
                }
              } else {
                nodeOutput = triggerPayload;
              }
            }
            outgoingHandles = [""];
            break;
          }
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
          // Group — canvas-only container. No execution semantics: pass any
          // upstream output through unchanged (groups have no handles in the
          // UI, so this branch is defensive — reached only if a malformed
          // template wires an edge to a group).
          // ------------------------------------------------------------------
          case "group": {
            nodeOutput =
              incomingFrom !== undefined
                ? (nodeOutputs[incomingFrom] ?? {})
                : {};
            outgoingHandles = [""];
            break;
          }

          // ------------------------------------------------------------------
          // Custom Builder — user-authored reusable node kind. The node's
          // config carries a snapshot of the template (code + handles +
          // schemas) so execution is fully self-contained, independent of
          // what the org's current template library looks like.
          // ------------------------------------------------------------------
          case "custom_builder": {
            const cfg = node.config as CustomBuilderConfig;

            // Resolve {{nodeId.field}} tokens in any string-valued templateInputs.
            const resolvedFields: Record<string, unknown> = {};
            for (const [k, v] of Object.entries(cfg.templateInputs ?? {})) {
              resolvedFields[k] =
                typeof v === "string" ? interpolate(v, nodeOutputs) : v;
            }

            let raw: unknown;
            if (cfg.executionMode === "sandbox") {
              // The sandbox auto-runner invokes `run(global.input)` and sends
              // its return value back via `setResult`. We pass templateInputs
              // under `fields` and upstream node outputs under `context`.
              const sandboxOut = (await runCustomCodeActivity({
                config: {
                  code: cfg.code ?? "",
                  timeoutMs: cfg.timeoutMs,
                  memoryMb: cfg.memoryMb,
                },
                context: {
                  fields: resolvedFields,
                  context: nodeOutputs,
                },
              })) as { result: unknown; logs: string[] };
              // Unwrap to the user's `run()` return so downstream nodes can
              // access fields directly as `{{nodeId.slug}}` etc.
              raw = sandboxOut?.result;
            } else {
              // HTTP mode: render cfg.httpTemplate into an HttpRequestConfig
              // and call the existing httpRequestActivity. `fields` are merged
              // into the interpolation context so users can write
              // {{fields.url}} / {{fields.channel}} in URL, headers, and body.
              const tpl = cfg.httpTemplate;
              if (!tpl) {
                throw new Error(
                  "Custom node is in http mode but httpTemplate is missing",
                );
              }

              let headers = [...(tpl.headers ?? [])];
              if (cfg.credentialRef?.credentialId) {
                const cred = await resolveCredentialActivity(
                  cfg.credentialRef.credentialId,
                );
                const authHeader = cred.token
                  ? { key: "Authorization", value: `Bearer ${cred.token}` }
                  : cred.username && cred.password
                    ? {
                        key: "Authorization",
                        value: `Basic ${Buffer.from(
                          `${cred.username}:${cred.password}`,
                        ).toString("base64")}`,
                      }
                    : cred.headerValue
                      ? {
                          key: cred.headerName ?? "X-Api-Key",
                          value: cred.headerValue,
                        }
                      : null;
                if (authHeader) headers.push(authHeader);
              }

              const httpCfg: HttpRequestConfig = {
                method: (tpl.method as HttpRequestConfig["method"]) ?? "GET",
                url: tpl.url,
                headers,
                queryParams: tpl.queryParams ?? [],
                body: tpl.bodyTemplate,
                failOnError: true,
                timeoutMs: cfg.timeoutMs ?? 30_000,
              };

              // Merge resolved templateInputs into the interpolation context
              // under the `fields` key so {{fields.X}} works.
              raw = await httpRequestActivity({
                config: httpCfg,
                context: { ...nodeOutputs, fields: resolvedFields },
              });
            }

            // Envelope routing (shared across modes): a return value shaped
            // { __handle: "<outputId>", value: ... } picks a specific output
            // handle; otherwise route to the first declared output.
            const envelope = raw as {
              __handle?: string;
              value?: unknown;
            } | null;
            const defaultHandle = cfg.outputs[0]?.id ?? "";
            if (
              envelope &&
              typeof envelope === "object" &&
              "__handle" in envelope &&
              cfg.outputs.length > 1 &&
              cfg.outputs.some((h) => h.id === envelope.__handle)
            ) {
              nodeOutput = envelope.value;
              outgoingHandles = [envelope.__handle as string];
            } else {
              nodeOutput = raw;
              outgoingHandles = [defaultHandle];
            }
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
            // Inject an `input` alias pointing at the immediately-upstream
            // node's output so common template shorthands like
            // `{{input.content}}` resolve without forcing users to hard-
            // code the upstream node's id. The alias doesn't shadow a real
            // node called "input" (none of the built-in kinds use that id).
            const ctx: Record<string, unknown> =
              incomingFrom !== undefined
                ? { ...nodeOutputs, input: nodeOutputs[incomingFrom] ?? {} }
                : nodeOutputs;
            const body = cfg.body ? interpolate(cfg.body, ctx) : undefined;
            const headers: Record<string, string> = {};
            for (const h of cfg.headers ?? []) {
              headers[interpolate(h.key, ctx)] = interpolate(h.value, ctx);
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

          // ------------------------------------------------------------------
          // Azure Blob Storage
          // ------------------------------------------------------------------
          case "azure_blob": {
            const cfg = node.config as AzureBlobConfig;
            let resolvedCredentials:
              | {
                  connectionString?: string;
                  accountName?: string;
                  accountKey?: string;
                  sasToken?: string;
                }
              | undefined;
            if (cfg.credentialId) {
              const cred = await resolveCredentialActivity(cfg.credentialId);
              resolvedCredentials = {
                connectionString: cred.connectionString,
                accountName: cred.accountName,
                accountKey: cred.accountKey,
                sasToken: cred.sasToken,
              };
            }
            nodeOutput = await azureBlobActivity({
              config: cfg,
              context: nodeOutputs,
              resolvedCredentials,
            });
            outgoingHandles = [""];
            break;
          }

          // ------------------------------------------------------------------
          // Azure Service Bus
          // ------------------------------------------------------------------
          case "azure_service_bus": {
            const cfg = node.config as AzureServiceBusConfig;
            const cred = cfg.credentialId
              ? await resolveCredentialActivity(cfg.credentialId)
              : {};
            nodeOutput = await azureServiceBusActivity({
              config: cfg,
              context: nodeOutputs,
              resolvedCredentials: { connectionString: cred.connectionString },
            });
            outgoingHandles = [""];
            break;
          }

          // ------------------------------------------------------------------
          // Azure Cosmos DB
          // ------------------------------------------------------------------
          case "azure_cosmos_db": {
            const cfg = node.config as AzureCosmosConfig;
            const cred = cfg.credentialId
              ? await resolveCredentialActivity(cfg.credentialId)
              : {};
            nodeOutput = await azureCosmosActivity({
              config: cfg,
              context: nodeOutputs,
              resolvedCredentials: {
                connectionString: cred.connectionString,
                cosmosEndpoint: cred.cosmosEndpoint,
                cosmosKey: cred.cosmosKey,
              },
            });
            outgoingHandles = [""];
            break;
          }

          // ------------------------------------------------------------------
          // Azure Key Vault
          // ------------------------------------------------------------------
          case "azure_key_vault": {
            const cfg = node.config as AzureKeyVaultConfig;
            const cred = cfg.credentialId
              ? await resolveCredentialActivity(cfg.credentialId)
              : {};
            nodeOutput = await azureKeyVaultActivity({
              config: cfg,
              context: nodeOutputs,
              resolvedCredentials: {
                tenantId: cred.tenantId,
                clientId: cred.clientId,
                clientSecret: cred.clientSecret,
                vaultUrl: cred.vaultUrl,
              },
            });
            outgoingHandles = [""];
            break;
          }

          // ------------------------------------------------------------------
          // Azure Functions
          // ------------------------------------------------------------------
          case "azure_functions": {
            const cfg = node.config as AzureFunctionsConfig;
            const cred = cfg.credentialId
              ? await resolveCredentialActivity(cfg.credentialId)
              : {};
            nodeOutput = await azureFunctionsActivity({
              config: cfg,
              context: nodeOutputs,
              resolvedCredentials: { functionKey: cred.functionKey },
            });
            outgoingHandles = [""];
            break;
          }

          // ------------------------------------------------------------------
          // GCP Storage
          // ------------------------------------------------------------------
          case "gcp_storage": {
            const cfg = node.config as GcpStorageConfig;
            const cred = cfg.credentialId
              ? await resolveCredentialActivity(cfg.credentialId)
              : {};
            nodeOutput = await gcpStorageActivity({
              config: cfg,
              context: nodeOutputs,
              resolvedCredentials: {
                serviceAccountJson: cred.serviceAccountJson,
                projectId: cred.projectId,
              },
            });
            outgoingHandles = [""];
            break;
          }

          // ------------------------------------------------------------------
          // GCP Pub/Sub
          // ------------------------------------------------------------------
          case "gcp_pubsub": {
            const cfg = node.config as GcpPubSubConfig;
            const cred = cfg.credentialId
              ? await resolveCredentialActivity(cfg.credentialId)
              : {};
            nodeOutput = await gcpPubSubActivity({
              config: cfg,
              context: nodeOutputs,
              resolvedCredentials: {
                serviceAccountJson: cred.serviceAccountJson,
                projectId: cred.projectId,
              },
            });
            outgoingHandles = [""];
            break;
          }

          // ------------------------------------------------------------------
          // GCP BigQuery
          // ------------------------------------------------------------------
          case "gcp_bigquery": {
            const cfg = node.config as GcpBigQueryConfig;
            const cred = cfg.credentialId
              ? await resolveCredentialActivity(cfg.credentialId)
              : {};
            nodeOutput = await gcpBigQueryActivity({
              config: cfg,
              context: nodeOutputs,
              resolvedCredentials: {
                serviceAccountJson: cred.serviceAccountJson,
                projectId: cred.projectId,
              },
            });
            outgoingHandles = [""];
            break;
          }

          // ------------------------------------------------------------------
          // Oracle Database
          // ------------------------------------------------------------------
          case "oracle_db": {
            const cfg = node.config as OracleDbConfig;
            const cred = cfg.credentialId
              ? await resolveCredentialActivity(cfg.credentialId)
              : {};
            nodeOutput = await oracleDbActivity({
              config: cfg,
              context: nodeOutputs,
              resolvedCredentials: {
                user: cred.user,
                password: cred.password,
                connectString: cred.connectString,
                walletLocation: cred.walletLocation,
                walletPassword: cred.walletPassword,
              },
            });
            outgoingHandles = [""];
            break;
          }

          // ------------------------------------------------------------------
          // OCI Object Storage
          // ------------------------------------------------------------------
          case "oci_object_storage": {
            const cfg = node.config as OciObjectStorageConfig;
            const cred = cfg.credentialId
              ? await resolveCredentialActivity(cfg.credentialId)
              : {};
            nodeOutput = await ociObjectStorageActivity({
              config: cfg,
              context: nodeOutputs,
              resolvedCredentials: {
                tenancy: cred.tenancy,
                user: cred.user,
                fingerprint: cred.fingerprint,
                privateKey: cred.privateKey,
                region: cred.region,
                namespace: cred.namespace,
              },
            });
            outgoingHandles = [""];
            break;
          }

          // ------------------------------------------------------------------
          // Stripe
          // ------------------------------------------------------------------
          case "stripe": {
            const cfg = node.config as StripeConfig;
            const cred = cfg.credentialId
              ? await resolveCredentialActivity(cfg.credentialId)
              : {};
            nodeOutput = await stripeActivity({
              config: cfg,
              context: nodeOutputs,
              resolvedCredentials: { apiKey: cred.apiKey },
            });
            outgoingHandles = [""];
            break;
          }

          // ------------------------------------------------------------------
          // GitHub
          // ------------------------------------------------------------------
          case "github": {
            const cfg = node.config as GithubConfig;
            const cred = cfg.credentialId
              ? await resolveCredentialActivity(cfg.credentialId)
              : {};
            nodeOutput = await githubActivity({
              config: cfg,
              context: nodeOutputs,
              resolvedCredentials: { token: cred.token },
            });
            outgoingHandles = [""];
            break;
          }

          // ------------------------------------------------------------------
          // Discord
          // ------------------------------------------------------------------
          case "discord": {
            const cfg = node.config as DiscordConfig;
            const cred = cfg.credentialId
              ? await resolveCredentialActivity(cfg.credentialId)
              : {};
            nodeOutput = await discordActivity({
              config: cfg,
              context: nodeOutputs,
              resolvedCredentials: {
                webhookUrl: cred.webhookUrl,
                botToken: cred.botToken,
              },
            });
            outgoingHandles = [""];
            break;
          }

          // ------------------------------------------------------------------
          // Notion
          // ------------------------------------------------------------------
          case "notion": {
            const cfg = node.config as NotionConfig;
            const cred = cfg.credentialId
              ? await resolveCredentialActivity(cfg.credentialId)
              : {};
            nodeOutput = await notionActivity({
              config: cfg,
              context: nodeOutputs,
              resolvedCredentials: { token: cred.token },
            });
            outgoingHandles = [""];
            break;
          }

          // ------------------------------------------------------------------
          // Salesforce
          // ------------------------------------------------------------------
          case "salesforce": {
            const cfg = node.config as SalesforceConfig;
            const cred = cfg.credentialId
              ? await resolveCredentialActivity(cfg.credentialId)
              : {};
            nodeOutput = await salesforceActivity({
              config: cfg,
              context: nodeOutputs,
              resolvedCredentials: {
                loginUrl: cred.loginUrl,
                username: cred.username,
                password: cred.password,
                securityToken: cred.securityToken,
                instanceUrl: cred.instanceUrl,
                accessToken: cred.accessToken,
              },
            });
            outgoingHandles = [""];
            break;
          }

          // ------------------------------------------------------------------
          // Jira
          // ------------------------------------------------------------------
          case "jira": {
            const cfg = node.config as JiraConfig;
            const cred = cfg.credentialId
              ? await resolveCredentialActivity(cfg.credentialId)
              : {};
            nodeOutput = await jiraActivity({
              config: cfg,
              context: nodeOutputs,
              resolvedCredentials: {
                baseUrl: cred.baseUrl,
                email: cred.email,
                apiToken: cred.apiToken,
              },
            });
            outgoingHandles = [""];
            break;
          }

          // ------------------------------------------------------------------
          // MS Teams
          // ------------------------------------------------------------------
          case "ms_teams": {
            const cfg = node.config as MsTeamsConfig;
            const cred = cfg.credentialId
              ? await resolveCredentialActivity(cfg.credentialId)
              : {};
            nodeOutput = await msTeamsActivity({
              config: cfg,
              context: nodeOutputs,
              resolvedCredentials: { webhookUrl: cred.webhookUrl },
            });
            outgoingHandles = [""];
            break;
          }

          // ------------------------------------------------------------------
          // HubSpot
          // ------------------------------------------------------------------
          case "hubspot": {
            const cfg = node.config as HubspotConfig;
            const cred = cfg.credentialId
              ? await resolveCredentialActivity(cfg.credentialId)
              : {};
            nodeOutput = await hubspotActivity({
              config: cfg,
              context: nodeOutputs,
              resolvedCredentials: {
                privateAppToken: cred.privateAppToken,
                apiKey: cred.apiKey,
              },
            });
            outgoingHandles = [""];
            break;
          }

          // ------------------------------------------------------------------
          // Airtable
          // ------------------------------------------------------------------
          case "airtable": {
            const cfg = node.config as AirtableConfig;
            const cred = cfg.credentialId
              ? await resolveCredentialActivity(cfg.credentialId)
              : {};
            nodeOutput = await airtableActivity({
              config: cfg,
              context: nodeOutputs,
              resolvedCredentials: { apiKey: cred.apiKey },
            });
            outgoingHandles = [""];
            break;
          }

          // ------------------------------------------------------------------
          // PagerDuty
          // ------------------------------------------------------------------
          case "pagerduty": {
            const cfg = node.config as PagerDutyConfig;
            const cred = cfg.credentialId
              ? await resolveCredentialActivity(cfg.credentialId)
              : {};
            nodeOutput = await pagerdutyActivity({
              config: cfg,
              context: nodeOutputs,
              resolvedCredentials: {
                routingKey: cred.routingKey,
                apiToken: cred.apiToken,
              },
            });
            outgoingHandles = [""];
            break;
          }

          // ------------------------------------------------------------------
          // GitLab
          // ------------------------------------------------------------------
          case "gitlab": {
            const cfg = node.config as GitlabConfig;
            const cred = cfg.credentialId
              ? await resolveCredentialActivity(cfg.credentialId)
              : {};
            nodeOutput = await gitlabActivity({
              config: cfg,
              context: nodeOutputs,
              resolvedCredentials: {
                baseUrl: cred.baseUrl,
                token: cred.token,
              },
            });
            outgoingHandles = [""];
            break;
          }

          // ------------------------------------------------------------------
          // Linear
          // ------------------------------------------------------------------
          case "linear": {
            const cfg = node.config as LinearConfig;
            const cred = cfg.credentialId
              ? await resolveCredentialActivity(cfg.credentialId)
              : {};
            nodeOutput = await linearActivity({
              config: cfg,
              context: nodeOutputs,
              resolvedCredentials: { apiKey: cred.apiKey },
            });
            outgoingHandles = [""];
            break;
          }

          // ------------------------------------------------------------------
          // Telegram
          // ------------------------------------------------------------------
          case "telegram": {
            const cfg = node.config as TelegramConfig;
            const cred = cfg.credentialId
              ? await resolveCredentialActivity(cfg.credentialId)
              : {};
            nodeOutput = await telegramActivity({
              config: cfg,
              context: nodeOutputs,
              resolvedCredentials: { botToken: cred.botToken },
            });
            outgoingHandles = [""];
            break;
          }

          // ------------------------------------------------------------------
          // SendGrid
          // ------------------------------------------------------------------
          case "sendgrid": {
            const cfg = node.config as SendgridConfig;
            const cred = cfg.credentialId
              ? await resolveCredentialActivity(cfg.credentialId)
              : {};
            nodeOutput = await sendgridActivity({
              config: cfg,
              context: nodeOutputs,
              resolvedCredentials: { apiKey: cred.apiKey },
            });
            outgoingHandles = [""];
            break;
          }

          // ------------------------------------------------------------------
          // Sentry
          // ------------------------------------------------------------------
          case "sentry": {
            const cfg = node.config as SentryConfig;
            const cred = cfg.credentialId
              ? await resolveCredentialActivity(cfg.credentialId)
              : {};
            nodeOutput = await sentryActivity({
              config: cfg,
              context: nodeOutputs,
              resolvedCredentials: {
                dsn: cred.dsn,
                authToken: cred.authToken,
                organizationSlug: cred.organizationSlug,
                projectSlug: cred.projectSlug,
              },
            });
            outgoingHandles = [""];
            break;
          }

          // ------------------------------------------------------------------
          // Shopify
          // ------------------------------------------------------------------
          case "shopify": {
            const cfg = node.config as ShopifyConfig;
            const cred = cfg.credentialId
              ? await resolveCredentialActivity(cfg.credentialId)
              : {};
            nodeOutput = await shopifyActivity({
              config: cfg,
              context: nodeOutputs,
              resolvedCredentials: {
                shopDomain: cred.shopDomain,
                accessToken: cred.accessToken,
              },
            });
            outgoingHandles = [""];
            break;
          }

          // ------------------------------------------------------------------
          // Mailchimp
          // ------------------------------------------------------------------
          case "mailchimp": {
            const cfg = node.config as MailchimpConfig;
            const cred = cfg.credentialId
              ? await resolveCredentialActivity(cfg.credentialId)
              : {};
            nodeOutput = await mailchimpActivity({
              config: cfg,
              context: nodeOutputs,
              resolvedCredentials: { apiKey: cred.apiKey },
            });
            outgoingHandles = [""];
            break;
          }

          // ------------------------------------------------------------------
          // Google Drive
          // ------------------------------------------------------------------
          case "google_drive": {
            const cfg = node.config as GoogleDriveConfig;
            const cred = cfg.credentialId
              ? await resolveCredentialActivity(cfg.credentialId)
              : {};
            nodeOutput = await googleDriveActivity({
              config: cfg,
              context: nodeOutputs,
              resolvedCredentials: {
                serviceAccountJson: cred.serviceAccountJson,
                accessToken: cred.accessToken,
              },
            });
            outgoingHandles = [""];
            break;
          }

          // ------------------------------------------------------------------
          // Dropbox
          // ------------------------------------------------------------------
          case "dropbox": {
            const cfg = node.config as DropboxConfig;
            const cred = cfg.credentialId
              ? await resolveCredentialActivity(cfg.credentialId)
              : {};
            nodeOutput = await dropboxActivity({
              config: cfg,
              context: nodeOutputs,
              resolvedCredentials: { accessToken: cred.accessToken },
            });
            outgoingHandles = [""];
            break;
          }

          // ------------------------------------------------------------------
          // Datadog
          // ------------------------------------------------------------------
          case "datadog": {
            const cfg = node.config as DatadogConfig;
            const cred = cfg.credentialId
              ? await resolveCredentialActivity(cfg.credentialId)
              : {};
            nodeOutput = await datadogActivity({
              config: cfg,
              context: nodeOutputs,
              resolvedCredentials: {
                apiKey: cred.apiKey,
                appKey: cred.appKey,
                site: cred.site,
              },
            });
            outgoingHandles = [""];
            break;
          }

          // ------------------------------------------------------------------
          // PayPal
          // ------------------------------------------------------------------
          case "paypal": {
            const cfg = node.config as PaypalConfig;
            const cred = cfg.credentialId
              ? await resolveCredentialActivity(cfg.credentialId)
              : {};
            nodeOutput = await paypalActivity({
              config: cfg,
              context: nodeOutputs,
              resolvedCredentials: {
                clientId: cred.clientId,
                clientSecret: cred.clientSecret,
                environment: cred.environment,
              },
            });
            outgoingHandles = [""];
            break;
          }

          // ------------------------------------------------------------------
          // Square
          // ------------------------------------------------------------------
          case "square": {
            const cfg = node.config as SquareConfig;
            const cred = cfg.credentialId
              ? await resolveCredentialActivity(cfg.credentialId)
              : {};
            nodeOutput = await squareActivity({
              config: cfg,
              context: nodeOutputs,
              resolvedCredentials: {
                accessToken: cred.accessToken,
                environment: cred.environment,
              },
            });
            outgoingHandles = [""];
            break;
          }

          // ------------------------------------------------------------------
          // Resend
          // ------------------------------------------------------------------
          case "resend": {
            const cfg = node.config as ResendConfig;
            const cred = cfg.credentialId
              ? await resolveCredentialActivity(cfg.credentialId)
              : {};
            nodeOutput = await resendActivity({
              config: cfg,
              context: nodeOutputs,
              resolvedCredentials: { apiKey: cred.apiKey },
            });
            outgoingHandles = [""];
            break;
          }

          // ------------------------------------------------------------------
          // OneDrive
          // ------------------------------------------------------------------
          case "onedrive": {
            const cfg = node.config as OneDriveConfig;
            const cred = cfg.credentialId
              ? await resolveCredentialActivity(cfg.credentialId)
              : {};
            nodeOutput = await onedriveActivity({
              config: cfg,
              context: nodeOutputs,
              resolvedCredentials: { accessToken: cred.accessToken },
            });
            outgoingHandles = [""];
            break;
          }

          // ------------------------------------------------------------------
          // Box
          // ------------------------------------------------------------------
          case "box": {
            const cfg = node.config as BoxConfig;
            const cred = cfg.credentialId
              ? await resolveCredentialActivity(cfg.credentialId)
              : {};
            nodeOutput = await boxActivity({
              config: cfg,
              context: nodeOutputs,
              resolvedCredentials: { accessToken: cred.accessToken },
            });
            outgoingHandles = [""];
            break;
          }

          // ------------------------------------------------------------------
          // CircleCI
          // ------------------------------------------------------------------
          case "circleci": {
            const cfg = node.config as CircleCIConfig;
            const cred = cfg.credentialId
              ? await resolveCredentialActivity(cfg.credentialId)
              : {};
            nodeOutput = await circleciActivity({
              config: cfg,
              context: nodeOutputs,
              resolvedCredentials: { token: cred.token },
            });
            outgoingHandles = [""];
            break;
          }

          // ------------------------------------------------------------------
          // WhatsApp Business
          // ------------------------------------------------------------------
          case "whatsapp_business": {
            const cfg = node.config as WhatsappConfig;
            const cred = cfg.credentialId
              ? await resolveCredentialActivity(cfg.credentialId)
              : {};
            nodeOutput = await whatsappActivity({
              config: cfg,
              context: nodeOutputs,
              resolvedCredentials: {
                accessToken: cred.accessToken,
                phoneNumberId: cred.phoneNumberId,
              },
            });
            outgoingHandles = [""];
            break;
          }

          // ------------------------------------------------------------------
          // Pipedrive
          // ------------------------------------------------------------------
          case "pipedrive": {
            const cfg = node.config as PipedriveConfig;
            const cred = cfg.credentialId
              ? await resolveCredentialActivity(cfg.credentialId)
              : {};
            nodeOutput = await pipedriveActivity({
              config: cfg,
              context: nodeOutputs,
              resolvedCredentials: {
                apiToken: cred.apiToken,
                companyDomain: cred.companyDomain,
              },
            });
            outgoingHandles = [""];
            break;
          }

          // ------------------------------------------------------------------
          // Customer.io
          // ------------------------------------------------------------------
          case "customer_io": {
            const cfg = node.config as CustomerIoConfig;
            const cred = cfg.credentialId
              ? await resolveCredentialActivity(cfg.credentialId)
              : {};
            nodeOutput = await customerIoActivity({
              config: cfg,
              context: nodeOutputs,
              resolvedCredentials: {
                siteId: cred.siteId,
                apiKey: cred.apiKey,
                appApiKey: cred.appApiKey,
                region: cred.region,
              },
            });
            outgoingHandles = [""];
            break;
          }

          // ------------------------------------------------------------------
          // Kafka
          // ------------------------------------------------------------------
          case "kafka": {
            const cfg = node.config as KafkaConfig;
            const cred = cfg.credentialId
              ? await resolveCredentialActivity(cfg.credentialId)
              : {};
            nodeOutput = await kafkaActivity({
              config: cfg,
              context: nodeOutputs,
              resolvedCredentials: {
                brokers: cred.brokers,
                clientId: cred.clientId,
                ssl: cred.ssl,
                sasl: cred.sasl,
                saslMechanism: cred.saslMechanism,
                username: cred.username,
                password: cred.password,
              },
            });
            outgoingHandles = [""];
            break;
          }

          // ------------------------------------------------------------------
          // NATS
          // ------------------------------------------------------------------
          case "nats": {
            const cfg = node.config as NatsConfig;
            const cred = cfg.credentialId
              ? await resolveCredentialActivity(cfg.credentialId)
              : {};
            nodeOutput = await natsActivity({
              config: cfg,
              context: nodeOutputs,
              resolvedCredentials: {
                servers: cred.servers,
                user: cred.user,
                pass: cred.pass,
                token: cred.token,
              },
            });
            outgoingHandles = [""];
            break;
          }

          // ------------------------------------------------------------------
          // Snowflake
          // ------------------------------------------------------------------
          case "snowflake": {
            const cfg = node.config as SnowflakeConfig;
            const cred = cfg.credentialId
              ? await resolveCredentialActivity(cfg.credentialId)
              : {};
            nodeOutput = await snowflakeActivity({
              config: cfg,
              context: nodeOutputs,
              resolvedCredentials: {
                account: cred.account,
                username: cred.username,
                password: cred.password,
                privateKey: cred.privateKey,
                database: cred.database,
                schema: cred.schema,
                warehouse: cred.warehouse,
                role: cred.role,
              },
            });
            outgoingHandles = [""];
            break;
          }

          // ------------------------------------------------------------------
          // ClickHouse
          // ------------------------------------------------------------------
          case "clickhouse": {
            const cfg = node.config as ClickhouseConfig;
            const cred = cfg.credentialId
              ? await resolveCredentialActivity(cfg.credentialId)
              : {};
            nodeOutput = await clickhouseActivity({
              config: cfg,
              context: nodeOutputs,
              resolvedCredentials: {
                url: cred.url,
                username: cred.username,
                password: cred.password,
                database: cred.database,
              },
            });
            outgoingHandles = [""];
            break;
          }

          // ------------------------------------------------------------------
          // Elasticsearch
          // ------------------------------------------------------------------
          case "elasticsearch": {
            const cfg = node.config as ElasticsearchConfig;
            const cred = cfg.credentialId
              ? await resolveCredentialActivity(cfg.credentialId)
              : {};
            nodeOutput = await elasticsearchActivity({
              config: cfg,
              context: nodeOutputs,
              resolvedCredentials: {
                node: cred.node,
                apiKey: cred.apiKey,
                username: cred.username,
                password: cred.password,
                ca: cred.ca,
              },
            });
            outgoingHandles = [""];
            break;
          }

          // ------------------------------------------------------------------
          // AI: Image generation
          // ------------------------------------------------------------------
          case "ai_image": {
            const cfg = node.config as AiImageConfig;
            const cred = cfg.credentialId
              ? await resolveCredentialActivity(cfg.credentialId)
              : {};
            nodeOutput = await aiImageActivity({
              config: cfg,
              context: nodeOutputs,
              resolvedCredentials: { apiKey: cred.apiKey },
            });
            outgoingHandles = [""];
            break;
          }

          // ------------------------------------------------------------------
          // AI: Transcribe (speech-to-text)
          // ------------------------------------------------------------------
          case "ai_transcribe": {
            const cfg = node.config as AiTranscribeConfig;
            const cred = cfg.credentialId
              ? await resolveCredentialActivity(cfg.credentialId)
              : {};
            nodeOutput = await aiTranscribeActivity({
              config: cfg,
              context: nodeOutputs,
              resolvedCredentials: { apiKey: cred.apiKey },
            });
            outgoingHandles = [""];
            break;
          }

          // ------------------------------------------------------------------
          // AI: TTS (text-to-speech)
          // ------------------------------------------------------------------
          case "ai_tts": {
            const cfg = node.config as AiTtsConfig;
            const cred = cfg.credentialId
              ? await resolveCredentialActivity(cfg.credentialId)
              : {};
            nodeOutput = await aiTtsActivity({
              config: cfg,
              context: nodeOutputs,
              resolvedCredentials: { apiKey: cred.apiKey },
            });
            outgoingHandles = [""];
            break;
          }

          // ------------------------------------------------------------------
          // AI: Embeddings
          // ------------------------------------------------------------------
          case "ai_embed": {
            const cfg = node.config as AiEmbedConfig;
            const cred = cfg.credentialId
              ? await resolveCredentialActivity(cfg.credentialId)
              : {};
            nodeOutput = await aiEmbedActivity({
              config: cfg,
              context: nodeOutputs,
              resolvedCredentials: {
                apiKey: cred.apiKey,
                apiToken: cred.apiToken,
              },
            });
            outgoingHandles = [""];
            break;
          }

          // ------------------------------------------------------------------
          // Vector DB (Pinecone / Weaviate / Qdrant)
          // ------------------------------------------------------------------
          case "vector_db": {
            const cfg = node.config as VectorDbConfig;
            const cred = cfg.credentialId
              ? await resolveCredentialActivity(cfg.credentialId)
              : {};
            nodeOutput = await vectorDbActivity({
              config: cfg,
              context: nodeOutputs,
              resolvedCredentials: {
                apiKey: cred.apiKey,
                indexHost: cred.indexHost,
                url: cred.url,
              },
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

    // Scan all completed nodes; keep overwriting so the last terminal
    // output node wins (trigger_output OR response). Webhook callers need
    // the Response node's data (statusCode / body / headers) to surface
    // back out of the Temporal workflow so the HTTP handler can replay it
    // to the external caller. Previously only `_isTriggerOutput` was
    // promoted — a webhook-triggered workflow's Response node landed in
    // nodeOutputs but was invisible to the webhook handler, which then
    // fell back to `{received: true}` regardless of what the workflow
    // actually produced.
    for (const completedNodeId of completedNodes) {
      const out = nodeOutputs[completedNodeId] as
        | Record<string, unknown>
        | undefined;
      if (out?._isTriggerOutput) {
        finalOutput = (out.data as Record<string, unknown>) ?? {};
      } else if (out?._isWebhookResponse) {
        // Pass the whole envelope through; the webhook handler unwraps it.
        finalOutput = out;
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
