// =============================================================================
// Built-in tool executors for the AI Agent node
// =============================================================================

import { ApplicationFailure } from "@temporalio/activity";
import type { AiAgentToolDef } from "@workflow/shared";

// =============================================================================
// Main dispatcher
// =============================================================================

export async function executeTool(
  tool: AiAgentToolDef,
  args: Record<string, unknown>,
): Promise<string> {
  switch (tool.kind) {
    case "http_request":
      return executeHttpRequest(args);
    case "js_code":
      return executeJsCode(args);
    case "json_extract":
      return executeJsonExtract(args);
    default:
      return JSON.stringify({ error: `Unknown tool kind: ${tool.kind}` });
  }
}

// =============================================================================
// HTTP Request executor — with SSRF protection
// =============================================================================

const BLOCKED_HOST_PATTERNS = [
  /^127\./,
  /^10\./,
  /^172\.(1[6-9]|2\d|3[01])\./,
  /^192\.168\./,
  /^169\.254\./,
  /^0\./,
  /^localhost$/i,
  /^\[::1\]$/,
  /^fc00:/i,
  /^fe80:/i,
];

function isBlockedHost(hostname: string): boolean {
  return BLOCKED_HOST_PATTERNS.some((p) => p.test(hostname));
}

async function executeHttpRequest(
  args: Record<string, unknown>,
): Promise<string> {
  const url = String(args.url ?? "");
  const method = String(args.method ?? "GET").toUpperCase();
  const headers = (args.headers ?? {}) as Record<string, string>;
  const body = args.body != null ? String(args.body) : undefined;

  if (!url) return JSON.stringify({ error: "Missing url parameter" });

  // SSRF protection: block private/internal IPs
  let hostname: string;
  try {
    hostname = new URL(url).hostname;
  } catch {
    return JSON.stringify({ error: "Invalid URL" });
  }
  if (isBlockedHost(hostname)) {
    throw ApplicationFailure.create({
      message: `Blocked request to internal/private host: ${hostname}`,
      type: "SSRF_BLOCKED",
      nonRetryable: true,
    });
  }

  if (!["GET", "POST", "PUT", "DELETE", "PATCH", "HEAD"].includes(method)) {
    return JSON.stringify({ error: `Unsupported HTTP method: ${method}` });
  }

  try {
    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json", ...headers },
      ...(body && method !== "GET" && method !== "HEAD" ? { body } : {}),
    });
    const text = await res.text();
    // Truncate large responses to prevent token explosion
    const truncated =
      text.length > 8000 ? text.slice(0, 8000) + "\n...[truncated]" : text;
    return JSON.stringify({ status: res.status, body: truncated });
  } catch (err) {
    return JSON.stringify({
      error: `HTTP request failed: ${(err as Error).message}`,
    });
  }
}

// =============================================================================
// JS Code executor — runs in isolated-vm sandbox
// =============================================================================

async function executeJsCode(args: Record<string, unknown>): Promise<string> {
  const code = String(args.code ?? "");
  if (!code) return JSON.stringify({ error: "Missing code parameter" });

  try {
    // Dynamic import to avoid bundling issues in workflow sandbox
    const ivm = await import("isolated-vm");
    const isolate = new ivm.Isolate({ memoryLimit: 64 });
    const context = await isolate.createContext();

    // Wrap user code to capture return value
    const wrappedCode = `(function() { ${code} })()`;
    const script = await isolate.compileScript(wrappedCode);
    const result = await script.run(context, { timeout: 5000 });

    isolate.dispose();
    return typeof result === "string" ? result : JSON.stringify(result ?? null);
  } catch (err) {
    return JSON.stringify({
      error: `JS execution failed: ${(err as Error).message}`,
    });
  }
}

// =============================================================================
// JSON Extract executor — dot-notation path extraction
// =============================================================================

function executeJsonExtract(args: Record<string, unknown>): Promise<string> {
  const jsonStr = String(args.json ?? "");
  const path = String(args.path ?? "");

  if (!jsonStr)
    return Promise.resolve(JSON.stringify({ error: "Missing json parameter" }));
  if (!path)
    return Promise.resolve(JSON.stringify({ error: "Missing path parameter" }));

  try {
    let obj: unknown = JSON.parse(jsonStr);
    const segments = path.replace(/\[(\d+)\]/g, ".$1").split(".");
    for (const seg of segments) {
      if (obj == null || typeof obj !== "object") {
        return Promise.resolve(JSON.stringify({ value: null }));
      }
      obj = (obj as Record<string, unknown>)[seg];
    }
    return Promise.resolve(
      typeof obj === "string" ? obj : JSON.stringify(obj ?? null),
    );
  } catch (err) {
    return Promise.resolve(
      JSON.stringify({
        error: `JSON extraction failed: ${(err as Error).message}`,
      }),
    );
  }
}
