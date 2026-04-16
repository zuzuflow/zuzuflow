import { promisify } from "util";
import { execFile as execFileCb } from "child_process";
import * as fs from "fs/promises";
import * as os from "os";
import * as path from "path";
import { ApplicationFailure } from "@temporalio/activity";
import { resolveRequirements } from "./pip_cache";

// =============================================================================
// pythonRunnerActivity — executes user Python code in a child process
//
// User writes arbitrary Python. The `input` variable is pre-populated from
// nodeOutputs. If the user sets a `result` variable, it is serialised as
// JSON and returned to the workflow engine.
//
// When requirements are specified, a cached virtual environment is used so
// pip install only runs once per unique dependency set (24h TTL).
// =============================================================================

const execFile = promisify(execFileCb);

export interface PythonRunnerConfig {
  code: string;
  timeoutMs?: number;
  requirements?: string[];
}

export interface PythonRunnerActivityInput {
  config: PythonRunnerConfig;
  nodeOutputs: Record<string, unknown>;
}

export interface PythonRunnerActivityOutput {
  result: unknown;
  logs: string[];
}

export async function pythonRunnerActivity(
  input: PythonRunnerActivityInput
): Promise<PythonRunnerActivityOutput> {
  const { config: cfg, nodeOutputs } = input;
  const timeoutMs = cfg.timeoutMs ?? 10_000;

  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "py-runner-"));
  const scriptPath = path.join(tmpDir, "script.py");

  // Wrapper that injects `input` from env, execs user code, then emits result
  const wrapper = `
import json, sys, os

# Provide node outputs as the 'input' variable
input = json.loads(os.environ.get("WORKFLOW_CONTEXT", "{}"))

# --- user code ---
${cfg.code}
# --- end user code ---

# If user set a 'result' variable, emit it as JSON
if "result" in dir():
    print(json.dumps(result))
else:
    print(json.dumps(None))
`;

  try {
    await fs.writeFile(scriptPath, wrapper, "utf-8");

    // Resolve python executable
    const systemPython = await resolvePython();

    // Determine which python binary to use for execution
    let execPython = systemPython;

    if (cfg.requirements && cfg.requirements.length > 0) {
      // Use cached venv with requirements pre-installed
      const cached = await resolveRequirements(systemPython, cfg.requirements, timeoutMs);
      execPython = cached.pythonBin;
    }

    // Execute the script
    const { stdout, stderr } = await execFile(execPython, [scriptPath], {
      timeout: timeoutMs,
      env: {
        ...process.env,
        WORKFLOW_CONTEXT: JSON.stringify(nodeOutputs),
      },
      maxBuffer: 10 * 1024 * 1024, // 10 MB
    });

    // Last non-empty stdout line is the JSON result emitted by the wrapper.
    // Everything before it is user `print(...)` output — promote to logs so
    // they're searchable from the global Logs page.
    const stdoutLines = stdout.split("\n").filter((l) => l.trim().length > 0);
    const lastLine = stdoutLines[stdoutLines.length - 1] ?? "null";
    const stdoutLogLines = stdoutLines.slice(0, -1);

    const stderrLines = stderr
      ? stderr.split("\n").filter((l) => l.trim().length > 0)
      : [];

    const logs = [...stdoutLogLines, ...stderrLines];

    let result: unknown;
    try {
      result = JSON.parse(lastLine);
    } catch {
      result = lastLine;
    }

    return { result, logs };
  } catch (err) {
    if (err instanceof ApplicationFailure) throw err;
    const msg = (err as Error).message ?? String(err);
    const isTimeout =
      msg.toLowerCase().includes("timed out") ||
      msg.toLowerCase().includes("timeout") ||
      (err as any).killed === true;
    throw ApplicationFailure.create({
      message: `Python runner failed: ${msg}`,
      type: isTimeout ? "PYTHON_RUNNER_TIMEOUT" : "PYTHON_RUNNER_ERROR",
      nonRetryable: true,
    });
  } finally {
    // Only clean up the tiny script dir — cached venvs are preserved
    await fs.rm(tmpDir, { recursive: true, force: true }).catch(() => {});
  }
}

/** Try python3 first, fall back to python */
async function resolvePython(): Promise<string> {
  try {
    await execFile("python3", ["--version"]);
    return "python3";
  } catch {
    try {
      await execFile("python", ["--version"]);
      return "python";
    } catch {
      throw ApplicationFailure.create({
        message: "Python runner: neither python3 nor python found on PATH",
        type: "PYTHON_RUNNER_NOT_FOUND",
        nonRetryable: true,
      });
    }
  }
}
