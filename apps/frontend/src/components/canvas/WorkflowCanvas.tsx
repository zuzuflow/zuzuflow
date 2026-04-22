import React, { useCallback, useMemo } from "react";
import {
  ReactFlow,
  MiniMap,
  Controls,
  Background,
  BackgroundVariant,
  ReactFlowProvider,
  useReactFlow,
  type NodeTypes,
  type EdgeTypes,
  type OnConnect,
  type OnNodesChange,
  type OnEdgesChange,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import type { NodeKind } from "@workflow/shared";

import { useWorkflowStore } from "../../store/workflowStore";
import { useExecutionStore } from "../../store/executionStore";
import { useCanvasDesignStore } from "../../store/canvasDesignStore";
import { nodeRegistry } from "../../lib/nodeRegistry";
import { AnimatedEdge } from "./AnimatedEdge";
import { SelectionToolbar } from "./SelectionToolbar";

// Node components
import { ManualTriggerNode } from "../nodes/ManualTriggerNode";
import { WebhookNode } from "../nodes/WebhookNode";
import { CronNode } from "../nodes/CronNode";
import { MqttTriggerNode } from "../nodes/MqttTriggerNode";
import { ExternalTriggerNode } from "../nodes/ExternalTriggerNode";
import { TriggerOutputNode } from "../nodes/TriggerOutputNode";
import { IfElseNode } from "../nodes/IfElseNode";
import { SwitchNode } from "../nodes/SwitchNode";
import { DelayNode } from "../nodes/DelayNode";
import { MergeNode } from "../nodes/MergeNode";
import { HttpRequestNode } from "../nodes/HttpRequestNode";
import { SendEmailNode } from "../nodes/SendEmailNode";
import { PostgresNode } from "../nodes/PostgresNode";
import { CustomCodeNode } from "../nodes/CustomCodeNode";
import { CustomBuilderNode } from "../nodes/CustomBuilderNode";
import { GroupNode } from "../nodes/GroupNode";
import { DebugNode } from "../nodes/DebugNode";
import { RabbitMQNode } from "../nodes/RabbitMQNode";
import { WorkflowTriggerInNode } from "../nodes/WorkflowTriggerInNode";
import { WorkflowTriggerOutNode } from "../nodes/WorkflowTriggerOutNode";
import { StopNode } from "../nodes/StopNode";
import { JsRunnerNode } from "../nodes/JsRunnerNode";
import { TsRunnerNode } from "../nodes/TsRunnerNode";
import { DataMapperNode } from "../nodes/DataMapperNode";
import { JsonParserNode } from "../nodes/JsonParserNode";
import { HtmlTemplateNode } from "../nodes/HtmlTemplateNode";
import { CryptoHashNode } from "../nodes/CryptoHashNode";
import { DateFormatterNode } from "../nodes/DateFormatterNode";
import { Base64Node } from "../nodes/Base64Node";
import { MysqlNode } from "../nodes/MysqlNode";
import { MongodbNode } from "../nodes/MongodbNode";
import { RedisNode } from "../nodes/RedisNode";
import { S3BucketNode } from "../nodes/S3BucketNode";
import { SlackNode } from "../nodes/SlackNode";
import { SshTerminalNode } from "../nodes/SshTerminalNode";
import { TwilioSmsNode } from "../nodes/TwilioSmsNode";
import { TwilioEmailNode } from "../nodes/TwilioEmailNode";
import { LlmPromptNode } from "../nodes/LlmPromptNode";
import { AiAgentNode } from "../nodes/AiAgentNode";
import { SubworkflowCallNode } from "../nodes/SubworkflowCallNode";
import { SubflowInputNode } from "../nodes/SubflowInputNode";
import { SubflowOutputNode } from "../nodes/SubflowOutputNode";
import { MariadbNode } from "../nodes/MariadbNode";
import { MssqlNode } from "../nodes/MssqlNode";
import { GoogleSheetsNode } from "../nodes/GoogleSheetsNode";
import { PythonRunnerNode } from "../nodes/PythonRunnerNode";
import { FirebasePushNode } from "../nodes/FirebasePushNode";
import { ApnsPushNode } from "../nodes/ApnsPushNode";
import { LoopNode } from "../nodes/LoopNode";
import { ResponseNode } from "../nodes/ResponseNode";
import { AwsLambdaNode } from "../nodes/AwsLambdaNode";
import { AwsSqsNode } from "../nodes/AwsSqsNode";
import { AwsSnsNode } from "../nodes/AwsSnsNode";
import { AwsDynamoDBNode } from "../nodes/AwsDynamoDBNode";
import { AwsSesNode } from "../nodes/AwsSesNode";
import { AwsSecretsManagerNode } from "../nodes/AwsSecretsManagerNode";
import { AwsSsmNode } from "../nodes/AwsSsmNode";
import { AwsEventBridgeNode } from "../nodes/AwsEventBridgeNode";
import { AwsStepFunctionsNode } from "../nodes/AwsStepFunctionsNode";
import { AzureBlobNode } from "../nodes/AzureBlobNode";
import { AzureServiceBusNode } from "../nodes/AzureServiceBusNode";
import { AzureCosmosNode } from "../nodes/AzureCosmosNode";
import { AzureKeyVaultNode } from "../nodes/AzureKeyVaultNode";
import { AzureFunctionsNode } from "../nodes/AzureFunctionsNode";
import { GcpStorageNode } from "../nodes/GcpStorageNode";
import { GcpPubSubNode } from "../nodes/GcpPubSubNode";
import { GcpBigQueryNode } from "../nodes/GcpBigQueryNode";
import { OracleDbNode } from "../nodes/OracleDbNode";
import { OciObjectStorageNode } from "../nodes/OciObjectStorageNode";
import { StripeNode } from "../nodes/StripeNode";
import { GithubNode } from "../nodes/GithubNode";
import { DiscordNode } from "../nodes/DiscordNode";
import { NotionNode } from "../nodes/NotionNode";
import { SalesforceNode } from "../nodes/SalesforceNode";
import { JiraNode } from "../nodes/JiraNode";
import { MsTeamsNode } from "../nodes/MsTeamsNode";
import { HubspotNode } from "../nodes/HubspotNode";
import { AirtableNode } from "../nodes/AirtableNode";
import { PagerDutyNode } from "../nodes/PagerDutyNode";
import { GitlabNode } from "../nodes/GitlabNode";
import { LinearNode } from "../nodes/LinearNode";
import { TelegramNode } from "../nodes/TelegramNode";
import { SendgridNode } from "../nodes/SendgridNode";
import { SentryNode } from "../nodes/SentryNode";
import { ShopifyNode } from "../nodes/ShopifyNode";
import { MailchimpNode } from "../nodes/MailchimpNode";
import { GoogleDriveNode } from "../nodes/GoogleDriveNode";
import { DropboxNode } from "../nodes/DropboxNode";
import { DatadogNode } from "../nodes/DatadogNode";
import { PaypalNode } from "../nodes/PaypalNode";
import { SquareNode } from "../nodes/SquareNode";
import { ResendNode } from "../nodes/ResendNode";
import { OneDriveNode } from "../nodes/OneDriveNode";
import { BoxNode } from "../nodes/BoxNode";
import { CircleCINode } from "../nodes/CircleCINode";
import { WhatsappNode } from "../nodes/WhatsappNode";
import { PipedriveNode } from "../nodes/PipedriveNode";
import { CustomerIoNode } from "../nodes/CustomerIoNode";
import { KafkaNode } from "../nodes/KafkaNode";
import { NatsNode } from "../nodes/NatsNode";
import { SnowflakeNode } from "../nodes/SnowflakeNode";
import { ClickhouseNode } from "../nodes/ClickhouseNode";
import { ElasticsearchNode } from "../nodes/ElasticsearchNode";
import { AiImageNode } from "../nodes/AiImageNode";
import { AiTranscribeNode } from "../nodes/AiTranscribeNode";
import { AiTtsNode } from "../nodes/AiTtsNode";
import { AiEmbedNode } from "../nodes/AiEmbedNode";
import { VectorDbNode } from "../nodes/VectorDbNode";
import type {
  SubworkflowCallConfig,
  CustomBuilderConfig,
  CustomBuilderInputField,
  GroupConfig,
  WorkflowNode,
} from "@workflow/shared";
import { getCustomNodeTemplate } from "../../lib/api";

// Node components use NodeProps<WorkflowNode> but xyflow v12 expects NodeProps<Record<string, unknown>>.
// At runtime the data is identical; this cast bridges the generic type gap.
const nodeTypes = {
  manual: ManualTriggerNode,
  webhook: WebhookNode,
  cron: CronNode,
  mqtt_trigger: MqttTriggerNode,
  external_trigger: ExternalTriggerNode,
  trigger_output: TriggerOutputNode,
  workflow_trigger_in: WorkflowTriggerInNode,
  workflow_trigger_out: WorkflowTriggerOutNode,
  if_else: IfElseNode,
  switch: SwitchNode,
  delay: DelayNode,
  merge: MergeNode,
  stop: StopNode,
  http_request: HttpRequestNode,
  js_runner: JsRunnerNode,
  ts_runner: TsRunnerNode,
  data_mapper: DataMapperNode,
  json_parser: JsonParserNode,
  html_template: HtmlTemplateNode,
  crypto_hash: CryptoHashNode,
  date_formatter: DateFormatterNode,
  base64: Base64Node,
  send_email: SendEmailNode,
  postgres_query: PostgresNode,
  mysql: MysqlNode,
  mongodb: MongodbNode,
  redis: RedisNode,
  s3_bucket: S3BucketNode,
  rabbitmq: RabbitMQNode,
  slack: SlackNode,
  ssh_terminal: SshTerminalNode,
  twilio_sms: TwilioSmsNode,
  twilio_email: TwilioEmailNode,
  custom_code: CustomCodeNode,
  custom_builder: CustomBuilderNode,
  group: GroupNode,
  debug: DebugNode,
  llm_prompt: LlmPromptNode,
  ai_agent: AiAgentNode,
  subworkflow_call: SubworkflowCallNode,
  subflow_input: SubflowInputNode,
  subflow_output: SubflowOutputNode,
  mariadb: MariadbNode,
  mssql: MssqlNode,
  google_sheets: GoogleSheetsNode,
  python_runner: PythonRunnerNode,
  firebase_push: FirebasePushNode,
  apns_push: ApnsPushNode,
  loop: LoopNode,
  response: ResponseNode,
  aws_lambda: AwsLambdaNode,
  aws_sqs: AwsSqsNode,
  aws_sns: AwsSnsNode,
  aws_dynamodb: AwsDynamoDBNode,
  aws_ses: AwsSesNode,
  aws_secrets_manager: AwsSecretsManagerNode,
  aws_ssm: AwsSsmNode,
  aws_eventbridge: AwsEventBridgeNode,
  aws_step_functions: AwsStepFunctionsNode,
  azure_blob: AzureBlobNode,
  azure_service_bus: AzureServiceBusNode,
  azure_cosmos_db: AzureCosmosNode,
  azure_key_vault: AzureKeyVaultNode,
  azure_functions: AzureFunctionsNode,
  gcp_storage: GcpStorageNode,
  gcp_pubsub: GcpPubSubNode,
  gcp_bigquery: GcpBigQueryNode,
  oracle_db: OracleDbNode,
  oci_object_storage: OciObjectStorageNode,
  stripe: StripeNode,
  github: GithubNode,
  discord: DiscordNode,
  notion: NotionNode,
  salesforce: SalesforceNode,
  jira: JiraNode,
  ms_teams: MsTeamsNode,
  hubspot: HubspotNode,
  airtable: AirtableNode,
  pagerduty: PagerDutyNode,
  gitlab: GitlabNode,
  linear: LinearNode,
  telegram: TelegramNode,
  sendgrid: SendgridNode,
  sentry: SentryNode,
  shopify: ShopifyNode,
  mailchimp: MailchimpNode,
  google_drive: GoogleDriveNode,
  dropbox: DropboxNode,
  datadog: DatadogNode,
  paypal: PaypalNode,
  square: SquareNode,
  resend: ResendNode,
  onedrive: OneDriveNode,
  box: BoxNode,
  circleci: CircleCINode,
  whatsapp_business: WhatsappNode,
  pipedrive: PipedriveNode,
  customer_io: CustomerIoNode,
  kafka: KafkaNode,
  nats: NatsNode,
  snowflake: SnowflakeNode,
  clickhouse: ClickhouseNode,
  elasticsearch: ElasticsearchNode,
  ai_image: AiImageNode,
  ai_transcribe: AiTranscribeNode,
  ai_tts: AiTtsNode,
  ai_embed: AiEmbedNode,
  vector_db: VectorDbNode,
};

const edgeTypes: EdgeTypes = {
  animated: AnimatedEdge,
};

function Canvas(): React.ReactElement {
  const { screenToFlowPosition } = useReactFlow();

  const nodes = useWorkflowStore((s) => s.nodes);
  const edges = useWorkflowStore((s) => s.edges);
  const onNodesChange = useWorkflowStore(
    (s) => s.onNodesChange,
  ) as OnNodesChange;
  const onEdgesChange = useWorkflowStore(
    (s) => s.onEdgesChange,
  ) as OnEdgesChange;
  const onConnect = useWorkflowStore((s) => s.onConnect) as OnConnect;
  const selectNode = useWorkflowStore((s) => s.selectNode);
  const selectEdge = useWorkflowStore((s) => s.selectEdge);
  const selectNodes = useWorkflowStore((s) => s.selectNodes);
  const selectEdges = useWorkflowStore((s) => s.selectEdges);
  const addNode = useWorkflowStore((s) => s.addNode);
  const nodeStatuses = useExecutionStore((s) => s.nodeStatuses);
  const theme = useCanvasDesignStore((s) => s.theme);

  // Apply status classes + freeze children of locked groups.
  //
  // Children of a locked group must not be individually draggable or
  // deletable — only the group itself can be moved or removed until it's
  // unlocked or ungrouped. xyflow respects per-node `draggable`/`deletable`.
  const styledNodes = useMemo(() => {
    const lockedGroupIds = new Set<string>();
    for (const n of nodes) {
      if (n.type !== "group") continue;
      const wn = n.data as unknown as WorkflowNode;
      const cfg = wn.config as GroupConfig | undefined;
      if (cfg?.locked) lockedGroupIds.add(n.id);
    }

    return nodes.map((n) => {
      const status = nodeStatuses[n.id];
      const statusClass = status
        ? {
            running: "node-status-running",
            completed: "node-status-completed",
            failed: "node-status-failed",
            skipped: "node-status-skipped",
          }[status]
        : undefined;

      const parentId = (n as typeof n & { parentId?: string }).parentId;
      const frozen = parentId ? lockedGroupIds.has(parentId) : false;

      return {
        ...n,
        className: statusClass,
        ...(frozen
          ? { draggable: false, deletable: false }
          : {}),
      };
    });
  }, [nodes, nodeStatuses]);

  const handleNodeClick = useCallback(
    (_: React.MouseEvent, node: { id: string }) => {
      selectNode(node.id);
    },
    [selectNode],
  );

  const handlePaneClick = useCallback(() => {
    selectNode(null);
    selectEdge(null);
  }, [selectNode, selectEdge]);

  const handleEdgeClick = useCallback(
    (_: React.MouseEvent, edge: { id: string }) => {
      selectEdge(edge.id);
    },
    [selectEdge],
  );

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "copy";
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      const kind = e.dataTransfer.getData("application/node-kind") as NodeKind;
      if (!kind || !nodeRegistry[kind]) return;

      const position = screenToFlowPosition({
        x: e.clientX,
        y: e.clientY,
      });

      // Custom node template drop — snapshot the full template into the node's
      // config so the workflow is self-contained (survives template edit/delete
      // and cross-environment / cross-org import).
      const customTemplateId = e.dataTransfer.getData(
        "application/custom-node-template",
      );
      if (kind === "custom_builder" && customTemplateId) {
        void getCustomNodeTemplate(customTemplateId)
          .then((tpl) => {
            const defaults: Record<string, unknown> = {};
            for (const field of tpl.inputsSchema as CustomBuilderInputField[]) {
              if (field.default !== undefined) {
                defaults[field.name] = field.default;
              }
            }
            const snapshot: CustomBuilderConfig = {
              templateId: tpl.id,
              templateKey: tpl.key,
              templateVersion: tpl.version,
              name: tpl.name,
              icon: tpl.icon,
              color: tpl.color,
              category: tpl.category,
              inputs: tpl.handles.inputs,
              outputs: tpl.handles.outputs,
              inputsSchema: tpl.inputsSchema,
              executionMode: tpl.executionMode,
              code: tpl.code ?? undefined,
              httpTemplate: tpl.httpTemplate ?? undefined,
              credentialType: tpl.credentialType ?? undefined,
              templateInputs: defaults,
              credentialRef: null,
            };
            addNode(kind, position, snapshot as Partial<CustomBuilderConfig>);
          })
          .catch((err) => {
            console.error("Failed to snapshot custom node template", err);
          });
        return;
      }

      const subworkflowId = e.dataTransfer.getData(
        "application/subworkflow-id",
      );
      if (kind === "subworkflow_call" && subworkflowId) {
        const configOverride: Partial<SubworkflowCallConfig> = {
          subworkflowId,
        };
        addNode(kind, position, configOverride);
      } else {
        addNode(kind, position);
      }
    },
    [screenToFlowPosition, addNode],
  );

  // xyflow fires this whenever its native selection set changes (Shift-click,
  // Shift-drag box select, or programmatic). Mirror it into the store so
  // Toolbar / PropertiesPanel / shortcuts all react to the multi-set.
  const handleSelectionChange = useCallback(
    (params: { nodes: { id: string }[]; edges: { id: string }[] }) => {
      selectNodes(params.nodes.map((n) => n.id));
      if (params.edges.length > 0) {
        selectEdges(params.edges.map((e) => e.id));
      }
    },
    [selectNodes, selectEdges],
  );

  const miniMapNodeColor = useCallback((node: { type?: string }) => {
    const kind = node.type as NodeKind | undefined;
    if (!kind || !nodeRegistry[kind]) return "#334155";
    return nodeRegistry[kind].color;
  }, []);

  const isLight = theme === "bpmn-light";

  return (
    <div className={`relative w-full h-full ${isLight ? "theme-bpmn-light" : ""}`}>
      <SelectionToolbar />
      <ReactFlow
        nodes={styledNodes}
        edges={edges}
        nodeTypes={nodeTypes as NodeTypes}
        edgeTypes={edgeTypes}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onNodeClick={handleNodeClick}
        onEdgeClick={
          handleEdgeClick as (
            event: React.MouseEvent,
            edge: { id: string },
          ) => void
        }
        onPaneClick={handlePaneClick}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
        onSelectionChange={handleSelectionChange}
        fitView
        fitViewOptions={{ padding: 0.4, maxZoom: 0.6 }}
        defaultViewport={{ x: 0, y: 0, zoom: 0.6 }}
        minZoom={0.1}
        maxZoom={2}
        deleteKeyCode={["Delete", "Backspace"]}
        multiSelectionKeyCode="Shift"
        selectionKeyCode="Shift"
        panActivationKeyCode={null}
        panOnScroll
        // Hold Shift and drag on empty canvas = rectangle-select. Plain drag
        // continues to pan (xyflow's panOnDrag default).
        selectionOnDrag
        defaultEdgeOptions={{ type: "animated" }}
      >
        <MiniMap
          nodeColor={miniMapNodeColor}
          maskColor={
            isLight ? "rgba(241, 245, 249, 0.7)" : "rgba(15, 23, 42, 0.7)"
          }
          pannable
          zoomable
        />
        <Controls />
        <Background
          variant={isLight ? BackgroundVariant.Lines : BackgroundVariant.Dots}
          gap={isLight ? 24 : 20}
          size={isLight ? 0.5 : 1}
          color={isLight ? "#e2e8f0" : "#1e293b"}
        />
      </ReactFlow>
    </div>
  );
}

export function WorkflowCanvas(): React.ReactElement {
  return (
    <div className="flex-1 h-full">
      <ReactFlowProvider>
        <Canvas />
      </ReactFlowProvider>
    </div>
  );
}
