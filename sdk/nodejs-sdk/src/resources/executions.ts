import { request, type HttpConfig } from "../http";
import { watchExecution, type WsFactory } from "../ws";
import { TriggerTimeoutError, WorkflowExecutionError } from "../errors";
import type {
  EventKind,
  ExecutionDetail,
  ExecutionEvent,
  ExecutionListFilters,
  ExecutionLogsFilter,
  ExecutionLogsResult,
  ExecutionResult,
  ExecutionStatus,
  ExecutionSummary,
  PaginatedResult,
  TriggerAndWaitOptions,
  TriggerResult,
  WatchOptions,
  WorkflowRef,
  WorkflowRefInput,
} from "../types";

/** Normalize the `string | WorkflowRef` input into `{ id, environment? }`. */
function toRef(ref: WorkflowRefInput): WorkflowRef {
  if (typeof ref === "string") {
    if (!ref) throw new Error("workflow id/key is required");
    return { id: ref };
  }
  if (!ref || !ref.id) throw new Error("workflow ref requires an `id` (stable key or UUID)");
  return ref;
}

const TERMINAL_KINDS: ReadonlySet<EventKind> = new Set([
  "execution_completed",
  "execution_failed",
  "execution_cancelled",
]);

/**
 * Read-side plus lifecycle for executions, including the **external trigger**
 * entrypoint and a WebSocket event stream.
 *
 * Routes: `/api/env/{envSlug}/executions/*`
 */
export class ExecutionsResource {
  constructor(
    private readonly cfg: HttpConfig,
    private readonly wsCfg: { baseUrl: string; token: string; wsFactory?: WsFactory }
  ) {}

  // ─── Trigger ────────────────────────────────────────────────────────────────

  /**
   * Fire an `external_trigger` workflow and return the new execution ID.
   *
   * `ref` is either the stable workflow `key` (e.g. `"wf_a7b3k2m9pq"`,
   * recommended — survives export/import) or `{ id, environment? }` to also
   * override the environment for this call. A raw UUID is accepted for
   * backwards compatibility.
   *
   * The workflow must contain exactly one `external_trigger` node — the
   * backend enforces this and returns 422 otherwise.
   */
  trigger(
    ref: WorkflowRefInput,
    payload?: Record<string, unknown>
  ): Promise<TriggerResult> {
    const { id, environment } = toRef(ref);
    return request<TriggerResult>(
      this.cfg,
      `/executions/trigger/${encodeURIComponent(id)}`,
      { method: "POST", body: { payload }, envSlug: environment }
    );
  }

  /**
   * Trigger + watch — returns an async iterable of live events that terminates
   * when the execution reaches a terminal state or the timeout elapses.
   */
  async *triggerAndStream(
    ref: WorkflowRefInput,
    payload?: Record<string, unknown>,
    options: WatchOptions = {}
  ): AsyncGenerator<ExecutionEvent> {
    const started = await this.trigger(ref, payload);
    yield* this.watch(started.executionId, options);
  }

  /**
   * Trigger + wait for the terminal event; returns the consolidated result.
   *
   * Throws `WorkflowExecutionError` on non-`completed` status when
   * `throwOnFailure` is left at its default (`true`).
   */
  async triggerAndWait(
    ref: WorkflowRefInput,
    payload?: Record<string, unknown>,
    options: TriggerAndWaitOptions = {}
  ): Promise<ExecutionResult> {
    const { throwOnFailure = true, ...watchOpts } = options;
    const started = await this.trigger(ref, payload);

    let terminal: ExecutionEvent | null = null;
    for await (const event of this.watch(started.executionId, watchOpts)) {
      if (TERMINAL_KINDS.has(event.kind)) {
        terminal = event;
        break;
      }
    }

    if (!terminal) {
      // `watch` always yields a terminal event before stopping, but guard anyway.
      throw new TriggerTimeoutError(
        started.executionId,
        watchOpts.timeoutMs ?? 300_000
      );
    }

    const status: ExecutionStatus =
      terminal.kind === "execution_completed"
        ? "completed"
        : terminal.kind === "execution_failed"
        ? "failed"
        : "cancelled";

    const result: ExecutionResult = {
      executionId: started.executionId,
      workflowId: started.workflowId,
      status,
      output: (terminal.payload?.output as Record<string, unknown>) ?? undefined,
      error: (terminal.payload?.error as string) ?? undefined,
      startedAt: started.startedAt,
      completedAt: terminal.timestamp,
    };

    if (throwOnFailure && status !== "completed") {
      throw new WorkflowExecutionError(started.executionId, status, result.error);
    }

    return result;
  }

  /**
   * Subscribe to live events for an already-started execution. Terminates
   * when the execution ends or `timeoutMs` elapses.
   */
  watch(executionId: string, options?: WatchOptions): AsyncGenerator<ExecutionEvent> {
    return watchExecution(this.wsCfg, executionId, options);
  }

  // ─── Read + lifecycle ───────────────────────────────────────────────────────

  get(id: string): Promise<ExecutionDetail> {
    return request<ExecutionDetail>(this.cfg, `/executions/${encodeURIComponent(id)}`);
  }

  list(filters: ExecutionListFilters = {}): Promise<PaginatedResult<ExecutionSummary>> {
    return request<PaginatedResult<ExecutionSummary>>(this.cfg, "/executions", {
      query: {
        workflowId: filters.workflowId,
        status: filters.status,
        q: filters.q,
        from: filters.from,
        to: filters.to,
        limit: filters.limit,
        offset: filters.offset,
      },
    });
  }

  /**
   * Cancel a running execution. Returns `null` when the backend discarded
   * the record (already-terminal state).
   */
  cancel(id: string): Promise<ExecutionDetail | null> {
    return request<ExecutionDetail | null>(this.cfg, `/executions/${encodeURIComponent(id)}`, {
      method: "DELETE",
    });
  }

  logs(id: string, filter: ExecutionLogsFilter = {}): Promise<ExecutionLogsResult> {
    return request<ExecutionLogsResult>(
      this.cfg,
      `/executions/${encodeURIComponent(id)}/logs`,
      {
        query: {
          nodeId: filter.nodeId,
          nodeKind: filter.nodeKind,
          level: filter.level,
          search: filter.search,
          limit: filter.limit,
          offset: filter.offset,
        },
      }
    );
  }
}
