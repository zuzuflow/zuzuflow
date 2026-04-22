#!/usr/bin/env node
// =============================================================================
// release.mjs — bump → build → commit → tag a publishable package, in one go.
//
// Convention this script enforces:
//   - Tag format: `<dir-name>-v<version>` (matches the existing
//     react-sdk-v0.1.0 / nodejs-sdk-v0.1.0 tags).
//   - Commit message: `release(<dir-name>): v<version>` plus an optional body.
//   - Only files inside the target package's directory are staged
//     automatically — unrelated dirty files in the working tree abort the
//     release with a clear message (use --include-all to override).
//
// Usage:
//   pnpm release <package> <bump|version> [flags]
//
//   <package>   react-sdk | nodejs-sdk
//   <bump>      patch | minor | major | prerelease | prepatch | preminor |
//               premajor | <explicit semver, e.g. 0.2.0>
//
//   Flags:
//     -m, --message "txt"   Extra commit body line (e.g. release notes summary)
//     --no-commit           Bump only — don't commit, don't tag
//     --no-tag              Commit but don't create the tag
//     --no-build            Skip the pre-bump build (faster, but riskier)
//     --include-all         Stage all dirty files in the working tree, not just
//                           ones inside the target package's directory
//     --push                After committing + tagging, push the branch + tag
//     --publish             After everything succeeds, run `pnpm publish` for the
//                           target package (requires npm auth)
//     --dry-run             Print every step without modifying anything
//
// Examples:
//   pnpm release react-sdk minor                      # 0.1.0 → 0.2.0, commit + tag
//   pnpm release react-sdk minor -m "drop WorkflowApp; add WorkflowLogs"
//   pnpm release nodejs-sdk patch --push --publish    # full pipeline
//   pnpm release react-sdk 1.0.0 --dry-run            # preview a major
// =============================================================================

import { execSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "..");

// ─── Catalog of releasable packages ──────────────────────────────────────────
// Add new entries here when more packages become publishable. The `dir`
// field becomes the tag prefix (matches the existing tag convention) and
// the `name` field is what `pnpm publish --filter` targets.

const PACKAGES = {
  "react-sdk": {
    dir: "react-sdk",
    name: "@zuzuflow/react-sdk",
    relativePath: "sdk/react-sdk",
  },
  "nodejs-sdk": {
    dir: "nodejs-sdk",
    name: "@zuzuflow/nodejs-sdk",
    relativePath: "sdk/nodejs-sdk",
  },
};

// ─── Tiny ANSI helpers ───────────────────────────────────────────────────────
const c = {
  reset: "\x1b[0m",
  bold: "\x1b[1m",
  dim: "\x1b[2m",
  red: "\x1b[31m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  blue: "\x1b[34m",
  cyan: "\x1b[36m",
};

function log(msg) { console.log(msg); }
function step(msg) { log(`${c.cyan}▶${c.reset} ${msg}`); }
function ok(msg) { log(`${c.green}✓${c.reset} ${msg}`); }
function warn(msg) { log(`${c.yellow}!${c.reset} ${msg}`); }
function die(msg) { log(`${c.red}✗${c.reset} ${msg}`); process.exit(1); }
function dim(msg) { return `${c.dim}${msg}${c.reset}`; }

// ─── Arg parser (no deps) ────────────────────────────────────────────────────
function parseArgs(argv) {
  const positional = [];
  const flags = {
    message: null,
    commit: true,
    tag: true,
    build: true,
    includeAll: false,
    push: false,
    publish: false,
    dryRun: false,
  };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "-m" || a === "--message") flags.message = argv[++i];
    else if (a === "--no-commit") flags.commit = false;
    else if (a === "--no-tag") flags.tag = false;
    else if (a === "--no-build") flags.build = false;
    else if (a === "--include-all") flags.includeAll = true;
    else if (a === "--push") flags.push = true;
    else if (a === "--publish") flags.publish = true;
    else if (a === "--dry-run") flags.dryRun = true;
    else if (a === "-h" || a === "--help") {
      log(USAGE);
      process.exit(0);
    } else if (a.startsWith("-")) {
      die(`unknown flag: ${a}`);
    } else {
      positional.push(a);
    }
  }
  return { positional, flags };
}

const USAGE = `
Usage: pnpm release <package> <bump|version> [flags]

  <package>  ${Object.keys(PACKAGES).join(" | ")}
  <bump>     patch | minor | major | prerelease | prepatch | preminor | premajor
             or an explicit semver (e.g. 1.2.3)

Flags:
  -m, --message "txt"  Extra commit body line
  --no-commit          Bump only
  --no-tag             Commit but don't tag
  --no-build           Skip the pre-bump build
  --include-all        Stage all dirty files, not just files in the package
  --push               git push branch + tag after committing
  --publish            pnpm publish the package after pushing
  --dry-run            Show what would happen without doing it
`;

// ─── Semver bumping (handles patch/minor/major + prerelease + explicit) ──────
function bumpSemver(current, kind) {
  const explicit = /^\d+\.\d+\.\d+(-[\w.-]+)?$/.test(kind);
  if (explicit) return kind;

  const m = current.match(/^(\d+)\.(\d+)\.(\d+)(?:-([\w.]+))?$/);
  if (!m) die(`current version "${current}" is not valid semver`);
  let [, major, minor, patch, pre] = m;
  major = Number(major); minor = Number(minor); patch = Number(patch);

  switch (kind) {
    case "major":  return `${major + 1}.0.0`;
    case "minor":  return `${major}.${minor + 1}.0`;
    case "patch":  return `${major}.${minor}.${patch + 1}`;
    case "premajor":  return `${major + 1}.0.0-0`;
    case "preminor":  return `${major}.${minor + 1}.0-0`;
    case "prepatch":  return `${major}.${minor}.${patch + 1}-0`;
    case "prerelease": {
      if (!pre) return `${major}.${minor}.${patch + 1}-0`;
      // Increment trailing numeric part if present.
      const parts = pre.split(".");
      const last = parts[parts.length - 1];
      if (/^\d+$/.test(last)) parts[parts.length - 1] = String(Number(last) + 1);
      else parts.push("0");
      return `${major}.${minor}.${patch}-${parts.join(".")}`;
    }
    default:
      die(`unknown bump kind "${kind}" (expected patch|minor|major|prerelease|... or an explicit version)`);
  }
}

// ─── Shell helpers ───────────────────────────────────────────────────────────
function sh(cmd, opts = {}) {
  return execSync(cmd, { stdio: "pipe", encoding: "utf8", cwd: REPO_ROOT, ...opts }).trim();
}
function shStream(cmd, opts = {}) {
  execSync(cmd, { stdio: "inherit", cwd: REPO_ROOT, ...opts });
}

function gitDirtyOutside(packageDir) {
  // Returns the list of changed files NOT inside `packageDir`.
  //
  // We deliberately bypass the `sh()` helper here: it `.trim()`s output,
  // which would strip the leading space on lines like ` M file` and shift
  // the filename column by one. Use raw execSync + regex extraction.
  const out = execSync("git status --porcelain", {
    encoding: "utf8",
    cwd: REPO_ROOT,
  });
  if (!out) return [];
  const inside = packageDir.replace(/\\/g, "/").replace(/^\.\//, "") + "/";
  // Porcelain v1: 2-char status + space + path (rename uses ` -> ` separator;
  // we take the destination path).
  const re = /^.{2} (?:.* -> )?(.+)$/;
  return out
    .split("\n")
    .map((line) => {
      const m = line.match(re);
      return m ? m[1].trim() : "";
    })
    .filter((file) => file && !file.startsWith(inside));
}

// ─── Main ────────────────────────────────────────────────────────────────────
async function main() {
  const { positional, flags } = parseArgs(process.argv.slice(2));
  if (positional.length < 2) {
    log(USAGE);
    die("missing arguments");
  }
  const [pkgKey, bumpKind] = positional;
  const pkgInfo = PACKAGES[pkgKey];
  if (!pkgInfo) die(`unknown package "${pkgKey}". Known: ${Object.keys(PACKAGES).join(", ")}`);

  const pkgJsonPath = path.join(REPO_ROOT, pkgInfo.relativePath, "package.json");
  let pkgJsonRaw;
  try {
    pkgJsonRaw = readFileSync(pkgJsonPath, "utf8");
  } catch {
    die(`cannot read ${pkgJsonPath}`);
  }
  const pkgJson = JSON.parse(pkgJsonRaw);
  const currentVersion = pkgJson.version;
  const newVersion = bumpSemver(currentVersion, bumpKind);
  const tagName = `${pkgInfo.dir}-v${newVersion}`;

  log("");
  log(`${c.bold}Release plan${c.reset}`);
  log(`  package:  ${c.cyan}${pkgInfo.name}${c.reset}  ${dim(`(${pkgInfo.relativePath})`)}`);
  log(`  version:  ${currentVersion}  →  ${c.bold}${c.green}${newVersion}${c.reset}`);
  log(`  tag:      ${c.cyan}${tagName}${c.reset}`);
  log(`  commit:   ${flags.commit ? "yes" : "no"}    tag: ${flags.tag ? "yes" : "no"}    build: ${flags.build ? "yes" : "no"}`);
  log(`  push:     ${flags.push ? "yes" : "no"}    publish: ${flags.publish ? "yes" : "no"}    dry-run: ${flags.dryRun ? "yes" : "no"}`);
  log("");

  // Sanity: tag must not already exist.
  const existingTag = sh(`git tag -l ${JSON.stringify(tagName)}`);
  if (existingTag) die(`tag ${tagName} already exists — bump to a higher version`);

  // Sanity: working tree should be clean OUTSIDE the target package dir,
  // unless --include-all is set.
  if (flags.commit && !flags.includeAll) {
    const dirty = gitDirtyOutside(pkgInfo.relativePath);
    if (dirty.length > 0) {
      log(`${c.red}Working tree has changes outside ${pkgInfo.relativePath}:${c.reset}`);
      for (const f of dirty.slice(0, 20)) log(`  ${f}`);
      if (dirty.length > 20) log(`  …and ${dirty.length - 20} more`);
      log("");
      die("commit / stash / discard them first, or rerun with --include-all to release everything together");
    }
  }

  // Build to confirm the package compiles before we bump.
  if (flags.build) {
    step(`Building ${pkgInfo.name}…`);
    if (flags.dryRun) {
      log(dim(`  [dry-run] pnpm --filter ${pkgInfo.name} build`));
    } else {
      try {
        shStream(`pnpm --filter ${JSON.stringify(pkgInfo.name)} build`);
      } catch {
        die("build failed — fix the errors above before releasing");
      }
    }
    ok("build green");
  }

  // Bump package.json — preserve formatting (2-space indent, trailing newline).
  step(`Updating ${path.relative(REPO_ROOT, pkgJsonPath)}…`);
  pkgJson.version = newVersion;
  // Detect indent from raw file (default to 2).
  const indentMatch = pkgJsonRaw.match(/^([ \t]+)"/m);
  const indent = indentMatch ? indentMatch[1] : "  ";
  const trailingNewline = pkgJsonRaw.endsWith("\n");
  const nextRaw = JSON.stringify(pkgJson, null, indent) + (trailingNewline ? "\n" : "");
  if (flags.dryRun) {
    log(dim(`  [dry-run] write package.json with version=${newVersion}`));
  } else {
    writeFileSync(pkgJsonPath, nextRaw, "utf8");
  }
  ok(`version → ${newVersion}`);

  if (!flags.commit) {
    log("");
    log(`${c.green}Done${c.reset} — version bumped (no commit / tag, as requested).`);
    return;
  }

  // Stage files
  step("Staging changes…");
  if (flags.dryRun) {
    log(dim(`  [dry-run] git add ${flags.includeAll ? "-A" : pkgInfo.relativePath}`));
  } else {
    if (flags.includeAll) {
      sh(`git add -A`);
    } else {
      sh(`git add ${JSON.stringify(pkgInfo.relativePath)}`);
    }
  }
  ok(flags.includeAll ? "staged: working tree (-A)" : `staged: ${pkgInfo.relativePath}/**`);

  // Commit
  const subject = `release(${pkgInfo.dir}): v${newVersion}`;
  const bodyLines = [];
  if (flags.message) bodyLines.push(flags.message);
  bodyLines.push(""); // blank line
  bodyLines.push(`Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>`);
  const commitMsg = [subject, "", ...bodyLines].join("\n").replace(/\n{3,}/g, "\n\n");

  step(`Committing…`);
  if (flags.dryRun) {
    log(dim(`  [dry-run] git commit -m "${subject}"`));
  } else {
    // Heredoc-via-stdin to safely handle multi-line messages.
    sh(`git commit -F -`, { input: commitMsg, stdio: ["pipe", "pipe", "inherit"] });
  }
  ok(`committed: ${subject}`);

  // Tag
  if (flags.tag) {
    step(`Creating annotated tag ${tagName}…`);
    if (flags.dryRun) {
      log(dim(`  [dry-run] git tag -a ${tagName} -m "${subject}"`));
    } else {
      sh(`git tag -a ${JSON.stringify(tagName)} -m ${JSON.stringify(subject)}`);
    }
    ok(`tag created`);
  }

  // Push
  if (flags.push) {
    step("Pushing branch + tag…");
    if (flags.dryRun) {
      log(dim(`  [dry-run] git push && git push origin ${tagName}`));
    } else {
      shStream(`git push`);
      if (flags.tag) shStream(`git push origin ${JSON.stringify(tagName)}`);
    }
    ok("pushed");
  }

  // Publish
  if (flags.publish) {
    step(`Publishing ${pkgInfo.name}…`);
    if (flags.dryRun) {
      log(dim(`  [dry-run] pnpm --filter ${pkgInfo.name} publish --access public --no-git-checks`));
    } else {
      shStream(`pnpm --filter ${JSON.stringify(pkgInfo.name)} publish --access public --no-git-checks`);
    }
    ok("published to npm");
  }

  // Summary + next steps
  log("");
  log(`${c.green}${c.bold}✓ Release complete${c.reset}`);
  log(`  ${pkgInfo.name}  v${newVersion}`);
  log(`  tag: ${tagName}`);
  if (!flags.push) {
    log("");
    log(`${c.bold}Next:${c.reset}`);
    log(`  git push && git push origin ${tagName}`);
  }
  if (!flags.publish && !flags.push) {
    log(`  pnpm --filter ${pkgInfo.name} publish --access public`);
  }
  log("");
}

main().catch((err) => {
  log("");
  die(err.message ?? String(err));
});
