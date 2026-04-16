import { getIvm } from "./ivm-loader";
import { ApplicationFailure } from "@temporalio/activity";
import { transformSync } from "esbuild";
import { execFile as execFileCb } from "child_process";
import { promisify } from "util";
import fs from "fs/promises";
import os from "os";
import path from "path";
import type { TsRunnerConfig } from "@workflow/shared";
import type { WorkflowContext } from "./js_runner";
import { resolvePackages } from "./pkg_cache";
import { safeEnvForSandbox } from "./sandbox-env";

const execFile = promisify(execFileCb);

// =============================================================================
// tsRunnerActivity — transpiles TypeScript to JS via esbuild, then runs in ivm
//
// User writes:
//   const main = (input: Record<string, unknown>, context: WorkflowContext) => {
//     return input['someNode'].value;
//   }
//
//   input   — outputs keyed by node ID from all previously executed nodes
//   context — workflow metadata: { workflowId, executionId, triggerPayload }
// =============================================================================

export interface TsRunnerActivityInput {
  config: TsRunnerConfig;
  nodeOutputs: Record<string, unknown>;
  workflowContext: WorkflowContext;
}

export interface TsRunnerActivityOutput {
  result: unknown;
  logs: string[];
}

export async function tsRunnerActivity(
  input: TsRunnerActivityInput
): Promise<TsRunnerActivityOutput> {
  const { config: cfg, nodeOutputs, workflowContext } = input;
  const hasPackages = cfg.npmPackages && cfg.npmPackages.length > 0;
  // Child-process mode supports async/await + npm packages — give more time for network calls
  const timeoutMs = cfg.timeoutMs ?? (hasPackages ? 30_000 : 5_000);

  // When npm packages are specified OR isolated-vm isn't available,
  // run in a Node.js child process.
  const ivm = getIvm();
  if (hasPackages || !ivm) {
    return runTsWithPackages(cfg, nodeOutputs, workflowContext, timeoutMs);
  }

  // Transpile TypeScript → JavaScript
  let jsCode: string;
  try {
    const result = transformSync(cfg.expression, {
      loader: "ts",
      target: "es2020",
      format: "esm",
    });
    jsCode = result.code;
  } catch (err) {
    throw ApplicationFailure.create({
      message: `TypeScript compile error: ${(err as Error).message}`,
      type: "TS_RUNNER_COMPILE_ERROR",
      nonRetryable: true,
    });
  }

  const code = `
(function() {
  try {
    ${jsCode}
    if (typeof main === 'function') {
      var _r = main(input, context);
      if (_r && typeof _r.then === 'function') {
        setResult({ __error: 'async main() is not supported — remove async and return values synchronously.' });
      } else {
        setResult(_r);
      }
    } else {
      setResult(null);
    }
  } catch (e) {
    setResult({ __error: e && e.message ? e.message : String(e) });
  }
})();
`;

  const isolate = new ivm.Isolate({ memoryLimit: 64 });
  const vmContext = await isolate.createContext();
  const jail = vmContext.global;

  const capturedLogs: string[] = [];
  let capturedResult: unknown = undefined;

  try {
    await jail.set("global", jail.derefInto());

    const logRef = new ivm.Reference((...args: unknown[]) => {
      capturedLogs.push(args.map((a) => String(a)).join(" "));
    });
    await jail.set("_consoleLog", logRef);
    await vmContext.eval(
      `global.console = { log: (...a) => _consoleLog.applySync(undefined, a), warn: (...a) => _consoleLog.applySync(undefined, a), error: (...a) => _consoleLog.applySync(undefined, a) }`
    );

    // Provide safe stubs for common Node.js globals that user code may reference
    await vmContext.eval(`
      global.process = { env: {}, version: '', platform: 'sandbox', argv: [] };
      global.Buffer = { from: function() { return ''; }, alloc: function() { return ''; } };
      global.require = function(m) { throw new Error('require() is not available in sandbox — only input and context are accessible.'); };
    `);

    // Inject `input` (node outputs) and `context` (workflow metadata)
    await vmContext.eval(`global.input = ${JSON.stringify(nodeOutputs)}`);
    await vmContext.eval(`global.context = ${JSON.stringify(workflowContext)}`);

    const resultRef = new ivm.Reference((jsonStr: string) => {
      try { capturedResult = JSON.parse(jsonStr); } catch { capturedResult = jsonStr; }
    });
    await jail.set("_setResult", resultRef);
    await vmContext.eval(
      `global.setResult = (v) => _setResult.applySync(undefined, [JSON.stringify(v)])`
    );

    const script = await isolate.compileScript(code);
    await script.run(vmContext, { timeout: timeoutMs });

    if (
      capturedResult !== null &&
      typeof capturedResult === "object" &&
      "__error" in (capturedResult as Record<string, unknown>)
    ) {
      throw ApplicationFailure.create({
        message: `TS runner threw: ${(capturedResult as any).__error}`,
        type: "TS_RUNNER_RUNTIME_ERROR",
        nonRetryable: true,
        details: [{ logs: capturedLogs }],
      });
    }

    return { result: capturedResult ?? null, logs: capturedLogs };
  } catch (err) {
    if (err instanceof ApplicationFailure) throw err;
    const msg = (err as Error).message ?? String(err);
    const isTimeout = msg.toLowerCase().includes("timed out") || msg.toLowerCase().includes("timeout");
    throw ApplicationFailure.create({
      message: `TS runner failed: ${msg}`,
      type: isTimeout ? "TS_RUNNER_TIMEOUT" : "TS_RUNNER_ERROR",
      nonRetryable: true,
      details: [{ logs: capturedLogs }],
    });
  } finally {
    isolate.dispose();
  }
}

// =============================================================================
// Child-process runner — used when npmPackages are specified
// =============================================================================

async function runTsWithPackages(
  cfg: TsRunnerConfig,
  nodeOutputs: Record<string, unknown>,
  workflowContext: WorkflowContext,
  timeoutMs: number
): Promise<TsRunnerActivityOutput> {
  // Transpile TS → JS first
  let jsCode: string;
  try {
    const result = transformSync(cfg.expression, {
      loader: "ts",
      target: "es2020",
      format: "cjs",
    });
    jsCode = result.code;
  } catch (err) {
    throw ApplicationFailure.create({
      message: `TypeScript compile error: ${(err as Error).message}`,
      type: "TS_RUNNER_COMPILE_ERROR",
      nonRetryable: true,
    });
  }

  const packages = (cfg.npmPackages ?? []).filter((p) => p.trim());

  // Resolve packages from cache (instant on cache hit, npm install on miss)
  const cachedNodeModules = packages.length > 0
    ? await resolvePackages(packages, timeoutMs)
    : undefined;

  // Write the runner script to a minimal temp dir (no npm install here)
  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "wf-ts-"));

  try {
    const script = `
// Block ALL network access — prevent data exfiltration from sandbox
const _errMsg = 'Network access is not allowed in sandbox mode';
const _net = require('net');
_net.Socket.prototype.connect = function() { throw new Error(_errMsg); };
_net.connect = function() { throw new Error(_errMsg); };
_net.createConnection = function() { throw new Error(_errMsg); };
_net.createServer = function() { throw new Error(_errMsg); };
const _tls = require('tls');
_tls.connect = function() { throw new Error(_errMsg); };
_tls.createServer = function() { throw new Error(_errMsg); };
const _http = require('http');
const _https = require('https');
_http.request = function() { throw new Error(_errMsg); };
_http.get = function() { throw new Error(_errMsg); };
_https.request = function() { throw new Error(_errMsg); };
_https.get = function() { throw new Error(_errMsg); };
const _dgram = require('dgram');
_dgram.createSocket = function() { throw new Error(_errMsg); };
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
    ${jsCode}
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
        message: `TS runner threw: ${payload.error}`,
        type: "TS_RUNNER_RUNTIME_ERROR",
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
      message: `TS runner failed: ${msg}`,
      type: isTimeout ? "TS_RUNNER_TIMEOUT" : "TS_RUNNER_ERROR",
      nonRetryable: true,
    });
  } finally {
    // Only clean up the tiny script dir — cached node_modules are preserved
    await fs.rm(tmpDir, { recursive: true, force: true }).catch(() => {});
  }
}
