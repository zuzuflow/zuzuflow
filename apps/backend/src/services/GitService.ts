import fs from "fs";
import path from "path";
import { simpleGit } from "simple-git";
import { prisma } from "../db/client";
import { logger } from "../logger";
import { settingService } from "./SettingService";
import { generateWorkflowKey } from "./WorkflowService";

// =============================================================================
// GitService — push/pull workflow definitions to/from a remote git repository
//
// Layout in the repo:
//   workflows/
//     <folder-path>/
//       <workflow-name>.json       (WorkflowTemplate JSON)
//
// Root-level workflows go directly under workflows/.
// Folder hierarchy is reflected as directories.
// =============================================================================

export type GitProvider = "github" | "bitbucket" | "gitlab" | "custom";

export interface GitConfig {
  provider: GitProvider;
  repoUrl: string;   // Base HTTPS URL without embedded credentials
  branch: string;
  username?: string; // Required for Bitbucket basic auth
  token: string;     // PAT / app password / OAuth token

  /** Push to git automatically after any workflow create/update/delete. */
  autoPush?: boolean;
  /** Pull from git on a periodic interval (see AUTO_PULL_INTERVAL_MS). */
  autoPull?: boolean;
}

export interface GitStatus {
  configured: boolean;
  lastPush?: string;
  lastPull?: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function repoDir(): string {
  return process.env.GIT_REPO_DIR ?? path.join(process.cwd(), ".git-data");
}

/** Embed credentials into the remote URL. */
function buildAuthUrl(cfg: GitConfig): string {
  const url = new URL(cfg.repoUrl.endsWith(".git") ? cfg.repoUrl : cfg.repoUrl + ".git");
  switch (cfg.provider) {
    case "github":
    case "gitlab":
      // GitHub: https://<token>@github.com/...
      // GitLab: https://oauth2:<token>@gitlab.com/...
      url.username = cfg.provider === "gitlab" ? "oauth2" : cfg.token;
      url.password = cfg.provider === "gitlab" ? cfg.token : "";
      break;
    case "bitbucket":
      // Bitbucket: https://<username>:<app-password>@bitbucket.org/...
      url.username = cfg.username ?? "";
      url.password = cfg.token;
      break;
    case "custom":
      // Expect the repoUrl to already contain credentials, or token is a full URL
      if (cfg.token.startsWith("http")) return cfg.token;
      url.username = cfg.username ?? "git";
      url.password = cfg.token;
      break;
  }
  return url.toString();
}

/** Sanitise a name for use as a file/directory name. */
function safeName(name: string): string {
  return name.replace(/[^a-zA-Z0-9_\-. ]/g, "_").trim() || "untitled";
}

/** Recursively ensure a directory exists. */
function mkdirp(dir: string) {
  fs.mkdirSync(dir, { recursive: true });
}

// ─── Build folder path map ────────────────────────────────────────────────────

async function buildFolderPaths(): Promise<Map<string, string>> {
  const folders = await prisma.folder.findMany();
  const nameMap = new Map(folders.map((f) => [f.id, { name: f.name, parentId: f.parentId }]));

  function resolvePath(id: string): string {
    const f = nameMap.get(id);
    if (!f) return "unknown";
    if (!f.parentId) return safeName(f.name);
    return resolvePath(f.parentId) + "/" + safeName(f.name);
  }

  const result = new Map<string, string>();
  for (const f of folders) {
    result.set(f.id, resolvePath(f.id));
  }
  return result;
}

// =============================================================================
// Service class
// =============================================================================

export class GitService {
  /** Read git config from settings. */
  async getConfig(): Promise<GitConfig | null> {
    return (await settingService.get("git")) as GitConfig | null;
  }

  /** Save git config. */
  async saveConfig(cfg: GitConfig): Promise<void> {
    await settingService.set("git", cfg);
  }

  /**
   * Verify that the credentials can reach the remote AND actually push.
   *
   * Strategy:
   *   1. `git ls-remote` — cheap reachability + read check.
   *   2. `git push --dry-run` into an isolated scratch repo — this triggers
   *      the SAME server-side permission check as a real push (including
   *      token scopes, SSO authorization, branch protection) but uploads no
   *      objects. Only a successful dry-run proves write access.
   *
   * Provider-API heuristics were removed because `permissions.push` from
   * GitHub's /repos endpoint reflects the USER's permission, not the
   * TOKEN's. A fine-grained PAT without `Contents: Write` would pass the
   * API check but fail the real push. The dry-run is the only authoritative
   * signal.
   */
  async verifyAccess(cfg: GitConfig): Promise<{ ok: true; writeConfirmed: boolean; message: string }> {
    const authUrl = buildAuthUrl(cfg);

    // 1. Reachability + read
    try {
      const readGit = simpleGit();
      await readGit.listRemote([authUrl]);
    } catch (err) {
      const msg = (err as Error).message || "";
      if (/Authentication failed|401|Invalid username or password|could not read Username/i.test(msg)) {
        throw Object.assign(new Error("Authentication failed — token is invalid, expired, or not authorized (SSO?)"), {
          code: "AUTH_FAILED",
        });
      }
      if (/Repository not found|404|does not exist/i.test(msg)) {
        throw Object.assign(new Error("Repository not found — check the URL and that the token has access to it"), {
          code: "REPO_NOT_FOUND",
        });
      }
      throw Object.assign(new Error(`Could not reach remote: ${msg.split("\n")[0]}`), { code: "CONNECT_FAILED" });
    }

    // 2. Real write check — dry-run push from a scratch repo
    const verifyDir = path.join(repoDir(), ".verify-" + Date.now());
    try {
      mkdirp(verifyDir);
      const git = simpleGit(verifyDir);
      await git.init();
      await git.addConfig("user.name", "ZuzuFlow Verify");
      await git.addConfig("user.email", "verify@zuzuflow.com");
      // Empty commit so we have something to push as a ref
      await git.raw(["commit", "--allow-empty", "--no-gpg-sign", "-m", "verify-access"]);
      // Dry-run push to a nonsensical ref so even on success we don't
      // actually create anything on the remote. The server still runs
      // permission checks on it.
      await git.push([
        "--dry-run",
        "--force",
        authUrl,
        `HEAD:refs/heads/__zuzuflow_verify__`,
      ]);
    } catch (err) {
      const msg = (err as Error).message || "";
      if (/403|permission denied|not granted|forbidden|remote rejected/i.test(msg)) {
        throw Object.assign(
          new Error(
            "Token can read but cannot push. For GitHub: grant 'Contents: Read and write' on a fine-grained PAT (or the classic `repo` scope), and authorize SSO for the org if required.",
          ),
          { code: "NO_WRITE_ACCESS" },
        );
      }
      // Any other dry-run failure is unexpected — surface the first line
      throw Object.assign(
        new Error(`Write-access check failed: ${msg.split("\n")[0]}`),
        { code: "VERIFY_FAILED" },
      );
    } finally {
      // Always clean up the scratch dir, even on failure
      try { fs.rmSync(verifyDir, { recursive: true, force: true }); } catch { /* best-effort */ }
    }

    return { ok: true, writeConfirmed: true, message: "Verified — token can push to this repository" };
  }

  /** Current sync status (last push/pull timestamps). */
  async getStatus(): Promise<GitStatus> {
    const cfg = await this.getConfig();
    const meta = (await settingService.get("git.meta")) as { lastPush?: string; lastPull?: string } | null;
    return {
      configured: !!cfg?.repoUrl && !!cfg?.token,
      lastPush: meta?.lastPush,
      lastPull: meta?.lastPull,
    };
  }

  // ─── PUSH ──────────────────────────────────────────────────────────────────

  async push(): Promise<{ committed: number; message: string }> {
    const cfg = await this.getConfig();
    if (!cfg?.repoUrl || !cfg?.token) {
      throw Object.assign(new Error("Git not configured"), { code: "NOT_CONFIGURED" });
    }

    const dir = repoDir();
    mkdirp(dir);
    const git = simpleGit(dir);
    const authUrl = buildAuthUrl(cfg);

    // Init or re-use existing repo
    const isRepo = fs.existsSync(path.join(dir, ".git"));
    if (!isRepo) {
      await git.init();
      await git.addConfig("user.name", "ZuzuFlow");
      await git.addConfig("user.email", "git@zuzuflow.com");
    }

    // Set remote (force-update URL in case token changed)
    const remotes = await git.getRemotes();
    if (remotes.find((r) => r.name === "origin")) {
      await git.remote(["set-url", "origin", authUrl]);
    } else {
      await git.addRemote("origin", authUrl);
    }

    // Fetch so we can merge/rebase — ignore errors (empty repo)
    try { await git.fetch("origin", cfg.branch); } catch { /* first push */ }

    // Write all workflow files
    const workflows = await prisma.workflow.findMany({
      include: { folder: true },
      orderBy: { name: "asc" },
    });
    const folderPaths = await buildFolderPaths();
    const wfDir = path.join(dir, "workflows");

    // Wipe and re-write the workflows directory for a clean export
    fs.rmSync(wfDir, { recursive: true, force: true });
    mkdirp(wfDir);

    for (const wf of workflows) {
      const folderPath = wf.folderId ? (folderPaths.get(wf.folderId) ?? "root") : "";
      const targetDir = folderPath ? path.join(wfDir, folderPath) : wfDir;
      mkdirp(targetDir);

      const payload = {
        id: wf.id,
        key: wf.key,
        name: wf.name,
        description: wf.description,
        status: wf.status,
        folderId: wf.folderId,
        folderPath: folderPath || null,
        template: wf.template,
        version: wf.version,
        createdAt: wf.createdAt.toISOString(),
        updatedAt: wf.updatedAt.toISOString(),
      };

      const fileName = `${safeName(wf.name)}.json`;
      fs.writeFileSync(path.join(targetDir, fileName), JSON.stringify(payload, null, 2), "utf8");
    }

    // Also write a folders manifest so pulls can recreate the tree
    const folders = await prisma.folder.findMany({ orderBy: { name: "asc" } });
    fs.writeFileSync(
      path.join(dir, "folders.json"),
      JSON.stringify(folders.map((f) => ({ id: f.id, name: f.name, parentId: f.parentId })), null, 2),
      "utf8"
    );

    await git.add(".");
    const status = await git.status();

    // Only create a commit if the working tree actually changed. But ALWAYS
    // attempt the push afterwards — a previous failed push (bad token, etc.)
    // may have left unpushed commits on the local branch that still need to
    // go out. Skipping the push just because the working tree is clean would
    // silently strand those commits.
    let newCommit = false;
    if (!status.isClean()) {
      const ts = new Date().toISOString();
      await git.commit(`chore: export ${workflows.length} workflow(s) [${ts}]`);
      newCommit = true;
    }

    // Push (remote may be behind even if no new local commit this run).
    let pushOutput: { pushed?: Array<{ alreadyUpdated?: boolean }> } | null = null;
    try {
      pushOutput = await git.push("origin", cfg.branch, { "--set-upstream": null }) as any;
    } catch {
      // Branch may not exist on remote yet — force-push
      pushOutput = await git.push(["origin", `HEAD:${cfg.branch}`, "--force"]) as any;
    }

    // Detect the "already up-to-date" case from simple-git's parsed output
    const alreadyUpToDate = !!pushOutput?.pushed?.every((p) => p.alreadyUpdated);

    await settingService.set("git.meta", {
      ...(await settingService.get("git.meta") as object ?? {}),
      lastPush: new Date().toISOString(),
    });

    logger.info(
      `Git push: ${workflows.length} workflows → ${cfg.repoUrl} (${cfg.branch}) ` +
      `[newCommit=${newCommit}, alreadyUpToDate=${alreadyUpToDate}]`,
    );

    if (alreadyUpToDate && !newCommit) {
      return { committed: 0, message: "Already up to date — nothing to push" };
    }
    if (!newCommit) {
      return { committed: 0, message: `Pushed existing commits to ${cfg.branch}` };
    }
    return { committed: workflows.length, message: `Pushed ${workflows.length} workflows to ${cfg.branch}` };
  }

  // ─── PULL ──────────────────────────────────────────────────────────────────

  async pull(): Promise<{ upserted: number; message: string }> {
    const cfg = await this.getConfig();
    if (!cfg?.repoUrl || !cfg?.token) {
      throw Object.assign(new Error("Git not configured"), { code: "NOT_CONFIGURED" });
    }

    const dir = repoDir();
    const authUrl = buildAuthUrl(cfg);
    const git = simpleGit();

    // Clone or fetch+reset
    if (!fs.existsSync(path.join(dir, ".git"))) {
      mkdirp(path.dirname(dir));
      await git.clone(authUrl, dir, ["--branch", cfg.branch, "--depth", "1"]);
    } else {
      const localGit = simpleGit(dir);
      await localGit.remote(["set-url", "origin", authUrl]);
      await localGit.fetch("origin", cfg.branch);
      await localGit.reset(["--hard", `origin/${cfg.branch}`]);
    }

    // Determine default environment for imported data
    const defaultEnv = await prisma.environment.findFirst({ where: { isDefault: true } });
    const envId = defaultEnv?.id ?? "env-default-production";

    // Restore folder tree from folders.json if present
    const foldersManifest = path.join(dir, "folders.json");
    if (fs.existsSync(foldersManifest)) {
      const rawFolders = JSON.parse(fs.readFileSync(foldersManifest, "utf8")) as Array<{
        id: string; name: string; parentId: string | null;
      }>;

      // Upsert root folders first, then children (topological order)
      const sorted = this._topoSortFolders(rawFolders);
      for (const f of sorted) {
        await prisma.folder.upsert({
          where: { id: f.id },
          create: { id: f.id, name: f.name, parentId: f.parentId, environmentId: envId },
          update: { name: f.name, parentId: f.parentId },
        });
      }
    }

    // Walk all workflow JSON files and upsert
    const wfDir = path.join(dir, "workflows");
    let upserted = 0;

    if (fs.existsSync(wfDir)) {
      const jsonFiles = this._walkJsonFiles(wfDir);
      for (const filePath of jsonFiles) {
        try {
          const payload = JSON.parse(fs.readFileSync(filePath, "utf8"));
          if (!payload.id || !payload.name || !payload.template) continue;

          await prisma.workflow.upsert({
            where: { id: payload.id },
            create: {
              id: payload.id,
              key: payload.key ?? generateWorkflowKey(),
              name: payload.name,
              description: payload.description ?? null,
              status: payload.status ?? "draft",
              template: payload.template,
              version: payload.version ?? 1,
              folderId: payload.folderId ?? null,
              environmentId: envId,
            },
            update: {
              ...(payload.key ? { key: payload.key } : {}),
              name: payload.name,
              description: payload.description ?? null,
              status: payload.status ?? "draft",
              template: payload.template,
              version: payload.version ?? 1,
              folderId: payload.folderId ?? null,
            },
          });
          upserted++;
        } catch (e) {
          logger.warn(`Git pull: failed to import ${filePath}`, { err: e });
        }
      }
    }

    await settingService.set("git.meta", {
      ...(await settingService.get("git.meta") as object ?? {}),
      lastPull: new Date().toISOString(),
    });

    logger.info(`Git pull: upserted ${upserted} workflows from ${cfg.repoUrl} (${cfg.branch})`);
    return { upserted, message: `Pulled and imported ${upserted} workflows from ${cfg.branch}` };
  }

  // ─── Utilities ─────────────────────────────────────────────────────────────

  private _walkJsonFiles(dir: string): string[] {
    const results: string[] = [];
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) results.push(...this._walkJsonFiles(full));
      else if (entry.isFile() && entry.name.endsWith(".json")) results.push(full);
    }
    return results;
  }

  private _topoSortFolders(folders: Array<{ id: string; name: string; parentId: string | null }>): typeof folders {
    const byId = new Map(folders.map((f) => [f.id, f]));
    const sorted: typeof folders = [];
    const visited = new Set<string>();

    function visit(id: string) {
      if (visited.has(id)) return;
      const f = byId.get(id);
      if (!f) return;
      if (f.parentId) visit(f.parentId);
      visited.add(id);
      sorted.push(f);
    }

    for (const f of folders) visit(f.id);
    return sorted;
  }

  // ─── Auto-sync helpers ──────────────────────────────────────────────────────
  //
  // autoPush is triggered by the workflow routes on every create/update/delete.
  // Multiple saves in quick succession are collapsed into a single push via a
  // short debounce window so a burst of edits results in one commit.

  private _autoPushTimer: NodeJS.Timeout | null = null;
  private _autoPullInterval: NodeJS.Timeout | null = null;

  /** Schedule an auto-push if the feature is enabled and git is configured.
   *  Returns immediately — the push runs asynchronously. */
  scheduleAutoPush(reason: string): void {
    // Debounce: collapse rapid successive saves into one push
    const DEBOUNCE_MS = 3000;
    if (this._autoPushTimer) clearTimeout(this._autoPushTimer);
    this._autoPushTimer = setTimeout(() => {
      this._autoPushTimer = null;
      void this._runAutoPush(reason);
    }, DEBOUNCE_MS);
  }

  private async _runAutoPush(reason: string): Promise<void> {
    try {
      const cfg = await this.getConfig();
      if (!cfg?.autoPush) return;
      if (!cfg.repoUrl || !cfg.token) return;
      logger.info(`Auto-push triggered (${reason})`);
      await this.push();
    } catch (err) {
      // Auto-push failure must not surface to the save request — just log it.
      logger.error("Auto-push failed", { err });
    }
  }

  /** Start a recurring auto-pull interval. Safe to call multiple times —
   *  previous interval is cleared first. */
  startAutoPullInterval(): void {
    const AUTO_PULL_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes
    if (this._autoPullInterval) clearInterval(this._autoPullInterval);
    this._autoPullInterval = setInterval(() => {
      void this._runAutoPull();
    }, AUTO_PULL_INTERVAL_MS);
    logger.info(`Auto-pull interval started (${AUTO_PULL_INTERVAL_MS / 1000}s)`);
  }

  private async _runAutoPull(): Promise<void> {
    try {
      const cfg = await this.getConfig();
      if (!cfg?.autoPull) return;
      if (!cfg.repoUrl || !cfg.token) return;
      logger.info("Auto-pull tick");
      await this.pull();
    } catch (err) {
      logger.error("Auto-pull failed", { err });
    }
  }
}

export const gitService = new GitService();
