import { createHash } from "crypto";
import { execFile as execFileCb } from "child_process";
import { promisify } from "util";
import fs from "fs/promises";
import os from "os";
import path from "path";

const execFile = promisify(execFileCb);

// =============================================================================
// pip_cache — shared Python venv cache for the Python runner activity
//
// Instead of running `pip install` globally on every execution (which is both
// slow and unsafe for concurrency), we maintain isolated venvs keyed by the
// sorted+hashed requirements list.
//
//   Cache layout:
//     ~/.cache/workflow-runner/pip/
//       <hash>/
//         venv/              ← full Python virtual environment
//         .cache-meta.json   ← { requirements, installedAt }
//
//   On cache hit  → return path to venv's site-packages instantly
//   On cache miss → create venv, pip install, cache it, return path
//   TTL           → 24 hours
// =============================================================================

const CACHE_ROOT = path.join(os.homedir(), ".cache", "workflow-runner", "pip");
const TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

// In-flight installs — prevents duplicate concurrent installs for same hash
const inflightInstalls = new Map<string, Promise<PipCacheResult>>();

export interface PipCacheResult {
  /** Path to the venv's python binary (e.g. .../venv/bin/python3) */
  pythonBin: string;
  /** PYTHONPATH pointing to the venv's site-packages */
  pythonPath: string;
}

// ─── Public API ──────────────────────────────────────────────────────────────

/**
 * Resolves pip requirements and returns paths to a cached venv.
 * Uses a content-addressed cache so pip install only runs once per unique
 * requirements set (within the TTL window).
 */
export async function resolveRequirements(
  pythonBin: string,
  requirements: string[],
  timeoutMs: number
): Promise<PipCacheResult> {
  const cleaned = requirements.map((r) => r.trim()).filter(Boolean);
  if (cleaned.length === 0) {
    throw new Error("resolveRequirements called with empty requirements list");
  }

  const hash = hashRequirements(cleaned);
  const cacheDir = path.join(CACHE_ROOT, hash);
  const venvDir = path.join(cacheDir, "venv");
  const metaFile = path.join(cacheDir, ".cache-meta.json");

  // Fast path — cache hit
  if (await isCacheValid(metaFile, cleaned, venvDir)) {
    return buildResult(venvDir);
  }

  // Deduplicate concurrent installs for the same requirements set
  const existing = inflightInstalls.get(hash);
  if (existing) {
    return existing;
  }

  const installPromise = installRequirements(pythonBin, cacheDir, venvDir, metaFile, cleaned, timeoutMs)
    .then(() => buildResult(venvDir))
    .finally(() => {
      inflightInstalls.delete(hash);
    });

  inflightInstalls.set(hash, installPromise);
  return installPromise;
}

/**
 * Evict all cache entries older than the given age (default: 7 days).
 */
export async function evictStalePipCache(maxAgeMs = 7 * 24 * 60 * 60 * 1000): Promise<number> {
  let evicted = 0;
  try {
    const entries = await fs.readdir(CACHE_ROOT);
    for (const entry of entries) {
      const metaFile = path.join(CACHE_ROOT, entry, ".cache-meta.json");
      try {
        const raw = await fs.readFile(metaFile, "utf-8");
        const meta = JSON.parse(raw);
        if (Date.now() - meta.installedAt > maxAgeMs) {
          await fs.rm(path.join(CACHE_ROOT, entry), { recursive: true, force: true });
          evicted++;
        }
      } catch {
        await fs.rm(path.join(CACHE_ROOT, entry), { recursive: true, force: true }).catch(() => {});
        evicted++;
      }
    }
  } catch {
    // Cache root doesn't exist yet
  }
  return evicted;
}

// ─── Internals ───────────────────────────────────────────────────────────────

function hashRequirements(requirements: string[]): string {
  const normalized = [...requirements].sort().join("|");
  return createHash("sha256").update(normalized).digest("hex").substring(0, 16);
}

async function isCacheValid(metaFile: string, requirements: string[], venvDir: string): Promise<boolean> {
  try {
    const raw = await fs.readFile(metaFile, "utf-8");
    const meta = JSON.parse(raw) as { requirements: string[]; installedAt: number };

    // Check TTL
    if (Date.now() - meta.installedAt > TTL_MS) {
      return false;
    }

    // Check that cached requirements match exactly
    const cachedSet = new Set(meta.requirements);
    const requestedSorted = [...requirements].sort();
    if (cachedSet.size !== requestedSorted.length) return false;
    for (const r of requestedSorted) {
      if (!cachedSet.has(r)) return false;
    }

    // Verify venv dir actually exists
    const stat = await fs.stat(venvDir);
    return stat.isDirectory();
  } catch {
    return false;
  }
}

function buildResult(venvDir: string): PipCacheResult {
  const isWindows = process.platform === "win32";
  const binDir = isWindows ? "Scripts" : "bin";
  const pythonName = isWindows ? "python.exe" : "python3";

  return {
    pythonBin: path.join(venvDir, binDir, pythonName),
    pythonPath: venvDir, // venv's site-packages are resolved automatically by the venv python
  };
}

async function installRequirements(
  systemPythonBin: string,
  cacheDir: string,
  venvDir: string,
  metaFile: string,
  requirements: string[],
  timeoutMs: number
): Promise<void> {
  // Ensure cache directory exists
  await fs.mkdir(cacheDir, { recursive: true });

  // Remove stale venv if it exists
  await fs.rm(venvDir, { recursive: true, force: true }).catch(() => {});

  // Create virtual environment
  await execFile(systemPythonBin, ["-m", "venv", venvDir], {
    timeout: Math.min(timeoutMs, 60_000),
  });

  // Determine venv's pip
  const isWindows = process.platform === "win32";
  const binDir = isWindows ? "Scripts" : "bin";
  const pipBin = path.join(venvDir, binDir, "pip");

  // Install requirements into the venv
  await execFile(pipBin, ["install", "--no-input", ...requirements], {
    timeout: Math.min(timeoutMs, 60_000),
  });

  // Write cache metadata
  await fs.writeFile(
    metaFile,
    JSON.stringify({
      requirements: [...requirements].sort(),
      installedAt: Date.now(),
    })
  );
}
