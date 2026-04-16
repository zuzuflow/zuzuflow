import { createHash } from "crypto";
import { execFile as execFileCb } from "child_process";
import { promisify } from "util";
import fs from "fs/promises";
import os from "os";
import path from "path";

const execFile = promisify(execFileCb);

// =============================================================================
// pkg_cache — shared npm package cache for JS/TS runner activities
//
// Instead of running `npm install` on every workflow execution, we maintain a
// persistent cache keyed by the sorted+hashed dependency list.
//
//   Cache layout:
//     ~/.cache/workflow-runner/npm/
//       <hash>/
//         package.json
//         node_modules/
//         .cache-meta.json   ← { packages, installedAt }
//
//   On cache hit  → return path to node_modules instantly (< 1ms)
//   On cache miss → run npm install once, cache it, return path
//   TTL           → 24 hours (re-installs to pick up patch versions)
// =============================================================================

const CACHE_ROOT = path.join(os.homedir(), ".cache", "workflow-runner", "npm");
const TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

// In-flight installs — prevents duplicate concurrent installs for same hash
const inflightInstalls = new Map<string, Promise<string>>();

// ─── Public API ──────────────────────────────────────────────────────────────

/**
 * Resolves npm packages and returns the path to a ready `node_modules` dir.
 * Uses a content-addressed cache so npm install only runs once per unique
 * dependency set (within the TTL window).
 */
export async function resolvePackages(
  packages: string[],
  timeoutMs: number
): Promise<string> {
  const cleaned = packages.map((p) => p.trim()).filter(Boolean);
  if (cleaned.length === 0) {
    throw new Error("resolvePackages called with empty package list");
  }

  const hash = hashPackages(cleaned);
  const cacheDir = path.join(CACHE_ROOT, hash);
  const nodeModulesDir = path.join(cacheDir, "node_modules");
  const metaFile = path.join(cacheDir, ".cache-meta.json");

  // Fast path — cache hit
  if (await isCacheValid(metaFile, cleaned)) {
    return nodeModulesDir;
  }

  // Deduplicate concurrent installs for the same package set
  const existing = inflightInstalls.get(hash);
  if (existing) {
    return existing;
  }

  const installPromise = installPackages(cacheDir, metaFile, cleaned, timeoutMs)
    .then(() => nodeModulesDir)
    .finally(() => {
      inflightInstalls.delete(hash);
    });

  inflightInstalls.set(hash, installPromise);
  return installPromise;
}

/**
 * Evict all cache entries older than the given age (default: 7 days).
 * Call this periodically from a maintenance task if desired.
 */
export async function evictStaleCache(maxAgeMs = 7 * 24 * 60 * 60 * 1000): Promise<number> {
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
        // Corrupted entry — remove it
        await fs.rm(path.join(CACHE_ROOT, entry), { recursive: true, force: true }).catch(() => {});
        evicted++;
      }
    }
  } catch {
    // Cache root doesn't exist yet — nothing to evict
  }
  return evicted;
}

/**
 * Extract .d.ts type definitions from an installed package in the cache.
 * Used to auto-extract types from git/private packages after first install.
 * Returns the .d.ts content string, or null if no types found.
 */
export async function extractTypesFromCache(
  packages: string[],
  targetPackage: string
): Promise<string | null> {
  const cleaned = packages.map((p) => p.trim()).filter(Boolean);
  const hash = hashPackages(cleaned);
  const nodeModulesDir = path.join(CACHE_ROOT, hash, "node_modules");

  // Resolve the package directory name from a git URL or package spec
  const pkgDir = await findPackageDir(nodeModulesDir, targetPackage);
  if (!pkgDir) return null;

  try {
    // Read package.json to find the types entry point
    const pkgJsonPath = path.join(pkgDir, "package.json");
    const pkgJsonRaw = await fs.readFile(pkgJsonPath, "utf-8");
    const pkgJson = JSON.parse(pkgJsonRaw);
    const typesField = pkgJson.types || pkgJson.typings;

    if (typesField) {
      const typesPath = path.join(pkgDir, typesField);
      try {
        return await fs.readFile(typesPath, "utf-8");
      } catch {
        // types field exists but file doesn't
      }
    }

    // Fallback: try common locations
    for (const candidate of ["index.d.ts", "dist/index.d.ts", "lib/index.d.ts"]) {
      try {
        const content = await fs.readFile(path.join(pkgDir, candidate), "utf-8");
        if (content.includes("export") || content.includes("declare")) {
          return content;
        }
      } catch {
        // not found, try next
      }
    }

    return null;
  } catch {
    return null;
  }
}

/** Find the actual directory for a package (handles git URLs → package name resolution) */
async function findPackageDir(
  nodeModulesDir: string,
  targetPackage: string
): Promise<string | null> {
  // For git URLs, npm installs under the repo name or package.json name
  // Try common patterns
  const candidates: string[] = [];

  // Direct name (for normal packages)
  candidates.push(path.join(nodeModulesDir, targetPackage));

  // Extract name from git URL: git+https://github.com/user/my-lib.git → my-lib
  const gitMatch = targetPackage.match(/\/([^/]+?)(?:\.git)?(?:#.*)?$/);
  if (gitMatch) {
    candidates.push(path.join(nodeModulesDir, gitMatch[1]));
  }

  // Scoped package from git: might be under @scope/name
  // Scan top-level dirs for a match
  try {
    const entries = await fs.readdir(nodeModulesDir);
    for (const entry of entries) {
      if (entry.startsWith(".") || entry.startsWith("@")) continue;
      const pkgJsonPath = path.join(nodeModulesDir, entry, "package.json");
      try {
        const raw = await fs.readFile(pkgJsonPath, "utf-8");
        const pkg = JSON.parse(raw);
        // Check if _resolved or _from matches the target
        if (
          pkg._resolved?.includes(targetPackage) ||
          pkg._from?.includes(targetPackage)
        ) {
          candidates.unshift(path.join(nodeModulesDir, entry));
        }
      } catch {
        // skip
      }
    }
  } catch {
    // nodeModulesDir doesn't exist
  }

  for (const dir of candidates) {
    try {
      const stat = await fs.stat(dir);
      if (stat.isDirectory()) return dir;
    } catch {
      // not found
    }
  }

  return null;
}

// ─── Internals ───────────────────────────────────────────────────────────────

function hashPackages(packages: string[]): string {
  const normalized = [...packages].sort().join("|");
  return createHash("sha256").update(normalized).digest("hex").substring(0, 16);
}

async function isCacheValid(metaFile: string, packages: string[]): Promise<boolean> {
  try {
    const raw = await fs.readFile(metaFile, "utf-8");
    const meta = JSON.parse(raw) as { packages: string[]; installedAt: number };

    // Check TTL
    if (Date.now() - meta.installedAt > TTL_MS) {
      return false;
    }

    // Check that the cached packages match exactly
    const cachedSet = new Set(meta.packages);
    const requestedSorted = [...packages].sort();
    if (cachedSet.size !== requestedSorted.length) return false;
    for (const p of requestedSorted) {
      if (!cachedSet.has(p)) return false;
    }

    // Verify node_modules dir actually exists
    const nodeModulesDir = path.join(path.dirname(metaFile), "node_modules");
    const stat = await fs.stat(nodeModulesDir);
    return stat.isDirectory();
  } catch {
    return false;
  }
}

async function installPackages(
  cacheDir: string,
  metaFile: string,
  packages: string[],
  timeoutMs: number
): Promise<void> {
  // Ensure cache directory exists
  await fs.mkdir(cacheDir, { recursive: true });

  // Write package.json
  const pkgJson = {
    name: "wf-pkg-cache",
    version: "1.0.0",
    private: true,
  };
  await fs.writeFile(path.join(cacheDir, "package.json"), JSON.stringify(pkgJson));

  // Run npm install
  await execFile("npm", ["install", "--no-audit", "--no-fund", ...packages], {
    cwd: cacheDir,
    timeout: Math.min(timeoutMs, 60_000),
  });

  // Write cache metadata
  await fs.writeFile(
    metaFile,
    JSON.stringify({
      packages: [...packages].sort(),
      installedAt: Date.now(),
    })
  );
}
