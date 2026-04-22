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

export { azureServiceBusActivity } from "./azure_service_bus";
export type { AzureServiceBusActivityInput } from "./azure_service_bus";

export { azureCosmosActivity } from "./azure_cosmos_db";
export type { AzureCosmosActivityInput } from "./azure_cosmos_db";

export { azureKeyVaultActivity } from "./azure_key_vault";
export type { AzureKeyVaultActivityInput } from "./azure_key_vault";

export { azureFunctionsActivity } from "./azure_functions";
export type { AzureFunctionsActivityInput } from "./azure_functions";

export { gcpStorageActivity } from "./gcp_storage";
export type { GcpStorageActivityInput } from "./gcp_storage";

export { gcpPubSubActivity } from "./gcp_pubsub";
export type { GcpPubSubActivityInput } from "./gcp_pubsub";

export { gcpBigQueryActivity } from "./gcp_bigquery";
export type { GcpBigQueryActivityInput } from "./gcp_bigquery";

export { oracleDbActivity } from "./oracle_db";
export type { OracleDbActivityInput } from "./oracle_db";

export { ociObjectStorageActivity } from "./oci_object_storage";
export type { OciObjectStorageActivityInput } from "./oci_object_storage";

// ── SaaS Integrations (Phase 2) ─────────────────────────────────────────────

export { stripeActivity } from "./stripe";
export type { StripeActivityInput, StripeActivityOutput } from "./stripe";

export { githubActivity } from "./github";
export type { GithubActivityInput, GithubActivityOutput } from "./github";

export { discordActivity } from "./discord";
export type { DiscordActivityInput, DiscordActivityOutput } from "./discord";

export { notionActivity } from "./notion";
export type { NotionActivityInput, NotionActivityOutput } from "./notion";

export { salesforceActivity } from "./salesforce";
export type {
  SalesforceActivityInput,
  SalesforceActivityOutput,
} from "./salesforce";

export { jiraActivity } from "./jira";
export type { JiraActivityInput, JiraActivityOutput } from "./jira";

export { msTeamsActivity } from "./ms_teams";
export type {
  MsTeamsActivityInput,
  MsTeamsActivityOutput,
} from "./ms_teams";

export { hubspotActivity } from "./hubspot";
export type { HubspotActivityInput, HubspotActivityOutput } from "./hubspot";

export { airtableActivity } from "./airtable";
export type {
  AirtableActivityInput,
  AirtableActivityOutput,
} from "./airtable";

export { pagerdutyActivity } from "./pagerduty";
export type {
  PagerDutyActivityInput,
  PagerDutyActivityOutput,
} from "./pagerduty";

export { gitlabActivity } from "./gitlab";
export type { GitlabActivityInput, GitlabActivityOutput } from "./gitlab";

export { linearActivity } from "./linear";
export type { LinearActivityInput, LinearActivityOutput } from "./linear";

export { telegramActivity } from "./telegram";
export type {
  TelegramActivityInput,
  TelegramActivityOutput,
} from "./telegram";

export { sendgridActivity } from "./sendgrid";
export type {
  SendgridActivityInput,
  SendgridActivityOutput,
} from "./sendgrid";

export { sentryActivity } from "./sentry";
export type { SentryActivityInput, SentryActivityOutput } from "./sentry";

export { shopifyActivity } from "./shopify";
export type {
  ShopifyActivityInput,
  ShopifyActivityOutput,
} from "./shopify";

export { mailchimpActivity } from "./mailchimp";
export type {
  MailchimpActivityInput,
  MailchimpActivityOutput,
} from "./mailchimp";

export { googleDriveActivity } from "./google_drive";
export type {
  GoogleDriveActivityInput,
  GoogleDriveActivityOutput,
} from "./google_drive";

export { dropboxActivity } from "./dropbox";
export type {
  DropboxActivityInput,
  DropboxActivityOutput,
} from "./dropbox";

export { datadogActivity } from "./datadog";
export type {
  DatadogActivityInput,
  DatadogActivityOutput,
} from "./datadog";

export { paypalActivity } from "./paypal";
export type {
  PaypalActivityInput,
  PaypalActivityOutput,
} from "./paypal";

export { squareActivity } from "./square";
export type { SquareActivityInput, SquareActivityOutput } from "./square";

export { resendActivity } from "./resend";
export type { ResendActivityInput, ResendActivityOutput } from "./resend";

export { onedriveActivity } from "./onedrive";
export type {
  OneDriveActivityInput,
  OneDriveActivityOutput,
} from "./onedrive";

export { boxActivity } from "./box";
export type { BoxActivityInput, BoxActivityOutput } from "./box";

export { circleciActivity } from "./circleci";
export type {
  CircleCIActivityInput,
  CircleCIActivityOutput,
} from "./circleci";

export { whatsappActivity } from "./whatsapp_business";
export type {
  WhatsappActivityInput,
  WhatsappActivityOutput,
} from "./whatsapp_business";

export { pipedriveActivity } from "./pipedrive";
export type {
  PipedriveActivityInput,
  PipedriveActivityOutput,
} from "./pipedrive";

export { customerIoActivity } from "./customer_io";
export type {
  CustomerIoActivityInput,
  CustomerIoActivityOutput,
} from "./customer_io";

// ── Phase 3: Streaming + Analytics ─────────────────────────────────────────

export { kafkaActivity } from "./kafka";
export type { KafkaActivityInput, KafkaActivityOutput } from "./kafka";

export { natsActivity } from "./nats";
export type { NatsActivityInput, NatsActivityOutput } from "./nats";

export { snowflakeActivity } from "./snowflake";
export type {
  SnowflakeActivityInput,
  SnowflakeActivityOutput,
} from "./snowflake";

export { clickhouseActivity } from "./clickhouse";
export type {
  ClickhouseActivityInput,
  ClickhouseActivityOutput,
} from "./clickhouse";

export { elasticsearchActivity } from "./elasticsearch";
export type {
  ElasticsearchActivityInput,
  ElasticsearchActivityOutput,
} from "./elasticsearch";

// ── Phase 4: AI ecosystem ──────────────────────────────────────────────────

export { aiImageActivity } from "./ai_image";
export type {
  AiImageActivityInput,
  AiImageActivityOutput,
} from "./ai_image";

export { aiTranscribeActivity } from "./ai_transcribe";
export type {
  AiTranscribeActivityInput,
  AiTranscribeActivityOutput,
} from "./ai_transcribe";

export { aiTtsActivity } from "./ai_tts";
export type { AiTtsActivityInput, AiTtsActivityOutput } from "./ai_tts";

export { aiEmbedActivity } from "./ai_embed";
export type {
  AiEmbedActivityInput,
  AiEmbedActivityOutput,
} from "./ai_embed";

export { vectorDbActivity } from "./vector_db";
export type {
  VectorDbActivityInput,
  VectorDbActivityOutput,
} from "./vector_db";

export { aiAgentActivity } from "./aiAgent";
export type { AiAgentActivityInput, AiAgentActivityOutput } from "./aiAgent";
