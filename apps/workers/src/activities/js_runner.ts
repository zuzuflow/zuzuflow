import { getIvm } from "./ivm-loader";
import { ApplicationFailure } from "@temporalio/activity";
import { execFile as execFileCb } from "child_process";
import { promisify } from "util";
import fs from "fs/promises";
import os from "os";
import path from "path";
import type { JsRunnerConfig } from "@workflow/shared";
import { resolvePackages } from "./pkg_cache";
import { safeEnvForSandbox } from "./sandbox-env";

const execFile = promisify(execFileCb);

// =============================================================================
// jsRunnerActivity — evaluates a JS function inside an isolated sandbox
//
// Strategy: avoid all cross-context synchronous callbacks (applySync deadlock
// risk in ivm v6). Instead, accumulate logs in an isolate-side array and
// return result + logs together as a single JSON string via evalSync copy.
//
// User writes:
//   const main = (input, context) => {
//     console.log("some value");
//     return input['someNode'].value * 2;
//   }
// =============================================================================

export interface WorkflowContext {
  workflowId: string;
  executionId: string;
  triggerPayload: Record<string, unknown>;
}

export interface JsRunnerActivityInput {
  config: JsRunnerConfig;
  nodeOutputs: Record<string, unknown>;
  workflowContext: WorkflowContext;
}

export interface JsRunnerActivityOutput {
  result: unknown;
  logs: string[];
}

export async function jsRunnerActivity(
  input: JsRunnerActivityInput
): Promise<JsRunnerActivityOutput> {
  const { config: cfg, nodeOutputs, workflowContext } = input;
  const hasPackages = cfg.npmPackages && cfg.npmPackages.length > 0;
  // Child-process mode supports async/await + npm packages — give more time for network calls
  const timeoutMs = cfg.timeoutMs ?? (hasPackages ? 30_000 : 5_000);

  // When npm packages are specified OR isolated-vm isn't available,
  // run in a Node.js child process.
  const ivm = getIvm();
  if (hasPackages || !ivm) {
    return runJsWithPackages(cfg, nodeOutputs, workflowContext, timeoutMs);
  }

  const isolate = new ivm.Isolate({ memoryLimit: 64 });
  const vmContext = await isolate.createContext();
  const jail = vmContext.global;

  try {
    await jail.set("global", jail.derefInto());

    // Inject globals — all done inside the isolate, no cross-context calls needed
    await vmContext.eval(`
      global.__logs = [];
      global.console = {
        log:   function() { var a = Array.prototype.slice.call(arguments); __logs.push(a.map(String).join(' ')); },
        warn:  function() { var a = Array.prototype.slice.call(arguments); __logs.push('[warn] ' + a.map(String).join(' ')); },
        error: function() { var a = Array.prototype.slice.call(arguments); __logs.push('[error] ' + a.map(String).join(' ')); },
      };
      // Provide safe stubs for common Node.js globals that user code may reference
      global.process = { env: {}, version: '', platform: 'sandbox', argv: [] };
      global.Buffer = { from: function() { return ''; }, alloc: function() { return ''; } };
      global.require = function(m) { throw new Error('require() is not available in sandbox — only input and context are accessible.'); };
      global.input   = ${JSON.stringify(nodeOutputs)};
      global.context = ${JSON.stringify(workflowContext)};
    `);

    // Run user code + call main — return everything as a JSON string so we
    // need exactly one copy across the isolate boundary
    const runCode = `
(function() {
  try {
    ${cfg.expression}
    if (typeof main !== 'function') {
      return JSON.stringify({ ok: true, result: null, logs: __logs });
    }
    var _r = main(input, context);
    if (_r && typeof _r.then === 'function') {
      return JSON.stringify({ ok: false, error: 'async main() is not supported — remove async and return values synchronously.', logs: __logs });
    }
    return JSON.stringify({ ok: true, result: _r !== undefined ? _r : null, logs: __logs });
  } catch (e) {
    return JSON.stringify({ ok: false, error: e && e.message ? e.message : String(e), logs: __logs });
  }
})()
`;

    const script = isolate.compileScriptSync(runCode);
    const rawRef = script.runSync(vmContext, { timeout: timeoutMs, result: { copy: true } });
    const raw = typeof rawRef === "string" ? rawRef : JSON.stringify(rawRef);
    const payload = JSON.parse(raw) as { ok: boolean; result?: unknown; error?: string; logs: string[] };

    if (!payload.ok) {
      throw ApplicationFailure.create({
        message: `JS runner threw: ${payload.error}`,
        type: "JS_RUNNER_RUNTIME_ERROR",
        nonRetryable: true,
        details: [{ logs: payload.logs }],
      });
    }

    return { result: payload.result ?? null, logs: payload.logs };
  } catch (err) {
    if (err instanceof ApplicationFailure) throw err;
    const msg = (err as Error).message ?? String(err);
    const isTimeout = msg.toLowerCase().includes("timed out") || msg.toLowerCase().includes("timeout");
    throw ApplicationFailure.create({
      message: `JS runner failed: ${msg}`,
      type: isTimeout ? "JS_RUNNER_TIMEOUT" : "JS_RUNNER_ERROR",
      nonRetryable: true,
    });
  } finally {
    isolate.dispose();
  }
}

// =============================================================================
// Child-process runner — used when npmPackages are specified
// =============================================================================

async function runJsWithPackages(
  cfg: JsRunnerConfig,
  nodeOutputs: Record<string, unknown>,
  workflowContext: WorkflowContext,
  timeoutMs: number
): Promise<JsRunnerActivityOutput> {
  const packages = (cfg.npmPackages ?? []).filter((p) => p.trim());

  // Resolve packages from cache (instant on cache hit, npm install on miss)
  const cachedNodeModules = packages.length > 0
    ? await resolvePackages(packages, timeoutMs)
    : undefined;

  // Write the runner script to a minimal temp dir (no npm install here)
  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "wf-js-"));

  try {
    const script = `
// Block ALL network access — prevent data exfiltration from sandbox
const _errMsg = 'Network access is not allowed in sandbox mode';
// 1. Block net.Socket (used by http, https, axios, got, etc.)
const _net = require('net');
_net.Socket.prototype.connect = function() { throw new Error(_errMsg); };
_net.connect = function() { throw new Error(_errMsg); };
_net.createConnection = function() { throw new Error(_errMsg); };
_net.createServer = function() { throw new Error(_errMsg); };
// 2. Block TLS (used by https)
const _tls = require('tls');
_tls.connect = function() { throw new Error(_errMsg); };
_tls.createServer = function() { throw new Error(_errMsg); };
// 3. Block http/https directly
const _http = require('http');
const _https = require('https');
_http.request = function() { throw new Error(_errMsg); };
_http.get = function() { throw new Error(_errMsg); };
_https.request = function() { throw new Error(_errMsg); };
_https.get = function() { throw new Error(_errMsg); };
// 4. Block UDP
const _dgram = require('dgram');
_dgram.createSocket = function() { throw new Error(_errMsg); };
// 5. Block global fetch (Node 20 built-in undici — bypasses net.Socket)
globalThis.fetch = function() { throw new Error(_errMsg); };

const input = JSON.parse(process.env.WORKFLOW_CONTEXT);
const context = JSON.parse(process.env.WORKFLOW_META);
const __logs = [];
const _origLog = console.log;
const _origWarn = console.warn;
const _origErr = console.error;
function _inspect(v) {
  if (v === null) return 'null';
  if (v === undefined) return 'undefined';
  if (typeof v === 'string') return v;
  if (typeof v === 'object') {
    try {
      const seen = new WeakSet();
      return JSON.stringify(v, (k, val) => {
        if (typeof val === 'object' && val !== null) {
          if (seen.has(val)) return '[Circular]';
          seen.add(val);
        }
        return val;
      }, 2);
    } catch { return String(v); }
  }
  return String(v);
}
console.log = (...a) => __logs.push(a.map(_inspect).join(' '));
console.warn = (...a) => __logs.push('[warn] ' + a.map(_inspect).join(' '));
console.error = (...a) => __logs.push('[error] ' + a.map(_inspect).join(' '));

function _safeStringify(obj) {
  const seen = new WeakSet();
  return JSON.stringify(obj, (key, value) => {
    if (typeof value === 'object' && value !== null) {
      if (seen.has(value)) return '[Circular]';
      seen.add(value);
    }
    if (typeof value === 'function') return undefined;
    if (value instanceof Buffer) return value.toString('base64').slice(0, 1000);
    return value;
  });
}

(async () => {
  try {
    ${cfg.expression}
    let _result = null;
    if (typeof main === 'function') {
      _result = main(input, context);
      if (_result && typeof _result.then === 'function') {
        _result = await _result;
      }
    }
    _origLog(_safeStringify({ ok: true, result: _result, logs: __logs }));
  } catch (e) {
    _origLog(_safeStringify({ ok: false, error: e.message || String(e), logs: __logs }));
  }
})();
`;
    await fs.writeFile(path.join(tmpDir, "runner.js"), script);

    const nodeArgs = [
      "--experimental-permission",
      `--allow-fs-read=${tmpDir}`,
      ...(cachedNodeModules ? [`--allow-fs-read=${cachedNodeModules}`] : []),
      "--max-old-space-size=128",
      "runner.js",
    ];
    const { stdout, stderr } = await execFile("node", nodeArgs, {
      cwd: tmpDir,
      timeout: timeoutMs,
      env: safeEnvForSandbox({
        WORKFLOW_CONTEXT: JSON.stringify(nodeOutputs),
        WORKFLOW_META: JSON.stringify(workflowContext),
        NODE_PATH: cachedNodeModules ?? "",
      }),
    });

    // Parse last line of stdout as JSON result
    const lines = stdout.trim().split("\n");
    const lastLine = lines[lines.length - 1];
    let payload: { ok: boolean; result?: unknown; error?: string; logs: string[] };
    try {
      payload = JSON.parse(lastLine);
    } catch {
      return { result: stdout.trim(), logs: stderr ? [stderr] : [] };
    }

    if (!payload.ok) {
      throw ApplicationFailure.create({
        message: `JS runner threw: ${payload.error}`,
        type: "JS_RUNNER_RUNTIME_ERROR",
        nonRetryable: true,
        details: [{ logs: payload.logs }],
      });
    }

    return { result: payload.result ?? null, logs: payload.logs };
  } catch (err) {
    if (err instanceof ApplicationFailure) throw err;
    const msg = (err as Error).message ?? String(err);
    const isTimeout = msg.toLowerCase().includes("timed out") || msg.toLowerCase().includes("timeout");
    throw ApplicationFailure.create({
      message: `JS runner failed: ${msg}`,
      type: isTimeout ? "JS_RUNNER_TIMEOUT" : "JS_RUNNER_ERROR",
      nonRetryable: true,
    });
  } finally {
    // Only clean up the tiny script dir — cached node_modules are preserved
    await fs.rm(tmpDir, { recursive: true, force: true }).catch(() => {});
  }
}
