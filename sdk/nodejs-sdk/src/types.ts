// =============================================================================
// DTOs mirrored from the backend API (apps/backend/src/routes/*) so the SDK
// stands alone — external consumers don't need to depend on repo-internal
// packages like @workflow/shared. Shapes are kept structurally compatible with
// apps/frontend/src/lib/api.ts so drift is easy to spot.
// =============================================================================

// ─── Pagination ───────────────────────────────────────────────────────────────

export interface PaginatedResult<T> {
  total: number;
  items: T[];
  limit: number;
  offset: number;
}

// ─── Workflows ────────────────────────────────────────────────────────────────

/**
 * The workflow template (nodes + edges) is a JSON tree managed by the editor.
 * We keep it loosely typed here; pass it through unchanged from `get` into
 * `update` if you want to round-trip a workflow without touching its graph.
 */
export type WorkflowTemplate = Record<string, unknown>;

export type WorkflowStatus = "draft" | "active" | "inactive" | "archived";

export interface WorkflowExecStats {
  totalExecutions: number;
  completed: number;
  failed: number;
  running: number;
  avgDurationMs: number | null;
  lastExecution: {
    id: string;
    status: string;
    startedAt: string;
    completedAt?: string | null;
    durationMs: number | null;
  } | null;
}

export interface WorkflowListItem {
  id: string;
  /** Stable, export/import-safe identifier (e.g. `"wf_a7b3k2m9pq"`). Use this
   *  in `client.executions.trigger({ id, environment })` — it survives promotion
   *  from one environment to another, whereas the raw UUID `id` does not. */
  key: string;
  name: string;
  description?: string;
  status: string;
  version?: number;
  folderId: string | null;
  stats?: WorkflowExecStats;
  isSubworkflow?: boolean;
  tags?: string[];
  createdAt: string;
  updatedAt: string;
}

export interface WorkflowDetail extends WorkflowListItem {
  template: WorkflowTemplate;
}

export interface CreateWorkflowPayload {
  name: string;
  description?: string;
  template: WorkflowTemplate;
  folderId?: string;
  isSubworkflow?: boolean;
  tags?: string[];
  /** Optional stable key. Auto-generated when omitted. */
  key?: string;
}

export interface UpdateWorkflowPayload {
  name?: string;
  description?: string;
  template?: WorkflowTemplate;
  folderId?: string | null;
  tags?: string[];
  /** Rename the stable export/import key. Must be unique within the env. */
  key?: string;
}

/**
 * Portable reference to a workflow. Prefer this form over a bare string so
 * your code keeps working after export/import:
 *
 *   client.executions.trigger({ id: "wf_a7b3k2m9pq" }, payload);
 *   client.executions.trigger({ id: "wf_a7b3k2m9pq", environment: "prod" });
 *
 * `id` accepts either the stable `key` (recommended) or the raw DB UUID
 * (accepted for backwards compatibility). `environment` overrides the envSlug
 * set on the client for this one call.
 */
export interface WorkflowRef {
  id: string;
  environment?: string;
}

export interface WorkflowListFilters {
  folderId?: string;
  status?: string;
  /** OR filter: return workflows tagged with ANY of these (maps to `?tags=a,b`). */
  tagsAny?: string[];
  /** AND filter: return workflows tagged with ALL of these (maps to `?tagsAll=a,b`). */
  tagsAll?: string[];
  /** Return only workflows containing a node of this `kind`. */
  hasTrigger?: string;
  /** Return only subworkflows when true. */
  isSubworkflow?: boolean;
  limit?: number;
  offset?: number;
}

// ─── Executions ───────────────────────────────────────────────────────────────

export type ExecutionStatus =
  | "pending"
  | "running"
  | "completed"
  | "failed"
  | "cancelled"
  | "timed_out";

export interface ExecutionLogEntry {
  id: string;
  nodeId: string;
  nodeKind: string;
  level: "debug" | "info" | "warn" | "error";
  message: string;
  data?: Record<string, unknown>;
  createdAt: string;
}

export interface ExecutionSummary {
  id: string;
  workflowId: string;
  status: ExecutionStatus;
  startedAt: string;
  completedAt?: string;
  triggerPayload?: Record<string, unknown>;
  error?: string | null;
  output?: unknown;
  workflow?: { id: string; name: string } | null;
}

export interface ExecutionDetail extends ExecutionSummary {
  logs?: ExecutionLogEntry[];
}

export interface ExecutionListFilters {
  workflowId?: string;
  status?: ExecutionStatus;
  q?: string;
  from?: string;
  to?: string;
  limit?: number;
  offset?: number;
}

export interface ExecutionLogsFilter {
  nodeId?: string;
  nodeKind?: string;
  level?: string;
  search?: string;
  limit?: number;
  offset?: number;
}

export interface ExecutionNodeMeta {
  nodeId: string;
  nodeKind: string;
}

export interface ExecutionLogsResult {
  execution: {
    id: string;
    status: ExecutionStatus;
    workflowId: string;
    startedAt: string;
    completedAt?: string;
  };
  total: number;
  logs: ExecutionLogEntry[];
  nodes: ExecutionNodeMeta[];
  limit: number;
  offset: number;
}

// ─── Trigger + live events ────────────────────────────────────────────────────

export interface TriggerResult {
  executionId: string;
  workflowId: string;
  status: string;
  startedAt: string;
}

/** Trigger payload shape: either a bare id/key (legacy) or a `WorkflowRef`. */
export type WorkflowRefInput = string | WorkflowRef;

export type EventKind =
  | "execution_started"
  | "execution_completed"
  | "execution_failed"
  | "execution_cancelled"
  | "node_started"
  | "node_completed"
  | "node_failed"
  | "subscribed";

export interface ExecutionEvent {
  kind: EventKind;
  executionId: string;
  workflowId?: string;
  nodeId?: string;
  nodeKind?: string;
  payload?: Record<string, unknown>;
  timestamp: string;
}

export interface ExecutionResult {
  executionId: string;
  workflowId: string;
  status: ExecutionStatus;
  output?: Record<string, unknown>;
  error?: string;
  startedAt: string;
  completedAt?: string;
  durationMs?: number;
}

export interface WatchOptions {
  /** Max ms to wait for the execution to terminate. Default: 300_000 (5 min). */
  timeoutMs?: number;
}

export interface TriggerAndWaitOptions extends WatchOptions {
  /** When the execution ends in a non-`completed` state, throw. Default: true. */
  throwOnFailure?: boolean;
}

// ─── Tags ─────────────────────────────────────────────────────────────────────

export interface Tag {
  name: string;
  color: string | null;
  count: number;
}

export interface UpdateTagInput {
  name?: string;
  color?: string | null;
}

// ─── Folders ──────────────────────────────────────────────────────────────────

export interface Folder {
  id: string;
  name: string;
  parentId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateFolderInput {
  name: string;
  parentId?: string | null;
}
