// =============================================================================
// Activity re-exports — imported by the Temporal Worker registration
// =============================================================================

export { httpRequestActivity } from "./http";
export type { HttpActivityInput, HttpActivityOutput } from "./http";

export { sendEmailActivity } from "./email";
export type { EmailActivityInput, EmailActivityOutput } from "./email";

export { postgresQueryActivity } from "./postgres";
export type { PostgresActivityInput, PostgresActivityOutput } from "./postgres";

export { runCustomCodeActivity } from "./sandbox";
export type { SandboxActivityInput, SandboxActivityOutput } from "./sandbox";

export { mqttPublishActivity } from "./mqtt";
export type { MqttPublishInput, MqttPublishOutput } from "./mqtt";

export { rabbitmqActivity } from "./rabbitmq";
export type { RabbitMQActivityInput, RabbitMQActivityOutput } from "./rabbitmq";

export {
  writeNodeLogActivity,
  updateExecutionStatusActivity,
  createExecutionRecordActivity,
  resolveCredentialActivity,
  resolveVariablesActivity,
} from "./persistence";
export type { NodeLogInput, UpdateExecutionStatusInput } from "./persistence";

// New activities
export { triggerWorkflowActivity } from "./workflow_trigger";
export type {
  TriggerWorkflowActivityInput,
  TriggerWorkflowActivityOutput,
} from "./workflow_trigger";

export { jsRunnerActivity } from "./js_runner";
export type {
  JsRunnerActivityInput,
  JsRunnerActivityOutput,
} from "./js_runner";

export { tsRunnerActivity } from "./ts_runner";
export type {
  TsRunnerActivityInput,
  TsRunnerActivityOutput,
} from "./ts_runner";

export {
  dataMappingActivity,
  jsonParserActivity,
  htmlTemplateActivity,
  cryptoHashActivity,
  dateFormatterActivity,
  base64Activity,
} from "./data_transform";
export type {
  DataMapperActivityInput,
  DataMapperActivityOutput,
  JsonParserActivityInput,
  JsonParserActivityOutput,
  HtmlTemplateActivityInput,
  HtmlTemplateActivityOutput,
  CryptoHashActivityInput,
  CryptoHashActivityOutput,
  DateFormatterActivityInput,
  DateFormatterActivityOutput,
  Base64ActivityInput,
  Base64ActivityOutput,
} from "./data_transform";

export { mysqlActivity } from "./mysql";
export type { MysqlActivityInput, MysqlActivityOutput } from "./mysql";

export { mongodbActivity } from "./mongodb";
export type { MongodbActivityInput, MongodbActivityOutput } from "./mongodb";

export { redisActivity } from "./redis";
export type { RedisActivityInput, RedisActivityOutput } from "./redis";

export { s3Activity } from "./s3";
export type { S3ActivityInput, S3ActivityOutput } from "./s3";

export { slackActivity } from "./slack";
export type { SlackActivityInput, SlackActivityOutput } from "./slack";

export { sshActivity } from "./ssh";
export type { SshActivityInput, SshActivityOutput } from "./ssh";

export { twilioSmsActivity, twilioEmailActivity } from "./twilio";
export type {
  TwilioSmsActivityInput,
  TwilioSmsActivityOutput,
  TwilioEmailActivityInput,
  TwilioEmailActivityOutput,
} from "./twilio";

export { llmPromptActivity } from "./llm";
export type { LlmPromptActivityInput, LlmPromptActivityOutput } from "./llm";

export { prepareSubworkflowActivity } from "./subworkflow";
export type {
  PrepareSubworkflowInput,
  PrepareSubworkflowOutput,
} from "./subworkflow";

export { mariadbActivity } from "./mariadb";
export type { MariadbActivityInput, MariadbActivityOutput } from "./mariadb";

export { mssqlActivity } from "./mssql";
export type { MssqlActivityInput, MssqlActivityOutput } from "./mssql";

export { googleSheetsActivity } from "./google_sheets";
export type {
  GoogleSheetsActivityInput,
  GoogleSheetsActivityOutput,
} from "./google_sheets";

export { pythonRunnerActivity } from "./python_runner";
export type {
  PythonRunnerActivityInput,
  PythonRunnerActivityOutput,
} from "./python_runner";

export { firebasePushActivity } from "./firebase_push";
export type {
  FirebasePushActivityInput,
  FirebasePushActivityOutput,
} from "./firebase_push";

export { apnsPushActivity } from "./apns_push";
export type {
  ApnsPushActivityInput,
  ApnsPushActivityOutput,
} from "./apns_push";

// AWS Cloud activities
export { awsLambdaActivity } from "./aws_lambda";
export type { AwsLambdaActivityInput } from "./aws_lambda";

export { awsSqsActivity } from "./aws_sqs";
export type { AwsSqsActivityInput } from "./aws_sqs";

export { awsSnsActivity } from "./aws_sns";
export type { AwsSnsActivityInput } from "./aws_sns";

export { awsDynamoDBActivity } from "./aws_dynamodb";
export type { AwsDynamoDBActivityInput } from "./aws_dynamodb";

export { awsSesActivity } from "./aws_ses";
export type { AwsSesActivityInput } from "./aws_ses";

export { awsSecretsManagerActivity } from "./aws_secrets_manager";
export type { AwsSecretsManagerActivityInput } from "./aws_secrets_manager";

export { awsSsmActivity } from "./aws_ssm";
export type { AwsSsmActivityInput } from "./aws_ssm";

export { awsEventBridgeActivity } from "./aws_eventbridge";
export type { AwsEventBridgeActivityInput } from "./aws_eventbridge";

export { awsStepFunctionsActivity } from "./aws_step_functions";
export type { AwsStepFunctionsActivityInput } from "./aws_step_functions";

export { azureBlobActivity } from "./azure_blob";
export type { AzureBlobActivityInput } from "./azure_blob";

export { aiAgentActivity } from "./aiAgent";
export type { AiAgentActivityInput, AiAgentActivityOutput } from "./aiAgent";
