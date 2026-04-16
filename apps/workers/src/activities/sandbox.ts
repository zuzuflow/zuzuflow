import { getIvm } from "./ivm-loader";
import * as esbuild from "esbuild";
import { ApplicationFailure } from "@temporalio/activity";
import { execFile as execFileCb } from "child_process";
import { promisify } from "util";
import fs from "fs/promises";
import os from "os";
import path from "path";
import type { CustomCodeConfig } from "@workflow/shared";
import { safeEnvForSandbox } from "./sandbox-env";

const execFile = promisify(execFileCb);

export interface SandboxActivityInput {
  config: CustomCodeConfig;
  context: Record<string, unknown>;
}

export interface SandboxActivityOutput {
  result: unknown;
  logs: string[];
}

export async function runCustomCodeActivity(
  input: SandboxActivityInput
): Promise<SandboxActivityOutput> {
  const { config: cfg, context } = input;
  const timeoutMs = cfg.timeoutMs ?? 10_000;
  const memoryMb = cfg.memoryMb ?? 128;

  // If isolated-vm isn't available, fall back to child-process sandbox
  const ivm = getIvm();
  if (!ivm) {
    return runCustomCodeChildProcess(cfg, context, timeoutMs);
  }

  // Step 1: Transpile TypeScript → CommonJS JS with auto-runner appended.
  // The auto-runner calls run(input) if the user defined it, and routes the
  // return value through setResult() so we can capture it across the isolate
  // boundary.
  let jsCode: string;
  try {
    const transpiled = esbuild.transformSync(cfg.code, {
      loader: "ts",
      format: "cjs",
      target: "es2020",
      minify: false,
    });
    jsCode =
      transpiled.code +
      `\n;(function(){
  if (typeof run === "function") {
    Promise.resolve(run(global.input))
      .then(function(v){ setResult(v); })
      .catch(function(e){ setResult({ __error: e && e.message ? e.message : String(e) }); });
  }
})();`;
  } catch (err) {
    throw ApplicationFailure.create({
      message: `Custom code transpilation failed: ${(err as Error).message}`,
      type: "SANDBOX_TRANSPILE_ERROR",
      nonRetryable: true,
    });
  }

  // Step 2: Create isolate + context (isolated-vm v6 API)
  const isolate = new ivm.Isolate({ memoryLimit: memoryMb });
  const vmContext = await isolate.createContext();
  const jail = vmContext.global;

  const capturedLogs: string[] = [];
  let capturedResult: unknown = undefined;

  try {
    await jail.set("global", jail.derefInto());

    // console shim — v6: set Reference directly on the jail, access via global
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

    // Inject node outputs as `input` global
    await vmContext.eval(`global.input = ${JSON.stringify(context)}`);

    // setResult callback — called by the auto-runner when run() resolves
    const resultRef = new ivm.Reference((jsonStr: string) => {
      try {
        capturedResult = JSON.parse(jsonStr);
      } catch {
        capturedResult = jsonStr;
      }
    });
    await jail.set("_setResult", resultRef);
    await vmContext.eval(
      `global.setResult = (v) => _setResult.applySync(undefined, [JSON.stringify(v)])`
    );

    // Step 3: Compile and run user code + auto-runner
    const script = await isolate.compileScript(jsCode);
    await script.run(vmContext, { timeout: timeoutMs });

    // Wait one event-loop tick for the Promise micro-tasks inside the isolate
    // to flush and call setResult before we read the result.
    await new Promise<void>((r) => setTimeout(r, 50));

    return { result: capturedResult ?? null, logs: capturedLogs };
  } catch (err) {
    const msg = (err as Error).message ?? String(err);
    const isTimeout =
      msg.toLowerCase().includes("timed out") ||
      msg.toLowerCase().includes("timeout");
    throw ApplicationFailure.create({
      message: `Custom code execution failed: ${msg}`,
      type: isTimeout ? "SANDBOX_TIMEOUT" : "SANDBOX_RUNTIME_ERROR",
      nonRetryable: true,
      details: [{ logs: capturedLogs }],
    });
  } finally {
    isolate.dispose();
  }
}

// =============================================================================
// Child-process fallback — used when isolated-vm is not available
// =============================================================================
async function runCustomCodeChildProcess(
  cfg: CustomCodeConfig,
  context: Record<string, unknown>,
  timeoutMs: number
): Promise<SandboxActivityOutput> {
  let jsCode: string;
  try {
    const transpiled = esbuild.transformSync(cfg.code, {
      loader: "ts",
      format: "cjs",
      target: "es2020",
      minify: false,
    });
    jsCode = transpiled.code;
  } catch (err) {
    throw ApplicationFailure.create({
      message: `Custom code transpilation failed: ${(err as Error).message}`,
      type: "SANDBOX_TRANSPILE_ERROR",
      nonRetryable: true,
    });
  }

  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "wf-sandbox-"));
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

const input = JSON.parse(process.env.SANDBOX_CONTEXT);
const __logs = [];
const _origLog = console.log;
console.log = (...a) => __logs.push(a.map(String).join(' '));
console.warn = (...a) => __logs.push('[warn] ' + a.map(String).join(' '));
console.error = (...a) => __logs.push('[error] ' + a.map(String).join(' '));

(async () => {
  try {
    ${jsCode}
    let _result = null;
    if (typeof run === 'function') {
      _result = await Promise.resolve(run(input));
    }
    _origLog(JSON.stringify({ ok: true, result: _result, logs: __logs }));
  } catch (e) {
    _origLog(JSON.stringify({ ok: false, error: e.message || String(e), logs: __logs }));
  }
})();
`;
    await fs.writeFile(path.join(tmpDir, "runner.js"), script);

    const { stdout } = await execFile(
      "node",
      ["--experimental-permission", `--allow-fs-read=${tmpDir}`, "--max-old-space-size=128", "runner.js"],
      {
        cwd: tmpDir,
        timeout: timeoutMs,
        env: safeEnvForSandbox({ SANDBOX_CONTEXT: JSON.stringify(context) }),
      }
    );

    const lines = stdout.trim().split("\n");
    const lastLine = lines[lines.length - 1];
    const payload = JSON.parse(lastLine) as { ok: boolean; result?: unknown; error?: string; logs: string[] };

    if (!payload.ok) {
      throw ApplicationFailure.create({
        message: `Custom code execution failed: ${payload.error}`,
        type: "SANDBOX_RUNTIME_ERROR",
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
      message: `Custom code execution failed: ${msg}`,
      type: isTimeout ? "SANDBOX_TIMEOUT" : "SANDBOX_RUNTIME_ERROR",
      nonRetryable: true,
    });
  } finally {
    await fs.rm(tmpDir, { recursive: true, force: true }).catch(() => {});
  }
}
