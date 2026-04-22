// =============================================================================
// Workflow Types — shared between backend, workers, and frontend
// =============================================================================

export type NodeKind =
  // ── Triggers ────────────────────────────────────────────────────────────────
  | "manual"
  | "webhook"
  | "cron"
  | "mqtt_trigger"
  | "external_trigger"
  | "trigger_output"
  /** @deprecated Use subworkflow_call instead */
  | "workflow_trigger_in"
  /** @deprecated Use subworkflow_call instead */
  | "workflow_trigger_out"
  // ── Subflow I/O (only appears inside subworkflow templates) ──────────────────
  | "subflow_input"
  | "subflow_output"
  // ── Logical ─────────────────────────────────────────────────────────────────
  | "if_else"
  | "switch"
  | "delay"
  | "merge"
  | "stop"
  | "loop"
  // ── Utilities ───────────────────────────────────────────────────────────────
  | "http_request"
  | "data_mapper"
  | "json_parser"
  | "html_template"
  | "crypto_hash"
  | "date_formatter"
  | "base64"
  | "subworkflow_call"
  | "response"
  // ── Data & Storage ───────────────────────────────────────────────────────────
  | "postgres_query"
  | "mysql"
  | "mongodb"
  | "redis"
  | "s3_bucket"
  | "mariadb"
  | "mssql"
  | "google_sheets"
  // ── Communication ────────────────────────────────────────────────────────────
  | "rabbitmq"
  | "send_email"
  | "slack"
  | "ssh_terminal"
  | "twilio_sms"
  | "twilio_email"
  | "firebase_push"
  | "apns_push"
  // ── AI Agents ────────────────────────────────────────────────────────────────
  | "llm_prompt"
  | "ai_agent"
  // ── Code ─────────────────────────────────────────────────────────────────────
  | "js_runner"
  | "ts_runner"
  | "custom_code"
  | "custom_builder"
  | "python_runner"
  | "debug"
  // ── Canvas-only (no execution semantics) ─────────────────────────────────────
  | "group"
  // ── AWS Cloud ────────────────────────────────────────────────────────────────
  | "aws_lambda"
  | "aws_sqs"
  | "aws_sns"
  | "aws_dynamodb"
  | "aws_ses"
  | "aws_secrets_manager"
  | "aws_ssm"
  | "aws_eventbridge"
  | "aws_step_functions"
  // ── Azure Cloud ──────────────────────────────────────────────────────────────
  | "azure_blob"
  | "azure_service_bus"
  | "azure_cosmos_db"
  | "azure_key_vault"
  | "azure_functions"
  // ── Google Cloud ─────────────────────────────────────────────────────────────
  | "gcp_storage"
  | "gcp_pubsub"
  | "gcp_bigquery"
  // ── Oracle Cloud ─────────────────────────────────────────────────────────────
  | "oracle_db"
  | "oci_object_storage"
  // ── SaaS Integrations (Phase 2) ──────────────────────────────────────────────
  | "stripe"
  | "github"
  | "discord"
  | "notion"
  | "salesforce"
  | "jira"
  | "ms_teams"
  | "hubspot"
  | "airtable"
  | "pagerduty"
  | "gitlab"
  | "linear"
  | "telegram"
  | "sendgrid"
  | "sentry"
  | "shopify"
  | "mailchimp"
  | "google_drive"
  | "dropbox"
  | "datadog"
  | "paypal"
  | "square"
  | "resend"
  | "onedrive"
  | "box"
  | "circleci"
  | "whatsapp_business"
  | "pipedrive"
  | "customer_io"
  // ── Phase 3: Streaming + Analytics natives ───────────────────────────────────
  | "kafka"
  | "nats"
  | "snowflake"
  | "clickhouse"
  | "elasticsearch"
  // ── Phase 4: AI ecosystem ────────────────────────────────────────────────────
  | "ai_image"
  | "ai_transcribe"
  | "ai_tts"
  | "ai_embed"
  | "vector_db";

// =============================================================================
// Trigger node configs
// =============================================================================

// ─── Manual / Immediate trigger ──────────────────────────────────────────────
//
// Runs the workflow immediately (on "Run" from the UI or via the SDK). An
// explicit `triggerPayload` on the API call always wins; otherwise the
// configured `value` is coerced by `valueType` and used as the trigger
// payload. Useful for parameterising a workflow with a static test input.

export type ManualTriggerValueType = "string" | "number" | "boolean" | "json";

export interface ManualTriggerConfig {
  /** Raw string value entered in the form. Coerced to `valueType` at runtime. */
  value?: string;
  /** How to parse `value`. Default "json" preserves object/array payloads. */
  valueType?: ManualTriggerValueType;
}

// ─── Webhook auth ────────────────────────────────────────────────────────────

export interface WebhookAuthNone {
  type: "none";
}

export interface WebhookAuthHmac {
  type: "hmac";
  /** HMAC-SHA256 signing secret */
  secret: string;
}

export interface WebhookAuthBasic {
  type: "basic";
  username: string;
  password: string;
}

export interface WebhookAuthJwt {
  type: "jwt";
  /** PEM public key or JWKS URI used to verify incoming JWT */
  jwksUri?: string;
  /** Raw PEM public key (RS256/ES256) — used if jwksUri is absent */
  publicKey?: string;
  /** Expected `iss` claim — leave blank to skip */
  issuer?: string;
  /** Expected `aud` claim — leave blank to skip */
  audience?: string;
}

export type WebhookAuth =
  | WebhookAuthNone
  | WebhookAuthHmac
  | WebhookAuthBasic
  | WebhookAuthJwt;

export interface WebhookConfig {
  /** The URL path segment (e.g. "my-webhook"). Registered in WebhookEndpoint table. */
  path: string;
  /** Allowed HTTP methods */
  method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  /** Authentication / verification strategy for inbound requests (inline config) */
  auth?: WebhookAuth;
  /** Reference to a stored credential for auth (overrides inline `auth` when set) */
  authCredentialId?: string;
  /**
   * @deprecated Use auth.type==="hmac" && auth.secret instead.
   * Kept for backwards-compat with stored templates that have a top-level secret.
   */
  secret?: string;
}

export interface CronConfig {
  /** Standard 5-field or 6-field cron expression */
  expression: string;
  /** IANA timezone string, e.g. "America/New_York" */
  timezone: string;
}

export interface MqttConfig {
  /** Broker URL, e.g. "mqtt://broker.hivemq.com:1883" */
  brokerUrl: string;
  /** Topic to subscribe to */
  topic: string;
  /** MQTT QoS level */
  qos: 0 | 1 | 2;
  /** Optional client ID (auto-generated if omitted) */
  clientId?: string;
  /** Optional username */
  username?: string;
  /** Optional password (stored as credential reference) */
  passwordCredentialId?: string;
}

export interface ExternalTriggerConfig {
  /** Optional description shown on the node */
  description?: string;
}

export interface TriggerOutputConfig {
  /** JSON body to return to the trigger caller — supports {{}} interpolation */
  body?: string;
}

export interface WorkflowTriggerInConfig {
  /** Optional description shown on the node */
  description?: string;
}

export interface WorkflowTriggerOutConfig {
  /** ID of the target workflow (must have a workflow_trigger_in node) */
  targetWorkflowId: string;
  /** JSON payload to pass — supports {{}} interpolation */
  payload?: string;
}

export interface SubworkflowCallConfig {
  /** ID of the subworkflow to execute synchronously */
  subworkflowId: string;
  /** Number of output handles to render (synced from the subworkflow's subflow_output count) */
  outputCount: number;
  /** Optional JSON payload passed as triggerPayload — supports {{}} interpolation */
  payload?: string;
}

/** Config for the virtual output port node inside a subworkflow */
export interface SubflowOutputConfig {
  /** 0-based index — determines which output handle on the parent subworkflow_call node fires */
  outputIndex: number;
  /** Optional label shown on the output handle */
  label?: string;
}

// =============================================================================
// Logical / control-flow node configs
// =============================================================================

export interface ConditionGroup {
  /** 'and' means all rules must match; 'or' means at least one must match */
  combinator: "and" | "or";
  rules: ConditionRule[];
}

export interface ConditionRule {
  /** Dot-path into nodeOutputs, e.g. "nodeA.body.status" */
  field: string;
  operator:
    | "equals"
    | "not_equals"
    | "contains"
    | "not_contains"
    | "greater_than"
    | "less_than"
    | "greater_than_or_equal"
    | "less_than_or_equal"
    | "is_empty"
    | "is_not_empty"
    | "regex";
  value?: string | number | boolean;
}

export interface IfElseConfig {
  /** Condition evaluated to choose 'true' or 'false' outgoing edge */
  condition: ConditionGroup;
}

export interface SwitchCase {
  /** The value to match against the expression result */
  value: string | number | boolean;
  /** Label for the outgoing edge (used as sourceHandle) */
  label: string;
}

export interface SwitchConfig {
  /** Expression whose result is matched against cases, e.g. "{{nodeA.body.status}}" */
  expression: string;
  cases: SwitchCase[];
  /** Label for the default edge when no case matches */
  defaultLabel?: string;
}

export interface DelayConfig {
  /** Duration amount */
  amount: number;
  /** Duration unit */
  unit: "seconds" | "minutes" | "hours" | "days";
}

export interface MergeConfig {
  /** 'all' = AND-join (wait for all incoming edges); 'first' = OR-join (first to arrive wins) */
  mode: "all" | "first";
  /** Number of expected incoming branches — must match actual edge count for AND-join */
  branchCount: number;
}

export interface StopConfig {
  /** Optional message to include in the execution log */
  message?: string;
}

// =============================================================================
// Utility node configs
// =============================================================================

export interface HttpHeader {
  key: string;
  value: string;
}

export interface HttpRequestConfig {
  url: string;
  method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE" | "HEAD" | "OPTIONS";
  headers?: HttpHeader[];
  /** JSON body as a string template — supports {{}} interpolation */
  body?: string;
  /** Query params */
  queryParams?: HttpHeader[];
  /** Timeout in milliseconds */
  timeoutMs?: number;
  /** If true, non-2xx responses throw an error */
  failOnError?: boolean;
  /** GraphQL query string — when set, enables GraphQL mode */
  graphqlQuery?: string;
  /** GraphQL variables JSON — supports {{}} interpolation */
  graphqlVariables?: string;
  /** GraphQL operation name */
  graphqlOperationName?: string;
}

export interface JsRunnerConfig {
  /** JavaScript expression / code to evaluate. Has access to `input` (all node outputs). */
  expression: string;
  /** Timeout in milliseconds. Default: 5000 */
  timeoutMs?: number;
  /** NPM packages to install before execution (uses child_process instead of isolate) */
  npmPackages?: string[];
  /** User-uploaded .d.ts content for private/git packages. Keyed by package name. */
  customTypeDefs?: Record<string, string>;
}

export interface TsRunnerConfig {
  /** TypeScript code to evaluate. Transpiled to JS before execution. Has access to `input`. */
  expression: string;
  /** Timeout in milliseconds. Default: 5000 */
  timeoutMs?: number;
  /** NPM packages to install before execution (uses child_process instead of isolate) */
  npmPackages?: string[];
  /** User-uploaded .d.ts content for private/git packages. Keyed by package name. */
  customTypeDefs?: Record<string, string>;
}

export interface DataMapperConfig {
  /** Field-to-field mappings. `from` is a dot-path into input context; `to` is the output key. */
  mappings: Array<{ from: string; to: string }>;
}

export interface JsonParserConfig {
  /** Expression resolving to the JSON string to parse — supports {{}} interpolation */
  input: string;
}

export interface HtmlTemplateConfig {
  /** Handlebars/mustache-style template string — supports {{}} interpolation */
  template: string;
}

export interface CryptoHashConfig {
  algorithm: "sha256" | "sha1" | "md5";
  /** Value to hash — supports {{}} interpolation */
  input: string;
  encoding: "hex" | "base64";
}

export interface DateFormatterConfig {
  /** Date string or timestamp — supports {{}} interpolation */
  input: string;
  /** dayjs format string, e.g. "YYYY-MM-DD HH:mm:ss" */
  outputFormat: string;
  /** IANA timezone, e.g. "America/New_York". Default: UTC */
  timezone?: string;
}

export interface Base64Config {
  operation: "encode" | "decode";
  /** Value to encode/decode — supports {{}} interpolation */
  input: string;
}

// =============================================================================
// Data & Storage node configs
// =============================================================================

export interface PostgresConfig {
  /** Connection string or credential reference */
  connectionString?: string;
  credentialId?: string;
  /** Parameterized query — use $1, $2 placeholders */
  query: string;
  /** Array of parameter expressions — supports {{}} interpolation */
  params?: string[];
}

export interface MysqlConfig {
  credentialId?: string;
  /** Full MySQL connection string e.g. mysql://user:pass@host:3306/db */
  connectionString?: string;
  /** Parameterized query — use ? placeholders */
  query: string;
  /** Array of parameter expressions — supports {{}} interpolation */
  params?: string[];
}

export type MongoOperation =
  | "findOne"
  | "find"
  | "insertOne"
  | "updateOne"
  | "deleteOne";

export interface MongodbConfig {
  credentialId?: string;
  /** MongoDB connection URI */
  uri?: string;
  database: string;
  collection: string;
  operation: MongoOperation;
  /** JSON filter — supports {{}} interpolation */
  filter?: string;
  /** JSON document for insert/update — supports {{}} interpolation */
  document?: string;
  /** JSON update operators (for updateOne) — supports {{}} interpolation */
  update?: string;
}

export type RedisOperation = "get" | "set" | "del" | "expire" | "exists";

export interface RedisConfig {
  credentialId?: string;
  /** Redis URL, e.g. redis://localhost:6379 */
  url?: string;
  operation: RedisOperation;
  /** Key — supports {{}} interpolation */
  key: string;
  /** Value for SET — supports {{}} interpolation */
  value?: string;
  /** TTL in seconds for SET or EXPIRE */
  ttl?: number;
}

export type S3Operation =
  | "getObject"
  | "putObject"
  | "listObjects"
  | "deleteObject";

export interface S3BucketConfig {
  credentialId?: string;
  region?: string;
  bucket: string;
  operation: S3Operation;
  /** Object key — supports {{}} interpolation */
  key: string;
  /** Body for putObject — supports {{}} interpolation */
  body?: string;
  contentType?: string;
  /** Prefix for listObjects */
  prefix?: string;
  /** Custom endpoint URL for S3-compatible services (MinIO, GCS, etc.) */
  endpoint?: string;
  /** Use path-style addressing (required for MinIO). Default: false */
  forcePathStyle?: boolean;
}

// =============================================================================
// Communication node configs
// =============================================================================

export type RabbitMQOperation =
  | "consume"
  | "publish_queue"
  | "publish_exchange";

/** Standard AMQP message properties */
export interface RabbitMQMessageProperties {
  persistent?: boolean;
  contentType?: string;
  contentEncoding?: string;
  headers?: Array<{ key: string; value: string }>;
  priority?: number;
  correlationId?: string;
  replyTo?: string;
  expiration?: string;
  messageId?: string;
  type?: string;
  appId?: string;
}

export interface RabbitMQQueueOptions {
  durable?: boolean;
  exclusive?: boolean;
  autoDelete?: boolean;
  arguments?: Array<{ key: string; value: string }>;
}

export interface RabbitMQExchangeOptions {
  type?: "direct" | "fanout" | "topic" | "headers";
  durable?: boolean;
  autoDelete?: boolean;
  internal?: boolean;
  arguments?: Array<{ key: string; value: string }>;
}

export interface RabbitMQConfig {
  operation: RabbitMQOperation;
  amqpUrl?: string;
  credentialId?: string;
  queueName?: string;
  assertQueue?: boolean;
  queueOptions?: RabbitMQQueueOptions;
  exchangeName?: string;
  routingKey?: string;
  assertExchange?: boolean;
  exchangeOptions?: RabbitMQExchangeOptions;
  noAck?: boolean;
  prefetchCount?: number;
  consumerTag?: string;
  timeoutMs?: number;
  messageBody?: string;
  messageProperties?: RabbitMQMessageProperties;
}

export interface SendEmailConfig {
  provider: "smtp" | "sendgrid";
  to: string | string[];
  cc?: string | string[];
  bcc?: string | string[];
  subject: string;
  body?: string;
  htmlBody?: string;
  credentialId?: string;
}

export interface SlackConfig {
  /** Slack incoming webhook URL */
  webhookUrl?: string;
  credentialId?: string;
  /** Channel name or ID — supports {{}} interpolation */
  channel: string;
  /** Message text — supports {{}} interpolation */
  message: string;
  username?: string;
  iconEmoji?: string;
}

export interface SshTerminalConfig {
  host: string;
  port?: number;
  username: string;
  credentialId?: string;
  /** PEM-encoded private key */
  privateKey?: string;
  password?: string;
  /** Shell command to execute — supports {{}} interpolation */
  command: string;
  /** Timeout in ms. Default: 30000 */
  timeout?: number;
}

export interface TwilioSmsConfig {
  accountSid?: string;
  authToken?: string;
  credentialId?: string;
  /** Twilio "From" number */
  from: string;
  /** Recipient number — supports {{}} interpolation */
  to: string;
  /** Message body — supports {{}} interpolation */
  body: string;
}

export interface TwilioEmailConfig {
  /** SendGrid API key (via Twilio) */
  apiKey?: string;
  credentialId?: string;
  from: string;
  /** Recipient — supports {{}} interpolation */
  to: string;
  /** Subject — supports {{}} interpolation */
  subject: string;
  body?: string;
  htmlBody?: string;
}

// =============================================================================
// AI Agents node configs
// =============================================================================

export type LlmProvider =
  | "openai"
  | "ollama"
  | "anthropic"
  | "gemini"
  | "huggingface";

export interface LlmPromptConfig {
  provider: LlmProvider;
  /** Model name, e.g. "gpt-4o", "gemma3:8b" */
  model: string;
  /** User prompt — supports {{}} interpolation */
  prompt: string;
  /** System prompt */
  systemPrompt?: string;
  /** Credential ID for API key */
  credentialId?: string;
  /** Base URL override (required for Ollama, optional for OpenAI-compatible) */
  apiUrl?: string;
  maxTokens?: number;
  temperature?: number;
}

export type AiAgentToolKind = "http_request" | "js_code" | "json_extract";

export interface AiAgentToolDef {
  /** Tool name exposed to the LLM */
  name: string;
  /** Tool description exposed to the LLM */
  description: string;
  /** Built-in executor kind */
  kind: AiAgentToolKind;
  /** Kind-specific config (e.g., allowed methods for http_request) */
  config?: Record<string, unknown>;
}

export interface AiAgentConfig {
  provider: LlmProvider;
  model: string;
  prompt: string;
  systemPrompt?: string;
  credentialId?: string;
  apiUrl?: string;
  maxTokens?: number;
  temperature?: number;
  /** Tools the agent can call */
  tools: AiAgentToolDef[];
  /** Max agentic loop iterations (default 10) */
  maxIterations: number;
}

// =============================================================================
// Code node configs
// =============================================================================

export interface CustomCodeConfig {
  code: string;
  timeoutMs?: number;
  memoryMb?: number;
}

// =============================================================================
// Group — canvas-only container for visual organisation
//
// A "group" node has no handles and carries no execution semantics (the
// GraphInterpreter no-ops the kind). Children declare `parentId` pointing at
// the group; their `position` becomes parent-relative while grouped, world-
// relative after ungrouping. When `locked: true`, children are not individually
// draggable or deletable — the whole group moves as a unit.
// =============================================================================

export interface GroupConfig {
  label?: string;
  /** Hex colour for the dotted border + translucent fill background. */
  color?: string;
  /** When true, children are frozen — no individual drag, no individual delete. */
  locked: boolean;
  width: number;
  height: number;
}

// =============================================================================
// Custom Builder — user-authored reusable node kind ("the in-app custom node")
//
// The config below is the snapshot copied from a CustomNodeTemplate when the
// node is dropped on the canvas. Everything needed to render and execute the
// node lives in this struct so workflows stay self-contained across
// git sync / cross-org import — even if the source template is later edited
// or deleted.
// =============================================================================

export interface CustomBuilderHandle {
  id: string;
  label: string;
}

export type CustomBuilderInputType =
  | "string"
  | "number"
  | "boolean"
  | "select"
  | "textarea"
  | "json"
  | "credential";

export interface CustomBuilderInputField {
  /** Key in templateInputs — stable identifier */
  name: string;
  label: string;
  type: CustomBuilderInputType;
  required?: boolean;
  default?: unknown;
  /** For type="select" */
  options?: { value: string; label: string }[];
  description?: string;
}

export interface CustomBuilderHttpTemplate {
  method: string;
  url: string;
  headers?: { key: string; value: string }[];
  queryParams?: { key: string; value: string }[];
  /** Body template — supports {{fields.X}} and {{nodeId.field}} interpolation */
  bodyTemplate?: string;
}

export interface CustomBuilderConfig {
  /** DB id of the source template (for "upgrade to latest" UX) */
  templateId: string;
  /** Stable slug, e.g. "cn_a7b3k2m9pq" — survives git sync & cross-env import */
  templateKey: string;
  /** Template version at drop-time */
  templateVersion: number;

  // ── Display snapshot ──────────────────────────────────────────────────────
  name: string;
  icon: string;
  color: string;
  category: string;

  // ── Port design snapshot ──────────────────────────────────────────────────
  inputs: CustomBuilderHandle[];
  outputs: CustomBuilderHandle[];
  inputsSchema: CustomBuilderInputField[];

  // ── Execution snapshot ────────────────────────────────────────────────────
  executionMode: "sandbox" | "http";
  /** TS source — when executionMode === "sandbox" */
  code?: string;
  /** Parameterized HTTP call — when executionMode === "http" */
  httpTemplate?: CustomBuilderHttpTemplate;
  /** Optional — declares which credential shape is required */
  credentialType?: string;

  // ── Per-node user input on the canvas ─────────────────────────────────────
  templateInputs: Record<string, unknown>;
  credentialRef?: { credentialId: string } | null;
  timeoutMs?: number;
  memoryMb?: number;
}

export interface DebugConfig {
  label?: string;
  breakpoint?: boolean;
}

// =============================================================================
// Phase 1 — New node configs
// =============================================================================

export interface MariadbConfig {
  credentialId?: string;
  /** MariaDB connection string, e.g. mysql://user:pass@host:3306/db */
  connectionString?: string;
  /** Parameterized query — use ? placeholders */
  query: string;
  /** Array of parameter expressions — supports {{}} interpolation */
  params?: string[];
}

export interface MssqlConfig {
  credentialId?: string;
  server: string;
  port?: number;
  database: string;
  user?: string;
  password?: string;
  /** Use encrypted connection */
  encrypt?: boolean;
  /** Trust self-signed certs */
  trustServerCertificate?: boolean;
  /** Parameterized query */
  query: string;
  /** Array of parameter expressions — supports {{}} interpolation */
  params?: string[];
}

export interface GoogleSheetsConfig {
  credentialId?: string;
  spreadsheetId: string;
  operation: "read_range" | "append_rows" | "update_range" | "clear_range";
  /** Sheet name + range, e.g. "Sheet1!A1:D10" */
  range: string;
  /** Row data for append/update — JSON array of arrays, supports {{}} interpolation */
  values?: string;
  /** Value input option */
  valueInputOption?: "RAW" | "USER_ENTERED";
}

export interface PythonRunnerConfig {
  /** Python code to execute. `input` dict is available with all previous node outputs. */
  code: string;
  /** Timeout in milliseconds. Default: 10000 */
  timeoutMs?: number;
  /** Pip packages to install before execution */
  requirements?: string[];
}

export interface FirebasePushConfig {
  credentialId?: string;
  /** FCM device token or topic — supports {{}} interpolation */
  target: string;
  /** "token" sends to a single device; "topic" sends to a topic */
  targetType: "token" | "topic";
  /** Notification title — supports {{}} interpolation */
  title: string;
  /** Notification body — supports {{}} interpolation */
  body: string;
  /** Optional JSON data payload — supports {{}} interpolation */
  data?: string;
  /** Optional image URL */
  imageUrl?: string;
}

export interface ApnsPushConfig {
  credentialId?: string;
  /** APNs device token — supports {{}} interpolation */
  deviceToken: string;
  /** Bundle ID, e.g. "com.myapp.ios" */
  bundleId: string;
  /** Notification title — supports {{}} interpolation */
  title: string;
  /** Notification body — supports {{}} interpolation */
  body: string;
  /** Optional JSON payload — supports {{}} interpolation */
  payload?: string;
  /** Use APNs production environment. Default: false (sandbox) */
  production?: boolean;
  /** APNs push type */
  pushType?: "alert" | "background" | "voip";
}

export interface LoopConfig {
  /** Expression resolving to an array to iterate over — supports {{}} interpolation */
  items: string;
  /** Max iterations (safety limit). Default: 1000 */
  maxIterations?: number;
  /** Variable name for current item in loop body context. Default: "item" */
  itemVariable?: string;
  /** Variable name for current index. Default: "index" */
  indexVariable?: string;
}

export interface ResponseConfig {
  /** HTTP status code. Default: 200 */
  statusCode: number;
  /** Response headers */
  headers?: Array<{ key: string; value: string }>;
  /** Response body — supports {{}} interpolation */
  body?: string;
  /** Content type. Default: "application/json" */
  contentType?: string;
}

// =============================================================================
// AWS Cloud node configs
// =============================================================================

export interface AwsBaseConfig {
  credentialId?: string;
  /** AWS region. Default: "us-east-1" */
  region?: string;
  /** Custom endpoint URL for LocalStack or compatible services */
  endpoint?: string;
}

export interface AwsLambdaConfig extends AwsBaseConfig {
  operation: "invoke" | "invokeAsync";
  /** Function name, ARN, or partial ARN — supports {{}} interpolation */
  functionName: string;
  /** JSON payload — supports {{}} interpolation */
  payload?: string;
  invocationType?: "RequestResponse" | "Event" | "DryRun";
  /** Version or alias qualifier */
  qualifier?: string;
}

export interface AwsSqsConfig extends AwsBaseConfig {
  operation: "sendMessage" | "receiveMessage" | "deleteMessage" | "purgeQueue";
  /** Queue URL — supports {{}} interpolation */
  queueUrl: string;
  /** Message body — supports {{}} interpolation */
  messageBody?: string;
  /** FIFO message group ID — supports {{}} interpolation */
  messageGroupId?: string;
  delaySeconds?: number;
  /** Max messages to receive (1-10) */
  maxMessages?: number;
  /** Long-poll wait time in seconds */
  waitTimeSeconds?: number;
  /** Receipt handle for deleteMessage — supports {{}} interpolation */
  receiptHandle?: string;
}

export interface AwsSnsConfig extends AwsBaseConfig {
  operation: "publish" | "publishBatch";
  /** Topic ARN — supports {{}} interpolation */
  topicArn: string;
  /** Message body — supports {{}} interpolation */
  message: string;
  /** Optional subject — supports {{}} interpolation */
  subject?: string;
  /** Message attributes JSON — supports {{}} interpolation */
  messageAttributes?: string;
}

export interface AwsDynamoDBConfig extends AwsBaseConfig {
  operation:
    | "getItem"
    | "putItem"
    | "updateItem"
    | "deleteItem"
    | "query"
    | "scan";
  /** Table name — supports {{}} interpolation */
  tableName: string;
  /** Key JSON (plain JSON, auto-marshalled) — supports {{}} interpolation */
  key?: string;
  /** Item JSON for putItem — supports {{}} interpolation */
  item?: string;
  updateExpression?: string;
  conditionExpression?: string;
  /** Key condition for query — supports {{}} interpolation */
  keyConditionExpression?: string;
  filterExpression?: string;
  /** JSON object — supports {{}} interpolation */
  expressionAttributeNames?: string;
  /** JSON object (plain values, auto-marshalled) — supports {{}} interpolation */
  expressionAttributeValues?: string;
  /** GSI/LSI index name */
  indexName?: string;
  limit?: number;
  /** Sort order for query. Default: true (ascending) */
  scanForward?: boolean;
}

export interface AwsSesConfig extends AwsBaseConfig {
  operation: "sendEmail" | "sendTemplatedEmail" | "sendRawEmail";
  /** Sender — supports {{}} interpolation */
  from: string;
  /** Comma-separated recipients — supports {{}} interpolation */
  to: string;
  cc?: string;
  bcc?: string;
  /** Subject — supports {{}} interpolation */
  subject?: string;
  /** Plain text body — supports {{}} interpolation */
  textBody?: string;
  /** HTML body — supports {{}} interpolation */
  htmlBody?: string;
  /** SES template name for sendTemplatedEmail */
  templateName?: string;
  /** Template data JSON — supports {{}} interpolation */
  templateData?: string;
  /** Raw MIME message for sendRawEmail — supports {{}} interpolation */
  rawMessage?: string;
}

export interface AwsSecretsManagerConfig extends AwsBaseConfig {
  operation:
    | "getSecretValue"
    | "putSecretValue"
    | "createSecret"
    | "deleteSecret";
  /** Secret name or ARN — supports {{}} interpolation */
  secretId: string;
  /** Secret value for put/create — supports {{}} interpolation */
  secretString?: string;
  /** Description for createSecret */
  description?: string;
}

export interface AwsSsmConfig extends AwsBaseConfig {
  operation:
    | "getParameter"
    | "putParameter"
    | "getParametersByPath"
    | "deleteParameter";
  /** Parameter name — supports {{}} interpolation */
  name: string;
  /** Parameter value for putParameter — supports {{}} interpolation */
  value?: string;
  /** Parameter type for putParameter */
  type?: "String" | "StringList" | "SecureString";
  /** Path prefix for getParametersByPath — supports {{}} interpolation */
  path?: string;
  /** Decrypt SecureString values */
  withDecryption?: boolean;
  /** Overwrite existing parameter */
  overwrite?: boolean;
}

export interface AwsEventBridgeConfig extends AwsBaseConfig {
  operation: "putEvents";
  /** Event bus name or ARN — supports {{}} interpolation */
  eventBusName?: string;
  /** Event source — supports {{}} interpolation */
  source: string;
  /** Event detail type — supports {{}} interpolation */
  detailType: string;
  /** Event detail JSON — supports {{}} interpolation */
  detail: string;
}

export interface AwsStepFunctionsConfig extends AwsBaseConfig {
  operation: "startExecution" | "describeExecution" | "stopExecution";
  /** State machine ARN — supports {{}} interpolation */
  stateMachineArn: string;
  /** Execution name — supports {{}} interpolation */
  executionName?: string;
  /** Input JSON for startExecution — supports {{}} interpolation */
  input?: string;
  /** Execution ARN for describe/stop — supports {{}} interpolation */
  executionArn?: string;
  /** Stop reason — supports {{}} interpolation */
  cause?: string;
}

// =============================================================================
// Azure Cloud node configs
// =============================================================================

export type AzureBlobOperation =
  | "uploadBlob"
  | "downloadBlob"
  | "listBlobs"
  | "deleteBlob"
  | "getBlobProperties";

/**
 * Azure Blob Storage — S3-equivalent object store for Azure. The credential's
 * decrypted payload should carry either:
 *   - `{ connectionString: string }` — fastest to configure, carries account
 *     name + key + endpoint in one blob. Recommended for getting started.
 *   - `{ accountName, accountKey }` — shared-key auth.
 *   - `{ accountName, sasToken }` — time-limited SAS access.
 * The activity picks the first credential shape that resolves.
 */
export interface AzureBlobConfig {
  credentialId?: string;
  operation: AzureBlobOperation;
  /** Container name — supports {{}} interpolation */
  container: string;
  /** Blob name — supports {{}} interpolation (not required for listBlobs) */
  blob?: string;
  /** Body for uploadBlob — supports {{}} interpolation */
  content?: string;
  /** MIME type for uploadBlob, e.g. "application/json" */
  contentType?: string;
  /** Prefix filter for listBlobs — supports {{}} interpolation */
  prefix?: string;
  /** Max results for listBlobs (default 100, max 5000) */
  maxResults?: number;
}

export type AzureServiceBusOperation =
  | "sendMessage"
  | "receiveMessages"
  | "peekMessages";

export interface AzureServiceBusConfig {
  credentialId?: string;
  operation: AzureServiceBusOperation;
  /** Queue or topic name — supports {{}} interpolation */
  entityName: string;
  /** Subscription name for topics (receiveMessages / peekMessages only) */
  subscriptionName?: string;
  /** Message body for sendMessage — supports {{}} interpolation */
  messageBody?: string;
  /** Optional content type header */
  contentType?: string;
  /** Max messages to receive / peek (default 1, max 100) */
  maxMessages?: number;
  /** Max wait time in seconds for receiveMessages */
  maxWaitTimeSeconds?: number;
}

export type AzureCosmosOperation =
  | "query"
  | "upsertItem"
  | "readItem"
  | "deleteItem";

export interface AzureCosmosConfig {
  credentialId?: string;
  operation: AzureCosmosOperation;
  /** Database ID — supports {{}} interpolation */
  databaseId: string;
  /** Container ID — supports {{}} interpolation */
  containerId: string;
  /** Item ID for readItem / deleteItem / upsertItem — supports {{}} */
  itemId?: string;
  /** Partition-key value — supports {{}} interpolation */
  partitionKey?: string;
  /** SQL query for `query` operation (use @params with parameters) */
  query?: string;
  /** JSON array of { name, value } parameter objects — supports {{}} */
  queryParameters?: string;
  /** JSON body for upsertItem — supports {{}} */
  item?: string;
  /** Max items returned per query (default 100) */
  maxItems?: number;
}

export type AzureKeyVaultOperation =
  | "getSecret"
  | "setSecret"
  | "listSecrets"
  | "deleteSecret";

export interface AzureKeyVaultConfig {
  credentialId?: string;
  operation: AzureKeyVaultOperation;
  /** Secret name — supports {{}} (not required for listSecrets) */
  secretName?: string;
  /** Optional version for getSecret */
  secretVersion?: string;
  /** Value for setSecret — supports {{}}. Kept raw, no interpolation strip. */
  secretValue?: string;
}

export interface AzureFunctionsConfig {
  credentialId?: string;
  /** Full function URL (code= querystring optional — credential.functionKey appended when set) */
  functionUrl: string;
  /** HTTP method, default POST */
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  /** JSON body — supports {{}} */
  body?: string;
  /** Extra headers — supports {{}} in both key and value */
  headers?: Array<{ key: string; value: string }>;
  /** Request timeout in ms, default 30000 */
  timeoutMs?: number;
}

// =============================================================================
// Google Cloud node configs
// =============================================================================

export type GcpStorageOperation =
  | "uploadObject"
  | "downloadObject"
  | "listObjects"
  | "deleteObject";

export interface GcpStorageConfig {
  credentialId?: string;
  operation: GcpStorageOperation;
  /** Bucket name — supports {{}} */
  bucket: string;
  /** Object name / path — supports {{}} (not required for listObjects) */
  object?: string;
  /** Body for uploadObject — supports {{}} */
  content?: string;
  /** MIME type for uploadObject */
  contentType?: string;
  /** Prefix filter for listObjects */
  prefix?: string;
  /** Max results for listObjects (default 100) */
  maxResults?: number;
}

export type GcpPubSubOperation = "publish" | "pull" | "ack";

export interface GcpPubSubConfig {
  credentialId?: string;
  operation: GcpPubSubOperation;
  /** Topic name for publish (short name, not full projects/.../topics/...) */
  topic?: string;
  /** Subscription name for pull / ack */
  subscription?: string;
  /** Message body for publish — supports {{}} */
  messageBody?: string;
  /** JSON object of message attributes — supports {{}} */
  attributes?: string;
  /** Max messages to pull (default 10, max 1000) */
  maxMessages?: number;
  /** ackId(s) for ack — comma-separated list, supports {{}} */
  ackIds?: string;
}

export type GcpBigQueryOperation = "query" | "insertRows";

export interface GcpBigQueryConfig {
  credentialId?: string;
  operation: GcpBigQueryOperation;
  /** Project ID — falls back to the credential's project_id */
  projectId?: string;
  /** SQL query for `query` — supports {{}} */
  query?: string;
  /** Use legacy SQL (default false, i.e. Standard SQL) */
  useLegacySql?: boolean;
  /** Query parameters as JSON object — supports {{}} */
  queryParameters?: string;
  /** Dataset ID for insertRows */
  datasetId?: string;
  /** Table ID for insertRows */
  tableId?: string;
  /** JSON array of rows for insertRows — supports {{}} */
  rows?: string;
  /** Max results for query (default 100) */
  maxResults?: number;
}

// =============================================================================
// Oracle Cloud node configs
// =============================================================================

export interface OracleDbConfig {
  credentialId?: string;
  /** Connection string (TNS / EZ connect) — overrides credential's connectString when set */
  connectString?: string;
  /** Parameterized SQL — use :bind placeholders */
  query: string;
  /** JSON object or array of bind params — supports {{}} */
  binds?: string;
  /** Commit immediately after the statement (default true for DML) */
  autoCommit?: boolean;
  /** Max rows returned (default 1000) */
  maxRows?: number;
}

export type OciObjectStorageOperation =
  | "putObject"
  | "getObject"
  | "listObjects"
  | "deleteObject";

export interface OciObjectStorageConfig {
  credentialId?: string;
  operation: OciObjectStorageOperation;
  /** Namespace — falls back to credential.namespace when omitted */
  namespace?: string;
  /** Bucket name — supports {{}} */
  bucket: string;
  /** Object name for put / get / delete — supports {{}} */
  object?: string;
  /** Body for putObject — supports {{}} */
  content?: string;
  /** MIME type for putObject */
  contentType?: string;
  /** Prefix filter for listObjects */
  prefix?: string;
  /** Max results for listObjects (default 100) */
  maxResults?: number;
}

// =============================================================================
// SaaS Integration node configs (Phase 2)
// =============================================================================

// ─── Stripe ──────────────────────────────────────────────────────────────────

export type StripeOperation =
  | "charges.create"
  | "charges.retrieve"
  | "charges.refund"
  | "customers.create"
  | "customers.retrieve"
  | "customers.update"
  | "paymentIntents.create"
  | "paymentIntents.retrieve"
  | "paymentIntents.capture"
  | "subscriptions.create"
  | "subscriptions.cancel"
  | "invoices.create"
  | "invoices.send";

/**
 * Stripe — credential payload should carry `{ apiKey: "sk_test_..." }`.
 * Uses the official `stripe` Node SDK (idempotent by default via idempotencyKey).
 */
export interface StripeConfig {
  credentialId?: string;
  operation: StripeOperation;
  /** Resource ID for retrieve / update / refund / cancel / capture / send — supports {{}} */
  resourceId?: string;
  /** Amount in the smallest currency unit (e.g. cents) — supports {{}} */
  amount?: string;
  /** ISO 4217 currency code — default "usd" */
  currency?: string;
  /** Customer ID for charges / subscriptions — supports {{}} */
  customerId?: string;
  /** Payment source / method — supports {{}} */
  source?: string;
  /** Description — supports {{}} */
  description?: string;
  /** Metadata JSON object — supports {{}} */
  metadata?: string;
  /** Extra params JSON object (merged into call) — supports {{}} */
  extraParams?: string;
  /** Idempotency key — supports {{}} */
  idempotencyKey?: string;
}

// ─── GitHub ──────────────────────────────────────────────────────────────────

export type GithubOperation =
  | "issues.create"
  | "issues.update"
  | "issues.get"
  | "issues.list"
  | "issues.createComment"
  | "pulls.create"
  | "pulls.merge"
  | "pulls.list"
  | "repos.get"
  | "repos.listForAuthenticatedUser"
  | "repos.createDispatchEvent"
  | "actions.createWorkflowDispatch";

/**
 * GitHub — credential payload should carry `{ token: "ghp_..." }`.
 * Uses the Octokit REST SDK.
 */
export interface GithubConfig {
  credentialId?: string;
  operation: GithubOperation;
  /** Repo owner (user / org) — supports {{}} */
  owner?: string;
  /** Repo name — supports {{}} */
  repo?: string;
  /** Issue / PR / comment number — supports {{}} */
  number?: string;
  /** Title — supports {{}} */
  title?: string;
  /** Body / markdown — supports {{}} */
  body?: string;
  /** Labels (comma-separated) — supports {{}} */
  labels?: string;
  /** Assignees (comma-separated) — supports {{}} */
  assignees?: string;
  /** Source branch for pulls.create — supports {{}} */
  head?: string;
  /** Target branch for pulls.create — supports {{}} */
  base?: string;
  /** State filter for issues.list / pulls.list */
  state?: "open" | "closed" | "all";
  /** Workflow ID / filename for actions.createWorkflowDispatch — supports {{}} */
  workflowId?: string;
  /** Ref (branch/tag) for workflow dispatch — supports {{}} */
  ref?: string;
  /** JSON inputs for workflow dispatch — supports {{}} */
  inputs?: string;
  /** Event type for repos.createDispatchEvent — supports {{}} */
  eventType?: string;
  /** JSON client_payload for dispatch — supports {{}} */
  clientPayload?: string;
}

// ─── Discord ─────────────────────────────────────────────────────────────────

export type DiscordOperation =
  | "sendWebhookMessage"
  | "sendChannelMessage"
  | "addReaction";

/**
 * Discord — credential shapes:
 *   - Webhook messages: `{ webhookUrl }` (no auth otherwise).
 *   - Channel messages: `{ botToken }` (bot user token starting with "Bot ").
 */
export interface DiscordConfig {
  credentialId?: string;
  operation: DiscordOperation;
  /** Channel ID for channel message / reaction — supports {{}} */
  channelId?: string;
  /** Message ID for reactions — supports {{}} */
  messageId?: string;
  /** Text content — supports {{}} */
  content?: string;
  /** Emoji (unicode or name:id) — supports {{}} */
  emoji?: string;
  /** Override bot username for webhook messages — supports {{}} */
  username?: string;
  /** Avatar URL override for webhook messages — supports {{}} */
  avatarUrl?: string;
  /** Embeds JSON array — supports {{}} */
  embeds?: string;
  /** Use TTS for channel message */
  tts?: boolean;
}

// ─── Notion ──────────────────────────────────────────────────────────────────

export type NotionOperation =
  | "pages.create"
  | "pages.retrieve"
  | "pages.update"
  | "blocks.append"
  | "blocks.children"
  | "databases.query"
  | "databases.retrieve"
  | "search";

/**
 * Notion — credential payload: `{ token: "secret_..." }` (Internal Integration Token).
 * Uses the `@notionhq/client` SDK.
 */
export interface NotionConfig {
  credentialId?: string;
  operation: NotionOperation;
  /** Parent page ID (for pages.create with page parent) — supports {{}} */
  parentPageId?: string;
  /** Database ID (for pages.create / databases.query / databases.retrieve) — supports {{}} */
  databaseId?: string;
  /** Page ID for retrieve / update / blocks.append / blocks.children — supports {{}} */
  pageId?: string;
  /** Block ID for blocks.append / blocks.children — supports {{}} */
  blockId?: string;
  /** JSON object of Notion properties (shape per property type) — supports {{}} */
  properties?: string;
  /** JSON array of block children — supports {{}} */
  children?: string;
  /** JSON filter for databases.query — supports {{}} */
  filter?: string;
  /** JSON sort array for databases.query — supports {{}} */
  sorts?: string;
  /** Free-text search query */
  query?: string;
  /** Page size (default 100, max 100) */
  pageSize?: number;
  /** Start cursor for pagination — supports {{}} */
  startCursor?: string;
  /** If true, page / block is archived (for pages.update) */
  archived?: boolean;
}

// ─── Salesforce ──────────────────────────────────────────────────────────────

export type SalesforceOperation =
  | "query"
  | "sobject.create"
  | "sobject.retrieve"
  | "sobject.update"
  | "sobject.delete"
  | "sobject.upsert"
  | "describe"
  | "apex.rest";

/**
 * Salesforce — credential shapes supported:
 *   - `{ loginUrl, username, password, securityToken }` — SOAP login (username/password+token).
 *   - `{ instanceUrl, accessToken }` — OAuth bearer (session token already acquired).
 * Uses the `jsforce` SDK.
 */
export interface SalesforceConfig {
  credentialId?: string;
  operation: SalesforceOperation;
  /** Object API name (e.g. "Account", "Contact") — supports {{}} */
  sobject?: string;
  /** Record ID for retrieve / update / delete / upsert — supports {{}} */
  recordId?: string;
  /** External ID field name for upsert */
  externalIdField?: string;
  /** SOQL query string — supports {{}} */
  soql?: string;
  /** JSON record body for create / update / upsert — supports {{}} */
  record?: string;
  /** Apex REST path ("/services/apexrest/..." minus the prefix) — supports {{}} */
  apexPath?: string;
  /** HTTP method for apex.rest (default GET) */
  apexMethod?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  /** JSON body for apex.rest — supports {{}} */
  apexBody?: string;
  /** Max rows returned from query (default 2000) */
  maxRows?: number;
}

// ─── Jira ────────────────────────────────────────────────────────────────────

export type JiraOperation =
  | "issues.create"
  | "issues.get"
  | "issues.update"
  | "issues.transition"
  | "issues.addComment"
  | "issues.search";

/**
 * Jira Cloud REST v3. Credential shape:
 *   `{ baseUrl, email, apiToken }` — baseUrl like "https://mycorp.atlassian.net".
 */
export interface JiraConfig {
  credentialId?: string;
  operation: JiraOperation;
  /** Project key (e.g. "PROJ") — required for issues.create */
  projectKey?: string;
  /** Issue type name — required for issues.create (e.g. "Bug", "Task") */
  issueType?: string;
  /** Issue key (e.g. "PROJ-123") for get/update/transition/addComment */
  issueKey?: string;
  /** Summary — supports {{}} */
  summary?: string;
  /** Description (Atlassian Document Format JSON or plain) — supports {{}} */
  description?: string;
  /** Labels CSV — supports {{}} */
  labels?: string;
  /** Assignee accountId — supports {{}} */
  assigneeAccountId?: string;
  /** Transition ID for issues.transition */
  transitionId?: string;
  /** Comment body for addComment — supports {{}} */
  comment?: string;
  /** JQL query for issues.search — supports {{}} */
  jql?: string;
  /** Fields CSV to return for search (default "*all") */
  fields?: string;
  /** Extra JSON merged into the fields object on create/update — supports {{}} */
  extraFields?: string;
  /** Max results for search (default 50, max 100) */
  maxResults?: number;
}

// ─── Microsoft Teams ─────────────────────────────────────────────────────────

export type MsTeamsOperation =
  | "sendWebhookMessage"
  | "sendAdaptiveCard";

/**
 * Microsoft Teams messaging via Incoming Webhook (Connector).
 * Credential shape: `{ webhookUrl }`. Adaptive cards go via the same webhook
 * with an `attachments` envelope.
 */
export interface MsTeamsConfig {
  credentialId?: string;
  operation: MsTeamsOperation;
  /** Message text — supports {{}} (required for sendWebhookMessage) */
  message?: string;
  /** Card title for sendWebhookMessage — supports {{}} */
  title?: string;
  /** Theme colour (hex, no #) — sendWebhookMessage */
  themeColor?: string;
  /** Adaptive Card JSON (the full `attachments[0].content`) — supports {{}} */
  cardJson?: string;
}

// ─── HubSpot ─────────────────────────────────────────────────────────────────

export type HubspotOperation =
  | "contacts.create"
  | "contacts.update"
  | "contacts.get"
  | "contacts.searchByEmail"
  | "companies.create"
  | "companies.update"
  | "companies.get"
  | "deals.create"
  | "deals.update"
  | "deals.get";

/**
 * HubSpot CRM v3. Credential shape: `{ privateAppToken }` (recommended) or
 * `{ apiKey }` (legacy). Uses HTTP with Bearer auth for the private-app token.
 */
export interface HubspotConfig {
  credentialId?: string;
  operation: HubspotOperation;
  /** Object ID for update/get — supports {{}} */
  objectId?: string;
  /** Email for contacts.searchByEmail — supports {{}} */
  email?: string;
  /** JSON `properties` object — supports {{}} */
  properties?: string;
  /** JSON `associations` array for create — supports {{}} */
  associations?: string;
}

// ─── Airtable ────────────────────────────────────────────────────────────────

export type AirtableOperation =
  | "records.list"
  | "records.get"
  | "records.create"
  | "records.update"
  | "records.delete";

/**
 * Airtable REST v0. Credential shape: `{ apiKey }` (legacy key or PAT).
 */
export interface AirtableConfig {
  credentialId?: string;
  operation: AirtableOperation;
  /** Base ID (app...) — supports {{}} */
  baseId: string;
  /** Table name or ID — supports {{}} */
  table: string;
  /** Record ID for get / update / delete — supports {{}} */
  recordId?: string;
  /** JSON `fields` object for create / update — supports {{}} */
  fields?: string;
  /** Filter formula for list — supports {{}} */
  filterByFormula?: string;
  /** Max records for list (default 100, max 100) */
  maxRecords?: number;
  /** View name for list */
  view?: string;
}

// ─── PagerDuty ───────────────────────────────────────────────────────────────

export type PagerDutyOperation =
  | "events.trigger"
  | "events.acknowledge"
  | "events.resolve"
  | "incidents.create"
  | "incidents.list";

/**
 * PagerDuty. Two APIs:
 *  - Events API v2 (events.*): credential shape `{ routingKey }` (integration key).
 *  - REST API (incidents.*): credential shape `{ apiToken }` (Bearer).
 */
export interface PagerDutyConfig {
  credentialId?: string;
  operation: PagerDutyOperation;
  /** Summary / title — supports {{}} */
  summary?: string;
  /** Source (hostname / service) — supports {{}} */
  source?: string;
  /** Severity for events.trigger */
  severity?: "critical" | "error" | "warning" | "info";
  /** Dedup key — supports {{}} (required for ack/resolve) */
  dedupKey?: string;
  /** Custom details JSON — supports {{}} */
  customDetails?: string;
  /** Service ID for incidents.create — supports {{}} */
  serviceId?: string;
  /** Escalation policy ID — supports {{}} */
  escalationPolicyId?: string;
  /** Requester email for REST API — supports {{}} */
  userEmail?: string;
  /** Status filter for incidents.list */
  statusFilter?: string;
  /** Max results for incidents.list (default 25, max 100) */
  limit?: number;
}

// ─── GitLab ──────────────────────────────────────────────────────────────────

export type GitlabOperation =
  | "issues.create"
  | "issues.get"
  | "issues.update"
  | "issues.list"
  | "issues.addComment"
  | "mergeRequests.create"
  | "mergeRequests.merge"
  | "mergeRequests.list"
  | "pipelines.trigger"
  | "projects.get";

/**
 * GitLab REST v4. Credential: `{ baseUrl?, token }` — baseUrl defaults to
 * https://gitlab.com. `token` is a Personal or Project Access Token sent
 * as `PRIVATE-TOKEN`.
 */
export interface GitlabConfig {
  credentialId?: string;
  operation: GitlabOperation;
  /** Project ID (numeric or "owner/repo") — supports {{}} */
  projectId?: string;
  /** Issue / MR IID — supports {{}} */
  iid?: string;
  /** Title — supports {{}} */
  title?: string;
  /** Description / body — supports {{}} */
  description?: string;
  /** Labels CSV — supports {{}} */
  labels?: string;
  /** Assignee user ID(s) CSV — supports {{}} */
  assigneeIds?: string;
  /** State filter for issues.list / mergeRequests.list */
  state?: "opened" | "closed" | "all" | "merged";
  /** Source branch for mergeRequests.create — supports {{}} */
  sourceBranch?: string;
  /** Target branch for mergeRequests.create — supports {{}} */
  targetBranch?: string;
  /** Comment body for issues.addComment — supports {{}} */
  comment?: string;
  /** Ref (branch / tag) for pipelines.trigger — supports {{}} */
  ref?: string;
  /** Variables JSON object for pipelines.trigger — supports {{}} */
  variables?: string;
}

// ─── Linear ──────────────────────────────────────────────────────────────────

export type LinearOperation =
  | "issues.create"
  | "issues.get"
  | "issues.update"
  | "issues.list"
  | "issues.addComment"
  | "teams.list";

/**
 * Linear GraphQL. Credential: `{ apiKey }` (personal API key from
 * linear.app/settings/api). Sent as `Authorization: <apiKey>`.
 */
export interface LinearConfig {
  credentialId?: string;
  operation: LinearOperation;
  /** Issue ID — supports {{}} */
  issueId?: string;
  /** Team ID — supports {{}} (required for issues.create) */
  teamId?: string;
  /** Title — supports {{}} */
  title?: string;
  /** Description (markdown) — supports {{}} */
  description?: string;
  /** Priority (0 = no priority, 1 urgent, 2 high, 3 medium, 4 low) */
  priority?: 0 | 1 | 2 | 3 | 4;
  /** State ID — supports {{}} */
  stateId?: string;
  /** Assignee user ID — supports {{}} */
  assigneeId?: string;
  /** Labels (label IDs CSV) — supports {{}} */
  labelIds?: string;
  /** Comment body — supports {{}} */
  comment?: string;
  /** Filter JSON for issues.list — supports {{}} */
  filter?: string;
  /** Number of results (default 25) */
  first?: number;
}

// ─── Telegram ────────────────────────────────────────────────────────────────

export type TelegramOperation =
  | "sendMessage"
  | "sendPhoto"
  | "sendDocument"
  | "editMessageText"
  | "answerCallbackQuery";

/**
 * Telegram Bot API. Credential: `{ botToken }` (from @BotFather).
 */
export interface TelegramConfig {
  credentialId?: string;
  operation: TelegramOperation;
  /** Chat ID (numeric or @channelusername) — supports {{}} */
  chatId?: string;
  /** Message text — supports {{}} */
  text?: string;
  /** Parse mode */
  parseMode?: "Markdown" | "MarkdownV2" | "HTML";
  /** Photo URL for sendPhoto — supports {{}} */
  photoUrl?: string;
  /** Caption for sendPhoto — supports {{}} */
  caption?: string;
  /** Document URL for sendDocument — supports {{}} */
  documentUrl?: string;
  /** Message ID for editMessageText — supports {{}} */
  messageId?: string;
  /** Callback query ID for answerCallbackQuery — supports {{}} */
  callbackQueryId?: string;
  /** Inline keyboard JSON (array of rows of button objects) — supports {{}} */
  replyMarkup?: string;
  /** Disable notifications */
  disableNotification?: boolean;
}

// ─── SendGrid ────────────────────────────────────────────────────────────────

export type SendgridOperation = "mail.send";

/**
 * SendGrid transactional mail. Credential: `{ apiKey }` (`SG.` prefix).
 * Uses the `@sendgrid/mail` SDK directly (no longer piggy-backing on Twilio).
 */
export interface SendgridConfig {
  credentialId?: string;
  operation: SendgridOperation;
  /** From email (must be verified sender) — supports {{}} */
  from: string;
  /** Sender name override — supports {{}} */
  fromName?: string;
  /** Recipient CSV — supports {{}} */
  to: string;
  /** CC CSV — supports {{}} */
  cc?: string;
  /** BCC CSV — supports {{}} */
  bcc?: string;
  /** Reply-to — supports {{}} */
  replyTo?: string;
  /** Subject — supports {{}} */
  subject: string;
  /** Plain text body — supports {{}} */
  text?: string;
  /** HTML body — supports {{}} */
  html?: string;
  /** Dynamic template ID for template-based sends */
  templateId?: string;
  /** Dynamic template data JSON — supports {{}} */
  dynamicTemplateData?: string;
  /** Categories CSV for tagging — supports {{}} */
  categories?: string;
  /** Send at Unix timestamp — supports {{}} */
  sendAt?: string;
}

// ─── Sentry ──────────────────────────────────────────────────────────────────

export type SentryOperation =
  | "events.captureMessage"
  | "events.captureException"
  | "issues.list"
  | "issues.resolve";

/**
 * Sentry. Credential shapes depend on the operation:
 *   - captureMessage / captureException (Store API): `{ dsn }` — the project
 *     DSN URL. DSN parses project + public key.
 *   - issues.list / issues.resolve (REST API): `{ authToken, organizationSlug,
 *     projectSlug }` — Bearer `<authToken>`.
 */
export interface SentryConfig {
  credentialId?: string;
  operation: SentryOperation;
  /** Message text — supports {{}} */
  message?: string;
  /** Level — defaults to "error" */
  level?: "fatal" | "error" | "warning" | "info" | "debug";
  /** Environment tag — supports {{}} */
  environment?: string;
  /** Release tag — supports {{}} */
  release?: string;
  /** Extra context JSON — supports {{}} */
  extra?: string;
  /** Tags JSON object — supports {{}} */
  tags?: string;
  /** Exception type for captureException — supports {{}} */
  exceptionType?: string;
  /** Exception value/message for captureException — supports {{}} */
  exceptionValue?: string;
  /** Issue ID for issues.resolve — supports {{}} */
  issueId?: string;
  /** Query filter for issues.list — supports {{}} */
  query?: string;
  /** Max results for issues.list (default 25, max 100) */
  limit?: number;
}

// ─── Shopify ─────────────────────────────────────────────────────────────────

export type ShopifyOperation =
  | "orders.list"
  | "orders.get"
  | "orders.cancel"
  | "products.list"
  | "products.get"
  | "products.create"
  | "products.update"
  | "customers.list"
  | "customers.get"
  | "inventory.adjust";

/**
 * Shopify Admin REST. Credential: `{ shopDomain, accessToken }`.
 * shopDomain like "mystore.myshopify.com" (no scheme). Token is sent via
 * the X-Shopify-Access-Token header.
 */
export interface ShopifyConfig {
  credentialId?: string;
  operation: ShopifyOperation;
  /** Object ID for get / cancel / update — supports {{}} */
  objectId?: string;
  /** JSON body (e.g. product attrs) for create / update — supports {{}} */
  body?: string;
  /** List query params as JSON object — supports {{}} */
  queryParams?: string;
  /** Inventory adjustment amount (positive or negative) — supports {{}} */
  adjustBy?: string;
  /** Inventory item ID for inventory.adjust — supports {{}} */
  inventoryItemId?: string;
  /** Location ID for inventory.adjust — supports {{}} */
  locationId?: string;
  /** API version override — default "2024-10" */
  apiVersion?: string;
  /** Max results (list ops, default 50, max 250) */
  limit?: number;
}

// ─── Mailchimp ───────────────────────────────────────────────────────────────

export type MailchimpOperation =
  | "lists.addMember"
  | "lists.updateMember"
  | "lists.getMember"
  | "lists.deleteMember"
  | "lists.getMembers"
  | "campaigns.send"
  | "campaigns.get";

/**
 * Mailchimp Marketing API. Credential: `{ apiKey }` where the key has the
 * data-center suffix, e.g. "abc123-us21". The activity parses the dc.
 */
export interface MailchimpConfig {
  credentialId?: string;
  operation: MailchimpOperation;
  /** Audience / list ID — supports {{}} */
  listId?: string;
  /** Campaign ID — supports {{}} */
  campaignId?: string;
  /** Email for member ops — supports {{}} */
  email?: string;
  /** Member status for add / update */
  status?: "subscribed" | "unsubscribed" | "cleaned" | "pending" | "transactional";
  /** JSON merge fields (e.g. FNAME/LNAME) — supports {{}} */
  mergeFields?: string;
  /** JSON tags array — supports {{}} */
  tags?: string;
  /** Max members per page (default 50, max 1000) */
  count?: number;
}

// ─── Google Drive ────────────────────────────────────────────────────────────

export type GoogleDriveOperation =
  | "files.list"
  | "files.get"
  | "files.upload"
  | "files.delete"
  | "files.share";

/**
 * Google Drive REST v3. Credential: `{ serviceAccountJson }` (reuses the
 * `gcp` credential shape) OR an OAuth access token `{ accessToken }`.
 * When a service account is used, the `subject` field triggers domain-wide
 * delegation impersonation (optional).
 */
export interface GoogleDriveConfig {
  credentialId?: string;
  operation: GoogleDriveOperation;
  /** File ID for get / delete / share — supports {{}} */
  fileId?: string;
  /** File name for upload — supports {{}} */
  name?: string;
  /** MIME type for upload */
  mimeType?: string;
  /** File content (text) for upload — supports {{}} */
  content?: string;
  /** Parent folder ID(s) CSV for upload — supports {{}} */
  parents?: string;
  /** Drive query (`name contains 'foo'`, etc.) for list — supports {{}} */
  query?: string;
  /** Max results for list (default 100, max 1000) */
  pageSize?: number;
  /** Share type */
  shareType?: "user" | "group" | "domain" | "anyone";
  /** Share role */
  shareRole?: "reader" | "commenter" | "writer" | "owner";
  /** Share target email / domain — supports {{}} */
  shareEmail?: string;
  /** Impersonate user (domain-wide delegation) — supports {{}} */
  impersonateUser?: string;
}

// ─── Dropbox ─────────────────────────────────────────────────────────────────

export type DropboxOperation =
  | "files.upload"
  | "files.download"
  | "files.listFolder"
  | "files.delete"
  | "sharing.createSharedLink";

/**
 * Dropbox. Credential: `{ accessToken }` — a Dropbox API access token.
 */
export interface DropboxConfig {
  credentialId?: string;
  operation: DropboxOperation;
  /** Remote path (must start with `/`) — supports {{}} */
  path?: string;
  /** Content for files.upload — supports {{}} */
  content?: string;
  /** Upload mode */
  mode?: "add" | "overwrite" | "update";
  /** Folder to list */
  folderPath?: string;
  /** Recurse for listFolder */
  recursive?: boolean;
  /** Max results for listFolder (Dropbox enforces 2000 hard cap) */
  limit?: number;
  /** Cursor for pagination — supports {{}} */
  cursor?: string;
  /** Sharing link visibility */
  linkVisibility?: "public" | "team_only" | "password";
  /** Password for password-protected links */
  linkPassword?: string;
}

// ─── Datadog ─────────────────────────────────────────────────────────────────

export type DatadogOperation =
  | "metrics.submit"
  | "events.post"
  | "logs.submit";

/**
 * Datadog. Credential: `{ apiKey, appKey?, site? }`. site defaults to
 * "datadoghq.com". DD-API-KEY + (for some APIs) DD-APPLICATION-KEY.
 */
export interface DatadogConfig {
  credentialId?: string;
  operation: DatadogOperation;
  /** Metric name (metrics.submit) — supports {{}} */
  metricName?: string;
  /** Metric value — supports {{}} */
  metricValue?: string;
  /** Metric type */
  metricType?: "count" | "rate" | "gauge";
  /** Tags CSV — supports {{}} */
  tags?: string;
  /** Event / log title — supports {{}} */
  title?: string;
  /** Event / log body text — supports {{}} */
  text?: string;
  /** Event alert type */
  alertType?: "error" | "warning" | "info" | "success";
  /** Log service name — supports {{}} */
  service?: string;
  /** Log host — supports {{}} */
  host?: string;
  /** Log status */
  logStatus?: "ok" | "info" | "warning" | "error" | "critical";
  /** Source type name */
  source?: string;
}

// ─── PayPal ──────────────────────────────────────────────────────────────────

export type PaypalOperation =
  | "orders.create"
  | "orders.get"
  | "orders.capture"
  | "payments.captureAuthorization"
  | "payments.refund";

/**
 * PayPal REST v2. Credential: `{ clientId, clientSecret, environment? }`.
 * environment defaults to "live" — set to "sandbox" for the sandbox API.
 * The activity performs the client-credentials OAuth exchange on each call
 * (short-lived in-memory token — no caching across workflow runs).
 */
export interface PaypalConfig {
  credentialId?: string;
  operation: PaypalOperation;
  /** Order / authorization / capture ID — supports {{}} */
  resourceId?: string;
  /** Amount value (string to preserve decimal precision) — supports {{}} */
  amount?: string;
  /** ISO 4217 currency — default "USD" */
  currency?: string;
  /** Intent for orders.create */
  intent?: "CAPTURE" | "AUTHORIZE";
  /** Description — supports {{}} */
  description?: string;
  /** Extra params JSON (merged into orders.create body) — supports {{}} */
  extraParams?: string;
  /** PayPal-Request-Id idempotency header — supports {{}} */
  idempotencyKey?: string;
}

// ─── Square ──────────────────────────────────────────────────────────────────

export type SquareOperation =
  | "payments.create"
  | "payments.get"
  | "payments.list"
  | "customers.create"
  | "customers.list"
  | "catalog.listItems";

/**
 * Square Payments / Customers / Catalog. Credential: `{ accessToken,
 * environment? }`. environment defaults to "production"; set "sandbox" to
 * use connect.squareupsandbox.com.
 */
export interface SquareConfig {
  credentialId?: string;
  operation: SquareOperation;
  /** Resource ID — supports {{}} */
  resourceId?: string;
  /** Amount in the smallest currency unit (cents) — supports {{}} */
  amountMinor?: string;
  /** ISO 4217 currency — default "USD" */
  currency?: string;
  /** Source ID (card nonce or saved source) for payments.create — supports {{}} */
  sourceId?: string;
  /** Idempotency key — supports {{}} */
  idempotencyKey?: string;
  /** Customer given name — supports {{}} */
  givenName?: string;
  /** Customer family name — supports {{}} */
  familyName?: string;
  /** Customer email — supports {{}} */
  emailAddress?: string;
  /** Customer phone — supports {{}} */
  phoneNumber?: string;
  /** Note on payment — supports {{}} */
  note?: string;
  /** Limit for list ops (default 100) */
  limit?: number;
}

// ─── Resend ──────────────────────────────────────────────────────────────────

export type ResendOperation = "emails.send" | "emails.get";

/**
 * Resend. Credential: `{ apiKey }` (`re_...`). Bearer auth.
 */
export interface ResendConfig {
  credentialId?: string;
  operation: ResendOperation;
  /** From address — supports {{}} */
  from?: string;
  /** To CSV — supports {{}} */
  to?: string;
  /** CC CSV — supports {{}} */
  cc?: string;
  /** BCC CSV — supports {{}} */
  bcc?: string;
  /** Subject — supports {{}} */
  subject?: string;
  /** HTML body — supports {{}} */
  html?: string;
  /** Text body — supports {{}} */
  text?: string;
  /** Reply-To — supports {{}} */
  replyTo?: string;
  /** Tags JSON array [{"name": "...", "value": "..."}] — supports {{}} */
  tags?: string;
  /** Email ID for emails.get — supports {{}} */
  emailId?: string;
}

// ─── OneDrive ────────────────────────────────────────────────────────────────

export type OneDriveOperation =
  | "files.list"
  | "files.get"
  | "files.upload"
  | "files.delete"
  | "files.createShareLink";

/**
 * Microsoft OneDrive / Graph API v1.0. Credential: `{ accessToken }` — an
 * OAuth access token with Files.ReadWrite scope.
 */
export interface OneDriveConfig {
  credentialId?: string;
  operation: OneDriveOperation;
  /** Item ID (preferred) — supports {{}} */
  itemId?: string;
  /** OR remote path from drive root (e.g. "/reports/file.txt") — supports {{}} */
  path?: string;
  /** Parent path for upload — supports {{}} (root if empty) */
  parentPath?: string;
  /** File name for upload — supports {{}} */
  name?: string;
  /** Content for upload — supports {{}} */
  content?: string;
  /** MIME type */
  contentType?: string;
  /** Share link type */
  linkType?: "view" | "edit" | "embed";
  /** Share scope */
  linkScope?: "anonymous" | "organization";
}

// ─── Box ─────────────────────────────────────────────────────────────────────

export type BoxOperation =
  | "files.upload"
  | "files.download"
  | "files.get"
  | "files.delete"
  | "folders.list"
  | "files.createSharedLink";

/**
 * Box Content API v2.0. Credential: `{ accessToken }` — an OAuth / JWT
 * developer access token. Bearer auth.
 */
export interface BoxConfig {
  credentialId?: string;
  operation: BoxOperation;
  /** File ID — supports {{}} */
  fileId?: string;
  /** Folder ID ("0" = root) — supports {{}} */
  folderId?: string;
  /** File name for upload — supports {{}} */
  name?: string;
  /** File content for upload — supports {{}} */
  content?: string;
  /** Shared link access type */
  linkAccess?: "open" | "company" | "collaborators";
  /** Shared link password (only valid with access=open) */
  linkPassword?: string;
  /** Max items for folders.list (default 100, max 1000) */
  limit?: number;
  /** Offset for folders.list pagination */
  offset?: number;
}

// ─── CircleCI ────────────────────────────────────────────────────────────────

export type CircleCIOperation =
  | "pipelines.trigger"
  | "pipelines.get"
  | "pipelines.list"
  | "workflows.get"
  | "workflows.cancel"
  | "projects.get";

/**
 * CircleCI REST v2. Credential: `{ token }` — Personal API token from
 * circleci.com/user/tokens. Sent via Circle-Token header.
 */
export interface CircleCIConfig {
  credentialId?: string;
  operation: CircleCIOperation;
  /** Project slug: "{vcs}/{org}/{repo}", e.g. "github/acme/myrepo" — supports {{}} */
  projectSlug?: string;
  /** Branch to trigger on (default "main") — supports {{}} */
  branch?: string;
  /** Tag to trigger on (alternative to branch) — supports {{}} */
  tag?: string;
  /** Pipeline ID for pipelines.get — supports {{}} */
  pipelineId?: string;
  /** Workflow ID for workflows.get / workflows.cancel — supports {{}} */
  workflowId?: string;
  /** Parameters JSON object passed to the pipeline — supports {{}} */
  parameters?: string;
}

// ─── WhatsApp Business ───────────────────────────────────────────────────────

export type WhatsappOperation =
  | "messages.sendText"
  | "messages.sendTemplate"
  | "messages.sendMedia"
  | "messages.markAsRead";

/**
 * WhatsApp Business Cloud API (Meta Graph v20.0+). Credential:
 * `{ accessToken, phoneNumberId }`. Uses Bearer auth.
 */
export interface WhatsappConfig {
  credentialId?: string;
  operation: WhatsappOperation;
  /** Recipient phone number in E.164 (no + required) — supports {{}} */
  to?: string;
  /** Text body — supports {{}} */
  text?: string;
  /** Disable link previews (messages.sendText) */
  previewUrl?: boolean;
  /** Template name — supports {{}} */
  templateName?: string;
  /** Template language code (default "en_US") */
  templateLanguage?: string;
  /** Template components JSON — supports {{}} */
  templateComponents?: string;
  /** Media type for sendMedia */
  mediaType?: "image" | "document" | "audio" | "video" | "sticker";
  /** Media URL — supports {{}} */
  mediaUrl?: string;
  /** Media caption (image/video/document) — supports {{}} */
  caption?: string;
  /** Document filename — supports {{}} */
  filename?: string;
  /** Message ID for markAsRead — supports {{}} */
  messageId?: string;
}

// ─── Pipedrive ───────────────────────────────────────────────────────────────

export type PipedriveOperation =
  | "deals.create"
  | "deals.get"
  | "deals.update"
  | "deals.list"
  | "persons.create"
  | "persons.get"
  | "persons.update"
  | "persons.search"
  | "activities.create";

/**
 * Pipedrive v1 REST. Credential: `{ apiToken, companyDomain }` —
 * companyDomain like "mycorp" (maps to mycorp.pipedrive.com). Token is sent
 * as `api_token` query param per Pipedrive's convention.
 */
export interface PipedriveConfig {
  credentialId?: string;
  operation: PipedriveOperation;
  /** Object ID for get / update — supports {{}} */
  objectId?: string;
  /** JSON body with object properties — supports {{}} */
  body?: string;
  /** Search term for persons.search — supports {{}} */
  searchTerm?: string;
  /** Fields to search (default "name,email,phone") */
  searchFields?: string;
  /** Max results for list / search (default 100) */
  limit?: number;
  /** Start offset for list pagination */
  start?: number;
}

// ─── Customer.io ─────────────────────────────────────────────────────────────

export type CustomerIoOperation =
  | "identify"
  | "track"
  | "deleteCustomer"
  | "sendTransactional";

/**
 * Customer.io. Two credential shapes used depending on op:
 *   - Track API (identify/track/delete): `{ siteId, apiKey }` — Basic auth.
 *     Host defaults to https://track.customer.io (US) — set `region: "eu"` for
 *     track-eu.customer.io.
 *   - App API (sendTransactional): `{ appApiKey }` — Bearer. Host is
 *     https://api.customer.io (or api-eu.customer.io for EU).
 */
export interface CustomerIoConfig {
  credentialId?: string;
  operation: CustomerIoOperation;
  /** Customer ID (email or internal ID) — supports {{}} */
  customerId?: string;
  /** Event name for track — supports {{}} */
  eventName?: string;
  /** JSON `attributes` for identify — supports {{}} */
  attributes?: string;
  /** JSON `data` for track / sendTransactional — supports {{}} */
  data?: string;
  /** Transactional message ID — supports {{}} */
  transactionalId?: string;
  /** Recipient email for sendTransactional — supports {{}} */
  to?: string;
  /** Identifier type for transactional — "id" or "email" */
  identifierType?: "id" | "email";
  /** Identifier value — supports {{}} */
  identifierValue?: string;
}

// =============================================================================
// Phase 3 — Streaming + Analytics native node configs
// =============================================================================

// ─── Kafka ───────────────────────────────────────────────────────────────────

export type KafkaOperation = "produce" | "consume";

/**
 * Apache Kafka via kafkajs. Credential shape:
 *   `{ brokers, clientId?, ssl?, sasl?, saslMechanism?, username?, password? }`
 *   - brokers is a CSV list "host1:9092,host2:9092"
 *   - ssl "true" / "false"
 *   - saslMechanism: plain | scram-sha-256 | scram-sha-512
 */
export interface KafkaConfig {
  credentialId?: string;
  operation: KafkaOperation;
  /** Topic to produce to or consume from — supports {{}} */
  topic: string;
  /** Message key (producer) — supports {{}} */
  messageKey?: string;
  /** Message value (producer) — supports {{}} */
  messageValue?: string;
  /** JSON object of headers (producer) — supports {{}} */
  headers?: string;
  /** Partition (producer) — leave blank for round-robin */
  partition?: number;
  /** Acks level for produce: 0 (fire-and-forget) | 1 (leader) | -1 (all) */
  acks?: "0" | "1" | "-1";
  /** Consumer group ID (consume) */
  groupId?: string;
  /** Max messages to consume in one call (default 10) */
  maxMessages?: number;
  /** Max wait time in ms (consume) */
  maxWaitMs?: number;
  /** Read from "earliest" or "latest" when no committed offset */
  fromBeginning?: boolean;
}

// ─── NATS ────────────────────────────────────────────────────────────────────

export type NatsOperation =
  | "publish"
  | "request"
  | "subscribe"
  | "jetstream.publish";

/**
 * NATS (and JetStream). Credential shape:
 *   `{ servers, user?, pass?, token? }` — servers is a CSV list.
 */
export interface NatsConfig {
  credentialId?: string;
  operation: NatsOperation;
  /** Subject — supports {{}} */
  subject: string;
  /** Message body — supports {{}} */
  payload?: string;
  /** Reply subject for publish (optional) — supports {{}} */
  replyTo?: string;
  /** JSON object of headers — supports {{}} */
  headers?: string;
  /** Request timeout in ms (default 5000) */
  timeoutMs?: number;
  /** Max messages for subscribe (default 1) */
  maxMessages?: number;
  /** JetStream stream name (for jetstream.publish) */
  stream?: string;
  /** Msg-Id header for JetStream de-duplication — supports {{}} */
  msgId?: string;
}

// ─── Snowflake ───────────────────────────────────────────────────────────────

export type SnowflakeOperation = "query" | "execute";

/**
 * Snowflake via snowflake-sdk. Credential shape:
 *   `{ account, username, password? | privateKey?, database?, schema?,
 *      warehouse?, role? }`.
 *   - account like "xy12345.us-east-1"
 *   - supply EITHER password OR privateKey (PEM) for key-pair auth.
 */
export interface SnowflakeConfig {
  credentialId?: string;
  operation: SnowflakeOperation;
  /** SQL — supports {{}} */
  sql: string;
  /** JSON array of bind params (positional ?) — supports {{}} */
  binds?: string;
  /** Max rows to return (default 10000) */
  maxRows?: number;
  /** Override warehouse for this statement — supports {{}} */
  warehouse?: string;
  /** Override database for this statement — supports {{}} */
  database?: string;
  /** Override schema for this statement — supports {{}} */
  schema?: string;
  /** Override role for this statement — supports {{}} */
  role?: string;
}

// ─── ClickHouse ──────────────────────────────────────────────────────────────

export type ClickhouseOperation = "query" | "insert" | "command";

/**
 * ClickHouse via @clickhouse/client. Credential shape:
 *   `{ url, username?, password?, database? }`
 *   - url like "http://localhost:8123" or "https://my-cluster.clickhouse.cloud"
 */
export interface ClickhouseConfig {
  credentialId?: string;
  operation: ClickhouseOperation;
  /** SQL for query / command — supports {{}} */
  query?: string;
  /** Named params JSON object (maps to {name: value}) — supports {{}} */
  queryParams?: string;
  /** Table name for insert — supports {{}} */
  table?: string;
  /** JSON array of rows for insert — supports {{}} */
  rows?: string;
  /** Response format for query (default JSONEachRow) */
  format?:
    | "JSON"
    | "JSONEachRow"
    | "JSONCompact"
    | "CSV"
    | "TabSeparated";
  /** Max rows to read back for query (default 10000) */
  maxRows?: number;
}

// ─── Elasticsearch ───────────────────────────────────────────────────────────

export type ElasticsearchOperation =
  | "index"
  | "get"
  | "update"
  | "delete"
  | "search"
  | "bulk";

/**
 * Elasticsearch via @elastic/elasticsearch. Credential shape:
 *   `{ node, apiKey? | (username + password), ca? }`.
 */
export interface ElasticsearchConfig {
  credentialId?: string;
  operation: ElasticsearchOperation;
  /** Index name — supports {{}} */
  index: string;
  /** Document ID — supports {{}} */
  documentId?: string;
  /** Document body (JSON) — supports {{}} */
  document?: string;
  /** Search / update query DSL body (JSON) — supports {{}} */
  body?: string;
  /** Partial update `doc` JSON — supports {{}} */
  doc?: string;
  /** Operations for bulk (newline-delimited JSON) — supports {{}} */
  operations?: string;
  /** Refresh policy */
  refresh?: "true" | "false" | "wait_for";
  /** Max hits for search (default 10, max 10000) */
  size?: number;
  /** From offset for search */
  from?: number;
}

// =============================================================================
// Phase 4 — AI ecosystem node configs
// =============================================================================

// ─── AI Image (generation) ───────────────────────────────────────────────────

export type AiImageProvider = "openai" | "stability";

/**
 * Image generation. Credential:
 *   - openai: `{ apiKey }`
 *   - stability: `{ apiKey }` (Stability AI / SD API)
 */
export interface AiImageConfig {
  credentialId?: string;
  provider: AiImageProvider;
  /** Model name — openai: "dall-e-3" / "dall-e-2" / "gpt-image-1"; stability: "stable-diffusion-xl-1024-v1-0" etc. */
  model: string;
  /** Prompt — supports {{}} */
  prompt: string;
  /** Negative prompt (stability only) — supports {{}} */
  negativePrompt?: string;
  /** Image size — "1024x1024" for openai dall-e-3; "512x512" / "768x768" etc. for SD */
  size?: string;
  /** Quality (openai dall-e-3 only): "standard" | "hd" */
  quality?: "standard" | "hd";
  /** Style (openai dall-e-3 only): "vivid" | "natural" */
  style?: "vivid" | "natural";
  /** Number of images (openai: 1 for dall-e-3, up to 10 for dall-e-2) */
  n?: number;
  /** Response format — "url" | "b64_json" (openai) */
  responseFormat?: "url" | "b64_json";
  /** Seed (stability) */
  seed?: number;
  /** Steps (stability, default 30) */
  steps?: number;
  /** CFG scale (stability, default 7) */
  cfgScale?: number;
}

// ─── AI Transcribe (speech-to-text) ──────────────────────────────────────────

export type AiTranscribeProvider = "openai" | "assemblyai";

/**
 * Speech-to-text. Credential:
 *   - openai: `{ apiKey }` (Whisper API)
 *   - assemblyai: `{ apiKey }`
 */
export interface AiTranscribeConfig {
  credentialId?: string;
  provider: AiTranscribeProvider;
  /** Model — "whisper-1" for openai; default "best" for assemblyai */
  model?: string;
  /** Audio URL to fetch + transcribe — supports {{}} */
  audioUrl?: string;
  /** Audio body as base64 (optional alternative to URL) — supports {{}} */
  audioBase64?: string;
  /** Audio MIME type (for base64 uploads) */
  audioMimeType?: string;
  /** Audio filename hint */
  audioFilename?: string;
  /** Language code (ISO-639-1) — supports {{}} */
  language?: string;
  /** OpenAI response format */
  responseFormat?: "json" | "text" | "srt" | "verbose_json" | "vtt";
  /** AssemblyAI: enable speaker labels */
  speakerLabels?: boolean;
  /** Prompt / context to steer transcription — supports {{}} */
  prompt?: string;
}

// ─── AI TTS (text-to-speech) ─────────────────────────────────────────────────

export type AiTtsProvider = "openai" | "elevenlabs";

/**
 * Text-to-speech. Credential:
 *   - openai: `{ apiKey }`
 *   - elevenlabs: `{ apiKey }`
 */
export interface AiTtsConfig {
  credentialId?: string;
  provider: AiTtsProvider;
  /** Model — "tts-1" / "tts-1-hd" for openai; "eleven_multilingual_v2" etc. for ElevenLabs */
  model?: string;
  /** Text to synthesise — supports {{}} */
  text: string;
  /** Voice — openai: "alloy"/"echo"/"fable"/"onyx"/"nova"/"shimmer"; elevenlabs: voice ID */
  voice?: string;
  /** Output format — openai: "mp3"/"opus"/"aac"/"flac"; elevenlabs: "mp3_44100_128" etc. */
  format?: string;
  /** Speed (openai 0.25–4.0, default 1) */
  speed?: number;
  /** ElevenLabs: voice stability (0–1) */
  stability?: number;
  /** ElevenLabs: similarity boost (0–1) */
  similarityBoost?: number;
}

// ─── AI Embed (text → vector) ────────────────────────────────────────────────

export type AiEmbedProvider = "openai" | "cohere" | "huggingface";

/**
 * Text embeddings. Credential:
 *   - openai: `{ apiKey }`
 *   - cohere: `{ apiKey }`
 *   - huggingface: `{ apiToken }` (uses feature-extraction pipeline)
 */
export interface AiEmbedConfig {
  credentialId?: string;
  provider: AiEmbedProvider;
  /** Model — e.g. "text-embedding-3-small"; cohere "embed-english-v3.0"; HF model ID */
  model: string;
  /** JSON array of input strings — supports {{}} */
  input: string;
  /** Cohere `input_type` */
  inputType?:
    | "search_document"
    | "search_query"
    | "classification"
    | "clustering";
  /** OpenAI: requested dimensions (optional override, e.g. 1536 → 512) */
  dimensions?: number;
  /** OpenAI: encoding_format "float" | "base64" */
  encodingFormat?: "float" | "base64";
}

// ─── Vector DB (Pinecone / Weaviate / Qdrant) ────────────────────────────────

export type VectorDbProvider = "pinecone" | "weaviate" | "qdrant";

export type VectorDbOperation =
  | "upsert"
  | "query"
  | "delete"
  | "fetch";

/**
 * Vector DB — driver selected at runtime.
 *   - pinecone: `{ apiKey, indexHost }` (indexHost from pinecone-console, per index)
 *   - weaviate: `{ url, apiKey? }` (api key for Weaviate Cloud)
 *   - qdrant: `{ url, apiKey? }`
 */
export interface VectorDbConfig {
  credentialId?: string;
  provider: VectorDbProvider;
  operation: VectorDbOperation;
  /** Collection / index / class name — supports {{}} */
  collection: string;
  /** Namespace (Pinecone) — supports {{}} */
  namespace?: string;
  /** JSON array of vectors for upsert — each `{ id, values, metadata? }` — supports {{}} */
  vectors?: string;
  /** Query vector (JSON array of numbers) — supports {{}} */
  queryVector?: string;
  /** Top-k for query (default 10) */
  topK?: number;
  /** Filter JSON (provider-specific shape) — supports {{}} */
  filter?: string;
  /** IDs JSON array for fetch / delete — supports {{}} */
  ids?: string;
  /** Include values / metadata in query results */
  includeValues?: boolean;
  includeMetadata?: boolean;
}

// =============================================================================
// Union of all node configs
// =============================================================================

export type NodeConfig =
  // Triggers
  | ManualTriggerConfig
  | WebhookConfig
  | CronConfig
  | MqttConfig
  | ExternalTriggerConfig
  | TriggerOutputConfig
  | WorkflowTriggerInConfig
  | WorkflowTriggerOutConfig
  // Logical
  | IfElseConfig
  | SwitchConfig
  | DelayConfig
  | MergeConfig
  | StopConfig
  | LoopConfig
  // Utilities
  | HttpRequestConfig
  | JsRunnerConfig
  | DataMapperConfig
  | JsonParserConfig
  | HtmlTemplateConfig
  | CryptoHashConfig
  | DateFormatterConfig
  | Base64Config
  | SubworkflowCallConfig
  | SubflowOutputConfig
  | ResponseConfig
  // Data & Storage
  | PostgresConfig
  | MysqlConfig
  | MongodbConfig
  | RedisConfig
  | S3BucketConfig
  | MariadbConfig
  | MssqlConfig
  | GoogleSheetsConfig
  // Communication
  | RabbitMQConfig
  | SendEmailConfig
  | SlackConfig
  | SshTerminalConfig
  | TwilioSmsConfig
  | TwilioEmailConfig
  | FirebasePushConfig
  | ApnsPushConfig
  // AI Agents
  | LlmPromptConfig
  | AiAgentConfig
  // Code
  | JsRunnerConfig
  | TsRunnerConfig
  | PythonRunnerConfig
  | CustomCodeConfig
  | CustomBuilderConfig
  | DebugConfig
  | GroupConfig
  // AWS Cloud
  | AwsLambdaConfig
  | AwsSqsConfig
  | AwsSnsConfig
  | AwsDynamoDBConfig
  | AwsSesConfig
  | AwsSecretsManagerConfig
  | AwsSsmConfig
  | AwsEventBridgeConfig
  | AwsStepFunctionsConfig
  // Azure Cloud
  | AzureBlobConfig
  | AzureServiceBusConfig
  | AzureCosmosConfig
  | AzureKeyVaultConfig
  | AzureFunctionsConfig
  // Google Cloud
  | GcpStorageConfig
  | GcpPubSubConfig
  | GcpBigQueryConfig
  // Oracle Cloud
  | OracleDbConfig
  | OciObjectStorageConfig
  // SaaS Integrations (Phase 2)
  | StripeConfig
  | GithubConfig
  | DiscordConfig
  | NotionConfig
  | SalesforceConfig
  | JiraConfig
  | MsTeamsConfig
  | HubspotConfig
  | AirtableConfig
  | PagerDutyConfig
  | GitlabConfig
  | LinearConfig
  | TelegramConfig
  | SendgridConfig
  | SentryConfig
  | ShopifyConfig
  | MailchimpConfig
  | GoogleDriveConfig
  | DropboxConfig
  | DatadogConfig
  | PaypalConfig
  | SquareConfig
  | ResendConfig
  | OneDriveConfig
  | BoxConfig
  | CircleCIConfig
  | WhatsappConfig
  | PipedriveConfig
  | CustomerIoConfig
  // Phase 3: Streaming + Analytics
  | KafkaConfig
  | NatsConfig
  | SnowflakeConfig
  | ClickhouseConfig
  | ElasticsearchConfig
  // Phase 4: AI ecosystem
  | AiImageConfig
  | AiTranscribeConfig
  | AiTtsConfig
  | AiEmbedConfig
  | VectorDbConfig;

// =============================================================================
// Graph primitives
// =============================================================================

export interface NodeStyle {
  /** Override the node header background color (hex). Falls back to nodeRegistry[kind].color */
  headerColor?: string;
  /** Override the node header icon (Lucide icon name). Falls back to nodeRegistry[kind].icon */
  icon?: string;
  /** Override handle positions per direction type */
  handlePositions?: {
    /** Position for all target (input) handles. Falls back to registry definition. */
    input?: "left" | "right" | "top" | "bottom";
    /** Position for all source (output) handles. Falls back to registry definition. */
    output?: "left" | "right" | "top" | "bottom";
  };
}

export interface EdgeStyle {
  /** Override edge color (hex). Falls back to theme default */
  color?: string;
  /** Stroke width 1–5. Default: 2 */
  width?: number;
  /** Render edge as dashed */
  dashed?: boolean;
}

export interface WorkflowNode {
  id: string;
  kind: NodeKind;
  label: string;
  config: NodeConfig;
  position?: { x: number; y: number };
  /** Per-node visual style overrides */
  style?: NodeStyle;
  /**
   * xyflow parent-child link. When set, this node is a child of a "group"
   * node with this id; its `position` is parent-relative. Ungrouping rewrites
   * positions back to world space and clears this field.
   */
  parentId?: string;
}

export interface WorkflowEdge {
  id: string;
  source: string;
  target: string;
  sourceHandle?: string;
  label?: string;
  /** Per-edge visual style overrides */
  style?: EdgeStyle;
}

// =============================================================================
// Workflow settings (Temporal execution options)
// =============================================================================

export interface WorkflowRetryPolicy {
  /** Max retry attempts for failed activities. Default: 3 */
  maximumAttempts?: number;
  /** Initial retry interval (e.g. "2s", "500ms"). Default: "2s" */
  initialInterval?: string;
  /** Backoff multiplier. Default: 2 */
  backoffCoefficient?: number;
  /** Max interval between retries (e.g. "30s", "5m"). Default: "30s" */
  maximumInterval?: string;
}

export interface WorkflowSettings {
  /** Max time for the entire workflow execution (e.g. "1h", "30m"). Default: none (unlimited) */
  workflowExecutionTimeout?: string;
  /** Max time for a single workflow run (e.g. "30m"). Default: none */
  workflowRunTimeout?: string;
  /** Max time for each activity to complete (e.g. "5m"). Default: "5 minutes" */
  activityStartToCloseTimeout?: string;
  /** Max time from scheduling to starting an activity (e.g. "1m"). Default: none */
  activityScheduleToStartTimeout?: string;
  /** Retry policy applied to all activities */
  retry?: WorkflowRetryPolicy;
}

// =============================================================================
// Top-level template
// =============================================================================

export interface WorkflowTemplate {
  version: "1.0";
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
  settings?: WorkflowSettings;
}

// =============================================================================
// Execution status & log level enums
// =============================================================================

export type ExecutionStatus =
  | "pending"
  | "running"
  | "completed"
  | "failed"
  | "cancelled"
  | "timed_out";

export type LogLevel = "debug" | "info" | "warn" | "error";
