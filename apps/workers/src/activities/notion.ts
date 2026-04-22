import { ApplicationFailure } from "@temporalio/activity";
import { interpolateTemplate } from "@workflow/shared";
import type { NotionConfig } from "@workflow/shared";

// =============================================================================
// notionActivity — Notion API via @notionhq/client
//
// Expects a decrypted credential of `{ token: "secret_..." }` (Internal
// Integration Token). SDK is lazy-imported.
// =============================================================================

export interface NotionActivityInput {
  config: NotionConfig;
  context: Record<string, unknown>;
  resolvedCredentials?: {
    token?: string;
  };
}

export interface NotionActivityOutput {
  ok: boolean;
  result: unknown;
}

function parseJson<T = unknown>(
  label: string,
  raw: string | undefined,
  context: Record<string, unknown>,
): T | undefined {
  if (!raw) return undefined;
  const interp = interpolateTemplate(raw, context);
  if (!interp.trim()) return undefined;
  try {
    return JSON.parse(interp) as T;
  } catch (err) {
    throw ApplicationFailure.create({
      message: `Notion ${label}: invalid JSON — ${(err as Error).message}`,
      type: "VALIDATION_ERROR",
      nonRetryable: true,
    });
  }
}

function mustString(
  label: string,
  raw: string | undefined,
  context: Record<string, unknown>,
): string {
  const val = raw ? interpolateTemplate(raw, context) : "";
  if (!val) {
    throw ApplicationFailure.create({
      message: `Notion: \`${label}\` is required`,
      type: "VALIDATION_ERROR",
      nonRetryable: true,
    });
  }
  return val;
}

export async function notionActivity(
  input: NotionActivityInput,
): Promise<NotionActivityOutput> {
  const { config: cfg, context, resolvedCredentials } = input;

  const token = resolvedCredentials?.token;
  if (!token) {
    throw ApplicationFailure.create({
      message:
        "Notion credential is missing — supply `{ token: \"secret_...\" }` in the stored credential.",
      type: "AUTH_ERROR",
      nonRetryable: true,
    });
  }

  const { Client } = await import("@notionhq/client");
  const notion = new Client({ auth: token });

  const pageSize = Math.min(Math.max(cfg.pageSize ?? 100, 1), 100);
  const startCursor = cfg.startCursor
    ? interpolateTemplate(cfg.startCursor, context)
    : undefined;

  try {
    switch (cfg.operation) {
      case "pages.create": {
        const properties = parseJson<Record<string, unknown>>(
          "properties",
          cfg.properties,
          context,
        );
        if (!properties) {
          throw ApplicationFailure.create({
            message: "Notion pages.create: `properties` JSON is required",
            type: "VALIDATION_ERROR",
            nonRetryable: true,
          });
        }
        const children = parseJson<unknown[]>(
          "children",
          cfg.children,
          context,
        );
        const parent = cfg.databaseId
          ? { database_id: interpolateTemplate(cfg.databaseId, context) }
          : cfg.parentPageId
            ? { page_id: interpolateTemplate(cfg.parentPageId, context) }
            : null;
        if (!parent) {
          throw ApplicationFailure.create({
            message:
              "Notion pages.create: either `databaseId` or `parentPageId` is required.",
            type: "VALIDATION_ERROR",
            nonRetryable: true,
          });
        }
        // The SDK's types are complex; we stay on the safe side with a cast.
        const page = await notion.pages.create({
          parent,
          properties,
          ...(children ? { children } : {}),
        } as Parameters<typeof notion.pages.create>[0]);
        return { ok: true, result: page as unknown };
      }

      case "pages.retrieve": {
        const id = mustString("pageId", cfg.pageId, context);
        const page = await notion.pages.retrieve({ page_id: id });
        return { ok: true, result: page as unknown };
      }

      case "pages.update": {
        const id = mustString("pageId", cfg.pageId, context);
        const properties = parseJson<Record<string, unknown>>(
          "properties",
          cfg.properties,
          context,
        );
        const page = await notion.pages.update({
          page_id: id,
          ...(properties ? { properties } : {}),
          ...(typeof cfg.archived === "boolean"
            ? { archived: cfg.archived }
            : {}),
        } as Parameters<typeof notion.pages.update>[0]);
        return { ok: true, result: page as unknown };
      }

      case "blocks.append": {
        const blockId = mustString(
          "blockId",
          cfg.blockId ?? cfg.pageId,
          context,
        );
        const children = parseJson<unknown[]>(
          "children",
          cfg.children,
          context,
        );
        if (!children || children.length === 0) {
          throw ApplicationFailure.create({
            message: "Notion blocks.append: `children` JSON array is required",
            type: "VALIDATION_ERROR",
            nonRetryable: true,
          });
        }
        const resp = await notion.blocks.children.append({
          block_id: blockId,
          children,
        } as Parameters<typeof notion.blocks.children.append>[0]);
        return { ok: true, result: resp as unknown };
      }

      case "blocks.children": {
        const blockId = mustString(
          "blockId",
          cfg.blockId ?? cfg.pageId,
          context,
        );
        const resp = await notion.blocks.children.list({
          block_id: blockId,
          page_size: pageSize,
          ...(startCursor ? { start_cursor: startCursor } : {}),
        });
        return { ok: true, result: resp as unknown };
      }

      case "databases.query": {
        const id = mustString("databaseId", cfg.databaseId, context);
        const filter = parseJson<Record<string, unknown>>(
          "filter",
          cfg.filter,
          context,
        );
        const sorts = parseJson<unknown[]>("sorts", cfg.sorts, context);
        const resp = await notion.databases.query({
          database_id: id,
          ...(filter ? { filter } : {}),
          ...(sorts ? { sorts } : {}),
          page_size: pageSize,
          ...(startCursor ? { start_cursor: startCursor } : {}),
        } as Parameters<typeof notion.databases.query>[0]);
        return { ok: true, result: resp as unknown };
      }

      case "databases.retrieve": {
        const id = mustString("databaseId", cfg.databaseId, context);
        const resp = await notion.databases.retrieve({ database_id: id });
        return { ok: true, result: resp as unknown };
      }

      case "search": {
        const query = cfg.query
          ? interpolateTemplate(cfg.query, context)
          : undefined;
        const resp = await notion.search({
          query,
          page_size: pageSize,
          ...(startCursor ? { start_cursor: startCursor } : {}),
        });
        return { ok: true, result: resp as unknown };
      }

      default:
        throw ApplicationFailure.create({
          message: `Unsupported Notion operation: ${(cfg as { operation?: string }).operation}`,
          type: "VALIDATION_ERROR",
          nonRetryable: true,
        });
    }
  } catch (err) {
    if (err instanceof ApplicationFailure) throw err;
    const e = err as {
      code?: string;
      status?: number;
      message?: string;
    };
    const status = e.status ?? 0;
    const retriable = status === 0 || status === 429 || status >= 500;
    throw ApplicationFailure.create({
      message: `Notion ${cfg.operation} failed: ${e.message ?? String(err)}`,
      type:
        status === 401 || status === 403 || e.code === "unauthorized"
          ? "AUTH_ERROR"
          : status === 404 || status === 400 || e.code === "validation_error"
            ? "VALIDATION_ERROR"
            : status === 429 || e.code === "rate_limited"
              ? "RATE_LIMITED"
              : "UPSTREAM_ERROR",
      nonRetryable: !retriable,
      details: [{ status, notionCode: e.code, operation: cfg.operation }],
    });
  }
}
