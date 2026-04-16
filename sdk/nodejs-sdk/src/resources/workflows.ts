import { request, type HttpConfig } from "../http";
import type {
  CreateWorkflowPayload,
  PaginatedResult,
  UpdateWorkflowPayload,
  WorkflowDetail,
  WorkflowListFilters,
  WorkflowListItem,
} from "../types";

/**
 * CRUD + lifecycle for workflows, scoped to the configured environment.
 *
 * Routes: `/api/env/{envSlug}/workflows/*`
 */
export class WorkflowsResource {
  constructor(private readonly cfg: HttpConfig) {}

  list(filters: WorkflowListFilters = {}): Promise<PaginatedResult<WorkflowListItem>> {
    return request<PaginatedResult<WorkflowListItem>>(this.cfg, "/workflows", {
      method: "GET",
      query: {
        status: filters.status,
        folderId: filters.folderId,
        tags: filters.tagsAny,
        tagsAll: filters.tagsAll,
        hasTrigger: filters.hasTrigger,
        isSubworkflow: filters.isSubworkflow ? "true" : undefined,
        limit: filters.limit,
        offset: filters.offset,
      },
    });
  }

  get(id: string): Promise<WorkflowDetail> {
    return request<WorkflowDetail>(this.cfg, `/workflows/${encodeURIComponent(id)}`);
  }

  create(input: CreateWorkflowPayload): Promise<WorkflowDetail> {
    return request<WorkflowDetail>(this.cfg, "/workflows", {
      method: "POST",
      body: input,
    });
  }

  update(id: string, patch: UpdateWorkflowPayload): Promise<WorkflowDetail> {
    return request<WorkflowDetail>(this.cfg, `/workflows/${encodeURIComponent(id)}`, {
      method: "PUT",
      body: patch,
    });
  }

  delete(id: string): Promise<void> {
    return request<void>(this.cfg, `/workflows/${encodeURIComponent(id)}`, {
      method: "DELETE",
    });
  }

  activate(id: string): Promise<WorkflowDetail> {
    return request<WorkflowDetail>(
      this.cfg,
      `/workflows/${encodeURIComponent(id)}/activate`,
      { method: "POST" }
    );
  }

  deactivate(id: string): Promise<WorkflowDetail> {
    return request<WorkflowDetail>(
      this.cfg,
      `/workflows/${encodeURIComponent(id)}/deactivate`,
      { method: "POST" }
    );
  }
}
