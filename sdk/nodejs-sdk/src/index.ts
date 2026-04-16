// =============================================================================
// @zuzuflow/nodejs-sdk
//
// Node.js SDK for the ZuzuFlow API. Covers workflows, executions (including
// external trigger + live event streaming), tags, and folders.
//
// Quick start:
//   import { ZuzuFlowClient } from "@zuzuflow/nodejs-sdk";
//
//   const client = new ZuzuFlowClient({
//     baseUrl: "https://app.zuzuflow.com",
//     envSlug: "production",
//     token: "wf_xxxxxxxxxxxx",  // generate in Settings → API Tokens
//   });
//
//   // Resource-style calls ---------------------------------------------------
//   const wfs  = await client.workflows.list({ tagsAny: ["production"] });
//   const tags = await client.tags.list();
//
//   // Trigger by stable key — survives export/import to another environment
//   for await (const event of client.executions.triggerAndStream(
//     { id: wfs.items[0].key, environment: "production" },
//     { userId: "123" }
//   )) {
//     if (event.kind === "node_completed") console.log(event.nodeKind, event.payload);
//   }
//
//   // Backwards-compat shortcuts (delegate to executions.*) ------------------
//   const result = await client.triggerAndWait(wfs.items[0].key, { userId: "123" });
// =============================================================================

export { ZuzuFlowClient } from "./client";
export type { ZuzuFlowClientOptions } from "./client";

export { WorkflowsResource } from "./resources/workflows";
export { ExecutionsResource } from "./resources/executions";
export { TagsResource } from "./resources/tags";
export { FoldersResource } from "./resources/folders";

export {
  ZuzuFlowError,
  HttpError,
  TriggerTimeoutError,
  WorkflowExecutionError,
} from "./errors";

export type {
  // Pagination
  PaginatedResult,
  // Workflows
  WorkflowTemplate,
  WorkflowStatus,
  WorkflowExecStats,
  WorkflowListItem,
  WorkflowDetail,
  WorkflowListFilters,
  CreateWorkflowPayload,
  UpdateWorkflowPayload,
  // Executions
  ExecutionStatus,
  ExecutionSummary,
  ExecutionDetail,
  ExecutionListFilters,
  ExecutionLogEntry,
  ExecutionLogsFilter,
  ExecutionLogsResult,
  ExecutionNodeMeta,
  // Trigger + events
  TriggerResult,
  EventKind,
  ExecutionEvent,
  ExecutionResult,
  WatchOptions,
  TriggerAndWaitOptions,
  WorkflowRef,
  WorkflowRefInput,
  // Tags + folders
  Tag,
  UpdateTagInput,
  Folder,
  CreateFolderInput,
} from "./types";

import { ZuzuFlowClient } from "./client";

/**
 * Backwards-compatible type alias. Pre-reorg this was the canonical class
 * name; it's kept so existing snippets only need a package-name change.
 * @deprecated Use `ZuzuFlowClient`.
 */
export type WorkflowTriggerClient = ZuzuFlowClient;

export default ZuzuFlowClient;
