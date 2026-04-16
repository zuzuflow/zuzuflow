// =============================================================================
// typeAcquisition — fetches BUNDLED .d.ts type definitions for npm packages
// so Monaco can provide full IntelliSense, autocomplete, and type checking.
//
// Strategy (per package):
//   1. HEAD request to esm.sh/<pkg> — read the X-TypeScript-Types header
//      to get a URL to a *fully bundled* .d.ts (all transitive types inlined)
//   2. Fetch that bundled .d.ts
//   3. If esm.sh fails, try fetching from unpkg + @types fallback
//   4. Last resort: generate an ambient `declare module` so require() works
//
// Results are cached in-memory for 30 min and deduped in-flight.
// This runs entirely in the browser — no backend involved.
// =============================================================================

export interface TypeDefinition {
  /** Virtual file path for Monaco, e.g. "file:///node_modules/axios/index.d.ts" */
  filePath: string;
  /** The .d.ts content */
  content: string;
}

export type PackageTypeStatus =
  | "loading"
  | "loaded"       // Full types resolved
  | "no-types"     // Package exists but no types available (ambient fallback)
  | "not-found"    // Package doesn't exist on npm
  | "private"      // Git/URL package — types can't be fetched
  | "error";       // Network or other error

export interface PackageTypeResult {
  packageName: string;
  /** Raw input string (e.g. "axios@1.6.0" or "git+https://...") */
  raw: string;
  status: PackageTypeStatus;
  defs: TypeDefinition[];
  /** Human-readable message */
  message: string;
}

interface CacheEntry {
  result: PackageTypeResult;
  fetchedAt: number;
}

const cache = new Map<string, CacheEntry>();
const CACHE_TTL = 30 * 60 * 1000; // 30 minutes
const inflight = new Map<string, Promise<PackageTypeResult>>();

// ─── Public API ──────────────────────────────────────────────────────────────

/**
 * Acquire type definitions for a single npm package with detailed status.
 */
export async function acquireTypeForPackage(raw: string): Promise<PackageTypeResult> {
  const trimmed = raw.trim();
  if (!trimmed) {
    return { packageName: "", raw, status: "error", defs: [], message: "" };
  }

  // Detect git/URL packages
  if (isPrivatePackage(trimmed)) {
    const name = extractNameFromUrl(trimmed);
    return {
      packageName: name,
      raw,
      status: "private",
      defs: [makeAmbientFallback(name)],
      message: "Private package — types unavailable, will work at runtime",
    };
  }

  const packageName = parsePackageName(trimmed);
  if (!packageName) {
    return { packageName: trimmed, raw, status: "error", defs: [], message: "Invalid package name" };
  }

  // Check cache
  const cached = cache.get(packageName);
  if (cached && Date.now() - cached.fetchedAt < CACHE_TTL) {
    return cached.result;
  }

  // Dedup in-flight
  const existing = inflight.get(packageName);
  if (existing) return existing;

  const promise = doFetchTypes(packageName, raw);
  inflight.set(packageName, promise);

  try {
    const result = await promise;
    cache.set(packageName, { result, fetchedAt: Date.now() });
    return result;
  } finally {
    inflight.delete(packageName);
  }
}

/**
 * Acquire types for multiple packages. Returns per-package results.
 */
export async function acquireTypesWithStatus(packages: string[]): Promise<PackageTypeResult[]> {
  const cleaned = packages.filter((p) => p.trim());
  return Promise.all(cleaned.map(acquireTypeForPackage));
}

/**
 * Clear the type cache.
 */
export function clearTypeCache(): void {
  cache.clear();
}

// ─── Workflow runtime types ──────────────────────────────────────────────────

export const WORKFLOW_RUNTIME_TYPES: TypeDefinition = {
  filePath: "file:///node_modules/@workflow/runtime/index.d.ts",
  content: `
declare interface WorkflowContext {
  workflowId: string;
  executionId: string;
  triggerPayload: Record<string, unknown>;
}

/**
 * Outputs from previously executed nodes, keyed by node ID.
 * Each value is the result returned by that node.
 */
declare const input: Record<string, any>;

/**
 * Workflow execution context with metadata.
 */
declare const context: WorkflowContext;

/**
 * Define this function as your entry point.
 * @param input - Outputs from previously executed nodes, keyed by node ID
 * @param context - Workflow execution metadata
 * @returns Your node's output value
 */
declare function main(input: Record<string, any>, context: WorkflowContext): any;
`,
};

// ─── Private / Git package detection ─────────────────────────────────────────

const PRIVATE_PATTERNS = [
  /^git\+/i,                  // git+https://... git+ssh://...
  /^git:\/\//i,               // git://...
  /^https?:\/\//i,            // https://github.com/user/repo
  /^ssh:\/\//i,               // ssh://...
  /^github:/i,                // github:user/repo
  /^bitbucket:/i,             // bitbucket:user/repo
  /^gitlab:/i,                // gitlab:user/repo
  /\.git$/i,                  // anything ending in .git
  /^file:/i,                  // file:../local-pkg
  /\.tgz$/i,                  // tarball
];

function isPrivatePackage(raw: string): boolean {
  return PRIVATE_PATTERNS.some((p) => p.test(raw));
}

function extractNameFromUrl(raw: string): string {
  // Try to extract a reasonable name from the URL
  // e.g. "git+https://github.com/user/my-lib.git" → "my-lib"
  const cleaned = raw
    .replace(/^git\+/, "")
    .replace(/\.git$/, "")
    .replace(/^(https?|ssh|git|file):\/\//, "");
  const parts = cleaned.split("/");
  const last = parts[parts.length - 1] || "unknown-package";
  // Remove version/hash suffixes
  return last.replace(/#.*$/, "").replace(/@.*$/, "") || "unknown-package";
}

// ─── Internals ───────────────────────────────────────────────────────────────

/** Extract package name without version specifier: "axios@1.6.0" → "axios" */
function parsePackageName(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;

  // Handle scoped packages: @scope/pkg@version
  if (trimmed.startsWith("@")) {
    const withoutLeading = trimmed.slice(1);
    const slashIdx = withoutLeading.indexOf("/");
    if (slashIdx === -1) return null;
    const afterSlash = withoutLeading.slice(slashIdx + 1);
    const atIdx = afterSlash.indexOf("@");
    if (atIdx > 0) {
      return "@" + withoutLeading.slice(0, slashIdx + 1 + atIdx);
    }
    return trimmed;
  }

  // Regular packages: pkg@version
  const atIdx = trimmed.indexOf("@");
  if (atIdx > 0) return trimmed.slice(0, atIdx);
  return trimmed;
}

async function doFetchTypes(packageName: string, raw: string): Promise<PackageTypeResult> {
  // ── Strategy 1: esm.sh bundled types
  const esmResult = await tryEsmSh(packageName);
  if (esmResult) {
    return {
      packageName,
      raw,
      status: "loaded",
      defs: [esmResult],
      message: "Types loaded",
    };
  }

  // ── Strategy 2: unpkg — package's own types field
  const unpkgResult = await tryUnpkgDirect(packageName);
  if (unpkgResult) {
    return {
      packageName,
      raw,
      status: "loaded",
      defs: [unpkgResult],
      message: "Types loaded",
    };
  }

  // ── Strategy 3: unpkg — @types/<package>
  const dtPkg = toDefinitelyTypedName(packageName);
  const dtResult = await tryUnpkgDirect(dtPkg);
  if (dtResult) {
    return {
      packageName,
      raw,
      status: "loaded",
      defs: [{ ...dtResult, filePath: moduleFilePath(packageName) }],
      message: "Types loaded via @types",
    };
  }

  // ── Check if the package even exists
  const exists = await checkPackageExists(packageName);
  if (!exists) {
    return {
      packageName,
      raw,
      status: "not-found",
      defs: [],
      message: `Package "${packageName}" not found on npm`,
    };
  }

  // ── Package exists but no types
  return {
    packageName,
    raw,
    status: "no-types",
    defs: [makeAmbientFallback(packageName)],
    message: "No types available — IntelliSense limited",
  };
}

// ─── Strategy 1: esm.sh ─────────────────────────────────────────────────────

async function tryEsmSh(packageName: string): Promise<TypeDefinition | null> {
  try {
    const headRes = await fetchWithTimeout(`https://esm.sh/${packageName}`, 6000, "HEAD");
    if (!headRes.ok) return null;

    const typesUrl = headRes.headers.get("X-TypeScript-Types");
    if (!typesUrl) return null;

    const fullUrl = typesUrl.startsWith("http")
      ? typesUrl
      : `https://esm.sh${typesUrl}`;

    const dtsRes = await fetchWithTimeout(fullUrl, 8000);
    if (!dtsRes.ok) return null;

    let content = await dtsRes.text();
    content = content.replace(/\/\/\/\s*<reference\s+path="[^"]*"\s*\/>/g, "");

    if (content.length < 50) return null;

    return {
      filePath: moduleFilePath(packageName),
      content: ensureModuleDeclaration(packageName, content),
    };
  } catch {
    return null;
  }
}

// ─── Strategy 2: unpkg direct ────────────────────────────────────────────────

async function tryUnpkgDirect(packageName: string): Promise<TypeDefinition | null> {
  try {
    const pkgRes = await fetchWithTimeout(
      `https://unpkg.com/${packageName}/package.json`,
      5000
    );
    if (!pkgRes.ok) return null;

    const pkgJson = await pkgRes.json();
    const typesField = pkgJson.types || pkgJson.typings;

    if (typesField) {
      const typesUrl = `https://unpkg.com/${packageName}/${typesField}`;
      const typesRes = await fetchWithTimeout(typesUrl, 5000);
      if (typesRes.ok) {
        const content = await typesRes.text();
        if (looksLikeDts(content)) {
          return {
            filePath: moduleFilePath(packageName),
            content: ensureModuleDeclaration(packageName, content),
          };
        }
      }
    }
  } catch {
    // skip
  }
  return null;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

async function checkPackageExists(packageName: string): Promise<boolean> {
  try {
    const res = await fetchWithTimeout(
      `https://registry.npmjs.org/${packageName}`,
      5000,
      "HEAD"
    );
    return res.ok;
  } catch {
    return true; // Assume exists if we can't check (offline, etc.)
  }
}

function moduleFilePath(packageName: string): string {
  return `file:///node_modules/${packageName}/index.d.ts`;
}

function toDefinitelyTypedName(packageName: string): string {
  if (packageName.startsWith("@")) {
    const withoutAt = packageName.slice(1);
    return `@types/${withoutAt.replace("/", "__")}`;
  }
  return `@types/${packageName}`;
}

function makeAmbientFallback(packageName: string): TypeDefinition {
  return {
    filePath: moduleFilePath(packageName),
    content: `declare module "${packageName}" {\n  const _default: any;\n  export default _default;\n  export = _default;\n}\n`,
  };
}

function ensureModuleDeclaration(packageName: string, content: string): string {
  if (content.includes(`declare module "${packageName}"`)) return content;
  if (content.includes(`declare module '${packageName}'`)) return content;
  return `declare module "${packageName}" {\n${content}\n}\n`;
}

function looksLikeDts(content: string): boolean {
  return (
    content.includes("declare") ||
    content.includes("export") ||
    content.includes("interface") ||
    content.includes("type ")
  );
}

async function fetchWithTimeout(
  url: string,
  timeoutMs: number,
  method: "GET" | "HEAD" = "GET"
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { signal: controller.signal, method });
  } finally {
    clearTimeout(timer);
  }
}
