import React, { useState } from "react";
import { Trash2, X, ChevronDown, ChevronRight } from "lucide-react";
import type {
  NodeKind,
  NodeConfig,
  NodeStyle,
  EdgeStyle,
} from "@workflow/shared";
import { useWorkflowStore } from "../../store/workflowStore";
import { nodeRegistry } from "../../lib/nodeRegistry";

// Form components
import { ManualTriggerForm } from "./forms/ManualTriggerForm";
import { WebhookForm } from "./forms/WebhookForm";
import { CronForm } from "./forms/CronForm";
import { MqttForm } from "./forms/MqttForm";
import { IfElseForm } from "./forms/IfElseForm";
import { SwitchForm } from "./forms/SwitchForm";
import { DelayForm } from "./forms/DelayForm";
import { MergeForm } from "./forms/MergeForm";
import { HttpRequestForm } from "./forms/HttpRequestForm";
import { SendEmailForm } from "./forms/SendEmailForm";
import { PostgresForm } from "./forms/PostgresForm";
import { CustomCodeForm } from "./forms/CustomCodeForm";
import { CustomBuilderForm } from "./forms/CustomBuilderForm";
import { GroupForm } from "./forms/GroupForm";
import { MultiSelectPanel } from "./forms/MultiSelectPanel";
import { RabbitMQForm } from "./forms/RabbitMQForm";
import { WorkflowTriggerInForm } from "./forms/WorkflowTriggerInForm";
import { WorkflowTriggerOutForm } from "./forms/WorkflowTriggerOutForm";
import { StopForm } from "./forms/StopForm";
import { JsRunnerForm } from "./forms/JsRunnerForm";
import { TsRunnerForm } from "./forms/TsRunnerForm";
import { DataMapperForm } from "./forms/DataMapperForm";
import { JsonParserForm } from "./forms/JsonParserForm";
import { HtmlTemplateForm } from "./forms/HtmlTemplateForm";
import { CryptoHashForm } from "./forms/CryptoHashForm";
import { DateFormatterForm } from "./forms/DateFormatterForm";
import { Base64Form } from "./forms/Base64Form";
import { MysqlForm } from "./forms/MysqlForm";
import { MongodbForm } from "./forms/MongodbForm";
import { RedisForm } from "./forms/RedisForm";
import { S3BucketForm } from "./forms/S3BucketForm";
import { SlackForm } from "./forms/SlackForm";
import { SshTerminalForm } from "./forms/SshTerminalForm";
import { TwilioSmsForm } from "./forms/TwilioSmsForm";
import { TwilioEmailForm } from "./forms/TwilioEmailForm";
import { LlmPromptForm } from "./forms/LlmPromptForm";
import { AiAgentForm } from "./forms/AiAgentForm";
import { SubworkflowCallForm } from "./forms/SubworkflowCallForm";
import { SubflowOutputForm } from "./forms/SubflowOutputForm";
import { MariadbForm } from "./forms/MariadbForm";
import { MssqlForm } from "./forms/MssqlForm";
import { GoogleSheetsForm } from "./forms/GoogleSheetsForm";
import { PythonRunnerForm } from "./forms/PythonRunnerForm";
import { FirebasePushForm } from "./forms/FirebasePushForm";
import { ApnsPushForm } from "./forms/ApnsPushForm";
import { LoopForm } from "./forms/LoopForm";
import { ResponseForm } from "./forms/ResponseForm";
import { TriggerOutputForm } from "./forms/TriggerOutputForm";
import { AwsLambdaForm } from "./forms/AwsLambdaForm";
import { AwsSqsForm } from "./forms/AwsSqsForm";
import { AwsSnsForm } from "./forms/AwsSnsForm";
import { AwsDynamoDBForm } from "./forms/AwsDynamoDBForm";
import { AwsSesForm } from "./forms/AwsSesForm";
import { AwsSecretsManagerForm } from "./forms/AwsSecretsManagerForm";
import { AwsSsmForm } from "./forms/AwsSsmForm";
import { AwsEventBridgeForm } from "./forms/AwsEventBridgeForm";
import { AwsStepFunctionsForm } from "./forms/AwsStepFunctionsForm";
import { AzureBlobForm } from "./forms/AzureBlobForm";
import { AzureServiceBusForm } from "./forms/AzureServiceBusForm";
import { AzureCosmosForm } from "./forms/AzureCosmosForm";
import { AzureKeyVaultForm } from "./forms/AzureKeyVaultForm";
import { AzureFunctionsForm } from "./forms/AzureFunctionsForm";
import { GcpStorageForm } from "./forms/GcpStorageForm";
import { GcpPubSubForm } from "./forms/GcpPubSubForm";
import { GcpBigQueryForm } from "./forms/GcpBigQueryForm";
import { OracleDbForm } from "./forms/OracleDbForm";
import { OciObjectStorageForm } from "./forms/OciObjectStorageForm";
import { StripeForm } from "./forms/StripeForm";
import { GithubForm } from "./forms/GithubForm";
import { DiscordForm } from "./forms/DiscordForm";
import { NotionForm } from "./forms/NotionForm";
import { SalesforceForm } from "./forms/SalesforceForm";
import { JiraForm } from "./forms/JiraForm";
import { MsTeamsForm } from "./forms/MsTeamsForm";
import { HubspotForm } from "./forms/HubspotForm";
import { AirtableForm } from "./forms/AirtableForm";
import { PagerDutyForm } from "./forms/PagerDutyForm";
import { GitlabForm } from "./forms/GitlabForm";
import { LinearForm } from "./forms/LinearForm";
import { TelegramForm } from "./forms/TelegramForm";
import { SendgridForm } from "./forms/SendgridForm";
import { SentryForm } from "./forms/SentryForm";
import { ShopifyForm } from "./forms/ShopifyForm";
import { MailchimpForm } from "./forms/MailchimpForm";
import { GoogleDriveForm } from "./forms/GoogleDriveForm";
import { DropboxForm } from "./forms/DropboxForm";
import { DatadogForm } from "./forms/DatadogForm";
import { PaypalForm } from "./forms/PaypalForm";
import { SquareForm } from "./forms/SquareForm";
import { ResendForm } from "./forms/ResendForm";
import { OneDriveForm } from "./forms/OneDriveForm";
import { BoxForm } from "./forms/BoxForm";
import { CircleCIForm } from "./forms/CircleCIForm";
import { WhatsappForm } from "./forms/WhatsappForm";
import { PipedriveForm } from "./forms/PipedriveForm";
import { CustomerIoForm } from "./forms/CustomerIoForm";
import { KafkaForm } from "./forms/KafkaForm";
import { NatsForm } from "./forms/NatsForm";
import { SnowflakeForm } from "./forms/SnowflakeForm";
import { ClickhouseForm } from "./forms/ClickhouseForm";
import { ElasticsearchForm } from "./forms/ElasticsearchForm";
import { AiImageForm } from "./forms/AiImageForm";
import { AiTranscribeForm } from "./forms/AiTranscribeForm";
import { AiTtsForm } from "./forms/AiTtsForm";
import { AiEmbedForm } from "./forms/AiEmbedForm";
import { VectorDbForm } from "./forms/VectorDbForm";

import type {
  ManualTriggerConfig,
  WebhookConfig,
  CronConfig,
  MqttConfig,
  RabbitMQConfig,
  IfElseConfig,
  SwitchConfig,
  DelayConfig,
  MergeConfig,
  HttpRequestConfig,
  SendEmailConfig,
  PostgresConfig,
  CustomCodeConfig,
  CustomBuilderConfig,
  GroupConfig,
  WorkflowTriggerInConfig,
  WorkflowTriggerOutConfig,
  StopConfig,
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
  SubworkflowCallConfig,
  SubflowOutputConfig,
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
  AiAgentConfig,
} from "@workflow/shared";

function renderForm(
  kind: NodeKind,
  config: NodeConfig,
  onChange: (patch: Partial<NodeConfig>) => void,
): React.ReactElement | null {
  switch (kind) {
    case "manual":
      return (
        <ManualTriggerForm
          config={config as ManualTriggerConfig}
          onChange={onChange as (p: Partial<ManualTriggerConfig>) => void}
        />
      );
    case "webhook":
      return (
        <WebhookForm
          config={config as WebhookConfig}
          onChange={onChange as (p: Partial<WebhookConfig>) => void}
        />
      );
    case "cron":
      return (
        <CronForm
          config={config as CronConfig}
          onChange={onChange as (p: Partial<CronConfig>) => void}
        />
      );
    case "mqtt_trigger":
      return (
        <MqttForm
          config={config as MqttConfig}
          onChange={onChange as (p: Partial<MqttConfig>) => void}
        />
      );
    case "if_else":
      return (
        <IfElseForm
          config={config as IfElseConfig}
          onChange={onChange as (p: Partial<IfElseConfig>) => void}
        />
      );
    case "switch":
      return (
        <SwitchForm
          config={config as SwitchConfig}
          onChange={onChange as (p: Partial<SwitchConfig>) => void}
        />
      );
    case "delay":
      return (
        <DelayForm
          config={config as DelayConfig}
          onChange={onChange as (p: Partial<DelayConfig>) => void}
        />
      );
    case "merge":
      return (
        <MergeForm
          config={config as MergeConfig}
          onChange={onChange as (p: Partial<MergeConfig>) => void}
        />
      );
    case "http_request":
      return (
        <HttpRequestForm
          config={config as HttpRequestConfig}
          onChange={onChange as (p: Partial<HttpRequestConfig>) => void}
        />
      );
    case "send_email":
      return (
        <SendEmailForm
          config={config as SendEmailConfig}
          onChange={onChange as (p: Partial<SendEmailConfig>) => void}
        />
      );
    case "postgres_query":
      return (
        <PostgresForm
          config={config as PostgresConfig}
          onChange={onChange as (p: Partial<PostgresConfig>) => void}
        />
      );
    case "custom_code":
      return (
        <CustomCodeForm
          config={config as CustomCodeConfig}
          onChange={onChange as (p: Partial<CustomCodeConfig>) => void}
        />
      );
    case "custom_builder":
      return (
        <CustomBuilderForm
          config={config as CustomBuilderConfig}
          onChange={onChange as (p: Partial<CustomBuilderConfig>) => void}
        />
      );
    case "group":
      return (
        <GroupForm
          config={config as GroupConfig}
          onChange={onChange as (p: Partial<GroupConfig>) => void}
        />
      );
    case "rabbitmq":
      return (
        <RabbitMQForm
          config={config as RabbitMQConfig}
          onChange={onChange as (p: Partial<RabbitMQConfig>) => void}
        />
      );
    case "workflow_trigger_in":
      return (
        <WorkflowTriggerInForm
          config={config as WorkflowTriggerInConfig}
          onChange={onChange as (p: Partial<WorkflowTriggerInConfig>) => void}
        />
      );
    case "workflow_trigger_out":
      return (
        <WorkflowTriggerOutForm
          config={config as WorkflowTriggerOutConfig}
          onChange={onChange as (p: Partial<WorkflowTriggerOutConfig>) => void}
        />
      );
    case "stop":
      return (
        <StopForm
          config={config as StopConfig}
          onChange={onChange as (p: Partial<StopConfig>) => void}
        />
      );
    case "js_runner":
      return (
        <JsRunnerForm
          config={config as JsRunnerConfig}
          onChange={onChange as (p: Partial<JsRunnerConfig>) => void}
        />
      );
    case "ts_runner":
      return (
        <TsRunnerForm
          config={config as TsRunnerConfig}
          onChange={onChange as (p: Partial<TsRunnerConfig>) => void}
        />
      );
    case "data_mapper":
      return (
        <DataMapperForm
          config={config as DataMapperConfig}
          onChange={onChange as (p: Partial<DataMapperConfig>) => void}
        />
      );
    case "json_parser":
      return (
        <JsonParserForm
          config={config as JsonParserConfig}
          onChange={onChange as (p: Partial<JsonParserConfig>) => void}
        />
      );
    case "html_template":
      return (
        <HtmlTemplateForm
          config={config as HtmlTemplateConfig}
          onChange={onChange as (p: Partial<HtmlTemplateConfig>) => void}
        />
      );
    case "crypto_hash":
      return (
        <CryptoHashForm
          config={config as CryptoHashConfig}
          onChange={onChange as (p: Partial<CryptoHashConfig>) => void}
        />
      );
    case "date_formatter":
      return (
        <DateFormatterForm
          config={config as DateFormatterConfig}
          onChange={onChange as (p: Partial<DateFormatterConfig>) => void}
        />
      );
    case "base64":
      return (
        <Base64Form
          config={config as Base64Config}
          onChange={onChange as (p: Partial<Base64Config>) => void}
        />
      );
    case "mysql":
      return (
        <MysqlForm
          config={config as MysqlConfig}
          onChange={onChange as (p: Partial<MysqlConfig>) => void}
        />
      );
    case "mongodb":
      return (
        <MongodbForm
          config={config as MongodbConfig}
          onChange={onChange as (p: Partial<MongodbConfig>) => void}
        />
      );
    case "redis":
      return (
        <RedisForm
          config={config as RedisConfig}
          onChange={onChange as (p: Partial<RedisConfig>) => void}
        />
      );
    case "s3_bucket":
      return (
        <S3BucketForm
          config={config as S3BucketConfig}
          onChange={onChange as (p: Partial<S3BucketConfig>) => void}
        />
      );
    case "slack":
      return (
        <SlackForm
          config={config as SlackConfig}
          onChange={onChange as (p: Partial<SlackConfig>) => void}
        />
      );
    case "ssh_terminal":
      return (
        <SshTerminalForm
          config={config as SshTerminalConfig}
          onChange={onChange as (p: Partial<SshTerminalConfig>) => void}
        />
      );
    case "twilio_sms":
      return (
        <TwilioSmsForm
          config={config as TwilioSmsConfig}
          onChange={onChange as (p: Partial<TwilioSmsConfig>) => void}
        />
      );
    case "twilio_email":
      return (
        <TwilioEmailForm
          config={config as TwilioEmailConfig}
          onChange={onChange as (p: Partial<TwilioEmailConfig>) => void}
        />
      );
    case "llm_prompt":
      return (
        <LlmPromptForm
          config={config as LlmPromptConfig}
          onChange={onChange as (p: Partial<LlmPromptConfig>) => void}
        />
      );
    case "ai_agent":
      return (
        <AiAgentForm
          config={config as AiAgentConfig}
          onChange={onChange as (p: Partial<AiAgentConfig>) => void}
        />
      );
    case "subworkflow_call":
      return (
        <SubworkflowCallForm
          config={config as SubworkflowCallConfig}
          onChange={onChange as (p: Partial<SubworkflowCallConfig>) => void}
        />
      );
    case "subflow_output":
      return (
        <SubflowOutputForm
          config={config as SubflowOutputConfig}
          onChange={onChange as (p: Partial<SubflowOutputConfig>) => void}
        />
      );
    case "mariadb":
      return (
        <MariadbForm
          config={config as MariadbConfig}
          onChange={onChange as (p: Partial<MariadbConfig>) => void}
        />
      );
    case "mssql":
      return (
        <MssqlForm
          config={config as MssqlConfig}
          onChange={onChange as (p: Partial<MssqlConfig>) => void}
        />
      );
    case "google_sheets":
      return (
        <GoogleSheetsForm
          config={config as GoogleSheetsConfig}
          onChange={onChange as (p: Partial<GoogleSheetsConfig>) => void}
        />
      );
    case "python_runner":
      return (
        <PythonRunnerForm
          config={config as PythonRunnerConfig}
          onChange={onChange as (p: Partial<PythonRunnerConfig>) => void}
        />
      );
    case "firebase_push":
      return (
        <FirebasePushForm
          config={config as FirebasePushConfig}
          onChange={onChange as (p: Partial<FirebasePushConfig>) => void}
        />
      );
    case "apns_push":
      return (
        <ApnsPushForm
          config={config as ApnsPushConfig}
          onChange={onChange as (p: Partial<ApnsPushConfig>) => void}
        />
      );
    case "loop":
      return (
        <LoopForm
          config={config as LoopConfig}
          onChange={onChange as (p: Partial<LoopConfig>) => void}
        />
      );
    case "response":
      return (
        <ResponseForm
          config={config as ResponseConfig}
          onChange={onChange as (p: Partial<ResponseConfig>) => void}
        />
      );
    case "trigger_output":
      return (
        <TriggerOutputForm
          config={config as TriggerOutputConfig}
          onChange={onChange as (p: Partial<TriggerOutputConfig>) => void}
        />
      );
    case "aws_lambda":
      return (
        <AwsLambdaForm
          config={config as AwsLambdaConfig}
          onChange={onChange as (p: Partial<AwsLambdaConfig>) => void}
        />
      );
    case "aws_sqs":
      return (
        <AwsSqsForm
          config={config as AwsSqsConfig}
          onChange={onChange as (p: Partial<AwsSqsConfig>) => void}
        />
      );
    case "aws_sns":
      return (
        <AwsSnsForm
          config={config as AwsSnsConfig}
          onChange={onChange as (p: Partial<AwsSnsConfig>) => void}
        />
      );
    case "aws_dynamodb":
      return (
        <AwsDynamoDBForm
          config={config as AwsDynamoDBConfig}
          onChange={onChange as (p: Partial<AwsDynamoDBConfig>) => void}
        />
      );
    case "aws_ses":
      return (
        <AwsSesForm
          config={config as AwsSesConfig}
          onChange={onChange as (p: Partial<AwsSesConfig>) => void}
        />
      );
    case "aws_secrets_manager":
      return (
        <AwsSecretsManagerForm
          config={config as AwsSecretsManagerConfig}
          onChange={onChange as (p: Partial<AwsSecretsManagerConfig>) => void}
        />
      );
    case "aws_ssm":
      return (
        <AwsSsmForm
          config={config as AwsSsmConfig}
          onChange={onChange as (p: Partial<AwsSsmConfig>) => void}
        />
      );
    case "aws_eventbridge":
      return (
        <AwsEventBridgeForm
          config={config as AwsEventBridgeConfig}
          onChange={onChange as (p: Partial<AwsEventBridgeConfig>) => void}
        />
      );
    case "aws_step_functions":
      return (
        <AwsStepFunctionsForm
          config={config as AwsStepFunctionsConfig}
          onChange={onChange as (p: Partial<AwsStepFunctionsConfig>) => void}
        />
      );
    case "azure_blob":
      return (
        <AzureBlobForm
          config={config as AzureBlobConfig}
          onChange={onChange as (p: Partial<AzureBlobConfig>) => void}
        />
      );
    case "azure_service_bus":
      return (
        <AzureServiceBusForm
          config={config as AzureServiceBusConfig}
          onChange={onChange as (p: Partial<AzureServiceBusConfig>) => void}
        />
      );
    case "azure_cosmos_db":
      return (
        <AzureCosmosForm
          config={config as AzureCosmosConfig}
          onChange={onChange as (p: Partial<AzureCosmosConfig>) => void}
        />
      );
    case "azure_key_vault":
      return (
        <AzureKeyVaultForm
          config={config as AzureKeyVaultConfig}
          onChange={onChange as (p: Partial<AzureKeyVaultConfig>) => void}
        />
      );
    case "azure_functions":
      return (
        <AzureFunctionsForm
          config={config as AzureFunctionsConfig}
          onChange={onChange as (p: Partial<AzureFunctionsConfig>) => void}
        />
      );
    case "gcp_storage":
      return (
        <GcpStorageForm
          config={config as GcpStorageConfig}
          onChange={onChange as (p: Partial<GcpStorageConfig>) => void}
        />
      );
    case "gcp_pubsub":
      return (
        <GcpPubSubForm
          config={config as GcpPubSubConfig}
          onChange={onChange as (p: Partial<GcpPubSubConfig>) => void}
        />
      );
    case "gcp_bigquery":
      return (
        <GcpBigQueryForm
          config={config as GcpBigQueryConfig}
          onChange={onChange as (p: Partial<GcpBigQueryConfig>) => void}
        />
      );
    case "oracle_db":
      return (
        <OracleDbForm
          config={config as OracleDbConfig}
          onChange={onChange as (p: Partial<OracleDbConfig>) => void}
        />
      );
    case "oci_object_storage":
      return (
        <OciObjectStorageForm
          config={config as OciObjectStorageConfig}
          onChange={onChange as (p: Partial<OciObjectStorageConfig>) => void}
        />
      );
    case "stripe":
      return (
        <StripeForm
          config={config as StripeConfig}
          onChange={onChange as (p: Partial<StripeConfig>) => void}
        />
      );
    case "github":
      return (
        <GithubForm
          config={config as GithubConfig}
          onChange={onChange as (p: Partial<GithubConfig>) => void}
        />
      );
    case "discord":
      return (
        <DiscordForm
          config={config as DiscordConfig}
          onChange={onChange as (p: Partial<DiscordConfig>) => void}
        />
      );
    case "notion":
      return (
        <NotionForm
          config={config as NotionConfig}
          onChange={onChange as (p: Partial<NotionConfig>) => void}
        />
      );
    case "salesforce":
      return (
        <SalesforceForm
          config={config as SalesforceConfig}
          onChange={onChange as (p: Partial<SalesforceConfig>) => void}
        />
      );
    case "jira":
      return (
        <JiraForm
          config={config as JiraConfig}
          onChange={onChange as (p: Partial<JiraConfig>) => void}
        />
      );
    case "ms_teams":
      return (
        <MsTeamsForm
          config={config as MsTeamsConfig}
          onChange={onChange as (p: Partial<MsTeamsConfig>) => void}
        />
      );
    case "hubspot":
      return (
        <HubspotForm
          config={config as HubspotConfig}
          onChange={onChange as (p: Partial<HubspotConfig>) => void}
        />
      );
    case "airtable":
      return (
        <AirtableForm
          config={config as AirtableConfig}
          onChange={onChange as (p: Partial<AirtableConfig>) => void}
        />
      );
    case "pagerduty":
      return (
        <PagerDutyForm
          config={config as PagerDutyConfig}
          onChange={onChange as (p: Partial<PagerDutyConfig>) => void}
        />
      );
    case "gitlab":
      return (
        <GitlabForm
          config={config as GitlabConfig}
          onChange={onChange as (p: Partial<GitlabConfig>) => void}
        />
      );
    case "linear":
      return (
        <LinearForm
          config={config as LinearConfig}
          onChange={onChange as (p: Partial<LinearConfig>) => void}
        />
      );
    case "telegram":
      return (
        <TelegramForm
          config={config as TelegramConfig}
          onChange={onChange as (p: Partial<TelegramConfig>) => void}
        />
      );
    case "sendgrid":
      return (
        <SendgridForm
          config={config as SendgridConfig}
          onChange={onChange as (p: Partial<SendgridConfig>) => void}
        />
      );
    case "sentry":
      return (
        <SentryForm
          config={config as SentryConfig}
          onChange={onChange as (p: Partial<SentryConfig>) => void}
        />
      );
    case "shopify":
      return (
        <ShopifyForm
          config={config as ShopifyConfig}
          onChange={onChange as (p: Partial<ShopifyConfig>) => void}
        />
      );
    case "mailchimp":
      return (
        <MailchimpForm
          config={config as MailchimpConfig}
          onChange={onChange as (p: Partial<MailchimpConfig>) => void}
        />
      );
    case "google_drive":
      return (
        <GoogleDriveForm
          config={config as GoogleDriveConfig}
          onChange={onChange as (p: Partial<GoogleDriveConfig>) => void}
        />
      );
    case "dropbox":
      return (
        <DropboxForm
          config={config as DropboxConfig}
          onChange={onChange as (p: Partial<DropboxConfig>) => void}
        />
      );
    case "datadog":
      return (
        <DatadogForm
          config={config as DatadogConfig}
          onChange={onChange as (p: Partial<DatadogConfig>) => void}
        />
      );
    case "paypal":
      return (
        <PaypalForm
          config={config as PaypalConfig}
          onChange={onChange as (p: Partial<PaypalConfig>) => void}
        />
      );
    case "square":
      return (
        <SquareForm
          config={config as SquareConfig}
          onChange={onChange as (p: Partial<SquareConfig>) => void}
        />
      );
    case "resend":
      return (
        <ResendForm
          config={config as ResendConfig}
          onChange={onChange as (p: Partial<ResendConfig>) => void}
        />
      );
    case "onedrive":
      return (
        <OneDriveForm
          config={config as OneDriveConfig}
          onChange={onChange as (p: Partial<OneDriveConfig>) => void}
        />
      );
    case "box":
      return (
        <BoxForm
          config={config as BoxConfig}
          onChange={onChange as (p: Partial<BoxConfig>) => void}
        />
      );
    case "circleci":
      return (
        <CircleCIForm
          config={config as CircleCIConfig}
          onChange={onChange as (p: Partial<CircleCIConfig>) => void}
        />
      );
    case "whatsapp_business":
      return (
        <WhatsappForm
          config={config as WhatsappConfig}
          onChange={onChange as (p: Partial<WhatsappConfig>) => void}
        />
      );
    case "pipedrive":
      return (
        <PipedriveForm
          config={config as PipedriveConfig}
          onChange={onChange as (p: Partial<PipedriveConfig>) => void}
        />
      );
    case "customer_io":
      return (
        <CustomerIoForm
          config={config as CustomerIoConfig}
          onChange={onChange as (p: Partial<CustomerIoConfig>) => void}
        />
      );
    case "kafka":
      return (
        <KafkaForm
          config={config as KafkaConfig}
          onChange={onChange as (p: Partial<KafkaConfig>) => void}
        />
      );
    case "nats":
      return (
        <NatsForm
          config={config as NatsConfig}
          onChange={onChange as (p: Partial<NatsConfig>) => void}
        />
      );
    case "snowflake":
      return (
        <SnowflakeForm
          config={config as SnowflakeConfig}
          onChange={onChange as (p: Partial<SnowflakeConfig>) => void}
        />
      );
    case "clickhouse":
      return (
        <ClickhouseForm
          config={config as ClickhouseConfig}
          onChange={onChange as (p: Partial<ClickhouseConfig>) => void}
        />
      );
    case "elasticsearch":
      return (
        <ElasticsearchForm
          config={config as ElasticsearchConfig}
          onChange={onChange as (p: Partial<ElasticsearchConfig>) => void}
        />
      );
    case "ai_image":
      return (
        <AiImageForm
          config={config as AiImageConfig}
          onChange={onChange as (p: Partial<AiImageConfig>) => void}
        />
      );
    case "ai_transcribe":
      return (
        <AiTranscribeForm
          config={config as AiTranscribeConfig}
          onChange={onChange as (p: Partial<AiTranscribeConfig>) => void}
        />
      );
    case "ai_tts":
      return (
        <AiTtsForm
          config={config as AiTtsConfig}
          onChange={onChange as (p: Partial<AiTtsConfig>) => void}
        />
      );
    case "ai_embed":
      return (
        <AiEmbedForm
          config={config as AiEmbedConfig}
          onChange={onChange as (p: Partial<AiEmbedConfig>) => void}
        />
      );
    case "vector_db":
      return (
        <VectorDbForm
          config={config as VectorDbConfig}
          onChange={onChange as (p: Partial<VectorDbConfig>) => void}
        />
      );
    default:
      return null;
  }
}

const inputClass =
  "w-full px-3 py-1.5 text-sm bg-muted border border-border rounded-md text-foreground placeholder-muted-foreground focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500";

// ─── Handle Position Row ──────────────────────────────────────────────────────

const POSITIONS = ["left", "right", "top", "bottom"] as const;
type HandleSide = (typeof POSITIONS)[number];

function HandlePositionRow({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string | null;
  onChange: (pos: HandleSide | null) => void;
}): React.ReactElement {
  return (
    <div>
      <span className="text-[10px] text-muted-foreground uppercase tracking-wide">
        {label}
      </span>
      <div className="flex gap-1 mt-1">
        {POSITIONS.map((pos) => (
          <button
            key={pos}
            onClick={() => onChange(value === pos ? null : pos)}
            className={`flex-1 py-1 text-[10px] rounded capitalize transition-colors ${
              value === pos
                ? "bg-indigo-600 text-white"
                : "bg-muted text-muted-foreground hover:bg-muted/80 hover:text-foreground"
            }`}
          >
            {pos}
          </button>
        ))}
      </div>
    </div>
  );
}

// ─── Edge Appearance Panel ────────────────────────────────────────────────────

function EdgeAppearancePanel(): React.ReactElement | null {
  const selectedEdgeId = useWorkflowStore((s) => s.selectedEdgeId);
  const edges = useWorkflowStore((s) => s.edges);
  const selectEdge = useWorkflowStore((s) => s.selectEdge);
  const updateEdgeStyle = useWorkflowStore((s) => s.updateEdgeStyle);

  if (!selectedEdgeId) return null;
  const edge = edges.find((e) => e.id === selectedEdgeId);
  if (!edge) return null;

  const edgeData = (edge.data ?? {}) as EdgeStyle;

  return (
    <aside className="w-[360px] h-full bg-card border-l border-border flex flex-col overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-border shrink-0">
        <span className="text-sm font-semibold text-foreground">
          Edge Appearance
        </span>
        <button
          onClick={() => selectEdge(null)}
          className="text-muted-foreground hover:text-foreground transition-colors"
        >
          <X size={16} />
        </button>
      </div>
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        <div>
          <label className="block text-xs font-medium text-muted-foreground mb-1">
            Color
          </label>
          <div className="flex items-center gap-2">
            <input
              type="color"
              className="w-8 h-8 rounded cursor-pointer bg-muted border border-border"
              value={edgeData.color ?? "#64748b"}
              onChange={(e) =>
                updateEdgeStyle(selectedEdgeId, { color: e.target.value })
              }
            />
            <input
              type="text"
              className={inputClass + " font-mono text-xs"}
              value={edgeData.color ?? "#64748b"}
              onChange={(e) =>
                updateEdgeStyle(selectedEdgeId, { color: e.target.value })
              }
            />
            <button
              className="text-[10px] text-muted-foreground hover:text-foreground whitespace-nowrap"
              onClick={() =>
                updateEdgeStyle(selectedEdgeId, { color: undefined })
              }
            >
              Reset
            </button>
          </div>
        </div>
        <div>
          <label className="block text-xs font-medium text-muted-foreground mb-1">
            Width: {edgeData.width ?? 2}px
          </label>
          <input
            type="range"
            min={1}
            max={5}
            step={1}
            className="w-full"
            value={edgeData.width ?? 2}
            onChange={(e) =>
              updateEdgeStyle(selectedEdgeId, { width: Number(e.target.value) })
            }
          />
        </div>
        <div className="flex items-center justify-between">
          <label className="text-xs font-medium text-muted-foreground">
            Dashed
          </label>
          <button
            className={`w-9 h-5 rounded-full transition-colors relative ${edgeData.dashed ? "bg-indigo-500" : "bg-muted"}`}
            onClick={() =>
              updateEdgeStyle(selectedEdgeId, { dashed: !edgeData.dashed })
            }
          >
            <span
              className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${edgeData.dashed ? "translate-x-4" : "translate-x-0"}`}
            />
          </button>
        </div>
      </div>
    </aside>
  );
}

// ─── Main Properties Panel ────────────────────────────────────────────────────

export function PropertiesPanel(): React.ReactElement | null {
  const selectedNodeIds = useWorkflowStore((s) => s.selectedNodeIds);
  const selectedNodeId = useWorkflowStore((s) => s.selectedNodeId);
  const selectedEdgeId = useWorkflowStore((s) => s.selectedEdgeId);
  const nodes = useWorkflowStore((s) => s.nodes);
  const selectNode = useWorkflowStore((s) => s.selectNode);
  const updateNodeConfig = useWorkflowStore((s) => s.updateNodeConfig);
  const updateNodeLabel = useWorkflowStore((s) => s.updateNodeLabel);
  const updateNodeStyle = useWorkflowStore((s) => s.updateNodeStyle);
  const removeNode = useWorkflowStore((s) => s.removeNode);
  const [appearanceOpen, setAppearanceOpen] = useState(false);

  // Multi-select: show a summary + batch actions. Takes priority over the
  // per-node form, since no single node is "the" selection.
  if (selectedNodeIds.length > 1) {
    return (
      <aside className="w-80 h-full bg-card border-l border-border flex flex-col overflow-hidden shrink-0">
        <MultiSelectPanel />
      </aside>
    );
  }

  if (selectedEdgeId) return <EdgeAppearancePanel />;
  if (!selectedNodeId) return null;

  const node = nodes.find((n) => n.id === selectedNodeId);
  if (!node) return null;

  const {
    kind,
    label,
    config,
    style: nodeStyle,
  } = node.data as {
    kind: NodeKind;
    label: string;
    config: NodeConfig;
    style?: NodeStyle;
  };
  const entry = nodeRegistry[kind];

  const handleConfigChange = (patch: Partial<NodeConfig>) => {
    updateNodeConfig(selectedNodeId, patch);
  };

  const headerColor = nodeStyle?.headerColor ?? entry.color;
  const iconOverride = nodeStyle?.icon ?? "";
  const inputPos = nodeStyle?.handlePositions?.input ?? null;
  const outputPos = nodeStyle?.handlePositions?.output ?? null;

  const hasTargetHandles = entry.handles.some((h) => h.type === "target");
  const hasSourceHandles = entry.handles.some((h) => h.type === "source");

  const setHandlePos = (kind: "input" | "output", pos: HandleSide | null) => {
    const current = nodeStyle?.handlePositions ?? {};
    if (pos === null) {
      const next = { ...current };
      delete next[kind];
      updateNodeStyle(selectedNodeId, {
        handlePositions: Object.keys(next).length ? next : undefined,
      });
    } else {
      updateNodeStyle(selectedNodeId, {
        handlePositions: { ...current, [kind]: pos },
      });
    }
  };

  return (
    <aside className="w-[360px] h-full bg-card border-l border-border flex flex-col overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border shrink-0">
        <div className="flex items-center gap-2">
          <div
            className="w-2.5 h-2.5 rounded-full"
            style={{ backgroundColor: entry.color }}
          />
          <span className="text-sm font-semibold text-foreground">
            {entry.label}
          </span>
        </div>
        <button
          onClick={() => selectNode(null)}
          className="text-muted-foreground hover:text-foreground transition-colors"
        >
          <X size={16} />
        </button>
      </div>

      {/* Scrollable body */}
      <div className="flex-1 overflow-y-auto p-4 space-y-5">
        {/* Label field */}
        <div>
          <label className="block text-xs font-medium text-muted-foreground mb-1">
            Label
          </label>
          <input
            type="text"
            className={inputClass}
            value={label}
            onChange={(e) => updateNodeLabel(selectedNodeId, e.target.value)}
            placeholder="Node label"
          />
        </div>

        {/* Divider */}
        <div className="border-t border-border" />

        {/* Config form */}
        <div>{renderForm(kind, config, handleConfigChange)}</div>

        {/* Appearance section */}
        <div className="border-t border-border pt-3">
          <button
            className="flex items-center gap-1.5 w-full text-xs font-medium text-muted-foreground hover:text-foreground transition-colors mb-2"
            onClick={() => setAppearanceOpen((v) => !v)}
          >
            {appearanceOpen ? (
              <ChevronDown size={12} />
            ) : (
              <ChevronRight size={12} />
            )}
            Appearance
          </button>
          {appearanceOpen && (
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">
                  Header Color
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    className="w-8 h-8 rounded cursor-pointer bg-muted border border-border"
                    value={headerColor}
                    onChange={(e) =>
                      updateNodeStyle(selectedNodeId, {
                        headerColor: e.target.value,
                      })
                    }
                  />
                  <input
                    type="text"
                    className={inputClass + " font-mono text-xs"}
                    value={headerColor}
                    onChange={(e) =>
                      updateNodeStyle(selectedNodeId, {
                        headerColor: e.target.value,
                      })
                    }
                  />
                  <button
                    className="text-[10px] text-muted-foreground hover:text-foreground whitespace-nowrap"
                    onClick={() =>
                      updateNodeStyle(selectedNodeId, {
                        headerColor: undefined,
                      })
                    }
                  >
                    Reset
                  </button>
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">
                  Icon Override
                </label>
                <input
                  type="text"
                  className={inputClass + " text-xs"}
                  value={iconOverride}
                  onChange={(e) =>
                    updateNodeStyle(selectedNodeId, {
                      icon: e.target.value || undefined,
                    })
                  }
                  placeholder={entry.icon + " (default)"}
                />
                <p className="text-[10px] text-muted-foreground/60 mt-0.5">
                  Lucide icon name, e.g. "Zap", "Database"
                </p>
              </div>

              {/* Handle positions */}
              {(hasTargetHandles || hasSourceHandles) && (
                <div className="space-y-2.5">
                  <label className="block text-xs font-medium text-muted-foreground">
                    Handle Positions
                  </label>
                  {hasTargetHandles && (
                    <HandlePositionRow
                      label="Input"
                      value={inputPos}
                      onChange={(pos) => setHandlePos("input", pos)}
                    />
                  )}
                  {hasSourceHandles && (
                    <HandlePositionRow
                      label="Output"
                      value={outputPos}
                      onChange={(pos) => setHandlePos("output", pos)}
                    />
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Footer */}
      <div className="px-4 py-3 border-t border-border shrink-0">
        <button
          onClick={() => removeNode(selectedNodeId)}
          className="flex items-center gap-2 w-full justify-center px-3 py-2 text-xs font-medium rounded-md text-red-400 border border-red-900 hover:bg-red-950 hover:border-red-700 transition-colors"
        >
          <Trash2 size={13} />
          Delete Node
        </button>
      </div>
    </aside>
  );
}
