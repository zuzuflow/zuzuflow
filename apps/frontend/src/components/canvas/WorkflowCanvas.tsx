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
import type { SubworkflowCallConfig } from "@workflow/shared";

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
  const addNode = useWorkflowStore((s) => s.addNode);
  const nodeStatuses = useExecutionStore((s) => s.nodeStatuses);
  const theme = useCanvasDesignStore((s) => s.theme);

  // Apply status classes via className on nodes
  const styledNodes = useMemo(() => {
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

      return {
        ...n,
        className: statusClass,
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

  const miniMapNodeColor = useCallback((node: { type?: string }) => {
    const kind = node.type as NodeKind | undefined;
    if (!kind || !nodeRegistry[kind]) return "#334155";
    return nodeRegistry[kind].color;
  }, []);

  const isLight = theme === "bpmn-light";

  return (
    <div className={`w-full h-full ${isLight ? "theme-bpmn-light" : ""}`}>
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
        fitView
        fitViewOptions={{ padding: 0.4, maxZoom: 0.6 }}
        defaultViewport={{ x: 0, y: 0, zoom: 0.6 }}
        minZoom={0.1}
        maxZoom={2}
        deleteKeyCode={["Delete", "Backspace"]}
        multiSelectionKeyCode="Shift"
        panActivationKeyCode={null}
        panOnScroll
        selectionOnDrag={false}
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
