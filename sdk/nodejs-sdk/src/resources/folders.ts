import { request, type HttpConfig } from "../http";
import type { CreateFolderInput, Folder } from "../types";

/**
 * Folder tree for organizing workflows within an environment.
 *
 * Routes: `/api/env/{envSlug}/folders/*`
 */
export class FoldersResource {
  constructor(private readonly cfg: HttpConfig) {}

  /** Flat list of all folders in the current environment. */
  list(): Promise<Folder[]> {
    return request<Folder[]>(this.cfg, "/folders");
  }

  create(input: CreateFolderInput): Promise<Folder> {
    return request<Folder>(this.cfg, "/folders", {
      method: "POST",
      body: { name: input.name, parentId: input.parentId ?? undefined },
    });
  }

  /** Rename a folder in place. */
  rename(id: string, name: string): Promise<Folder> {
    return request<Folder>(this.cfg, `/folders/${encodeURIComponent(id)}`, {
      method: "PUT",
      body: { name },
    });
  }

  /** Move a folder under a new parent (`null` = move to root). */
  move(id: string, parentId: string | null): Promise<Folder> {
    return request<Folder>(this.cfg, `/folders/${encodeURIComponent(id)}/move`, {
      method: "PATCH",
      body: { parentId },
    });
  }

  /** Delete a folder; its contents move up to the parent. */
  delete(id: string): Promise<void> {
    return request<void>(this.cfg, `/folders/${encodeURIComponent(id)}`, {
      method: "DELETE",
    });
  }

  /** Move a workflow into this folder (or pass `id: "root"` to move to root). */
  moveWorkflow(id: string, workflowId: string): Promise<{ id: string; folderId: string | null }> {
    return request<{ id: string; folderId: string | null }>(
      this.cfg,
      `/folders/${encodeURIComponent(id)}/workflows/${encodeURIComponent(workflowId)}`,
      { method: "PATCH" }
    );
  }
}
