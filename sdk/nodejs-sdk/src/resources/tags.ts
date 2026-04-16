import { request, type HttpConfig } from "../http";
import type { Tag, UpdateTagInput } from "../types";

/**
 * Environment-scoped tag catalog with usage counts.
 *
 * Routes: `/api/env/{envSlug}/tags/*`
 */
export class TagsResource {
  constructor(private readonly cfg: HttpConfig) {}

  /** List tags in the current environment ordered by usage count desc, name asc. */
  list(): Promise<Tag[]> {
    return request<Tag[]>(this.cfg, "/tags");
  }

  /** Rename or recolor a tag. Pass `{ name }` to rename, `{ color }` to recolor. */
  update(name: string, input: UpdateTagInput): Promise<Tag> {
    return request<Tag>(this.cfg, `/tags/${encodeURIComponent(name)}`, {
      method: "PATCH",
      body: input,
    });
  }

  /** Drop the tag and remove it from every workflow it's applied to. */
  delete(name: string): Promise<void> {
    return request<void>(this.cfg, `/tags/${encodeURIComponent(name)}`, {
      method: "DELETE",
    });
  }
}
