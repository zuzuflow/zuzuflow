import type { ExecutionStatus, LogLevel } from "./workflow";

// =============================================================================
// Execution Types — used by backend routes, services, and WS broadcaster
// =============================================================================

export interface ExecutionLog {
  id: string;
  executionId: string;
  nodeId: string;
  nodeKind: string;
  level: LogLevel;
  message: string;
  /** Arbitrary structured data (input/output snapshot, error details, etc.) */
  data?: Record<string, unknown>;
  createdAt: Date;
}

export interface ExecutionRecord {
  id: string;
  workflowId: string;
  status: ExecutionStatus;
  /** The payload that triggered this execution (webhook body, cron context, etc.) */
  triggerPayload?: Record<string, unknown>;
  /** Temporal workflow run ID for correlation */
  temporalRunId?: string;
  /** Temporal workflow ID */
  temporalWorkflowId?: string;
  /** Serialized final output of the last completed node */
  output?: Record<string, unknown>;
  /** Error message if status is 'failed' */
  error?: string;
  startedAt: Date;
  completedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

// -----------------------------------------------------------------------------
// WebSocket event shapes broadcast to subscribers
// -----------------------------------------------------------------------------

export type ExecutionEventKind =
  | "execution_started"
  | "node_started"
  | "node_completed"
  | "node_log"
  | "node_failed"
  | "execution_completed"
  | "execution_failed"
  | "execution_cancelled";

export interface ExecutionEvent {
  kind: ExecutionEventKind;
  executionId: string;
  workflowId: string;
  /** Present for node-level events */
  nodeId?: string;
  nodeKind?: string;
  /** Structured payload (node output, error, etc.) */
  payload?: Record<string, unknown>;
  timestamp: string; // ISO-8601
}
