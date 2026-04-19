import type {
  NodeKind,
  NodeConfig,
  ManualTriggerConfig,
  WebhookConfig,
  CronConfig,
  MqttConfig,
  ExternalTriggerConfig,
  TriggerOutputConfig,
  WorkflowTriggerInConfig,
  WorkflowTriggerOutConfig,
  SubworkflowCallConfig,
  SubflowOutputConfig,
  StopConfig,
  RabbitMQConfig,
  IfElseConfig,
  SwitchConfig,
  DelayConfig,
  MergeConfig,
  HttpRequestConfig,
  JsRunnerConfig,
  TsRunnerConfig,
  DataMapperConfig,
  JsonParserConfig,
  HtmlTemplateConfig,
  CryptoHashConfig,
  DateFormatterConfig,
  Base64Config,
  PostgresConfig,
  MysqlConfig,
  MongodbConfig,
  RedisConfig,
  S3BucketConfig,
  SendEmailConfig,
  SlackConfig,
  SshTerminalConfig,
  TwilioSmsConfig,
  TwilioEmailConfig,
  MariadbConfig,
  MssqlConfig,
  GoogleSheetsConfig,
  PythonRunnerConfig,
  FirebasePushConfig,
  ApnsPushConfig,
  LoopConfig,
  ResponseConfig,
  LlmPromptConfig,
  AiAgentConfig,
  CustomCodeConfig,
  CustomBuilderConfig,
  GroupConfig,
  DebugConfig,
  AwsLambdaConfig,
  AwsSqsConfig,
  AwsSnsConfig,
  AwsDynamoDBConfig,
  AwsSesConfig,
  AwsSecretsManagerConfig,
  AwsSsmConfig,
  AwsEventBridgeConfig,
  AwsStepFunctionsConfig,
} from "@workflow/shared";

// =============================================================================
// Category system — hex colors are the single source of truth
// =============================================================================

export type NodeCategory =
  | "trigger" // #7c3aed violet
  | "logical" // #FF9F29 amber-orange
  | "utilities" // #3AB4F2 sky-blue
  | "data_storage" // #2EB086 teal
  | "communication" // #7F56D9 purple
  | "ai_agents" // #F9D923 yellow
  | "code" // #3178c6 blue
  | "cloud"; // #FF9900 AWS orange

export const CATEGORY_COLOR: Record<NodeCategory, string> = {
  trigger: "#7c3aed",
  logical: "#FF9F29",
  utilities: "#3AB4F2",
  data_storage: "#2EB086",
  communication: "#7F56D9",
  ai_agents: "#F9D923",
  code: "#3178c6",
  cloud: "#FF9900",
};

export interface HandleDef {
  type: "source" | "target";
  id: string;
  position: "top" | "bottom" | "left" | "right";
  label?: string;
}

export interface NodeRegistryEntry {
  label: string;
  category: NodeCategory;
  /** Hex colour — used for node header background + minimap + palette accents */
  color: string;
  /** Lucide icon name */
  icon: string;
  description: string;
  defaultLabel: string;
  defaultConfig: NodeConfig;
  handles: HandleDef[];
  /** When true, the node is hidden from the palette (still functional in saved workflows) */
  hidden?: boolean;
}

// =============================================================================
// Default configs
// =============================================================================

const defaultManualConfig: ManualTriggerConfig = {
  value: "",
  valueType: "json",
};

const defaultWebhookConfig: WebhookConfig = {
  path: "my-webhook",
  method: "POST",
};
const defaultCronConfig: CronConfig = {
  expression: "0 * * * *",
  timezone: "UTC",
};
const defaultMqttConfig: MqttConfig = {
  brokerUrl: "mqtt://broker.hivemq.com:1883",
  topic: "my/topic",
  qos: 0,
};
const defaultExtConfig: ExternalTriggerConfig = {};
const defaultTriggerOutputConfig: TriggerOutputConfig = {
  body: '{"success": true}',
};
const defaultWfTriggerInConfig: WorkflowTriggerInConfig = {};
const defaultWfTriggerOutConfig: WorkflowTriggerOutConfig = {
  targetWorkflowId: "",
};
const defaultSubworkflowCallConfig: SubworkflowCallConfig = {
  subworkflowId: "",
  outputCount: 1,
};
const defaultSubflowOutputConfig: SubflowOutputConfig = {
  outputIndex: 0,
  label: "output 1",
};

const defaultIfElseConfig: IfElseConfig = {
  condition: {
    combinator: "and",
    rules: [{ field: "$.body.status", operator: "equals", value: "ok" }],
  },
};
const defaultSwitchConfig: SwitchConfig = {
  expression: "{{$.body.status}}",
  cases: [
    { value: "ok", label: "ok" },
    { value: "error", label: "error" },
  ],
  defaultLabel: "default",
};
const defaultDelayConfig: DelayConfig = { amount: 5, unit: "minutes" };
const defaultMergeConfig: MergeConfig = { mode: "all", branchCount: 2 };
const defaultStopConfig: StopConfig = { message: "" };

const defaultHttpConfig: HttpRequestConfig = {
  url: "https://example.com/api",
  method: "GET",
  headers: [],
  queryParams: [],
  timeoutMs: 30000,
  failOnError: true,
};
const defaultJsRunnerConfig: JsRunnerConfig = {
  expression: "const main = (input, context) => {\n  return null;\n}",
  timeoutMs: 5000,
};
const defaultTsRunnerConfig: TsRunnerConfig = {
  expression:
    "const main = (input: Record<string, unknown>, context: { workflowId: string; executionId: string; triggerPayload: Record<string, unknown> }) => {\n  return null;\n}",
  timeoutMs: 5000,
};
const defaultDataMapperConfig: DataMapperConfig = {
  mappings: [{ from: "input.body.name", to: "name" }],
};
const defaultJsonParserConfig: JsonParserConfig = {
  input: "{{input.body.json}}",
};
const defaultHtmlTemplateConfig: HtmlTemplateConfig = {
  template: "<h1>Hello {{input.name}}</h1>",
};
const defaultCryptoHashConfig: CryptoHashConfig = {
  algorithm: "sha256",
  input: "{{input.value}}",
  encoding: "hex",
};
const defaultDateFormatterConfig: DateFormatterConfig = {
  input: "{{input.date}}",
  outputFormat: "YYYY-MM-DD HH:mm:ss",
  timezone: "UTC",
};
const defaultBase64Config: Base64Config = {
  operation: "encode",
  input: "{{input.value}}",
};

const defaultPostgresConfig: PostgresConfig = {
  query: "SELECT * FROM users WHERE id = $1",
  params: [],
};
const defaultMysqlConfig: MysqlConfig = {
  query: "SELECT * FROM users WHERE id = ?",
  params: [],
};
const defaultMongodbConfig: MongodbConfig = {
  database: "mydb",
  collection: "users",
  operation: "findOne",
  filter: '{"_id": "{{input.id}}"}',
};
const defaultRedisConfig: RedisConfig = {
  operation: "get",
  key: "{{input.key}}",
};
const defaultS3Config: S3BucketConfig = {
  bucket: "my-bucket",
  operation: "getObject",
  key: "{{input.key}}",
};

const defaultMariadbConfig: MariadbConfig = {
  query: "SELECT * FROM users WHERE id = ?",
  params: [],
};
const defaultMssqlConfig: MssqlConfig = {
  server: "",
  database: "",
  query: "SELECT * FROM users WHERE id = @id",
  params: [],
};
const defaultGoogleSheetsConfig: GoogleSheetsConfig = {
  spreadsheetId: "",
  operation: "read_range",
  range: "Sheet1!A1:D10",
  valueInputOption: "USER_ENTERED",
};
const defaultPythonRunnerConfig: PythonRunnerConfig = {
  code: 'import json\n\ndef main(input):\n    return {"result": "hello from python"}\n\nresult = main(input)',
  timeoutMs: 10000,
};
const defaultFirebasePushConfig: FirebasePushConfig = {
  target: "{{input.deviceToken}}",
  targetType: "token",
  title: "Notification",
  body: "Hello from workflow",
};
const defaultApnsPushConfig: ApnsPushConfig = {
  deviceToken: "{{input.deviceToken}}",
  bundleId: "com.example.app",
  title: "Notification",
  body: "Hello from workflow",
  production: false,
  pushType: "alert",
};
const defaultLoopConfig: LoopConfig = {
  items: "{{$.body.items}}",
  maxIterations: 1000,
  itemVariable: "item",
  indexVariable: "index",
};
const defaultResponseConfig: ResponseConfig = {
  statusCode: 200,
  contentType: "application/json",
  body: '{"success": true}',
};

const defaultRabbitMQConfig: RabbitMQConfig = {
  operation: "publish_queue",
  queueName: "my.queue",
  messageBody: '{"event": "{{input.type}}"}',
  assertQueue: true,
  queueOptions: { durable: true },
  messageProperties: { persistent: true, contentType: "application/json" },
};
const defaultSendEmailConfig: SendEmailConfig = {
  provider: "smtp",
  to: "recipient@example.com",
  subject: "Hello from Workflow",
  body: "Your workflow ran successfully.",
};
const defaultSlackConfig: SlackConfig = {
  channel: "#notifications",
  message: "Workflow executed: {{input.status}}",
};
const defaultSshConfig: SshTerminalConfig = {
  host: "",
  username: "ubuntu",
  command: "echo hello",
  timeout: 30000,
};
const defaultTwilioSmsConfig: TwilioSmsConfig = {
  from: "+1234567890",
  to: "{{input.phone}}",
  body: "{{input.message}}",
};
const defaultTwilioEmailConfig: TwilioEmailConfig = {
  from: "noreply@example.com",
  to: "{{input.email}}",
  subject: "Notification",
  body: "{{input.message}}",
};

// AWS defaults
const defaultAwsLambdaConfig: AwsLambdaConfig = {
  operation: "invoke",
  functionName: "",
  invocationType: "RequestResponse",
};
const defaultAwsSqsConfig: AwsSqsConfig = {
  operation: "sendMessage",
  queueUrl: "",
  messageBody: '{"event": "{{input.type}}"}',
};
const defaultAwsSnsConfig: AwsSnsConfig = {
  operation: "publish",
  topicArn: "",
  message: "{{input.message}}",
};
const defaultAwsDynamoDBConfig: AwsDynamoDBConfig = {
  operation: "getItem",
  tableName: "",
  key: '{"id": "{{input.id}}"}',
};
const defaultAwsSesConfig: AwsSesConfig = {
  operation: "sendEmail",
  from: "",
  to: "",
  subject: "Notification",
  textBody: "Hello from workflow",
};
const defaultAwsSecretsManagerConfig: AwsSecretsManagerConfig = {
  operation: "getSecretValue",
  secretId: "",
};
const defaultAwsSsmConfig: AwsSsmConfig = {
  operation: "getParameter",
  name: "",
  withDecryption: true,
};
const defaultAwsEventBridgeConfig: AwsEventBridgeConfig = {
  operation: "putEvents",
  source: "workflow",
  detailType: "WorkflowEvent",
  detail: '{"action": "{{input.action}}"}',
};
const defaultAwsStepFunctionsConfig: AwsStepFunctionsConfig = {
  operation: "startExecution",
  stateMachineArn: "",
};

const defaultLlmConfig: LlmPromptConfig = {
  provider: "openai",
  model: "gpt-4o-mini",
  prompt: "{{input.userMessage}}",
  systemPrompt: "You are a helpful assistant.",
  maxTokens: 1024,
  temperature: 0.7,
};

const defaultAiAgentConfig: AiAgentConfig = {
  provider: "openai",
  model: "gpt-4o-mini",
  prompt: "{{input.userMessage}}",
  systemPrompt:
    "You are a helpful AI assistant with access to tools. Use them when needed to complete the task.",
  maxTokens: 1024,
  temperature: 0.7,
  tools: [],
  maxIterations: 10,
};

const defaultCustomCodeConfig: CustomCodeConfig = {
  code: `// \`input\` contains all previous node outputs keyed by node ID.
async function run(input: Record<string, unknown>) {
  return { result: "hello world" };
}`,
  timeoutMs: 10000,
  memoryMb: 128,
};
const defaultDebugConfig: DebugConfig = {
  label: "Debug Output",
  breakpoint: false,
};

// Default group config — created from multi-selection, never from the palette.
const defaultGroupConfig: GroupConfig = {
  label: "Group",
  color: "#64748b",
  locked: true,
  width: 280,
  height: 180,
};

// Placeholder — real snapshots come from a CustomNodeTemplate at drop-time.
const defaultCustomBuilderConfig: CustomBuilderConfig = {
  templateId: "",
  templateKey: "",
  templateVersion: 1,
  name: "Custom Node",
  icon: "Puzzle",
  color: "#8b5cf6",
  category: "utilities",
  inputs: [{ id: "in", label: "in" }],
  outputs: [{ id: "out", label: "out" }],
  inputsSchema: [],
  executionMode: "sandbox",
  code: "",
  templateInputs: {},
  credentialRef: null,
};

// =============================================================================
// Shared handle sets
// =============================================================================

const TRIGGER_HANDLES: HandleDef[] = [
  { type: "source", id: "out", position: "bottom", label: "out" },
];
const ACTION_HANDLES: HandleDef[] = [
  { type: "target", id: "in", position: "top" },
  { type: "source", id: "out", position: "bottom" },
];

// =============================================================================
// Registry
// =============================================================================

export const nodeRegistry: Record<NodeKind, NodeRegistryEntry> = {
  // ── TRIGGERS ────────────────────────────────────────────────────────────────

  manual: {
    label: "Immediate",
    category: "trigger",
    color: "#7c3aed",
    icon: "Play",
    description:
      "Run the workflow immediately with an optional typed input payload",
    defaultLabel: "Immediate",
    defaultConfig: defaultManualConfig,
    handles: TRIGGER_HANDLES,
  },
  webhook: {
    label: "Webhook",
    category: "trigger",
    color: "#7c3aed",
    icon: "Webhook",
    description: "Trigger workflow via HTTP webhook",
    defaultLabel: "Webhook Trigger",
    defaultConfig: defaultWebhookConfig,
    handles: TRIGGER_HANDLES,
  },
  cron: {
    label: "Cron",
    category: "trigger",
    color: "#7c3aed",
    icon: "Clock",
    description: "Trigger workflow on a schedule",
    defaultLabel: "Cron Trigger",
    defaultConfig: defaultCronConfig,
    handles: TRIGGER_HANDLES,
  },
  mqtt_trigger: {
    label: "MQTT Trigger",
    category: "trigger",
    color: "#7c3aed",
    icon: "Radio",
    description: "Trigger workflow on MQTT message",
    defaultLabel: "MQTT Trigger",
    defaultConfig: defaultMqttConfig,
    handles: TRIGGER_HANDLES,
  },
  external_trigger: {
    label: "External Trigger",
    category: "trigger",
    color: "#7c3aed",
    icon: "Terminal",
    description: "Trigger from an external Node.js app via npm package",
    defaultLabel: "External Trigger",
    defaultConfig: defaultExtConfig,
    handles: TRIGGER_HANDLES,
  },
  trigger_output: {
    label: "Trigger Response",
    category: "trigger",
    color: "#7c3aed",
    icon: "Reply",
    description: "Return data to the external trigger caller (npm package)",
    defaultLabel: "Trigger Response",
    defaultConfig: defaultTriggerOutputConfig,
    handles: [{ type: "target", id: "in", position: "top" }],
  },
  workflow_trigger_in: {
    label: "Workflow In",
    category: "trigger",
    color: "#7c3aed",
    icon: "ArrowDownToLine",
    description: "Entry point when called from another workflow",
    defaultLabel: "Workflow In",
    defaultConfig: defaultWfTriggerInConfig,
    handles: TRIGGER_HANDLES,
    hidden: true,
  },
  workflow_trigger_out: {
    label: "Workflow Out",
    category: "trigger",
    color: "#7c3aed",
    icon: "ArrowUpFromLine",
    description: "Call another workflow that has a Workflow In node",
    defaultLabel: "Workflow Out",
    defaultConfig: defaultWfTriggerOutConfig,
    handles: ACTION_HANDLES,
    hidden: true,
  },
  subflow_input: {
    label: "Input",
    category: "trigger",
    color: "#0ea5e9",
    icon: "LogIn",
    description:
      "Virtual input port — receives data from the parent workflow when this subworkflow is called",
    defaultLabel: "Input",
    defaultConfig: {},
    handles: TRIGGER_HANDLES,
    hidden: true,
  },
  subflow_output: {
    label: "Output",
    category: "logical",
    color: "#0ea5e9",
    icon: "LogOut",
    description:
      "Virtual output port — returns data to the parent workflow. Add multiple for branching.",
    defaultLabel: "Output",
    defaultConfig: defaultSubflowOutputConfig,
    handles: [{ type: "target", id: "in", position: "top" }],
    hidden: true,
  },

  // ── LOGICAL ─────────────────────────────────────────────────────────────────

  if_else: {
    label: "If / Else",
    category: "logical",
    color: "#FF9F29",
    icon: "GitBranch",
    description: "Branch based on a condition",
    defaultLabel: "If / Else",
    defaultConfig: defaultIfElseConfig,
    handles: [
      { type: "target", id: "in", position: "top" },
      { type: "source", id: "true", position: "bottom", label: "true" },
      { type: "source", id: "false", position: "bottom", label: "false" },
    ],
  },
  switch: {
    label: "Switch",
    category: "logical",
    color: "#FF9F29",
    icon: "ToggleLeft",
    description: "Multi-branch switch expression",
    defaultLabel: "Switch",
    defaultConfig: defaultSwitchConfig,
    handles: [
      { type: "target", id: "in", position: "top" },
      { type: "source", id: "default", position: "bottom", label: "default" },
    ],
  },
  delay: {
    label: "Delay",
    category: "logical",
    color: "#FF9F29",
    icon: "Timer",
    description: "Pause execution for a fixed time",
    defaultLabel: "Delay",
    defaultConfig: defaultDelayConfig,
    handles: ACTION_HANDLES,
  },
  merge: {
    label: "Merge / Join",
    category: "logical",
    color: "#FF9F29",
    icon: "Merge",
    description: "Merge multiple branches into one",
    defaultLabel: "Merge",
    defaultConfig: defaultMergeConfig,
    handles: ACTION_HANDLES,
  },
  stop: {
    label: "Stop",
    category: "logical",
    color: "#FF9F29",
    icon: "OctagonX",
    description: "Terminate workflow execution at this point",
    defaultLabel: "Stop",
    defaultConfig: defaultStopConfig,
    handles: [{ type: "target", id: "in", position: "top" }],
  },
  loop: {
    label: "Loop",
    category: "logical",
    color: "#FF9F29",
    icon: "Repeat",
    description:
      "Iterate over an array and execute downstream nodes for each item",
    defaultLabel: "Loop",
    defaultConfig: defaultLoopConfig,
    handles: [
      { type: "target", id: "in", position: "top" },
      { type: "source", id: "body", position: "bottom", label: "body" },
      { type: "source", id: "done", position: "bottom", label: "done" },
    ],
  },

  // ── UTILITIES ───────────────────────────────────────────────────────────────

  http_request: {
    label: "HTTP Request",
    category: "utilities",
    color: "#3AB4F2",
    icon: "Globe",
    description: "Make an HTTP/HTTPS request",
    defaultLabel: "HTTP Request",
    defaultConfig: defaultHttpConfig,
    handles: ACTION_HANDLES,
  },
  js_runner: {
    label: "JS Runner",
    category: "code",
    color: "#3178c6",
    icon: "Braces",
    description: "Evaluate a JavaScript expression in a sandbox",
    defaultLabel: "JS Runner",
    defaultConfig: defaultJsRunnerConfig,
    handles: ACTION_HANDLES,
  },
  data_mapper: {
    label: "Data Mapper",
    category: "utilities",
    color: "#3AB4F2",
    icon: "ArrowLeftRight",
    description: "Map and rename fields from previous nodes",
    defaultLabel: "Data Mapper",
    defaultConfig: defaultDataMapperConfig,
    handles: ACTION_HANDLES,
  },
  json_parser: {
    label: "JSON Parser",
    category: "utilities",
    color: "#3AB4F2",
    icon: "FileJson",
    description: "Parse a JSON string into an object",
    defaultLabel: "JSON Parser",
    defaultConfig: defaultJsonParserConfig,
    handles: ACTION_HANDLES,
  },
  html_template: {
    label: "HTML Template",
    category: "utilities",
    color: "#3AB4F2",
    icon: "FileCode2",
    description: "Render an HTML template with dynamic values",
    defaultLabel: "HTML Template",
    defaultConfig: defaultHtmlTemplateConfig,
    handles: ACTION_HANDLES,
  },
  crypto_hash: {
    label: "Crypto / Hash",
    category: "utilities",
    color: "#3AB4F2",
    icon: "ShieldCheck",
    description: "Hash or encode data (SHA-256, MD5, etc.)",
    defaultLabel: "Crypto / Hash",
    defaultConfig: defaultCryptoHashConfig,
    handles: ACTION_HANDLES,
  },
  date_formatter: {
    label: "Date Formatter",
    category: "utilities",
    color: "#3AB4F2",
    icon: "CalendarClock",
    description: "Format and convert date/time values",
    defaultLabel: "Date Formatter",
    defaultConfig: defaultDateFormatterConfig,
    handles: ACTION_HANDLES,
  },
  base64: {
    label: "Base64",
    category: "utilities",
    color: "#3AB4F2",
    icon: "Binary",
    description: "Encode or decode Base64 strings",
    defaultLabel: "Base64",
    defaultConfig: defaultBase64Config,
    handles: ACTION_HANDLES,
  },
  subworkflow_call: {
    label: "Subworkflow",
    category: "utilities",
    color: "#0ea5e9",
    icon: "GitFork",
    description: "Call a reusable subworkflow and wait for its result",
    defaultLabel: "Subworkflow",
    defaultConfig: defaultSubworkflowCallConfig,
    // Handles are rendered dynamically in SubworkflowCallNode based on config.outputCount
    handles: [],
  },
  response: {
    label: "Response",
    category: "utilities",
    color: "#3AB4F2",
    icon: "Reply",
    description: "Customize the HTTP response for webhook-triggered workflows",
    defaultLabel: "Response",
    defaultConfig: defaultResponseConfig,
    handles: [{ type: "target", id: "in", position: "top" }],
  },

  // ── DATA & STORAGE ──────────────────────────────────────────────────────────

  postgres_query: {
    label: "Postgres",
    category: "data_storage",
    color: "#2EB086",
    icon: "Database",
    description: "Run a parameterized PostgreSQL query",
    defaultLabel: "Postgres Query",
    defaultConfig: defaultPostgresConfig,
    handles: ACTION_HANDLES,
  },
  mysql: {
    label: "MySQL",
    category: "data_storage",
    color: "#2EB086",
    icon: "Database",
    description: "Run a parameterized MySQL query",
    defaultLabel: "MySQL Query",
    defaultConfig: defaultMysqlConfig,
    handles: ACTION_HANDLES,
  },
  mongodb: {
    label: "MongoDB",
    category: "data_storage",
    color: "#2EB086",
    icon: "Layers",
    description: "Read or write MongoDB documents",
    defaultLabel: "MongoDB",
    defaultConfig: defaultMongodbConfig,
    handles: ACTION_HANDLES,
  },
  redis: {
    label: "Redis K-V Store",
    category: "data_storage",
    color: "#2EB086",
    icon: "ServerCog",
    description: "Get, set, or delete Redis keys",
    defaultLabel: "Redis",
    defaultConfig: defaultRedisConfig,
    handles: ACTION_HANDLES,
  },
  s3_bucket: {
    label: "S3 Bucket",
    category: "cloud",
    color: "#3F8624",
    icon: "Archive",
    description: "Read, write, or list objects in an S3 bucket",
    defaultLabel: "S3 Bucket",
    defaultConfig: defaultS3Config,
    handles: ACTION_HANDLES,
  },
  mariadb: {
    label: "MariaDB",
    category: "data_storage",
    color: "#2EB086",
    icon: "Database",
    description: "Run a parameterized MariaDB query",
    defaultLabel: "MariaDB Query",
    defaultConfig: defaultMariadbConfig,
    handles: ACTION_HANDLES,
  },
  mssql: {
    label: "MS SQL Server",
    category: "data_storage",
    color: "#2EB086",
    icon: "Database",
    description: "Run a parameterized SQL Server query",
    defaultLabel: "MSSQL Query",
    defaultConfig: defaultMssqlConfig,
    handles: ACTION_HANDLES,
  },
  google_sheets: {
    label: "Google Sheets",
    category: "data_storage",
    color: "#2EB086",
    icon: "Sheet",
    description: "Read, write, or update Google Sheets data",
    defaultLabel: "Google Sheets",
    defaultConfig: defaultGoogleSheetsConfig,
    handles: ACTION_HANDLES,
  },

  // ── COMMUNICATION ───────────────────────────────────────────────────────────

  rabbitmq: {
    label: "RabbitMQ",
    category: "communication",
    color: "#7F56D9",
    icon: "Rabbit",
    description: "Consume or publish to RabbitMQ queues/exchanges",
    defaultLabel: "RabbitMQ",
    defaultConfig: defaultRabbitMQConfig,
    handles: ACTION_HANDLES,
  },
  send_email: {
    label: "Send Email",
    category: "communication",
    color: "#7F56D9",
    icon: "Mail",
    description: "Send an email via SMTP or SendGrid",
    defaultLabel: "Send Email",
    defaultConfig: defaultSendEmailConfig,
    handles: ACTION_HANDLES,
  },
  slack: {
    label: "Slack",
    category: "communication",
    color: "#7F56D9",
    icon: "MessageSquare",
    description: "Send a message to a Slack channel",
    defaultLabel: "Slack Message",
    defaultConfig: defaultSlackConfig,
    handles: ACTION_HANDLES,
  },
  ssh_terminal: {
    label: "SSH Terminal",
    category: "communication",
    color: "#7F56D9",
    icon: "Terminal",
    description: "Execute a command on a remote server via SSH",
    defaultLabel: "SSH Terminal",
    defaultConfig: defaultSshConfig,
    handles: ACTION_HANDLES,
  },
  twilio_sms: {
    label: "Twilio SMS",
    category: "communication",
    color: "#7F56D9",
    icon: "Smartphone",
    description: "Send an SMS via Twilio",
    defaultLabel: "Twilio SMS",
    defaultConfig: defaultTwilioSmsConfig,
    handles: ACTION_HANDLES,
  },
  twilio_email: {
    label: "Twilio Email",
    category: "communication",
    color: "#7F56D9",
    icon: "MailCheck",
    description: "Send an email via Twilio SendGrid",
    defaultLabel: "Twilio Email",
    defaultConfig: defaultTwilioEmailConfig,
    handles: ACTION_HANDLES,
  },
  firebase_push: {
    label: "Firebase Push",
    category: "communication",
    color: "#7F56D9",
    icon: "Bell",
    description: "Send push notifications via Firebase Cloud Messaging (FCM)",
    defaultLabel: "Firebase Push",
    defaultConfig: defaultFirebasePushConfig,
    handles: ACTION_HANDLES,
  },
  apns_push: {
    label: "Apple Push",
    category: "communication",
    color: "#7F56D9",
    icon: "Smartphone",
    description:
      "Send push notifications via Apple Push Notification Service (APNs)",
    defaultLabel: "Apple Push",
    defaultConfig: defaultApnsPushConfig,
    handles: ACTION_HANDLES,
  },

  // ── AI AGENTS ───────────────────────────────────────────────────────────────

  llm_prompt: {
    label: "LLM Prompt",
    category: "ai_agents",
    color: "#F9D923",
    icon: "Sparkles",
    description: "Send a prompt to an LLM (OpenAI, Ollama/Gemma)",
    defaultLabel: "LLM Prompt",
    defaultConfig: defaultLlmConfig,
    handles: ACTION_HANDLES,
  },
  ai_agent: {
    label: "AI Agent",
    category: "ai_agents",
    color: "#F97316",
    icon: "Bot",
    description: "AI agent with tool-calling loop (HTTP, JS, JSON)",
    defaultLabel: "AI Agent",
    defaultConfig: defaultAiAgentConfig,
    handles: ACTION_HANDLES,
  },

  // ── CODE ────────────────────────────────────────────────────────────────────

  ts_runner: {
    label: "TS Runner",
    category: "code",
    color: "#3178c6",
    icon: "FileType",
    description: "Evaluate a TypeScript expression in a sandbox",
    defaultLabel: "TS Runner",
    defaultConfig: defaultTsRunnerConfig,
    handles: ACTION_HANDLES,
  },
  python_runner: {
    label: "Python Runner",
    category: "code",
    color: "#3178c6",
    icon: "FileCode",
    description: "Execute Python code in a subprocess",
    defaultLabel: "Python Runner",
    defaultConfig: defaultPythonRunnerConfig,
    handles: ACTION_HANDLES,
  },
  custom_code: {
    label: "Custom Code",
    category: "code",
    color: "#3178c6",
    icon: "Code2",
    description: "Run custom TypeScript in a sandbox",
    defaultLabel: "Custom Code",
    defaultConfig: defaultCustomCodeConfig,
    handles: ACTION_HANDLES,
  },
  custom_builder: {
    // Hidden: placed via the "Custom Nodes" palette section, not the default
    // category list. Handles and display come from each node's own snapshot.
    label: "Custom Node",
    category: "code",
    color: "#8b5cf6",
    icon: "Puzzle",
    description: "User-authored node kind — snapshot at drop time",
    defaultLabel: "Custom Node",
    defaultConfig: defaultCustomBuilderConfig,
    handles: ACTION_HANDLES,
    hidden: true,
  },
  group: {
    // Hidden: created from multi-selection via Cmd/Ctrl+G, never from palette.
    // No handles — groups are purely visual containers.
    label: "Group",
    category: "logical",
    color: "#64748b",
    icon: "BoxSelect",
    description: "Canvas-only container (Cmd/Ctrl+G on a multi-selection)",
    defaultLabel: "Group",
    defaultConfig: defaultGroupConfig,
    handles: [],
    hidden: true,
  },
  debug: {
    label: "Debug",
    category: "code",
    color: "#3178c6",
    icon: "Bug",
    description: "Inspect node output during a run",
    defaultLabel: "Debug",
    defaultConfig: defaultDebugConfig,
    handles: ACTION_HANDLES,
  },

  // ── AWS CLOUD ──────────────────────────────────────────────────────────────

  aws_lambda: {
    label: "AWS Lambda",
    category: "cloud",
    color: "#E7820C",
    icon: "Zap",
    description: "Invoke an AWS Lambda function",
    defaultLabel: "Lambda",
    defaultConfig: defaultAwsLambdaConfig,
    handles: ACTION_HANDLES,
  },
  aws_sqs: {
    label: "AWS SQS",
    category: "cloud",
    color: "#C7511F",
    icon: "MessageSquarePlus",
    description: "Send, receive, or delete SQS messages",
    defaultLabel: "SQS",
    defaultConfig: defaultAwsSqsConfig,
    handles: ACTION_HANDLES,
  },
  aws_sns: {
    label: "AWS SNS",
    category: "cloud",
    color: "#C7511F",
    icon: "Megaphone",
    description: "Publish messages to an SNS topic",
    defaultLabel: "SNS",
    defaultConfig: defaultAwsSnsConfig,
    handles: ACTION_HANDLES,
  },
  aws_dynamodb: {
    label: "AWS DynamoDB",
    category: "cloud",
    color: "#4053D6",
    icon: "Table2",
    description: "Read, write, query, or scan DynamoDB tables",
    defaultLabel: "DynamoDB",
    defaultConfig: defaultAwsDynamoDBConfig,
    handles: ACTION_HANDLES,
  },
  aws_ses: {
    label: "AWS SES",
    category: "cloud",
    color: "#C7511F",
    icon: "MailPlus",
    description: "Send emails via Amazon SES",
    defaultLabel: "SES Email",
    defaultConfig: defaultAwsSesConfig,
    handles: ACTION_HANDLES,
  },
  aws_secrets_manager: {
    label: "AWS Secrets Manager",
    category: "cloud",
    color: "#DD344C",
    icon: "KeyRound",
    description: "Get, put, or manage secrets in AWS Secrets Manager",
    defaultLabel: "Secrets Manager",
    defaultConfig: defaultAwsSecretsManagerConfig,
    handles: ACTION_HANDLES,
  },
  aws_ssm: {
    label: "AWS SSM Param Store",
    category: "cloud",
    color: "#E7157B",
    icon: "Settings",
    description: "Get, put, or delete AWS Systems Manager parameters",
    defaultLabel: "SSM Parameter",
    defaultConfig: defaultAwsSsmConfig,
    handles: ACTION_HANDLES,
  },
  aws_eventbridge: {
    label: "AWS EventBridge",
    category: "cloud",
    color: "#C7511F",
    icon: "Radio",
    description: "Put events to Amazon EventBridge",
    defaultLabel: "EventBridge",
    defaultConfig: defaultAwsEventBridgeConfig,
    handles: ACTION_HANDLES,
  },
  aws_step_functions: {
    label: "AWS Step Functions",
    category: "cloud",
    color: "#C7511F",
    icon: "Workflow",
    description: "Start, describe, or stop AWS Step Functions executions",
    defaultLabel: "Step Functions",
    defaultConfig: defaultAwsStepFunctionsConfig,
    handles: ACTION_HANDLES,
  },
};

// =============================================================================
// Category metadata & helpers
// =============================================================================

export const NODE_CATEGORIES: {
  id: NodeCategory;
  label: string;
  color: string;
}[] = [
  { id: "trigger", label: "Triggers", color: "#7c3aed" },
  { id: "logical", label: "Logical", color: "#FF9F29" },
  { id: "utilities", label: "Utilities", color: "#3AB4F2" },
  { id: "data_storage", label: "Data & Storage", color: "#2EB086" },
  { id: "communication", label: "Communication", color: "#7F56D9" },
  { id: "ai_agents", label: "AI Agents", color: "#F9D923" },
  { id: "code", label: "Code", color: "#3178c6" },
  { id: "cloud", label: "Cloud (AWS)", color: "#FF9900" },
];

export function getNodesByCategory(category: NodeCategory): NodeKind[] {
  return (Object.entries(nodeRegistry) as [NodeKind, NodeRegistryEntry][])
    .filter(([, entry]) => entry.category === category && !entry.hidden)
    .map(([kind]) => kind);
}
