import { ApplicationFailure } from "@temporalio/activity";
import { interpolateTemplate } from "@workflow/shared";
import type { VectorDbConfig } from "@workflow/shared";

// =============================================================================
// vectorDbActivity — Pinecone / Weaviate / Qdrant (driver selection)
//
// All three speak HTTP + JSON, so we hit them directly rather than bringing in
// three SDKs. Credentials:
//   - pinecone: { apiKey, indexHost }
//   - weaviate: { url, apiKey? }
//   - qdrant:   { url, apiKey? }
// =============================================================================

export interface VectorDbActivityInput {
  config: VectorDbConfig;
  context: Record<string, unknown>;
  resolvedCredentials?: {
    apiKey?: string;
    indexHost?: string;
    url?: string;
  };
}

export interface VectorDbActivityOutput {
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
      message: `Vector DB ${label}: invalid JSON — ${(err as Error).message}`,
      type: "VALIDATION_ERROR",
      nonRetryable: true,
    });
  }
}

function errType(status: number): { type: string; nonRetryable: boolean } {
  if (status === 401 || status === 403)
    return { type: "AUTH_ERROR", nonRetryable: true };
  if (status === 429) return { type: "RATE_LIMITED", nonRetryable: false };
  if (status === 400 || status === 404 || status === 422)
    return { type: "VALIDATION_ERROR", nonRetryable: true };
  return { type: "UPSTREAM_ERROR", nonRetryable: false };
}

async function hit(
  url: string,
  init: RequestInit,
  op: string,
): Promise<unknown> {
  const resp = await fetch(url, init);
  const text = await resp.text();
  if (!resp.ok) {
    const { type, nonRetryable } = errType(resp.status);
    throw ApplicationFailure.create({
      message: `Vector DB ${op} failed: ${resp.status} ${resp.statusText} — ${text.slice(0, 500)}`,
      type,
      nonRetryable,
      details: [{ status: resp.status, operation: op }],
    });
  }
  if (!text) return { ok: true };
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

// ────── Pinecone ────────────────────────────────────────────────────────────
// Data plane API — one URL per index (indexHost). Namespace is optional.
async function pinecone(
  cfg: VectorDbConfig,
  context: Record<string, unknown>,
  apiKey: string,
  indexHost: string,
): Promise<unknown> {
  const namespace = cfg.namespace
    ? interpolateTemplate(cfg.namespace, context)
    : undefined;
  const headers = {
    accept: "application/json",
    "content-type": "application/json",
    "api-key": apiKey,
  };
  const base = indexHost.replace(/\/$/, "");

  switch (cfg.operation) {
    case "upsert": {
      const vectors = parseJson<
        Array<{ id: string; values: number[]; metadata?: unknown }>
      >("vectors", cfg.vectors, context);
      if (!vectors || !Array.isArray(vectors)) {
        throw ApplicationFailure.create({
          message: "Pinecone upsert: `vectors` JSON array is required",
          type: "VALIDATION_ERROR",
          nonRetryable: true,
        });
      }
      return await hit(
        `${base}/vectors/upsert`,
        {
          method: "POST",
          headers,
          body: JSON.stringify({ vectors, ...(namespace ? { namespace } : {}) }),
        },
        "pinecone.upsert",
      );
    }
    case "query": {
      const vector = parseJson<number[]>(
        "queryVector",
        cfg.queryVector,
        context,
      );
      if (!vector) {
        throw ApplicationFailure.create({
          message: "Pinecone query: `queryVector` is required",
          type: "VALIDATION_ERROR",
          nonRetryable: true,
        });
      }
      const filter = parseJson<Record<string, unknown>>(
        "filter",
        cfg.filter,
        context,
      );
      return await hit(
        `${base}/query`,
        {
          method: "POST",
          headers,
          body: JSON.stringify({
            vector,
            topK: cfg.topK ?? 10,
            includeValues: cfg.includeValues ?? false,
            includeMetadata: cfg.includeMetadata ?? true,
            ...(namespace ? { namespace } : {}),
            ...(filter ? { filter } : {}),
          }),
        },
        "pinecone.query",
      );
    }
    case "delete": {
      const ids = parseJson<string[]>("ids", cfg.ids, context);
      return await hit(
        `${base}/vectors/delete`,
        {
          method: "POST",
          headers,
          body: JSON.stringify({
            ...(ids ? { ids } : { deleteAll: true }),
            ...(namespace ? { namespace } : {}),
          }),
        },
        "pinecone.delete",
      );
    }
    case "fetch": {
      const ids = parseJson<string[]>("ids", cfg.ids, context);
      if (!ids || ids.length === 0) {
        throw ApplicationFailure.create({
          message: "Pinecone fetch: `ids` array is required",
          type: "VALIDATION_ERROR",
          nonRetryable: true,
        });
      }
      const params = new URLSearchParams();
      for (const id of ids) params.append("ids", id);
      if (namespace) params.set("namespace", namespace);
      return await hit(
        `${base}/vectors/fetch?${params.toString()}`,
        { method: "GET", headers },
        "pinecone.fetch",
      );
    }
    default:
      throw ApplicationFailure.create({
        message: `Unsupported Pinecone operation: ${cfg.operation}`,
        type: "VALIDATION_ERROR",
        nonRetryable: true,
      });
  }
}

// ────── Weaviate ────────────────────────────────────────────────────────────
// Uses the v1 REST API. `collection` is the class name.
async function weaviate(
  cfg: VectorDbConfig,
  context: Record<string, unknown>,
  base: string,
  apiKey: string | undefined,
): Promise<unknown> {
  const headers: Record<string, string> = {
    accept: "application/json",
    "content-type": "application/json",
  };
  if (apiKey) headers.authorization = `Bearer ${apiKey}`;
  const className = cfg.collection;
  const url = base.replace(/\/$/, "");

  switch (cfg.operation) {
    case "upsert": {
      const vectors = parseJson<
        Array<{ id: string; values: number[]; metadata?: Record<string, unknown> }>
      >("vectors", cfg.vectors, context);
      if (!vectors) {
        throw ApplicationFailure.create({
          message: "Weaviate upsert: `vectors` JSON array is required",
          type: "VALIDATION_ERROR",
          nonRetryable: true,
        });
      }
      const objects = vectors.map((v) => ({
        class: className,
        id: v.id,
        vector: v.values,
        properties: v.metadata ?? {},
      }));
      return await hit(
        `${url}/v1/batch/objects`,
        {
          method: "POST",
          headers,
          body: JSON.stringify({ objects }),
        },
        "weaviate.upsert",
      );
    }
    case "query": {
      const vector = parseJson<number[]>(
        "queryVector",
        cfg.queryVector,
        context,
      );
      if (!vector) {
        throw ApplicationFailure.create({
          message: "Weaviate query: `queryVector` is required",
          type: "VALIDATION_ERROR",
          nonRetryable: true,
        });
      }
      // Use the GraphQL nearVector endpoint for flexibility.
      const gql = `{
  Get {
    ${className}(nearVector: { vector: ${JSON.stringify(vector)} }, limit: ${cfg.topK ?? 10}) {
      _additional { id distance vector }
    }
  }
}`;
      return await hit(
        `${url}/v1/graphql`,
        {
          method: "POST",
          headers,
          body: JSON.stringify({ query: gql }),
        },
        "weaviate.query",
      );
    }
    case "delete": {
      const ids = parseJson<string[]>("ids", cfg.ids, context);
      if (!ids || ids.length === 0) {
        throw ApplicationFailure.create({
          message: "Weaviate delete: `ids` array is required",
          type: "VALIDATION_ERROR",
          nonRetryable: true,
        });
      }
      const results: unknown[] = [];
      for (const id of ids) {
        const r = await hit(
          `${url}/v1/objects/${encodeURIComponent(className)}/${encodeURIComponent(id)}`,
          { method: "DELETE", headers },
          "weaviate.delete",
        );
        results.push(r);
      }
      return { deleted: results.length };
    }
    case "fetch": {
      const ids = parseJson<string[]>("ids", cfg.ids, context);
      if (!ids || ids.length === 0) {
        throw ApplicationFailure.create({
          message: "Weaviate fetch: `ids` array is required",
          type: "VALIDATION_ERROR",
          nonRetryable: true,
        });
      }
      const objects = await Promise.all(
        ids.map((id) =>
          hit(
            `${url}/v1/objects/${encodeURIComponent(className)}/${encodeURIComponent(id)}?include=vector`,
            { method: "GET", headers },
            "weaviate.fetch",
          ),
        ),
      );
      return { objects };
    }
    default:
      throw ApplicationFailure.create({
        message: `Unsupported Weaviate operation: ${cfg.operation}`,
        type: "VALIDATION_ERROR",
        nonRetryable: true,
      });
  }
}

// ────── Qdrant ──────────────────────────────────────────────────────────────
async function qdrant(
  cfg: VectorDbConfig,
  context: Record<string, unknown>,
  base: string,
  apiKey: string | undefined,
): Promise<unknown> {
  const headers: Record<string, string> = {
    accept: "application/json",
    "content-type": "application/json",
  };
  if (apiKey) headers["api-key"] = apiKey;
  const url = base.replace(/\/$/, "");
  const coll = encodeURIComponent(cfg.collection);

  switch (cfg.operation) {
    case "upsert": {
      const vectors = parseJson<
        Array<{ id: string | number; values: number[]; metadata?: Record<string, unknown> }>
      >("vectors", cfg.vectors, context);
      if (!vectors) {
        throw ApplicationFailure.create({
          message: "Qdrant upsert: `vectors` JSON array is required",
          type: "VALIDATION_ERROR",
          nonRetryable: true,
        });
      }
      const points = vectors.map((v) => ({
        id: v.id,
        vector: v.values,
        payload: v.metadata ?? {},
      }));
      return await hit(
        `${url}/collections/${coll}/points?wait=true`,
        {
          method: "PUT",
          headers,
          body: JSON.stringify({ points }),
        },
        "qdrant.upsert",
      );
    }
    case "query": {
      const vector = parseJson<number[]>(
        "queryVector",
        cfg.queryVector,
        context,
      );
      if (!vector) {
        throw ApplicationFailure.create({
          message: "Qdrant query: `queryVector` is required",
          type: "VALIDATION_ERROR",
          nonRetryable: true,
        });
      }
      const filter = parseJson<Record<string, unknown>>(
        "filter",
        cfg.filter,
        context,
      );
      return await hit(
        `${url}/collections/${coll}/points/search`,
        {
          method: "POST",
          headers,
          body: JSON.stringify({
            vector,
            limit: cfg.topK ?? 10,
            with_payload: cfg.includeMetadata ?? true,
            with_vector: cfg.includeValues ?? false,
            ...(filter ? { filter } : {}),
          }),
        },
        "qdrant.query",
      );
    }
    case "delete": {
      const ids = parseJson<Array<string | number>>("ids", cfg.ids, context);
      if (!ids || ids.length === 0) {
        throw ApplicationFailure.create({
          message: "Qdrant delete: `ids` array is required",
          type: "VALIDATION_ERROR",
          nonRetryable: true,
        });
      }
      return await hit(
        `${url}/collections/${coll}/points/delete?wait=true`,
        {
          method: "POST",
          headers,
          body: JSON.stringify({ points: ids }),
        },
        "qdrant.delete",
      );
    }
    case "fetch": {
      const ids = parseJson<Array<string | number>>("ids", cfg.ids, context);
      if (!ids || ids.length === 0) {
        throw ApplicationFailure.create({
          message: "Qdrant fetch: `ids` array is required",
          type: "VALIDATION_ERROR",
          nonRetryable: true,
        });
      }
      return await hit(
        `${url}/collections/${coll}/points`,
        {
          method: "POST",
          headers,
          body: JSON.stringify({
            ids,
            with_payload: cfg.includeMetadata ?? true,
            with_vector: cfg.includeValues ?? true,
          }),
        },
        "qdrant.fetch",
      );
    }
    default:
      throw ApplicationFailure.create({
        message: `Unsupported Qdrant operation: ${cfg.operation}`,
        type: "VALIDATION_ERROR",
        nonRetryable: true,
      });
  }
}

export async function vectorDbActivity(
  input: VectorDbActivityInput,
): Promise<VectorDbActivityOutput> {
  const { config: cfg, context, resolvedCredentials } = input;
  switch (cfg.provider) {
    case "pinecone": {
      const apiKey = resolvedCredentials?.apiKey;
      const indexHost = resolvedCredentials?.indexHost;
      if (!apiKey || !indexHost) {
        throw ApplicationFailure.create({
          message:
            "Pinecone credential is missing — supply `{ apiKey, indexHost }` (index host URL).",
          type: "AUTH_ERROR",
          nonRetryable: true,
        });
      }
      const result = await pinecone(cfg, context, apiKey, indexHost);
      return { ok: true, result };
    }
    case "weaviate": {
      const url = resolvedCredentials?.url;
      if (!url) {
        throw ApplicationFailure.create({
          message: "Weaviate credential is missing — supply `{ url }`.",
          type: "AUTH_ERROR",
          nonRetryable: true,
        });
      }
      const result = await weaviate(
        cfg,
        context,
        url,
        resolvedCredentials?.apiKey,
      );
      return { ok: true, result };
    }
    case "qdrant": {
      const url = resolvedCredentials?.url;
      if (!url) {
        throw ApplicationFailure.create({
          message: "Qdrant credential is missing — supply `{ url }`.",
          type: "AUTH_ERROR",
          nonRetryable: true,
        });
      }
      const result = await qdrant(
        cfg,
        context,
        url,
        resolvedCredentials?.apiKey,
      );
      return { ok: true, result };
    }
    default:
      throw ApplicationFailure.create({
        message: `Unsupported Vector DB provider: ${(cfg as { provider?: string }).provider}`,
        type: "VALIDATION_ERROR",
        nonRetryable: true,
      });
  }
}
