// =============================================================================
// ZuzuFlowClient — the single entry point for @zuzuflow/nodejs-sdk
//
// Resources are exposed as nested namespaces (`client.workflows.list()`,
// `client.executions.trigger()`, …). The original trigger methods from the
// pre-reorg SDK are kept as client-level shortcuts that delegate to
// `executions.*` so existing snippets continue to compile after the rename.
// =============================================================================

import { request, type HttpConfig } from "./http";
import { WorkflowsResource } from "./resources/workflows";
import { ExecutionsResource } from "./resources/executions";
import { TagsResource } from "./resources/tags";
import { FoldersResource } from "./resources/folders";
import type { WsFactory } from "./ws";
import type {
  ExecutionEvent,
  ExecutionResult,
  TriggerAndWaitOptions,
  TriggerResult,
  WatchOptions,
  WorkflowRefInput,
} from "./types";

export interface ZuzuFlowClientOptions {
  /** Base URL of the ZuzuFlow deployment (no trailing slash, no `/api`). e.g. `"https://app.zuzuflow.com"` */
  baseUrl: string;
  /** Environment slug used to scope every call. e.g. `"production"` */
  envSlug: string;
  /** Bearer token (master API_TOKEN, JWT, or a `wf_*` API token). */
  token: string;
  /** Override for environments without a global `fetch`. */
  fetch?: typeof fetch;
  /** Override for environments where `ws` shouldn't be used directly (tests). */
  wsFactory?: WsFactory;
}

export class ZuzuFlowClient {
  readonly workflows: WorkflowsResource;
  readonly executions: ExecutionsResource;
  readonly tags: TagsResource;
  readonly folders: FoldersResource;

  private readonly cfg: HttpConfig;

  constructor(options: ZuzuFlowClientOptions) {
    if (!options.baseUrl) throw new Error("baseUrl is required");
    if (!options.envSlug) throw new Error("envSlug is required");
    if (!options.token) throw new Error("token is required");

    const fetchImpl = options.fetch ?? (globalThis as { fetch?: typeof fetch }).fetch;
    if (!fetchImpl) {
      throw new Error(
        "No global `fetch` is available in this runtime. Pass `fetch` explicitly " +
          "via `new ZuzuFlowClient({ ..., fetch })`."
      );
    }

    this.cfg = {
      baseUrl: options.baseUrl.replace(/\/$/, ""),
      envSlug: options.envSlug,
      token: options.token,
      fetchImpl,
    };

    const wsCfg = {
      baseUrl: this.cfg.baseUrl,
      token: options.token,
      wsFactory: options.wsFactory,
    };

    this.workflows = new WorkflowsResource(this.cfg);
    this.executions = new ExecutionsResource(this.cfg, wsCfg);
    this.tags = new TagsResource(this.cfg);
    this.folders = new FoldersResource(this.cfg);
  }

  // ─── Backwards-compat shortcuts ────────────────────────────────────────────
  // Pre-reorg SDK exposed these on the client directly. They're kept as thin
  // wrappers around `executions.*` so old snippets keep working after the
  // package rename.

  trigger(ref: WorkflowRefInput, payload?: Record<string, unknown>): Promise<TriggerResult> {
    return this.executions.trigger(ref, payload);
  }

  triggerAndWait(
    ref: WorkflowRefInput,
    payload?: Record<string, unknown>,
    options?: TriggerAndWaitOptions
  ): Promise<ExecutionResult> {
    return this.executions.triggerAndWait(ref, payload, options);
  }

  triggerAndStream(
    ref: WorkflowRefInput,
    payload?: Record<string, unknown>,
    options?: WatchOptions
  ): AsyncGenerator<ExecutionEvent> {
    return this.executions.triggerAndStream(ref, payload, options);
  }

  watch(executionId: string, options?: WatchOptions): AsyncGenerator<ExecutionEvent> {
    return this.executions.watch(executionId, options);
  }

  /**
   * Low-level escape hatch — issue a raw request against an env-scoped path
   * (e.g. `"/credentials"`). Useful for endpoints the SDK doesn't cover yet.
   */
  raw<T = unknown>(
    path: string,
    opts?: {
      method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
      body?: unknown;
      query?: Record<string, string | number | boolean | string[] | null | undefined>;
    }
  ): Promise<T> {
    return request<T>(this.cfg, path, opts);
  }
}
