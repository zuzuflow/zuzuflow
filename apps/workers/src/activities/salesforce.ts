import { ApplicationFailure } from "@temporalio/activity";
import { interpolateTemplate } from "@workflow/shared";
import type { SalesforceConfig } from "@workflow/shared";

// =============================================================================
// salesforceActivity — Salesforce via jsforce
//
// Two credential shapes accepted:
//   - { loginUrl, username, password, securityToken }  (SOAP login)
//   - { instanceUrl, accessToken }                     (OAuth bearer)
// =============================================================================

export interface SalesforceActivityInput {
  config: SalesforceConfig;
  context: Record<string, unknown>;
  resolvedCredentials?: {
    loginUrl?: string;
    username?: string;
    password?: string;
    securityToken?: string;
    instanceUrl?: string;
    accessToken?: string;
  };
}

export interface SalesforceActivityOutput {
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
      message: `Salesforce ${label}: invalid JSON — ${(err as Error).message}`,
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
      message: `Salesforce: \`${label}\` is required`,
      type: "VALIDATION_ERROR",
      nonRetryable: true,
    });
  }
  return val;
}

interface MinimalJsforceConnection {
  login(username: string, password: string): Promise<unknown>;
  query<T = unknown>(soql: string): Promise<{ records: T[]; totalSize: number; done: boolean }>;
  queryMore?: (locator: string) => Promise<unknown>;
  sobject(name: string): {
    create(record: Record<string, unknown>): Promise<unknown>;
    retrieve(id: string): Promise<unknown>;
    update(record: Record<string, unknown> & { Id: string }): Promise<unknown>;
    destroy(id: string): Promise<unknown>;
    upsert(record: Record<string, unknown>, externalIdField: string): Promise<unknown>;
    describe(): Promise<unknown>;
  };
  describeGlobal(): Promise<unknown>;
  apex: {
    get(path: string): Promise<unknown>;
    post(path: string, body?: unknown): Promise<unknown>;
    put(path: string, body?: unknown): Promise<unknown>;
    patch(path: string, body?: unknown): Promise<unknown>;
    del(path: string): Promise<unknown>;
  };
}

export async function salesforceActivity(
  input: SalesforceActivityInput,
): Promise<SalesforceActivityOutput> {
  const { config: cfg, context, resolvedCredentials } = input;

  const creds = resolvedCredentials ?? {};
  const hasOauth = Boolean(creds.instanceUrl && creds.accessToken);
  const hasSoap = Boolean(creds.username && creds.password);
  if (!hasOauth && !hasSoap) {
    throw ApplicationFailure.create({
      message:
        "Salesforce credential is missing — supply `{ instanceUrl, accessToken }` or `{ loginUrl, username, password, securityToken }`.",
      type: "AUTH_ERROR",
      nonRetryable: true,
    });
  }

  const jsforce = (await import("jsforce")) as unknown as {
    Connection: new (opts: Record<string, unknown>) => MinimalJsforceConnection;
  };

  const conn = hasOauth
    ? new jsforce.Connection({
        instanceUrl: creds.instanceUrl,
        accessToken: creds.accessToken,
      })
    : new jsforce.Connection({
        loginUrl: creds.loginUrl ?? "https://login.salesforce.com",
      });

  if (!hasOauth) {
    const pwd = `${creds.password ?? ""}${creds.securityToken ?? ""}`;
    await conn.login(creds.username ?? "", pwd);
  }

  try {
    switch (cfg.operation) {
      case "query": {
        const soql = mustString("soql", cfg.soql, context);
        const maxRows = cfg.maxRows ?? 2000;
        const records: unknown[] = [];
        let result = await conn.query<unknown>(soql);
        records.push(...result.records);
        while (!result.done && records.length < maxRows && conn.queryMore) {
          const locator = (result as unknown as { nextRecordsUrl?: string })
            .nextRecordsUrl;
          if (!locator) break;
          result = (await conn.queryMore(locator)) as typeof result;
          records.push(...result.records);
        }
        return {
          ok: true,
          result: {
            records: records.slice(0, maxRows),
            totalSize: records.length,
            done: result.done,
          },
        };
      }

      case "sobject.create": {
        const sobject = mustString("sobject", cfg.sobject, context);
        const record = parseJson<Record<string, unknown>>(
          "record",
          cfg.record,
          context,
        );
        if (!record) {
          throw ApplicationFailure.create({
            message: "Salesforce sobject.create: `record` JSON is required",
            type: "VALIDATION_ERROR",
            nonRetryable: true,
          });
        }
        const res = await conn.sobject(sobject).create(record);
        return { ok: true, result: res };
      }

      case "sobject.retrieve": {
        const sobject = mustString("sobject", cfg.sobject, context);
        const id = mustString("recordId", cfg.recordId, context);
        const res = await conn.sobject(sobject).retrieve(id);
        return { ok: true, result: res };
      }

      case "sobject.update": {
        const sobject = mustString("sobject", cfg.sobject, context);
        const id = mustString("recordId", cfg.recordId, context);
        const record = parseJson<Record<string, unknown>>(
          "record",
          cfg.record,
          context,
        );
        if (!record) {
          throw ApplicationFailure.create({
            message: "Salesforce sobject.update: `record` JSON is required",
            type: "VALIDATION_ERROR",
            nonRetryable: true,
          });
        }
        const res = await conn.sobject(sobject).update({ ...record, Id: id });
        return { ok: true, result: res };
      }

      case "sobject.delete": {
        const sobject = mustString("sobject", cfg.sobject, context);
        const id = mustString("recordId", cfg.recordId, context);
        const res = await conn.sobject(sobject).destroy(id);
        return { ok: true, result: res };
      }

      case "sobject.upsert": {
        const sobject = mustString("sobject", cfg.sobject, context);
        const ext = mustString(
          "externalIdField",
          cfg.externalIdField,
          context,
        );
        const record = parseJson<Record<string, unknown>>(
          "record",
          cfg.record,
          context,
        );
        if (!record) {
          throw ApplicationFailure.create({
            message: "Salesforce sobject.upsert: `record` JSON is required",
            type: "VALIDATION_ERROR",
            nonRetryable: true,
          });
        }
        const res = await conn.sobject(sobject).upsert(record, ext);
        return { ok: true, result: res };
      }

      case "describe": {
        if (cfg.sobject) {
          const sobject = interpolateTemplate(cfg.sobject, context);
          const res = await conn.sobject(sobject).describe();
          return { ok: true, result: res };
        }
        const res = await conn.describeGlobal();
        return { ok: true, result: res };
      }

      case "apex.rest": {
        const path = mustString("apexPath", cfg.apexPath, context);
        const normalized = path.startsWith("/") ? path : `/${path}`;
        const method = (cfg.apexMethod ?? "GET").toUpperCase();
        const body = parseJson<unknown>("apexBody", cfg.apexBody, context);
        let res: unknown;
        switch (method) {
          case "GET":
            res = await conn.apex.get(normalized);
            break;
          case "POST":
            res = await conn.apex.post(normalized, body);
            break;
          case "PUT":
            res = await conn.apex.put(normalized, body);
            break;
          case "PATCH":
            res = await conn.apex.patch(normalized, body);
            break;
          case "DELETE":
            res = await conn.apex.del(normalized);
            break;
          default:
            throw ApplicationFailure.create({
              message: `Salesforce apex.rest: unsupported method ${method}`,
              type: "VALIDATION_ERROR",
              nonRetryable: true,
            });
        }
        return { ok: true, result: res };
      }

      default:
        throw ApplicationFailure.create({
          message: `Unsupported Salesforce operation: ${(cfg as { operation?: string }).operation}`,
          type: "VALIDATION_ERROR",
          nonRetryable: true,
        });
    }
  } catch (err) {
    if (err instanceof ApplicationFailure) throw err;
    const e = err as {
      errorCode?: string;
      name?: string;
      message?: string;
    };
    const code = e.errorCode ?? e.name ?? "";
    const isAuth =
      code === "INVALID_SESSION_ID" ||
      code === "INVALID_LOGIN" ||
      code === "INVALID_GRANT" ||
      code === "INSUFFICIENT_ACCESS";
    const isValidation =
      code === "INVALID_FIELD" ||
      code === "MALFORMED_QUERY" ||
      code === "REQUIRED_FIELD_MISSING" ||
      code === "NOT_FOUND";
    throw ApplicationFailure.create({
      message: `Salesforce ${cfg.operation} failed: ${e.message ?? String(err)}`,
      type: isAuth
        ? "AUTH_ERROR"
        : isValidation
          ? "VALIDATION_ERROR"
          : code === "REQUEST_LIMIT_EXCEEDED"
            ? "RATE_LIMITED"
            : "UPSTREAM_ERROR",
      nonRetryable: isAuth || isValidation,
      details: [{ code, operation: cfg.operation }],
    });
  }
}
