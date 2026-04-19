import { prisma } from "../db/client";
import { config } from "../config";
import { logger } from "../logger";

// =============================================================================
// TaskQueueResolver — per-org Temporal task-queue resolution.
//
// Precedence:
//   1. OrgPlan.taskQueueOverride   ← admin writes this on dedicated-worker provision
//   2. Plan.defaultTaskQueue       ← tier-level default (e.g. "shared-free")
//   3. config.TEMPORAL_TASK_QUEUE  ← env var fallback (single-tenant default)
//
// Cached in-memory with a short TTL (30s) so execution scheduling doesn't hit
// the DB on every call. Admin changing a value picks up within the TTL window.
// =============================================================================

const CACHE_TTL_MS = 30_000;

type CacheEntry = { value: string; expiresAt: number };

export class TaskQueueResolver {
  private cache = new Map<string, CacheEntry>();

  async resolveTaskQueue(organizationId: string | null | undefined): Promise<string> {
    // Fallback when we don't have an org context (e.g. internal/system flows).
    if (!organizationId) return config.TEMPORAL_TASK_QUEUE;

    const now = Date.now();
    const hit = this.cache.get(organizationId);
    if (hit && hit.expiresAt > now) return hit.value;

    const orgPlan = await prisma.orgPlan.findUnique({
      where: { organizationId },
      select: {
        taskQueueOverride: true,
        plan: { select: { defaultTaskQueue: true } },
      },
    });

    const queue =
      orgPlan?.taskQueueOverride ||
      orgPlan?.plan?.defaultTaskQueue ||
      config.TEMPORAL_TASK_QUEUE;

    this.cache.set(organizationId, { value: queue, expiresAt: now + CACHE_TTL_MS });
    return queue;
  }

  /** Clear the cache for a specific org (call from admin when writing a new
   *  override so the change takes effect immediately). */
  invalidate(organizationId: string): void {
    this.cache.delete(organizationId);
    logger.debug("TaskQueueResolver cache invalidated", { organizationId });
  }

  /** Clear the entire cache. Useful for tests. */
  invalidateAll(): void {
    this.cache.clear();
  }
}

export const taskQueueResolver = new TaskQueueResolver();
