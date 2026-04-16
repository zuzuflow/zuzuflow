import { Prisma } from "@prisma/client";
import { prisma } from "../db/client";

// =============================================================================
// TagService — environment-scoped tags for workflows
//
// Tags are free-form labels users apply to workflows for filtering (e.g.
// "production", "customer-onboarding"). They live on a normalized `Tag` table
// scoped per environment with a `WorkflowTag` join table so renames cascade to
// every workflow automatically.
// =============================================================================

/** Maximum tags allowed on a single workflow. */
export const MAX_TAGS_PER_WORKFLOW = 16;
/** Maximum tag name length. */
export const MAX_TAG_NAME_LENGTH = 32;

/**
 * Normalize a user-supplied tag name: lowercase, trim, keep only
 * [a-z0-9-_:] characters. Returns `null` for inputs that normalize to empty.
 */
export function normalizeTagName(raw: string): string | null {
  const cleaned = raw.trim().toLowerCase().replace(/[^a-z0-9\-_:]/g, "");
  if (cleaned.length === 0) return null;
  return cleaned.slice(0, MAX_TAG_NAME_LENGTH);
}

export interface TagWithCount {
  name: string;
  color: string | null;
  count: number;
}

export class TagService {
  // ---------------------------------------------------------------------------
  // List every tag in an environment with a usage count, ordered by usage
  // ---------------------------------------------------------------------------
  async listTags(environmentId: string): Promise<TagWithCount[]> {
    const tags = await prisma.tag.findMany({
      where: { environmentId },
      include: { _count: { select: { workflows: true } } },
      orderBy: [{ name: "asc" }],
    });
    return tags
      .map((t) => ({ name: t.name, color: t.color, count: t._count.workflows }))
      .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
  }

  // ---------------------------------------------------------------------------
  // Upsert — used when applying tags to a workflow where the tag may not exist
  // ---------------------------------------------------------------------------
  async getOrCreateTag(environmentId: string, rawName: string, color?: string | null) {
    const name = normalizeTagName(rawName);
    if (!name) {
      throw Object.assign(new Error(`Invalid tag name: "${rawName}"`), {
        code: "VALIDATION_ERROR",
      });
    }
    return prisma.tag.upsert({
      where: { environmentId_name: { environmentId, name } },
      update: color !== undefined ? { color } : {},
      create: { environmentId, name, color: color ?? null },
    });
  }

  // ---------------------------------------------------------------------------
  // Rename / recolor a tag by its current name within an environment
  // ---------------------------------------------------------------------------
  async updateTag(
    environmentId: string,
    currentName: string,
    input: { name?: string; color?: string | null }
  ) {
    const existing = await prisma.tag.findUnique({
      where: { environmentId_name: { environmentId, name: currentName } },
    });
    if (!existing) {
      throw Object.assign(new Error(`Tag "${currentName}" not found`), {
        code: "NOT_FOUND",
      });
    }

    const data: Prisma.TagUpdateInput = {};

    if (input.name !== undefined && input.name !== currentName) {
      const normalized = normalizeTagName(input.name);
      if (!normalized) {
        throw Object.assign(new Error(`Invalid tag name: "${input.name}"`), {
          code: "VALIDATION_ERROR",
        });
      }
      // Reject collisions
      const collision = await prisma.tag.findUnique({
        where: { environmentId_name: { environmentId, name: normalized } },
      });
      if (collision && collision.id !== existing.id) {
        throw Object.assign(
          new Error(`A tag named "${normalized}" already exists in this environment`),
          { code: "CONFLICT" }
        );
      }
      data.name = normalized;
    }

    if (input.color !== undefined) data.color = input.color;

    return prisma.tag.update({ where: { id: existing.id }, data });
  }

  // ---------------------------------------------------------------------------
  // Delete a tag (cascades through WorkflowTag via FK)
  // ---------------------------------------------------------------------------
  async deleteTag(environmentId: string, name: string): Promise<void> {
    const existing = await prisma.tag.findUnique({
      where: { environmentId_name: { environmentId, name } },
    });
    if (!existing) {
      throw Object.assign(new Error(`Tag "${name}" not found`), {
        code: "NOT_FOUND",
      });
    }
    await prisma.tag.delete({ where: { id: existing.id } });
  }

  // ---------------------------------------------------------------------------
  // Replace the full set of tags on a workflow with `names`.
  // Auto-creates any missing tag. Runs inside the caller's transaction when a
  // Prisma client is provided so the Workflow write + tag diff are atomic.
  // ---------------------------------------------------------------------------
  async setWorkflowTags(
    workflowId: string,
    environmentId: string,
    rawNames: string[],
    tx: Prisma.TransactionClient | typeof prisma = prisma
  ): Promise<string[]> {
    const normalized = Array.from(
      new Set(
        rawNames
          .map((n) => normalizeTagName(n))
          .filter((n): n is string => n != null)
      )
    );

    if (normalized.length > MAX_TAGS_PER_WORKFLOW) {
      throw Object.assign(
        new Error(`A workflow can have at most ${MAX_TAGS_PER_WORKFLOW} tags`),
        { code: "VALIDATION_ERROR" }
      );
    }

    // Upsert every tag we'll need, then resolve ids
    const tagRows = await Promise.all(
      normalized.map((name) =>
        tx.tag.upsert({
          where: { environmentId_name: { environmentId, name } },
          update: {},
          create: { environmentId, name },
        })
      )
    );
    const desiredIds = new Set(tagRows.map((t) => t.id));

    // Current associations
    const existing = await tx.workflowTag.findMany({ where: { workflowId } });
    const existingIds = new Set(existing.map((e) => e.tagId));

    const toDelete = existing.filter((e) => !desiredIds.has(e.tagId));
    const toCreate = tagRows.filter((t) => !existingIds.has(t.id));

    if (toDelete.length > 0) {
      await tx.workflowTag.deleteMany({
        where: {
          workflowId,
          tagId: { in: toDelete.map((d) => d.tagId) },
        },
      });
    }
    if (toCreate.length > 0) {
      await tx.workflowTag.createMany({
        data: toCreate.map((t) => ({ workflowId, tagId: t.id })),
      });
    }

    return normalized;
  }
}

export const tagService = new TagService();
