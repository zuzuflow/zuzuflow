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
  | "azure_blob";

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
  | AzureBlobConfig;

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
