import React, { useCallback, useEffect, useState } from "react";
import { useEnvironmentStore } from "@/store/environmentStore";
import {
  Plus,
  Trash2,
  Pencil,
  KeyRound,
  RefreshCw,
  Save,
  ChevronDown,
  ChevronUp,
  SlidersHorizontal,
  Lock,
  Eye,
  EyeOff,
  Copy,
  Check,
} from "lucide-react";
import * as api from "../lib/api";
import { cn } from "../lib/utils";
import { TemplateInput } from "../components/panels/TemplateInput";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { PageHeader } from "../components/layout/PageHeader";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "../components/ui/dialog";
import { Button } from "../components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../components/ui/table";

// ─── Credential kind metadata ─────────────────────────────────────────────────

interface FieldDef {
  key: string;
  label: string;
  placeholder?: string;
  secret?: boolean;
}

const KIND_DEFS: Record<api.CredentialKind, { label: string; description: string; fields: FieldDef[] }> = {
  postgres: {
    label: "PostgreSQL",
    description: "Database connection for the PostgreSQL Query node",
    fields: [{ key: "connectionString", label: "Connection String", placeholder: "postgresql://user:pass@host:5432/db", secret: true }],
  },
  smtp: {
    label: "SMTP",
    description: "Email server credentials for the Send Email node",
    fields: [
      { key: "host", label: "Host", placeholder: "smtp.gmail.com" },
      { key: "port", label: "Port", placeholder: "587" },
      { key: "user", label: "Username / Email", placeholder: "you@gmail.com" },
      { key: "pass", label: "Password / App Password", secret: true },
      { key: "from", label: "From Address", placeholder: "noreply@example.com" },
      { key: "secure", label: "Secure (true/false)", placeholder: "false" },
    ],
  },
  sendgrid: {
    label: "SendGrid",
    description: "SendGrid API key for the Send Email node",
    fields: [
      { key: "apiKey", label: "API Key", placeholder: "SG.xxxxxxxx", secret: true },
      { key: "from", label: "From Address", placeholder: "noreply@example.com" },
    ],
  },
  mqtt: {
    label: "MQTT",
    description: "MQTT broker credentials for the MQTT Trigger node",
    fields: [
      { key: "brokerUrl", label: "Broker URL", placeholder: "mqtt://broker:1883" },
      { key: "username", label: "Username", placeholder: "mqtt-user" },
      { key: "password", label: "Password", secret: true },
    ],
  },
  rabbitmq: {
    label: "RabbitMQ",
    description: "AMQP connection for the RabbitMQ node",
    fields: [
      { key: "url", label: "AMQP URL", placeholder: "amqp://user:pass@localhost:5672/vhost", secret: true },
    ],
  },
  http_bearer: {
    label: "HTTP Bearer Token",
    description: "Injects Authorization: Bearer <token> header into HTTP Request nodes",
    fields: [{ key: "token", label: "Bearer Token", secret: true, placeholder: "eyJhbGciOi..." }],
  },
  http_basic: {
    label: "HTTP Basic Auth",
    description: "Injects Authorization: Basic header into HTTP Request nodes",
    fields: [
      { key: "username", label: "Username" },
      { key: "password", label: "Password", secret: true },
    ],
  },
  http_api_key: {
    label: "HTTP API Key",
    description: "Injects a custom header (e.g. X-Api-Key) into HTTP Request nodes",
    fields: [
      { key: "headerName", label: "Header Name", placeholder: "X-Api-Key" },
      { key: "headerValue", label: "Header Value", secret: true },
    ],
  },
  webhook_hmac: {
    label: "Webhook HMAC",
    description: "HMAC-SHA256 signing secret for verifying inbound webhook requests",
    fields: [
      { key: "secret", label: "Signing Secret", placeholder: "whsec_...", secret: true },
    ],
  },
  webhook_basic: {
    label: "Webhook Basic Auth",
    description: "Basic Auth credentials for verifying inbound webhook requests",
    fields: [
      { key: "username", label: "Username", placeholder: "webhook-user" },
      { key: "password", label: "Password", secret: true },
    ],
  },
  webhook_jwt: {
    label: "Webhook JWT",
    description: "JWT / Bearer token verification settings for inbound webhook requests",
    fields: [
      { key: "jwksUri", label: "JWKS URI", placeholder: "https://auth.example.com/.well-known/jwks.json" },
      { key: "publicKey", label: "Public Key (PEM)", placeholder: "-----BEGIN PUBLIC KEY-----", secret: true },
      { key: "issuer", label: "Issuer (optional)", placeholder: "https://auth.example.com/" },
      { key: "audience", label: "Audience (optional)", placeholder: "my-workflow-api" },
    ],
  },
  mysql: {
    label: "MySQL",
    description: "MySQL database connection for the MySQL node",
    fields: [{ key: "connectionString", label: "Connection String", placeholder: "mysql://user:pass@host:3306/db", secret: true }],
  },
  mariadb: {
    label: "MariaDB",
    description: "MariaDB database connection for the MariaDB node",
    fields: [{ key: "connectionString", label: "Connection String", placeholder: "mysql://user:pass@host:3306/db", secret: true }],
  },
  mssql: {
    label: "MS SQL Server",
    description: "SQL Server connection for the MSSQL node",
    fields: [
      { key: "server", label: "Server", placeholder: "localhost" },
      { key: "port", label: "Port", placeholder: "1433" },
      { key: "database", label: "Database", placeholder: "mydb" },
      { key: "user", label: "Username" },
      { key: "password", label: "Password", secret: true },
    ],
  },
  mongodb: {
    label: "MongoDB",
    description: "MongoDB connection URI for the MongoDB node",
    fields: [{ key: "uri", label: "Connection URI", placeholder: "mongodb://user:pass@host:27017/db", secret: true }],
  },
  redis: {
    label: "Redis",
    description: "Redis connection URL for the Redis node",
    fields: [{ key: "url", label: "Connection URL", placeholder: "redis://user:pass@host:6379", secret: true }],
  },
  aws: {
    label: "AWS",
    description: "AWS credentials for S3 and other AWS services",
    fields: [
      { key: "accessKeyId", label: "Access Key ID", placeholder: "AKIA..." },
      { key: "secretAccessKey", label: "Secret Access Key", secret: true },
      { key: "region", label: "Region (optional)", placeholder: "us-east-1" },
    ],
  },
  azure: {
    label: "Azure",
    description:
      "Azure credential covering every Azure node in the catalogue. Supply EITHER a connection string (Storage / Service Bus), OR account name + access key / SAS (Storage), OR Cosmos DB endpoint + key, OR a Service Principal (tenantId + clientId + clientSecret) for Key Vault / Functions / generic REST. The activity picks the first non-empty shape that matches what the node needs.",
    fields: [
      {
        key: "connectionString",
        label: "Connection String (Storage / Service Bus / Cosmos)",
        placeholder: "DefaultEndpointsProtocol=https;AccountName=...",
        secret: true,
      },
      {
        key: "accountName",
        label: "Account Name (Storage)",
        placeholder: "mystorageaccount",
      },
      { key: "accountKey", label: "Account Key (Storage)", secret: true },
      {
        key: "sasToken",
        label: "SAS Token (Storage)",
        placeholder: "?sv=2024-...&ss=b&srt=sco&sp=rwdlac",
        secret: true,
      },
      {
        key: "cosmosEndpoint",
        label: "Cosmos Endpoint",
        placeholder: "https://mycosmos.documents.azure.com:443/",
      },
      {
        key: "cosmosKey",
        label: "Cosmos Primary Key",
        secret: true,
      },
      {
        key: "tenantId",
        label: "Tenant ID (Service Principal)",
        placeholder: "00000000-0000-0000-0000-000000000000",
      },
      {
        key: "clientId",
        label: "Client ID (Service Principal)",
        placeholder: "00000000-0000-0000-0000-000000000000",
      },
      {
        key: "clientSecret",
        label: "Client Secret (Service Principal)",
        secret: true,
      },
      {
        key: "vaultUrl",
        label: "Key Vault URL",
        placeholder: "https://myvault.vault.azure.net",
      },
      {
        key: "functionKey",
        label: "Function Key (Azure Functions)",
        secret: true,
      },
    ],
  },
  gcp: {
    label: "Google Cloud",
    description:
      "Service account JSON for Google Cloud nodes (Storage / Pub/Sub / BigQuery). Use a least-privilege service account — download the JSON key from the GCP console and paste it here.",
    fields: [
      {
        key: "serviceAccountJson",
        label: "Service Account JSON",
        placeholder: '{"type":"service_account","project_id":"...","private_key":"-----BEGIN..."}',
        secret: true,
      },
      {
        key: "projectId",
        label: "Project ID (optional override)",
        placeholder: "my-gcp-project",
      },
    ],
  },
  oracle: {
    label: "Oracle Database",
    description:
      "Oracle DB connection — supports TNS connect strings, EZConnect, and Wallet-based auth. The activity uses node-oracledb's thin client by default; set walletLocation for Wallet auth.",
    fields: [
      { key: "user", label: "User", placeholder: "SYSTEM" },
      { key: "password", label: "Password", secret: true },
      {
        key: "connectString",
        label: "Connect String",
        placeholder: "host:port/service_name  or  TNS alias",
      },
      {
        key: "walletLocation",
        label: "Wallet Location (optional)",
        placeholder: "/path/to/wallet",
      },
      {
        key: "walletPassword",
        label: "Wallet Password (optional)",
        secret: true,
      },
    ],
  },
  oci: {
    label: "Oracle Cloud (OCI)",
    description:
      "OCI API signing key for Object Storage and other OCI services. Grab the fingerprint from the OCI console after uploading your public key; the private key is the PEM body.",
    fields: [
      {
        key: "tenancy",
        label: "Tenancy OCID",
        placeholder: "ocid1.tenancy.oc1..aaaaaaaa...",
      },
      {
        key: "user",
        label: "User OCID",
        placeholder: "ocid1.user.oc1..aaaaaaaa...",
      },
      {
        key: "fingerprint",
        label: "Key Fingerprint",
        placeholder: "aa:bb:cc:dd:...",
      },
      {
        key: "privateKey",
        label: "Private Key (PEM)",
        placeholder: "-----BEGIN RSA PRIVATE KEY-----",
        secret: true,
      },
      { key: "region", label: "Region", placeholder: "us-ashburn-1" },
      {
        key: "namespace",
        label: "Object Storage Namespace (optional)",
        placeholder: "mynamespace",
      },
    ],
  },
  google_sheets: {
    label: "Google Sheets",
    description: "Service account credentials for Google Sheets API",
    fields: [{ key: "serviceAccountJson", label: "Service Account JSON", placeholder: '{"type":"service_account",...}', secret: true }],
  },
  firebase: {
    label: "Firebase",
    description: "Firebase Admin SDK service account for push notifications (FCM)",
    fields: [{ key: "serviceAccountJson", label: "Service Account JSON", placeholder: '{"type":"service_account",...}', secret: true }],
  },
  apns: {
    label: "Apple Push (APNs)",
    description: "APNs token-based authentication for iOS push notifications",
    fields: [
      { key: "keyId", label: "Key ID", placeholder: "ABC123DEFG" },
      { key: "teamId", label: "Team ID", placeholder: "ABCDE12345" },
      { key: "privateKey", label: "Private Key (.p8)", placeholder: "-----BEGIN PRIVATE KEY-----", secret: true },
      { key: "bundleId", label: "Bundle ID", placeholder: "com.myapp.ios" },
    ],
  },
  slack: {
    label: "Slack",
    description: "Slack webhook URL for the Slack node",
    fields: [{ key: "webhookUrl", label: "Webhook URL", placeholder: "https://hooks.slack.com/services/T.../B.../...", secret: true }],
  },
  ssh: {
    label: "SSH",
    description: "SSH credentials for the SSH Terminal node",
    fields: [
      { key: "password", label: "Password", secret: true, placeholder: "SSH password" },
      { key: "privateKey", label: "Private Key (PEM)", secret: true, placeholder: "-----BEGIN OPENSSH PRIVATE KEY-----" },
    ],
  },
  twilio: {
    label: "Twilio",
    description: "Twilio credentials for SMS and voice",
    fields: [
      { key: "accountSid", label: "Account SID", placeholder: "AC..." },
      { key: "authToken", label: "Auth Token", secret: true },
    ],
  },
  openai: {
    label: "OpenAI",
    description: "OpenAI API key for GPT models in LLM Prompt node",
    fields: [{ key: "apiKey", label: "API Key", placeholder: "sk-...", secret: true }],
  },
  anthropic: {
    label: "Anthropic",
    description: "Anthropic API key for Claude models in LLM Prompt node",
    fields: [{ key: "apiKey", label: "API Key", placeholder: "sk-ant-...", secret: true }],
  },
  gemini: {
    label: "Google Gemini",
    description: "Google AI API key for Gemini models in LLM Prompt node",
    fields: [{ key: "apiKey", label: "API Key", placeholder: "AIza...", secret: true }],
  },
  huggingface: {
    label: "Hugging Face",
    description: "Hugging Face access token for inference API in LLM Prompt node",
    fields: [{ key: "apiToken", label: "Access Token", placeholder: "hf_...", secret: true }],
  },
  stripe: {
    label: "Stripe",
    description:
      "Stripe secret API key. Use a test key (sk_test_...) for development, live key (sk_live_...) for production.",
    fields: [
      {
        key: "apiKey",
        label: "Secret API Key",
        placeholder: "sk_test_... / sk_live_...",
        secret: true,
      },
    ],
  },
  github: {
    label: "GitHub",
    description:
      "GitHub personal access token (classic `ghp_...` or fine-grained `github_pat_...`). Scope-minimise: typical flows need `repo` / `workflow` at most.",
    fields: [
      {
        key: "token",
        label: "Personal Access Token",
        placeholder: "ghp_... / github_pat_...",
        secret: true,
      },
    ],
  },
  discord: {
    label: "Discord",
    description:
      "Either a webhook URL (for simple channel notifications) or a bot token (for arbitrary channel messages & reactions). Fill ONE — the activity picks what the selected operation needs.",
    fields: [
      {
        key: "webhookUrl",
        label: "Webhook URL",
        placeholder:
          "https://discord.com/api/webhooks/.../abc... (for webhook messages)",
        secret: true,
      },
      {
        key: "botToken",
        label: "Bot Token",
        placeholder: "(for bot-authenticated channel messages & reactions)",
        secret: true,
      },
    ],
  },
  notion: {
    label: "Notion",
    description:
      "Notion internal integration token. Create one at Settings → Connections → Develop or manage integrations, then share the target pages/databases with the integration.",
    fields: [
      {
        key: "token",
        label: "Integration Token",
        placeholder: "secret_... / ntn_...",
        secret: true,
      },
    ],
  },
  salesforce: {
    label: "Salesforce",
    description:
      "Two auth shapes supported. Fill EITHER OAuth (instanceUrl + accessToken after your own OAuth handshake) OR classic SOAP login (loginUrl + username + password + security token).",
    fields: [
      {
        key: "instanceUrl",
        label: "Instance URL (OAuth)",
        placeholder: "https://mycorp.my.salesforce.com",
      },
      {
        key: "accessToken",
        label: "Access Token (OAuth)",
        secret: true,
      },
      {
        key: "loginUrl",
        label: "Login URL (SOAP, optional)",
        placeholder: "https://login.salesforce.com (or https://test.salesforce.com for sandbox)",
      },
      { key: "username", label: "Username (SOAP)", placeholder: "you@example.com" },
      { key: "password", label: "Password (SOAP)", secret: true },
      {
        key: "securityToken",
        label: "Security Token (SOAP)",
        secret: true,
      },
    ],
  },
  jira: {
    label: "Jira Cloud",
    description:
      "Jira Cloud uses Basic auth with `email:apiToken`. Create an API token at id.atlassian.com → Security → Create and manage API tokens.",
    fields: [
      {
        key: "baseUrl",
        label: "Base URL",
        placeholder: "https://mycorp.atlassian.net",
      },
      { key: "email", label: "Email", placeholder: "you@example.com" },
      { key: "apiToken", label: "API Token", secret: true },
    ],
  },
  ms_teams: {
    label: "Microsoft Teams",
    description:
      "Microsoft Teams Incoming Webhook URL. Create in the target channel's connectors. Adaptive cards and text messages both POST to the same URL.",
    fields: [
      {
        key: "webhookUrl",
        label: "Incoming Webhook URL",
        placeholder: "https://outlook.office.com/webhook/... or https://....webhook.office.com/webhookb2/...",
        secret: true,
      },
    ],
  },
  hubspot: {
    label: "HubSpot",
    description:
      "HubSpot Private App token (recommended — create under Settings → Integrations → Private Apps) or legacy API key.",
    fields: [
      {
        key: "privateAppToken",
        label: "Private App Token",
        placeholder: "pat-na1-... (recommended)",
        secret: true,
      },
      {
        key: "apiKey",
        label: "API Key (legacy, deprecated)",
        secret: true,
      },
    ],
  },
  airtable: {
    label: "Airtable",
    description:
      "Airtable Personal Access Token (PAT) or legacy API key. PATs are preferred — create at airtable.com/create/tokens with scopes `data.records:read`/`write` for the target base.",
    fields: [
      {
        key: "apiKey",
        label: "Personal Access Token / API Key",
        placeholder: "pat... / key...",
        secret: true,
      },
    ],
  },
  pagerduty: {
    label: "PagerDuty",
    description:
      "Supply EITHER an Events API v2 routing key (integration key) for events.trigger/ack/resolve OR a REST API token for incidents.*. Operations pick the one they need.",
    fields: [
      {
        key: "routingKey",
        label: "Events API Routing Key",
        placeholder: "32-char integration key",
        secret: true,
      },
      {
        key: "apiToken",
        label: "REST API Token",
        placeholder: "(General Access or User token)",
        secret: true,
      },
    ],
  },
  gitlab: {
    label: "GitLab",
    description:
      "GitLab Personal or Project Access Token. baseUrl defaults to https://gitlab.com — set it only for self-hosted instances.",
    fields: [
      {
        key: "baseUrl",
        label: "Base URL (optional)",
        placeholder: "https://gitlab.com (or https://gitlab.mycorp.net)",
      },
      {
        key: "token",
        label: "Access Token",
        placeholder: "glpat-...",
        secret: true,
      },
    ],
  },
  linear: {
    label: "Linear",
    description:
      "Linear Personal API Key from linear.app/settings/api. Sent as the raw Authorization header (not Bearer — Linear convention).",
    fields: [
      {
        key: "apiKey",
        label: "Personal API Key",
        placeholder: "lin_api_...",
        secret: true,
      },
    ],
  },
  telegram: {
    label: "Telegram Bot",
    description:
      "Telegram Bot API token from @BotFather. Used as https://api.telegram.org/bot<token>/...",
    fields: [
      {
        key: "botToken",
        label: "Bot Token",
        placeholder: "123456789:AA...",
        secret: true,
      },
    ],
  },
  sentry: {
    label: "Sentry",
    description:
      "Two auth shapes. For events.captureMessage/captureException fill DSN. For issues.list/resolve fill auth token + org + project slugs.",
    fields: [
      {
        key: "dsn",
        label: "DSN (for events)",
        placeholder: "https://abc@o0.ingest.sentry.io/1234567",
        secret: true,
      },
      {
        key: "authToken",
        label: "Auth Token (REST API)",
        placeholder: "(Internal Integration or Auth Token)",
        secret: true,
      },
      {
        key: "organizationSlug",
        label: "Organization Slug (REST API)",
        placeholder: "my-org",
      },
      {
        key: "projectSlug",
        label: "Project Slug (REST API)",
        placeholder: "backend",
      },
    ],
  },
  shopify: {
    label: "Shopify",
    description:
      "Shopify Admin API access token + shop domain. Create a custom app from Settings → Apps and sales channels → Develop apps → API credentials.",
    fields: [
      {
        key: "shopDomain",
        label: "Shop Domain",
        placeholder: "mystore.myshopify.com",
      },
      {
        key: "accessToken",
        label: "Admin API Access Token",
        placeholder: "shpat_...",
        secret: true,
      },
    ],
  },
  mailchimp: {
    label: "Mailchimp",
    description:
      "Mailchimp Marketing API key. The key MUST include the data-center suffix (e.g. `abc123-us21`) — the activity parses the `us21` part to build the API URL.",
    fields: [
      {
        key: "apiKey",
        label: "API Key",
        placeholder: "abc123def456-us21",
        secret: true,
      },
    ],
  },
  google_drive_oauth: {
    label: "Google Drive (OAuth token)",
    description:
      "Short-lived OAuth access token for Google Drive. Use the `gcp` credential kind for service account auth instead — this kind is for OAuth flows you handle outside the platform.",
    fields: [
      {
        key: "accessToken",
        label: "Access Token",
        placeholder: "ya29...",
        secret: true,
      },
    ],
  },
  dropbox: {
    label: "Dropbox",
    description:
      "Dropbox API access token. Create one under App Console → your app → OAuth 2 → Generated access token. Long-lived PATs and short-lived tokens both work.",
    fields: [
      {
        key: "accessToken",
        label: "Access Token",
        placeholder: "sl.Bxyz...",
        secret: true,
      },
    ],
  },
  datadog: {
    label: "Datadog",
    description:
      "Datadog API key (required). App key is needed only for a few REST endpoints. Site defaults to datadoghq.com — set it for EU (`datadoghq.eu`) or regional sites like `us3.datadoghq.com`.",
    fields: [
      {
        key: "apiKey",
        label: "API Key",
        placeholder: "DD_API_KEY",
        secret: true,
      },
      {
        key: "appKey",
        label: "Application Key (optional)",
        placeholder: "DD_APP_KEY",
        secret: true,
      },
      {
        key: "site",
        label: "Site (optional)",
        placeholder: "datadoghq.com / datadoghq.eu / us3.datadoghq.com",
      },
    ],
  },
  paypal: {
    label: "PayPal",
    description:
      "PayPal REST API client credentials from developer.paypal.com. Set `environment` to `sandbox` to hit the sandbox API; defaults to `live`.",
    fields: [
      { key: "clientId", label: "Client ID", placeholder: "A21AA..." },
      { key: "clientSecret", label: "Client Secret", secret: true },
      {
        key: "environment",
        label: "Environment",
        placeholder: "live (default) / sandbox",
      },
    ],
  },
  square: {
    label: "Square",
    description:
      "Square access token from the Developer Dashboard. Set `environment` to `sandbox` to use connect.squareupsandbox.com; defaults to `production`.",
    fields: [
      {
        key: "accessToken",
        label: "Access Token",
        placeholder: "EAAA... (prod) / EAAAE... (sandbox)",
        secret: true,
      },
      {
        key: "environment",
        label: "Environment",
        placeholder: "production (default) / sandbox",
      },
    ],
  },
  resend: {
    label: "Resend",
    description:
      "Resend API key (re_...) from resend.com/api-keys. Uses Bearer auth for the emails API.",
    fields: [
      {
        key: "apiKey",
        label: "API Key",
        placeholder: "re_...",
        secret: true,
      },
    ],
  },
  onedrive: {
    label: "OneDrive",
    description:
      "OAuth access token for Microsoft Graph (Files.ReadWrite scope). Short-lived — refresh outside the platform and paste a fresh token as needed.",
    fields: [
      {
        key: "accessToken",
        label: "Access Token",
        placeholder: "EwB...",
        secret: true,
      },
    ],
  },
  box: {
    label: "Box",
    description:
      "Box OAuth / JWT developer access token. For apps with user auth, use the access token issued by your OAuth flow; for server auth, use a JWT-minted token.",
    fields: [
      {
        key: "accessToken",
        label: "Access Token",
        placeholder: "(Box access token)",
        secret: true,
      },
    ],
  },
  circleci: {
    label: "CircleCI",
    description:
      "CircleCI Personal API Token from circleci.com/user/tokens. Sent via the Circle-Token header.",
    fields: [
      {
        key: "token",
        label: "API Token",
        placeholder: "(40-char token)",
        secret: true,
      },
    ],
  },
  whatsapp_business: {
    label: "WhatsApp Business",
    description:
      "Meta Graph access token + phone number ID from Meta for Developers → WhatsApp → API Setup. System-user tokens recommended for production.",
    fields: [
      {
        key: "accessToken",
        label: "Access Token",
        placeholder: "EAAG...",
        secret: true,
      },
      {
        key: "phoneNumberId",
        label: "Phone Number ID",
        placeholder: "(numeric ID from the API Setup panel)",
      },
    ],
  },
  pipedrive: {
    label: "Pipedrive",
    description:
      "Pipedrive API token + company domain. companyDomain is the subdomain part of `<companyDomain>.pipedrive.com`.",
    fields: [
      {
        key: "apiToken",
        label: "API Token",
        placeholder: "(from Personal preferences → API)",
        secret: true,
      },
      {
        key: "companyDomain",
        label: "Company Domain",
        placeholder: "mycorp (from mycorp.pipedrive.com)",
      },
    ],
  },
  customer_io: {
    label: "Customer.io",
    description:
      "Track API: siteId + apiKey (Basic auth). App API (for sendTransactional): appApiKey (Bearer). Set `region` to `eu` for the EU data residency endpoints.",
    fields: [
      {
        key: "siteId",
        label: "Site ID (Track API)",
        placeholder: "abc123",
      },
      {
        key: "apiKey",
        label: "Track API Key",
        placeholder: "(Track API key)",
        secret: true,
      },
      {
        key: "appApiKey",
        label: "App API Key (transactional)",
        placeholder: "(App API key)",
        secret: true,
      },
      {
        key: "region",
        label: "Region (optional)",
        placeholder: "us (default) / eu",
      },
    ],
  },
  kafka: {
    label: "Kafka",
    description:
      "Kafka broker connection. `brokers` is a CSV list `host1:9092,host2:9092`. SASL + SSL are optional — set `sasl` to `true` and fill `saslMechanism` / username / password for authenticated clusters (Confluent Cloud, MSK IAM, etc.).",
    fields: [
      {
        key: "brokers",
        label: "Brokers (CSV)",
        placeholder: "broker1:9092,broker2:9092",
      },
      {
        key: "clientId",
        label: "Client ID (optional)",
        placeholder: "zuzuflow",
      },
      {
        key: "ssl",
        label: "SSL (true / false)",
        placeholder: "true",
      },
      {
        key: "sasl",
        label: "SASL enabled (true / false)",
        placeholder: "true",
      },
      {
        key: "saslMechanism",
        label: "SASL Mechanism",
        placeholder: "plain / scram-sha-256 / scram-sha-512",
      },
      { key: "username", label: "SASL Username" },
      { key: "password", label: "SASL Password", secret: true },
    ],
  },
  nats: {
    label: "NATS",
    description:
      "NATS / JetStream connection. `servers` is a CSV list. Supply EITHER `token` OR `user` + `pass` for authenticated servers.",
    fields: [
      {
        key: "servers",
        label: "Servers (CSV)",
        placeholder: "nats://localhost:4222",
      },
      { key: "user", label: "User (optional)" },
      { key: "pass", label: "Password (optional)", secret: true },
      { key: "token", label: "Token (optional)", secret: true },
    ],
  },
  snowflake: {
    label: "Snowflake",
    description:
      "Snowflake account + username + (password OR privateKey). `account` is the locator like `xy12345.us-east-1`. Optional defaults for database/schema/warehouse/role can be overridden per-node.",
    fields: [
      {
        key: "account",
        label: "Account locator",
        placeholder: "xy12345.us-east-1",
      },
      { key: "username", label: "Username" },
      { key: "password", label: "Password (choose one)", secret: true },
      {
        key: "privateKey",
        label: "Private Key PEM (key-pair auth)",
        secret: true,
      },
      { key: "database", label: "Default Database (optional)" },
      { key: "schema", label: "Default Schema (optional)" },
      { key: "warehouse", label: "Default Warehouse (optional)" },
      { key: "role", label: "Default Role (optional)" },
    ],
  },
  clickhouse: {
    label: "ClickHouse",
    description:
      "ClickHouse HTTP interface URL + optional credentials. URL looks like `http://localhost:8123` or `https://<cluster>.clickhouse.cloud`.",
    fields: [
      {
        key: "url",
        label: "URL",
        placeholder: "https://my-cluster.clickhouse.cloud",
      },
      { key: "username", label: "Username (optional)", placeholder: "default" },
      { key: "password", label: "Password (optional)", secret: true },
      { key: "database", label: "Default Database (optional)" },
    ],
  },
  elasticsearch: {
    label: "Elasticsearch",
    description:
      "Elasticsearch node URL + auth. Supply EITHER `apiKey` OR `username` + `password`. Paste CA cert (PEM) for self-signed clusters.",
    fields: [
      {
        key: "node",
        label: "Node URL",
        placeholder: "https://localhost:9200",
      },
      { key: "apiKey", label: "API Key (recommended)", secret: true },
      { key: "username", label: "Username (alternative)" },
      { key: "password", label: "Password (alternative)", secret: true },
      { key: "ca", label: "CA cert PEM (optional)", secret: true },
    ],
  },
  stability: {
    label: "Stability AI",
    description:
      "Stability AI API key from platform.stability.ai. Used by the AI Image node when provider=stability.",
    fields: [
      {
        key: "apiKey",
        label: "API Key",
        placeholder: "sk-...",
        secret: true,
      },
    ],
  },
  assemblyai: {
    label: "AssemblyAI",
    description:
      "AssemblyAI API key from assemblyai.com. Used by AI Transcribe when provider=assemblyai.",
    fields: [
      {
        key: "apiKey",
        label: "API Key",
        secret: true,
      },
    ],
  },
  elevenlabs: {
    label: "ElevenLabs",
    description:
      "ElevenLabs xi-api-key from elevenlabs.io. Used by AI TTS when provider=elevenlabs.",
    fields: [
      {
        key: "apiKey",
        label: "API Key",
        secret: true,
      },
    ],
  },
  cohere: {
    label: "Cohere",
    description:
      "Cohere production API key from dashboard.cohere.com. Used by AI Embed when provider=cohere.",
    fields: [
      {
        key: "apiKey",
        label: "API Key",
        secret: true,
      },
    ],
  },
  pinecone: {
    label: "Pinecone",
    description:
      "Pinecone API key + per-index host URL. `indexHost` looks like `my-index-abc123.svc.aped-xxxx.pinecone.io` — you'll find it on the index detail page.",
    fields: [
      { key: "apiKey", label: "API Key", secret: true },
      {
        key: "indexHost",
        label: "Index Host URL",
        placeholder: "https://my-index-abc.svc.aped-xxxx.pinecone.io",
      },
    ],
  },
  weaviate: {
    label: "Weaviate",
    description:
      "Weaviate cluster URL + optional API key (required for Weaviate Cloud, optional for self-hosted).",
    fields: [
      {
        key: "url",
        label: "Cluster URL",
        placeholder: "https://my-cluster.weaviate.network",
      },
      { key: "apiKey", label: "API Key (optional)", secret: true },
    ],
  },
  qdrant: {
    label: "Qdrant",
    description:
      "Qdrant URL + optional API key (required for Qdrant Cloud). Self-hosted can run without one.",
    fields: [
      {
        key: "url",
        label: "URL",
        placeholder: "https://my-cluster.qdrant.io:6333",
      },
      { key: "apiKey", label: "API Key (optional)", secret: true },
    ],
  },
  generic: {
    label: "Generic / Custom",
    description: "Free-form key-value pairs, resolved at runtime",
    fields: [
      { key: "key1", label: "Key 1", placeholder: "MY_SECRET" },
      { key: "value1", label: "Value 1", secret: true },
    ],
  },
};

const KIND_BADGE: Record<string, string> = {
  postgres: "bg-blue-900 text-blue-300",
  mysql: "bg-blue-900 text-blue-300",
  mongodb: "bg-green-900 text-green-300",
  redis: "bg-red-900 text-red-300",
  smtp: "bg-violet-900 text-violet-300",
  sendgrid: "bg-cyan-900 text-cyan-300",
  mqtt: "bg-amber-900 text-amber-300",
  rabbitmq: "bg-orange-900 text-orange-300",
  http_bearer: "bg-green-900 text-green-300",
  http_basic: "bg-green-900 text-green-300",
  http_api_key: "bg-green-900 text-green-300",
  webhook_hmac: "bg-emerald-900 text-emerald-300",
  webhook_basic: "bg-amber-900 text-amber-300",
  webhook_jwt: "bg-sky-900 text-sky-300",
  aws: "bg-orange-900 text-orange-300",
  azure: "bg-sky-900 text-sky-300",
  gcp: "bg-blue-900 text-blue-300",
  oracle: "bg-red-900 text-red-300",
  oci: "bg-red-900 text-red-300",
  slack: "bg-purple-900 text-purple-300",
  ssh: "bg-slate-800 text-slate-300",
  twilio: "bg-red-900 text-red-300",
  openai: "bg-emerald-900 text-emerald-300",
  mariadb: "bg-blue-900 text-blue-300",
  mssql: "bg-blue-900 text-blue-300",
  google_sheets: "bg-green-900 text-green-300",
  firebase: "bg-yellow-900 text-yellow-300",
  apns: "bg-slate-800 text-slate-300",
  anthropic: "bg-orange-900 text-orange-300",
  gemini: "bg-blue-900 text-blue-300",
  huggingface: "bg-yellow-900 text-yellow-300",
  stripe: "bg-violet-900 text-violet-300",
  github: "bg-slate-800 text-slate-200",
  discord: "bg-indigo-900 text-indigo-300",
  notion: "bg-neutral-800 text-neutral-200",
  salesforce: "bg-sky-900 text-sky-300",
  jira: "bg-blue-900 text-blue-300",
  ms_teams: "bg-indigo-900 text-indigo-300",
  hubspot: "bg-orange-900 text-orange-300",
  airtable: "bg-yellow-900 text-yellow-300",
  pagerduty: "bg-emerald-900 text-emerald-300",
  gitlab: "bg-orange-900 text-orange-300",
  linear: "bg-indigo-900 text-indigo-300",
  telegram: "bg-sky-900 text-sky-300",
  sentry: "bg-violet-900 text-violet-300",
  shopify: "bg-green-900 text-green-300",
  mailchimp: "bg-yellow-900 text-yellow-300",
  google_drive_oauth: "bg-blue-900 text-blue-300",
  dropbox: "bg-blue-900 text-blue-300",
  datadog: "bg-violet-900 text-violet-300",
  paypal: "bg-blue-900 text-blue-300",
  square: "bg-slate-800 text-slate-200",
  resend: "bg-neutral-800 text-neutral-200",
  onedrive: "bg-blue-900 text-blue-300",
  box: "bg-blue-900 text-blue-300",
  circleci: "bg-neutral-800 text-neutral-200",
  whatsapp_business: "bg-green-900 text-green-300",
  pipedrive: "bg-green-900 text-green-300",
  customer_io: "bg-violet-900 text-violet-300",
  kafka: "bg-neutral-800 text-neutral-200",
  nats: "bg-sky-900 text-sky-300",
  snowflake: "bg-sky-900 text-sky-300",
  clickhouse: "bg-yellow-900 text-yellow-300",
  elasticsearch: "bg-yellow-900 text-yellow-300",
  stability: "bg-violet-900 text-violet-300",
  assemblyai: "bg-blue-900 text-blue-300",
  elevenlabs: "bg-neutral-800 text-neutral-200",
  cohere: "bg-orange-900 text-orange-300",
  pinecone: "bg-emerald-900 text-emerald-300",
  weaviate: "bg-indigo-900 text-indigo-300",
  qdrant: "bg-red-900 text-red-300",
  generic: "bg-muted text-foreground",
};

const inputClass =
  "w-full px-3 py-1.5 text-sm bg-secondary border border-border rounded text-foreground placeholder-muted-foreground focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500";

// ─── Credential form modal ────────────────────────────────────────────────────

function CredentialForm({ existing, onSave, onClose }: {
  existing?: api.CredentialItem; onSave: () => void; onClose: () => void;
}) {
  const [name, setName] = useState(existing?.name ?? "");
  const [kind, setKind] = useState<api.CredentialKind>(existing?.kind ?? "postgres");
  const [data, setData] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [showSecrets, setShowSecrets] = useState<Record<string, boolean>>({});
  const def = KIND_DEFS[kind];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) { setError("Name is required"); return; }
    setSaving(true); setError("");
    try {
      if (existing) {
        await api.updateCredential(existing.id, { name: name.trim(), data });
      } else {
        await api.createCredential({ name: name.trim(), kind, data });
      }
      onSave();
    } catch (err) { setError(String(err)); }
    finally { setSaving(false); }
  };

  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="max-w-lg max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>{existing ? "Edit Credential" : "New Credential"}</DialogTitle>
          <DialogDescription>{existing ? "Update credential values below." : "Configure a new credential for your workflows."}</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto space-y-4">
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">Name *</label>
            <input className={inputClass} value={name} onChange={(e) => setName(e.target.value)} placeholder="My Postgres DB" autoFocus />
          </div>
          {!existing && (
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">Type *</label>
              <select className={inputClass} value={kind} onChange={(e) => { setKind(e.target.value as api.CredentialKind); setData({}); }}>
                {(Object.keys(KIND_DEFS) as api.CredentialKind[]).map((k) => (
                  <option key={k} value={k}>{KIND_DEFS[k].label}</option>
                ))}
              </select>
              <p className="text-[10px] text-muted-foreground mt-1">{def.description}</p>
            </div>
          )}
          <div className="space-y-3">
            <label className="block text-xs font-medium text-muted-foreground">
              {existing ? "Update values (leave blank to keep existing)" : "Values"}
            </label>
            {def.fields.map((field) => (
              <div key={field.key}>
                <label className="block text-[10px] text-muted-foreground mb-0.5">{field.label}</label>
                <TemplateInput
                  type={field.secret && !showSecrets[field.key] ? "password" : "text"}
                  className={inputClass + (field.secret ? " pr-16" : "")}
                  value={data[field.key] ?? ""}
                  onChange={(v) => setData((d) => ({ ...d, [field.key]: v }))}
                  placeholder={existing ? "(unchanged)" : field.placeholder}
                  endAdornment={field.secret ? (
                    <button
                      type="button"
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-muted-foreground hover:text-foreground"
                      onClick={() => setShowSecrets((s) => ({ ...s, [field.key]: !s[field.key] }))}
                    >
                      {showSecrets[field.key] ? "Hide" : "Show"}
                    </button>
                  ) : undefined}
                />
              </div>
            ))}
          </div>
          {error && <p className="text-xs text-red-400">{error}</p>}
        </form>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSubmit as any} disabled={saving}>
            {saving ? <RefreshCw size={12} className="animate-spin mr-1.5" /> : <Save size={12} className="mr-1.5" />}
            {saving ? "Saving…" : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Variable form modal ──────────────────────────────────────────────────────

function VariableForm({ existing, onSave, onClose }: {
  existing?: api.VariableItem; onSave: () => void; onClose: () => void;
}) {
  const [key, setKey] = useState(existing?.key ?? "");
  const [value, setValue] = useState("");
  const [description, setDescription] = useState(existing?.description ?? "");
  const [isSecret, setIsSecret] = useState(existing?.isSecret ?? false);
  const [showValue, setShowValue] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!key.trim()) { setError("Key is required"); return; }
    if (!existing && !value.trim()) { setError("Value is required"); return; }
    // Validate key format: only letters, numbers, underscores
    if (!/^[A-Z0-9_]+$/i.test(key.trim())) { setError("Key must contain only letters, numbers, and underscores"); return; }
    setSaving(true); setError("");
    try {
      if (existing) {
        await api.updateVariable(existing.id, {
          key: key.trim(),
          ...(value.trim() ? { value: value.trim() } : {}),
          description: description || undefined,
        });
      } else {
        await api.createVariable({ key: key.trim().toUpperCase(), value: value.trim(), description: description || undefined, isSecret });
      }
      onSave();
    } catch (err) { setError(String(err)); }
    finally { setSaving(false); }
  };

  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{existing ? "Edit Variable" : "New Variable"}</DialogTitle>
          <DialogDescription>{existing ? "Update variable values below." : "Add a new environment variable."}</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">Key *</label>
            <input
              className={inputClass + " font-mono uppercase"}
              value={key}
              onChange={(e) => setKey(e.target.value.toUpperCase().replace(/[^A-Z0-9_]/g, ""))}
              placeholder="DB_HOST"
              autoFocus
            />
            <p className="text-[10px] text-muted-foreground mt-0.5">
              Reference in nodes as <code className="font-mono text-indigo-400">{"{{$env." + (key || "KEY") + "}}"}</code>
            </p>
          </div>

          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">
              Value {existing ? "(leave blank to keep existing)" : "*"}
            </label>
            <div className="relative">
              <input
                type={isSecret && !showValue ? "password" : "text"}
                className={inputClass + " pr-9"}
                value={value}
                onChange={(e) => setValue(e.target.value)}
                placeholder={existing ? "(unchanged)" : "your-value-here"}
              />
              <button type="button" className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                onClick={() => setShowValue((v) => !v)}>
                {showValue ? <EyeOff size={13} /> : <Eye size={13} />}
              </button>
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">Description (optional)</label>
            <input
              className={inputClass}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What this variable is for"
            />
          </div>

          {!existing && (
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={isSecret} onChange={(e) => setIsSecret(e.target.checked)}
                className="w-3.5 h-3.5 rounded accent-indigo-500" />
              <span className="text-xs text-muted-foreground">
                Secret — encrypt value, mask in UI
              </span>
              <Lock size={11} className="text-muted-foreground" />
            </label>
          )}

          {error && <p className="text-xs text-red-400">{error}</p>}
        </form>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSubmit as any} disabled={saving}>
            {saving ? <RefreshCw size={12} className="animate-spin mr-1.5" /> : <Save size={12} className="mr-1.5" />}
            {saving ? "Saving…" : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Variables panel ──────────────────────────────────────────────────────────

function VariablesPanel() {
  const currentSlug = useEnvironmentStore((s) => s.currentSlug);
  const [variables, setVariables] = useState<api.VariableItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<api.VariableItem | undefined>();
  const [deleting, setDeleting] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string } | null>(null);

  const load = useCallback(() => {
    if (!currentSlug) return;
    setLoading(true);
    api.listVariables().then(setVariables).catch(console.error).finally(() => setLoading(false));
  }, [currentSlug]);

  useEffect(() => { load(); }, [load]);

  const handleDelete = (v: api.VariableItem) => {
    setDeleteTarget({ id: v.id, name: v.key });
  };

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(deleteTarget.id);
    setDeleteTarget(null);
    try {
      await api.deleteVariable(deleteTarget.id);
      setVariables((prev) => prev.filter((x) => x.id !== deleteTarget.id));
    } catch (err) { toast.error(String(err)); }
    finally { setDeleting(null); }
  };

  const copyRef = (key: string) => {
    navigator.clipboard.writeText(`{{$env.${key}}}`);
    setCopied(key);
    setTimeout(() => setCopied(null), 1500);
  };

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-sm font-semibold text-foreground">Environment Variables</h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Reference in any node config as{" "}
            <code className="font-mono text-indigo-400">{"{{$env.MY_KEY}}"}</code>
          </p>
        </div>
        <button onClick={() => { setEditing(undefined); setShowForm(true); }}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded bg-indigo-600 hover:bg-indigo-500 text-white transition-colors">
          <Plus size={13} /> Add Variable
        </button>
      </div>

      {/* Banner */}
      <div className="bg-card border border-border rounded-lg px-4 py-3 text-xs text-muted-foreground leading-relaxed mb-5">
        Variables let you manage environment-specific values (URLs, feature flags, non-secret config) in one place.
        Change a variable once and every workflow that uses it picks up the new value automatically.
        For secrets (passwords, tokens), mark the variable as <strong className="text-foreground">Secret</strong> — it will be encrypted and masked in the UI.
      </div>

      {loading && variables.length === 0 ? (
        <div className="flex items-center justify-center py-12 text-muted-foreground">
          <RefreshCw size={16} className="animate-spin mr-2" /> Loading…
        </div>
      ) : variables.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
          <SlidersHorizontal size={36} className="mb-3 opacity-30" />
          <p className="text-sm mb-1">No variables yet</p>
          <button onClick={() => { setEditing(undefined); setShowForm(true); }}
            className="mt-4 flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded bg-indigo-600 hover:bg-indigo-500 text-white transition-colors">
            <Plus size={13} /> Add Variable
          </button>
        </div>
      ) : (
        <div className="bg-card border border-border rounded-xl overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Key</TableHead>
                <TableHead>Value</TableHead>
                <TableHead className="hidden sm:table-cell">Description</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {variables.map((v) => (
                <TableRow key={v.id}>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      {v.isSecret && <Lock size={10} className="text-amber-400 shrink-0" />}
                      <code className="font-mono text-foreground">{v.key}</code>
                      <button title="Copy reference" onClick={() => copyRef(v.key)}
                        className="text-muted-foreground hover:text-indigo-400 transition-colors">
                        {copied === v.key ? <Check size={11} className="text-emerald-400" /> : <Copy size={11} />}
                      </button>
                    </div>
                    <p className="text-[10px] text-indigo-500 font-mono mt-0.5">{`{{$env.${v.key}}}`}</p>
                  </TableCell>
                  <TableCell>
                    <span className={cn("font-mono", v.isSecret ? "text-muted-foreground" : "text-foreground")}>
                      {v.value}
                    </span>
                  </TableCell>
                  <TableCell className="text-muted-foreground hidden sm:table-cell">
                    {v.description ?? "—"}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1 justify-end">
                      <button onClick={() => { setEditing(v); setShowForm(true); }}
                        className="flex items-center gap-1 px-2 py-1 text-muted-foreground hover:text-foreground hover:bg-muted rounded transition-colors">
                        <Pencil size={12} />
                      </button>
                      <button onClick={() => handleDelete(v)} disabled={deleting === v.id}
                        className="flex items-center justify-center w-7 h-7 text-muted-foreground hover:text-red-400 hover:bg-red-900/30 rounded transition-colors">
                        {deleting === v.id ? <RefreshCw size={12} className="animate-spin" /> : <Trash2 size={12} />}
                      </button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {showForm && (
        <VariableForm
          existing={editing}
          onSave={() => { setShowForm(false); load(); }}
          onClose={() => setShowForm(false)}
        />
      )}

      <ConfirmDialog
        open={deleteTarget !== null}
        onOpenChange={(open) => { if (!open) setDeleteTarget(null); }}
        title="Delete Variable"
        description={`Delete variable "${deleteTarget?.name}"?`}
        confirmLabel="Delete"
        onConfirm={handleConfirmDelete}
        destructive
      />
    </div>
  );
}

// ─── Credentials panel ────────────────────────────────────────────────────────

function CredentialsPanel() {
  const currentSlug = useEnvironmentStore((s) => s.currentSlug);
  const [credentials, setCredentials] = useState<api.CredentialItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<api.CredentialItem | undefined>();
  const [deleting, setDeleting] = useState<string | null>(null);
  const [expandedKinds, setExpandedKinds] = useState<Set<string>>(new Set(Object.keys(KIND_DEFS)));
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string } | null>(null);

  const load = useCallback(() => {
    if (!currentSlug) return;
    setLoading(true);
    api.listCredentials().then(setCredentials).catch(console.error).finally(() => setLoading(false));
  }, [currentSlug]);

  useEffect(() => { load(); }, [load]);

  const handleDelete = (c: api.CredentialItem) => {
    setDeleteTarget({ id: c.id, name: c.name });
  };

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(deleteTarget.id);
    setDeleteTarget(null);
    try {
      await api.deleteCredential(deleteTarget.id);
      setCredentials((prev) => prev.filter((x) => x.id !== deleteTarget.id));
    } catch (err) { toast.error(String(err)); }
    finally { setDeleting(null); }
  };

  const grouped = credentials.reduce<Record<string, api.CredentialItem[]>>((acc, c) => {
    if (!acc[c.kind]) acc[c.kind] = [];
    acc[c.kind].push(c); return acc;
  }, {});

  const toggleKind = (kind: string) => {
    setExpandedKinds((prev) => {
      const next = new Set(prev);
      next.has(kind) ? next.delete(kind) : next.add(kind);
      return next;
    });
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-sm font-semibold text-foreground">Credentials</h2>
          <p className="text-xs text-muted-foreground mt-0.5">Encrypted connection details for nodes</p>
        </div>
        <button onClick={() => { setEditing(undefined); setShowForm(true); }}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded bg-indigo-600 hover:bg-indigo-500 text-white transition-colors">
          <Plus size={13} /> New Credential
        </button>
      </div>

      <div className="bg-card border border-border rounded-lg px-4 py-3 text-xs text-muted-foreground leading-relaxed mb-5">
        <strong className="text-foreground">Credentials</strong> store connection details and secrets (passwords, API keys, tokens)
        encrypted at rest with AES-256-GCM. Select a credential in node config — the engine decrypts and injects values at runtime.
        Nodes: PostgreSQL, Send Email, HTTP Request, MQTT.
      </div>

      {loading && credentials.length === 0 ? (
        <div className="flex items-center justify-center py-12 text-muted-foreground">
          <RefreshCw size={16} className="animate-spin mr-2" /> Loading…
        </div>
      ) : credentials.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
          <KeyRound size={36} className="mb-3 opacity-30" />
          <p className="text-sm mb-1">No credentials yet</p>
          <button onClick={() => { setEditing(undefined); setShowForm(true); }}
            className="mt-4 flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded bg-indigo-600 hover:bg-indigo-500 text-white transition-colors">
            <Plus size={13} /> Add Credential
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {(Object.keys(KIND_DEFS) as api.CredentialKind[]).map((kind) => {
            const items = grouped[kind];
            if (!items) return null;
            const def = KIND_DEFS[kind];
            const expanded = expandedKinds.has(kind);
            return (
              <div key={kind} className="bg-card border border-border rounded-xl overflow-hidden">
                <button className="w-full flex items-center gap-3 px-5 py-3 hover:bg-secondary/50 transition-colors" onClick={() => toggleKind(kind)}>
                  <span className={cn("px-2 py-0.5 text-[10px] font-bold rounded uppercase", KIND_BADGE[kind] ?? "bg-muted text-foreground")}>{kind}</span>
                  <span className="text-sm font-medium text-foreground">{def.label}</span>
                  <span className="text-xs text-muted-foreground ml-1">{items.length} credential{items.length !== 1 ? "s" : ""}</span>
                  <span className="ml-auto text-muted-foreground">{expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}</span>
                </button>
                {expanded && (
                  <div className="border-t border-border">
                    {items.map((c) => (
                      <div key={c.id} className="flex items-center gap-3 px-5 py-3 border-b border-border/50 last:border-0 hover:bg-secondary/20 transition-colors">
                        <KeyRound size={13} className="text-muted-foreground shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-foreground font-medium">{c.name}</p>
                          <p className="text-[10px] text-muted-foreground font-mono">{c.id}</p>
                        </div>
                        <p className="text-[10px] text-muted-foreground hidden sm:block">Updated {new Date(c.updatedAt).toLocaleDateString()}</p>
                        <div className="flex items-center gap-1 shrink-0">
                          <button onClick={() => { setEditing(c); setShowForm(true); }}
                            className="flex items-center gap-1 px-2 py-1.5 text-xs text-muted-foreground hover:text-foreground hover:bg-muted rounded transition-colors">
                            <Pencil size={12} /> Edit
                          </button>
                          <button onClick={() => handleDelete(c)} disabled={deleting === c.id}
                            className="flex items-center justify-center w-7 h-7 text-muted-foreground hover:text-red-400 hover:bg-red-900/30 rounded transition-colors">
                            {deleting === c.id ? <RefreshCw size={12} className="animate-spin" /> : <Trash2 size={12} />}
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {showForm && (
        <CredentialForm
          existing={editing}
          onSave={() => { setShowForm(false); load(); }}
          onClose={() => setShowForm(false)}
        />
      )}

      <ConfirmDialog
        open={deleteTarget !== null}
        onOpenChange={(open) => { if (!open) setDeleteTarget(null); }}
        title="Delete Credential"
        description={`Delete "${deleteTarget?.name}"? Workflows using this credential will stop working.`}
        confirmLabel="Delete"
        onConfirm={handleConfirmDelete}
        destructive
      />
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export function CredentialsPage(): React.ReactElement {
  return (
    <div className="px-8 py-6 max-w-4xl mx-auto">
      <PageHeader icon={KeyRound} title="Secrets & Variables" />

      <Tabs defaultValue="variables" className="w-full">
        <TabsList>
          <TabsTrigger value="variables">
            <SlidersHorizontal size={13} className="mr-1.5" />
            Variables
          </TabsTrigger>
          <TabsTrigger value="credentials">
            <KeyRound size={13} className="mr-1.5" />
            Credentials
          </TabsTrigger>
        </TabsList>
        <TabsContent value="variables"><VariablesPanel /></TabsContent>
        <TabsContent value="credentials"><CredentialsPanel /></TabsContent>
      </Tabs>
    </div>
  );
}
