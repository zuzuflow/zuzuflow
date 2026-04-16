// =============================================================================
// Error classes exposed by the SDK
// =============================================================================

import type { ExecutionStatus } from "./types";

/** Base class for every error thrown by the SDK. */
export class ZuzuFlowError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ZuzuFlowError";
  }
}

/**
 * Thrown when the server responds with a non-2xx HTTP status. `status` is the
 * raw HTTP code; `body` is whatever JSON body the server returned (or a string
 * snippet when the body isn't JSON).
 */
export class HttpError extends ZuzuFlowError {
  readonly status: number;
  readonly body: unknown;
  constructor(status: number, message: string, body?: unknown) {
    super(message);
    this.name = "HttpError";
    this.status = status;
    this.body = body;
  }
}

/**
 * Thrown by `watch` / `triggerAndWait` / `triggerAndStream` when the execution
 * doesn't reach a terminal state within the configured timeout.
 */
export class TriggerTimeoutError extends ZuzuFlowError {
  readonly executionId: string;
  constructor(executionId: string, timeoutMs: number) {
    super(
      `Workflow execution ${executionId} did not complete within ${timeoutMs}ms`
    );
    this.name = "TriggerTimeoutError";
    this.executionId = executionId;
  }
}

/**
 * Thrown by `triggerAndWait` when the execution ends in `failed` or `cancelled`
 * and `throwOnFailure` is left at its default (`true`).
 */
export class WorkflowExecutionError extends ZuzuFlowError {
  readonly executionId: string;
  readonly status: ExecutionStatus;
  readonly executionError?: string;
  constructor(
    executionId: string,
    status: ExecutionStatus,
    executionError?: string
  ) {
    super(
      `Workflow execution ${executionId} ended with status "${status}"` +
        (executionError ? `: ${executionError}` : "")
    );
    this.name = "WorkflowExecutionError";
    this.executionId = executionId;
    this.status = status;
    this.executionError = executionError;
  }
}
