import React, { useEffect, useState, useCallback } from "react";
import {
  GitBranch,
  Upload,
  Download,
  Save,
  CheckCircle2,
  XCircle,
  Loader2,
  Eye,
  EyeOff,
  RefreshCw,
  Settings,
  Users,
  Key,
  Plus,
  Trash2,
  Copy,
  Check,
  ShieldCheck,
  Globe,
  UserPlus,
  Building2,
  Mail,
  MapPin,
  Smartphone,
  Lock,
  AlertTriangle,
  ShieldOff,
} from "lucide-react";
import type {
  GitConfig,
  GitProvider,
  GitStatus,
  UserPublic,
  ApiTokenPublic,
  ApiTokenCreated,
  EnvironmentItem,
  EnvironmentMember,
  OrgDetail,
  MfaStatus,
  TotpSetupResult,
} from "../lib/api";
import {
  getGitConfig,
  saveGitConfig,
  getGitStatus,
  gitPush,
  gitPull,
  listUsers,
  createUser,
  changePassword,
  deleteUser,
  listApiTokens,
  createApiToken,
  revokeApiToken,
  listEnvironments,
  createEnvironment,
  updateEnvironment,
  deleteEnvironment,
  listEnvironmentMembers,
  addEnvironmentMember,
  removeEnvironmentMember,
  getOrganization,
  updateOrganization,
  getMfaStatus,
  setupTotp,
  enableTotp,
  disableTotp,
  enableEmailOtp,
  disableEmailOtp,
  regenerateBackupCodes,
  adminResetMfa,
} from "../lib/api";
import { useEnvironmentStore } from "../store/environmentStore";
import { cn } from "../lib/utils";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { PageHeader } from "../components/layout/PageHeader";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "../components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "../components/ui/dialog";
import { Button } from "../components/ui/button";
import { Switch } from "../components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../components/ui/table";

// ─── Helpers ──────────────────────────────────────────────────────────────────

const PROVIDERS: { value: GitProvider; label: string }[] = [
  { value: "github", label: "GitHub" },
  { value: "gitlab", label: "GitLab" },
  { value: "bitbucket", label: "Bitbucket" },
  { value: "custom", label: "Custom (HTTPS)" },
];

function fmtDate(iso?: string | null) {
  if (!iso) return "Never";
  return new Date(iso).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

const inputClass =
  "w-full px-3 py-1.5 text-sm bg-secondary border border-border rounded text-foreground placeholder-muted-foreground focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500";

const labelClass = "block text-xs font-medium text-muted-foreground mb-1";

// ─── Result pill ─────────────────────────────────────────────────────────────

function ResultPill({ ok, msg }: { ok: boolean; msg: string }) {
  return (
    <span
      className={cn(
        "flex items-center gap-1 text-xs",
        ok ? "text-emerald-400" : "text-red-400",
      )}
    >
      {ok ? <CheckCircle2 size={12} /> : <XCircle size={12} />}
      {msg}
    </span>
  );
}

// ─── Git tab ─────────────────────────────────────────────────────────────────

function GitTab() {
  const [provider, setProvider] = useState<GitProvider>("github");
  const [repoUrl, setRepoUrl] = useState("");
  const [branch, setBranch] = useState("main");
  const [username, setUsername] = useState("");
  const [token, setToken] = useState("");
  const [showToken, setShowToken] = useState(false);
  const [tokenMasked, setTokenMasked] = useState(false);
  const [autoPush, setAutoPush]       = useState(false);
  const [autoPull, setAutoPull]       = useState(false);
  const [autoSaving, setAutoSaving]   = useState<"push" | "pull" | null>(null);

  const [saving, setSaving] = useState(false);
  const [saveResult, setSaveResult] = useState<{
    ok: boolean;
    msg: string;
  } | null>(null);
  const [pushing, setPushing] = useState(false);
  const [pushResult, setPushResult] = useState<{
    ok: boolean;
    msg: string;
  } | null>(null);
  const [pulling, setPulling] = useState(false);
  const [pullResult, setPullResult] = useState<{
    ok: boolean;
    msg: string;
  } | null>(null);
  const [gitStatus, setGitStatus] = useState<GitStatus | null>(null);
  const [statusLoading, setStatusLoading] = useState(false);

  const loadStatus = useCallback(async () => {
    setStatusLoading(true);
    try {
      setGitStatus(await getGitStatus());
    } catch {
      /* best-effort */
    } finally {
      setStatusLoading(false);
    }
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const cfg = await getGitConfig();
        if (cfg) {
          setProvider(cfg.provider);
          setRepoUrl(cfg.repoUrl);
          setBranch(cfg.branch);
          setUsername(cfg.username ?? "");
          setToken(cfg.token);
          setAutoPush(!!cfg.autoPush);
          setAutoPull(!!cfg.autoPull);
          if (cfg.token.startsWith("•")) setTokenMasked(true);
        }
      } catch {
        /* no config yet */
      }
      loadStatus();
    })();
  }, [loadStatus]);

  async function handleSave() {
    setSaving(true);
    setSaveResult(null);
    try {
      await saveGitConfig({ provider, repoUrl: repoUrl.trim(), branch: branch.trim(), username: username.trim() || undefined, token, autoPush, autoPull });
      setTokenMasked(true);
      setSaveResult({ ok: true, msg: "Configuration saved." });
    } catch (err) {
      setSaveResult({ ok: false, msg: (err as Error).message });
    } finally {
      setSaving(false);
    }
  }

  /**
   * Toggle auto-push/auto-pull independently of the main "Save Configuration"
   * button — feels more natural for toggles (take effect instantly). Optimistic
   * UI, rolls back on failure.
   */
  async function persistAutoSync(field: "autoPush" | "autoPull", value: boolean) {
    // Require the rest of the config to be saved before toggles take effect.
    if (!gitStatus?.configured) {
      toast.error("Save Git configuration first, then enable auto-sync.");
      return;
    }
    const prev = field === "autoPush" ? autoPush : autoPull;
    // Optimistic update
    if (field === "autoPush") setAutoPush(value); else setAutoPull(value);
    setAutoSaving(field === "autoPush" ? "push" : "pull");
    try {
      await saveGitConfig({
        provider,
        repoUrl: repoUrl.trim(),
        branch: branch.trim(),
        username: username.trim() || undefined,
        token,
        autoPush: field === "autoPush" ? value : autoPush,
        autoPull: field === "autoPull" ? value : autoPull,
      });
      setTokenMasked(true);
    } catch (err) {
      // Rollback
      if (field === "autoPush") setAutoPush(prev); else setAutoPull(prev);
      toast.error((err as Error).message);
    } finally {
      setAutoSaving(null);
    }
  }

  async function handlePush() {
    setPushing(true);
    setPushResult(null);
    try {
      const r = await gitPush();
      setPushResult({ ok: true, msg: r.message });
      loadStatus();
    } catch (err) {
      setPushResult({ ok: false, msg: (err as Error).message });
    } finally {
      setPushing(false);
    }
  }

  async function handlePull() {
    setPulling(true);
    setPullResult(null);
    try {
      const r = await gitPull();
      setPullResult({ ok: true, msg: r.message });
      loadStatus();
    } catch (err) {
      setPullResult({ ok: false, msg: (err as Error).message });
    } finally {
      setPulling(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* Git Integration card */}
      <div>
        <div className="flex items-center gap-2 mb-1">
          <GitBranch size={14} className="text-muted-foreground" />
          <h2 className="text-sm font-semibold text-foreground">
            Git Integration
          </h2>
        </div>
        <p className="text-xs text-muted-foreground mb-4">
          Link a remote repository to push and pull workflows as JSON files.
          Tokens are stored encrypted.
        </p>
        <div className="bg-card border border-border rounded-xl overflow-hidden">
          <div className="px-5 py-4 space-y-4">
            {/* Provider */}
            <div>
              <label className={labelClass}>Provider</label>
              <div className="flex flex-wrap gap-2 mt-1">
                {PROVIDERS.map((p) => (
                  <button
                    key={p.value}
                    onClick={() => setProvider(p.value)}
                    className={cn(
                      "px-3 py-1 text-xs rounded border transition-colors",
                      provider === p.value
                        ? "border-indigo-500 bg-indigo-600/30 text-indigo-300"
                        : "border-border bg-secondary text-muted-foreground hover:border-border hover:text-foreground",
                    )}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className={labelClass}>Repository URL (HTTPS)</label>
              <input
                className={inputClass}
                placeholder="https://github.com/org/repo.git"
                value={repoUrl}
                onChange={(e) => setRepoUrl(e.target.value)}
              />
            </div>
            <div>
              <label className={labelClass}>Branch</label>
              <input
                className={inputClass}
                placeholder="main"
                value={branch}
                onChange={(e) => setBranch(e.target.value)}
              />
            </div>
            {(provider === "bitbucket" || provider === "custom") && (
              <div>
                <label className={labelClass}>Username</label>
                <input
                  className={inputClass}
                  placeholder="your-username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                />
              </div>
            )}
            <div>
              <label className={labelClass}>
                {provider === "github" && "Personal Access Token"}
                {provider === "gitlab" && "Personal Access Token"}
                {provider === "bitbucket" && "App Password"}
                {provider === "custom" && "Token / Password"}
              </label>
              <div className="relative">
                <input
                  className={inputClass + " pr-9"}
                  type={showToken ? "text" : "password"}
                  placeholder={
                    tokenMasked ? "Leave blank to keep existing token" : "ghp_…"
                  }
                  value={token}
                  onChange={(e) => {
                    setToken(e.target.value);
                    setTokenMasked(false);
                  }}
                />
                <button
                  type="button"
                  onClick={() => setShowToken((v) => !v)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showToken ? <EyeOff size={13} /> : <Eye size={13} />}
                </button>
              </div>
              {tokenMasked && (
                <p className="text-[10px] text-muted-foreground mt-0.5">
                  Token is stored — edit to replace it.
                </p>
              )}
            </div>
          </div>
          <div className="px-5 py-3 border-t border-border flex items-center gap-3">
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded bg-indigo-600 hover:bg-indigo-500 text-white transition-colors disabled:opacity-60"
            >
              {saving ? (
                <Loader2 size={12} className="animate-spin" />
              ) : (
                <Save size={12} />
              )}
              {saving ? "Saving…" : "Save Configuration"}
            </button>
            {saveResult && <ResultPill {...saveResult} />}
          </div>
        </div>
      </div>

      {/* Sync card */}
      <div>
        <div className="flex items-center justify-between mb-1">
          <div className="flex items-center gap-2">
            <RefreshCw size={14} className="text-muted-foreground" />
            <h2 className="text-sm font-semibold text-foreground">Sync</h2>
          </div>
          <button
            onClick={loadStatus}
            disabled={statusLoading}
            className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
          >
            <RefreshCw
              size={11}
              className={cn(statusLoading && "animate-spin")}
            />
            Refresh
          </button>
        </div>
        <p className="text-xs text-muted-foreground mb-4">
          Push exports all workflows to the repo as JSON. Pull imports them back
          and upserts into the database.
        </p>
        <div className="bg-card border border-border rounded-xl overflow-hidden">
          {gitStatus && (
            <div className="px-5 py-3 border-b border-border grid grid-cols-3 gap-4 text-xs">
              <div>
                <p className="text-muted-foreground mb-0.5">Status</p>
                <span
                  className={cn(
                    "font-medium",
                    gitStatus.configured
                      ? "text-emerald-400"
                      : "text-amber-400",
                  )}
                >
                  {gitStatus.configured ? "Connected" : "Not configured"}
                </span>
              </div>
              <div>
                <p className="text-muted-foreground mb-0.5">Last push</p>
                <p className="text-foreground font-mono">
                  {fmtDate(gitStatus.lastPush)}
                </p>
              </div>
              <div>
                <p className="text-muted-foreground mb-0.5">Last pull</p>
                <p className="text-foreground font-mono">
                  {fmtDate(gitStatus.lastPull)}
                </p>
              </div>
            </div>
          )}
          {/* Auto-sync toggles */}
          <div className="px-5 py-4 border-b border-border flex items-center justify-between gap-4">
            <div>
              <p className="text-xs font-medium text-foreground mb-0.5">Auto-push on change</p>
              <p className="text-xs text-muted-foreground">
                Automatically push to Git whenever a workflow is created, updated, or deleted.
                Rapid saves are batched into a single commit.
              </p>
            </div>
            <Switch
              checked={autoPush}
              disabled={!gitStatus?.configured || autoSaving === "push"}
              onCheckedChange={(v) => persistAutoSync("autoPush", v)}
              aria-label="Toggle auto-push"
            />
          </div>
          <div className="px-5 py-4 border-b border-border flex items-center justify-between gap-4">
            <div>
              <p className="text-xs font-medium text-foreground mb-0.5">Auto-pull periodically</p>
              <p className="text-xs text-muted-foreground">
                Pull the latest workflows from Git every 5 minutes and upsert into the database.
              </p>
            </div>
            <Switch
              checked={autoPull}
              disabled={!gitStatus?.configured || autoSaving === "pull"}
              onCheckedChange={(v) => persistAutoSync("autoPull", v)}
              aria-label="Toggle auto-pull"
            />
          </div>

          <div className="px-5 py-4 border-b border-border flex items-center justify-between gap-4">
            <div>
              <p className="text-xs font-medium text-foreground mb-0.5">
                Push to Git
              </p>
              <p className="text-xs text-muted-foreground">
                Export all workflows to the remote repository, organized by
                folder.
              </p>
            </div>
            <div className="flex items-center gap-3 shrink-0">
              {pushResult && <ResultPill {...pushResult} />}
              <button
                onClick={handlePush}
                disabled={pushing || !gitStatus?.configured}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded bg-muted hover:bg-slate-600 text-foreground transition-colors disabled:opacity-40"
              >
                {pushing ? (
                  <Loader2 size={12} className="animate-spin" />
                ) : (
                  <Upload size={12} />
                )}
                Push
              </button>
            </div>
          </div>
          <div className="px-5 py-4 flex items-center justify-between gap-4">
            <div>
              <p className="text-xs font-medium text-foreground mb-0.5">
                Pull from Git
              </p>
              <p className="text-xs text-muted-foreground">
                Import workflows from the repository and upsert them into the
                database.
              </p>
            </div>
            <div className="flex items-center gap-3 shrink-0">
              {pullResult && <ResultPill {...pullResult} />}
              <button
                onClick={handlePull}
                disabled={pulling || !gitStatus?.configured}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded bg-muted hover:bg-slate-600 text-foreground transition-colors disabled:opacity-40"
              >
                {pulling ? (
                  <Loader2 size={12} className="animate-spin" />
                ) : (
                  <Download size={12} />
                )}
                Pull
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Users tab ────────────────────────────────────────────────────────────────

function UsersTab() {
  const [users, setUsers] = useState<UserPublic[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Create form
  const [newUsername, setNewUsername] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newRole, setNewRole] = useState<"admin" | "editor">("editor");
  const [showNewPass, setShowNewPass] = useState(false);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState("");

  // Change password modal
  const [changePwUser, setChangePwUser] = useState<UserPublic | null>(null);
  const [newPw, setNewPw] = useState("");
  const [showNewPw, setShowNewPw] = useState(false);
  const [changingPw, setChangingPw] = useState(false);
  const [changePwError, setChangePwError] = useState("");

  // Reset MFA dialog
  const [mfaResetTarget, setMfaResetTarget] = useState<UserPublic | null>(null);
  const [resettingMfa, setResettingMfa] = useState(false);

  // Delete user dialog
  const [deleteTarget, setDeleteTarget] = useState<{
    id: string;
    name: string;
  } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setUsers(await listUsers());
      setError("");
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!newUsername.trim() || !newEmail.trim() || !newPassword.trim()) {
      setCreateError("Username, email, and password are required");
      return;
    }
    setCreating(true);
    setCreateError("");
    try {
      await createUser(
        newUsername.trim(),
        newEmail.trim(),
        newPassword.trim(),
        newRole,
      );
      setNewUsername("");
      setNewEmail("");
      setNewPassword("");
      setNewRole("editor");
      await load();
    } catch (err) {
      setCreateError((err as Error).message);
    } finally {
      setCreating(false);
    }
  }

  function handleDelete(user: UserPublic) {
    setDeleteTarget({ id: user.id, name: user.username });
  }

  async function handleConfirmDelete() {
    if (!deleteTarget) return;
    const target = deleteTarget;
    setDeleteTarget(null);
    try {
      await deleteUser(target.id);
      await load();
    } catch (err) {
      toast.error((err as Error).message);
    }
  }

  async function handleChangePw(e: React.FormEvent) {
    e.preventDefault();
    if (!changePwUser || !newPw.trim()) return;
    setChangingPw(true);
    setChangePwError("");
    try {
      await changePassword(changePwUser.id, newPw.trim());
      setChangePwUser(null);
      setNewPw("");
    } catch (err) {
      setChangePwError((err as Error).message);
    } finally {
      setChangingPw(false);
    }
  }

  async function handleConfirmMfaReset() {
    if (!mfaResetTarget) return;
    setResettingMfa(true);
    try {
      await adminResetMfa(mfaResetTarget.id);
      toast.success(`MFA cleared for ${mfaResetTarget.username}`);
      setMfaResetTarget(null);
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setResettingMfa(false);
    }
  }

  const inputSm =
    "px-2.5 py-1.5 text-xs bg-secondary border border-border rounded text-foreground placeholder-muted-foreground focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500";

  return (
    <div className="space-y-6">
      {/* User list */}
      <div>
        <div className="flex items-center gap-2 mb-1">
          <Users size={14} className="text-muted-foreground" />
          <h2 className="text-sm font-semibold text-foreground">Users</h2>
        </div>
        <p className="text-xs text-muted-foreground mb-4">
          Manage who can access this application. Each user has a role: admin or
          editor.
        </p>

        <div className="bg-card border border-border rounded-xl overflow-hidden">
          {loading ? (
            <div className="flex items-center justify-center py-8 text-muted-foreground">
              <Loader2 size={16} className="animate-spin mr-2" /> Loading…
            </div>
          ) : error ? (
            <div className="px-5 py-4 text-xs text-red-400">{error}</div>
          ) : users.length === 0 ? (
            <div className="px-5 py-4 text-xs text-muted-foreground">
              No users found.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Username</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Last Login</TableHead>
                  <TableHead>Last IP</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {users.map((u) => (
                  <TableRow key={u.id}>
                    <TableCell className="font-medium text-foreground">
                      {u.username}
                    </TableCell>
                    <TableCell className="text-muted-foreground text-xs">
                      {u.email || "—"}
                    </TableCell>
                    <TableCell>
                      <span
                        className={cn(
                          "px-2 py-0.5 rounded text-[10px] font-medium",
                          u.role === "admin"
                            ? "bg-indigo-600/20 text-indigo-300 border border-indigo-500/30"
                            : "bg-muted text-muted-foreground border border-border",
                        )}
                      >
                        {u.role}
                      </span>
                    </TableCell>
                    <TableCell className="text-muted-foreground font-mono text-xs">
                      {u.lastLoginAt ? fmtDate(u.lastLoginAt) : "Never"}
                    </TableCell>
                    <TableCell className="text-muted-foreground font-mono text-xs">
                      {u.lastLoginIp || "—"}
                    </TableCell>
                    <TableCell className="text-muted-foreground font-mono">
                      {fmtDate(u.createdAt)}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => {
                            setChangePwUser(u);
                            setNewPw("");
                            setChangePwError("");
                          }}
                          className="text-muted-foreground hover:text-foreground transition-colors text-[10px] underline underline-offset-2"
                        >
                          Change password
                        </button>
                        <button
                          onClick={() => setMfaResetTarget(u)}
                          className="text-muted-foreground hover:text-amber-400 transition-colors"
                          title="Reset MFA"
                        >
                          <ShieldOff size={12} />
                        </button>
                        <button
                          onClick={() => handleDelete(u)}
                          className="text-muted-foreground hover:text-red-400 transition-colors"
                          title="Delete user"
                        >
                          <Trash2 size={12} />
                        </button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </div>
      </div>

      {/* Create user form */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <Plus size={14} className="text-muted-foreground" />
          <h3 className="text-sm font-semibold text-foreground">Add User</h3>
        </div>
        <div className="bg-card border border-border rounded-xl overflow-hidden">
          <form onSubmit={handleCreate} className="px-5 py-4 space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelClass}>Username</label>
                <input
                  className={inputClass}
                  type="text"
                  placeholder="username"
                  value={newUsername}
                  onChange={(e) => setNewUsername(e.target.value)}
                />
              </div>
              <div>
                <label className={labelClass}>Role</label>
                <select
                  className={inputClass + " cursor-pointer"}
                  value={newRole}
                  onChange={(e) =>
                    setNewRole(e.target.value as "admin" | "editor")
                  }
                >
                  <option value="editor">Editor</option>
                  <option value="admin">Admin</option>
                </select>
              </div>
            </div>
            <div>
              <label className={labelClass}>Email</label>
              <input
                className={inputClass}
                type="email"
                placeholder="user@example.com"
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
              />
            </div>
            <div>
              <label className={labelClass}>Password</label>
              <div className="relative">
                <input
                  className={inputClass + " pr-9"}
                  type={showNewPass ? "text" : "password"}
                  placeholder="Min. 8 characters"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                />
                <button
                  type="button"
                  onClick={() => setShowNewPass((v) => !v)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showNewPass ? <EyeOff size={13} /> : <Eye size={13} />}
                </button>
              </div>
            </div>
            {createError && (
              <p className="text-xs text-red-400">{createError}</p>
            )}
          </form>
          <div className="px-5 py-3 border-t border-border">
            <button
              onClick={handleCreate as any}
              disabled={creating}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded bg-indigo-600 hover:bg-indigo-500 text-white transition-colors disabled:opacity-60"
            >
              {creating ? (
                <Loader2 size={12} className="animate-spin" />
              ) : (
                <Plus size={12} />
              )}
              {creating ? "Creating…" : "Create User"}
            </button>
          </div>
        </div>
      </div>

      {/* Change password modal */}
      <Dialog
        open={!!changePwUser}
        onOpenChange={(open) => {
          if (!open) {
            setChangePwUser(null);
            setNewPw("");
          }
        }}
      >
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Change password</DialogTitle>
            <DialogDescription>
              For user:{" "}
              <span className="text-foreground">{changePwUser?.username}</span>
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleChangePw} className="space-y-3">
            <div>
              <label className={labelClass}>New password</label>
              <div className="relative">
                <input
                  className={inputSm + " w-full pr-9"}
                  type={showNewPw ? "text" : "password"}
                  placeholder="Min. 8 characters"
                  value={newPw}
                  onChange={(e) => setNewPw(e.target.value)}
                  autoFocus
                />
                <button
                  type="button"
                  onClick={() => setShowNewPw((v) => !v)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showNewPw ? <EyeOff size={13} /> : <Eye size={13} />}
                </button>
              </div>
            </div>
            {changePwError && (
              <p className="text-xs text-red-400">{changePwError}</p>
            )}
          </form>
          <DialogFooter>
            <Button
              variant="ghost"
              onClick={() => {
                setChangePwUser(null);
                setNewPw("");
              }}
            >
              Cancel
            </Button>
            <Button onClick={handleChangePw as any} disabled={changingPw}>
              {changingPw ? (
                <Loader2 size={12} className="animate-spin mr-1.5" />
              ) : (
                <Check size={12} className="mr-1.5" />
              )}
              {changingPw ? "Saving…" : "Update Password"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={deleteTarget !== null}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null);
        }}
        title="Delete User"
        description={`Delete user "${deleteTarget?.name}"? This cannot be undone.`}
        confirmLabel="Delete"
        onConfirm={handleConfirmDelete}
        destructive
      />

      <ConfirmDialog
        open={mfaResetTarget !== null}
        onOpenChange={(open) => {
          if (!open) setMfaResetTarget(null);
        }}
        title="Reset MFA"
        description={`Clear all MFA methods for "${mfaResetTarget?.username}"? They will be able to log in with their password only and will need to re-enroll.`}
        confirmLabel={resettingMfa ? "Clearing…" : "Clear MFA"}
        onConfirm={handleConfirmMfaReset}
        destructive
      />
    </div>
  );
}

// ─── API Tokens tab ───────────────────────────────────────────────────────────

function ApiTokensTab() {
  const [tokens, setTokens] = useState<ApiTokenPublic[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [newName, setNewName] = useState("");
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState("");
  const [revealed, setRevealed] = useState<ApiTokenCreated | null>(null);
  const [copied, setCopied] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<{
    id: string;
    name: string;
  } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setTokens(await listApiTokens());
      setError("");
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!newName.trim()) {
      setCreateError("Token name is required");
      return;
    }
    setCreating(true);
    setCreateError("");
    try {
      const result = await createApiToken(newName.trim());
      setRevealed(result);
      setNewName("");
      await load();
    } catch (err) {
      setCreateError((err as Error).message);
    } finally {
      setCreating(false);
    }
  }

  function handleRevoke(id: string, name: string) {
    setDeleteTarget({ id, name });
  }

  async function handleConfirmRevoke() {
    if (!deleteTarget) return;
    const target = deleteTarget;
    setDeleteTarget(null);
    try {
      await revokeApiToken(target.id);
      await load();
    } catch (err) {
      toast.error((err as Error).message);
    }
  }

  function handleCopy() {
    if (!revealed) return;
    navigator.clipboard.writeText(revealed.token).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  return (
    <div className="space-y-6">
      {/* Token list */}
      <div>
        <div className="flex items-center gap-2 mb-1">
          <Key size={14} className="text-muted-foreground" />
          <h2 className="text-sm font-semibold text-foreground">API Tokens</h2>
        </div>
        <p className="text-xs text-muted-foreground mb-4">
          Generate long-lived API tokens for external integrations (e.g., npm
          packages, CI pipelines). Tokens are shown once — store them securely.
        </p>

        <div className="bg-card border border-border rounded-xl overflow-hidden">
          {loading ? (
            <div className="flex items-center justify-center py-8 text-muted-foreground">
              <Loader2 size={16} className="animate-spin mr-2" /> Loading…
            </div>
          ) : error ? (
            <div className="px-5 py-4 text-xs text-red-400">{error}</div>
          ) : tokens.length === 0 ? (
            <div className="px-5 py-4 text-xs text-muted-foreground">
              No tokens yet. Generate one below.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead>Last used</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {tokens.map((t) => (
                  <TableRow key={t.id}>
                    <TableCell className="font-medium text-foreground">
                      <div className="flex items-center gap-2">
                        <ShieldCheck
                          size={12}
                          className="text-muted-foreground shrink-0"
                        />
                        {t.name}
                      </div>
                    </TableCell>
                    <TableCell className="text-muted-foreground font-mono">
                      {fmtDate(t.createdAt)}
                    </TableCell>
                    <TableCell className="text-muted-foreground font-mono">
                      {fmtDate(t.lastUsedAt)}
                    </TableCell>
                    <TableCell className="text-right">
                      <button
                        onClick={() => handleRevoke(t.id, t.name)}
                        className="text-muted-foreground hover:text-red-400 transition-colors"
                        title="Revoke token"
                      >
                        <Trash2 size={12} />
                      </button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </div>
      </div>

      {/* New token revealed */}
      {revealed && (
        <div className="bg-emerald-950/40 border border-emerald-700/40 rounded-xl px-5 py-4">
          <div className="flex items-center gap-2 mb-2">
            <CheckCircle2 size={14} className="text-emerald-400" />
            <p className="text-xs font-semibold text-emerald-400">
              Token generated — copy it now
            </p>
          </div>
          <p className="text-xs text-muted-foreground mb-3">
            This is the only time the full token will be shown. It will not be
            visible again after you leave this page.
          </p>
          <div className="flex items-center gap-2">
            <code className="flex-1 px-3 py-2 text-xs bg-card border border-border rounded text-foreground font-mono break-all">
              {revealed.token}
            </code>
            <button
              onClick={handleCopy}
              className="shrink-0 flex items-center gap-1.5 px-3 py-2 text-xs rounded bg-muted hover:bg-slate-600 text-foreground transition-colors"
            >
              {copied ? (
                <Check size={12} className="text-emerald-400" />
              ) : (
                <Copy size={12} />
              )}
              {copied ? "Copied!" : "Copy"}
            </button>
          </div>
          <button
            onClick={() => setRevealed(null)}
            className="mt-3 text-xs text-muted-foreground hover:text-foreground underline underline-offset-2 transition-colors"
          >
            I've saved it — dismiss
          </button>
        </div>
      )}

      {/* Generate form */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <Plus size={14} className="text-muted-foreground" />
          <h3 className="text-sm font-semibold text-foreground">
            Generate Token
          </h3>
        </div>
        <div className="bg-card border border-border rounded-xl overflow-hidden">
          <form onSubmit={handleCreate} className="px-5 py-4 space-y-3">
            <div>
              <label className={labelClass}>Token name</label>
              <input
                className={inputClass}
                type="text"
                placeholder="e.g. My App Integration"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
              />
              <p className="text-[10px] text-muted-foreground mt-1">
                Give it a descriptive name so you know what it's used for.
              </p>
            </div>
            {createError && (
              <p className="text-xs text-red-400">{createError}</p>
            )}
          </form>
          <div className="px-5 py-3 border-t border-border">
            <button
              onClick={handleCreate as any}
              disabled={creating}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded bg-indigo-600 hover:bg-indigo-500 text-white transition-colors disabled:opacity-60"
            >
              {creating ? (
                <Loader2 size={12} className="animate-spin" />
              ) : (
                <Key size={12} />
              )}
              {creating ? "Generating…" : "Generate Token"}
            </button>
          </div>
        </div>
      </div>

      <ConfirmDialog
        open={deleteTarget !== null}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null);
        }}
        title="Revoke Token"
        description={`Revoke token "${deleteTarget?.name}"? Any integrations using it will stop working.`}
        confirmLabel="Revoke"
        onConfirm={handleConfirmRevoke}
        destructive
      />
    </div>
  );
}

// ─── Environments tab ────────────────────────────────────────────────────────

function EnvironmentsTab() {
  const [envs, setEnvs] = useState<EnvironmentItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState("");
  const [newSlug, setNewSlug] = useState("");
  const [creating, setCreating] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<EnvironmentItem | null>(
    null,
  );
  const [selectedEnv, setSelectedEnv] = useState<EnvironmentItem | null>(null);
  const [members, setMembers] = useState<EnvironmentMember[]>([]);
  const [allUsers, setAllUsers] = useState<UserPublic[]>([]);
  const [addUserId, setAddUserId] = useState("");
  const [addRole, setAddRole] = useState("editor");
  const setStoreEnvs = useEnvironmentStore((s) => s.setEnvironments);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await listEnvironments();
      setEnvs(data);
      setStoreEnvs(data);
    } catch {
      /* ignore */
    } finally {
      setLoading(false);
    }
  }, [setStoreEnvs]);

  useEffect(() => {
    load();
  }, [load]);

  const loadMembers = useCallback(async (env: EnvironmentItem) => {
    setSelectedEnv(env);
    try {
      const [m, u] = await Promise.all([
        listEnvironmentMembers(env.id),
        listUsers(),
      ]);
      setMembers(m);
      setAllUsers(u);
    } catch {
      /* ignore */
    }
  }, []);

  const handleCreate = async () => {
    if (!newName.trim() || !newSlug.trim()) return;
    setCreating(true);
    try {
      await createEnvironment(newName, newSlug);
      toast.success(`Environment "${newName}" created`);
      setShowCreate(false);
      setNewName("");
      setNewSlug("");
      load();
    } catch (err) {
      toast.error((err as Error).message);
    }
    setCreating(false);
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await deleteEnvironment(deleteTarget.id);
      toast.success(`Environment "${deleteTarget.name}" deleted`);
      setDeleteTarget(null);
      if (selectedEnv?.id === deleteTarget.id) setSelectedEnv(null);
      load();
    } catch (err) {
      toast.error((err as Error).message);
    }
  };

  const handleAddMember = async () => {
    if (!selectedEnv || !addUserId) return;
    try {
      await addEnvironmentMember(selectedEnv.id, addUserId, addRole);
      toast.success("Member added");
      setAddUserId("");
      loadMembers(selectedEnv);
    } catch (err) {
      toast.error((err as Error).message);
    }
  };

  const handleRemoveMember = async (memberId: string) => {
    if (!selectedEnv) return;
    try {
      await removeEnvironmentMember(selectedEnv.id, memberId);
      toast.success("Member removed");
      loadMembers(selectedEnv);
    } catch (err) {
      toast.error((err as Error).message);
    }
  };

  const envColors: Record<string, string> = {
    production: "text-green-400",
    staging: "text-yellow-400",
    development: "text-blue-400",
    dev: "text-blue-400",
    test: "text-purple-400",
  };

  return (
    <div className="space-y-4 mt-4">
      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground">
          Environments isolate workflows, credentials, and variables. Each
          environment has its own members.
        </p>
        <Button size="sm" onClick={() => setShowCreate(true)}>
          <Plus size={13} className="mr-1" /> New Environment
        </Button>
      </div>

      {loading ? (
        <div className="flex justify-center py-8">
          <Loader2 size={20} className="animate-spin text-muted-foreground" />
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {envs.map((env) => (
            <div
              key={env.id}
              className={cn(
                "border rounded-lg p-3 transition-colors cursor-pointer hover:border-indigo-500/50",
                selectedEnv?.id === env.id
                  ? "border-indigo-500 bg-indigo-500/5"
                  : "border-border",
              )}
              onClick={() => loadMembers(env)}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Globe
                    size={14}
                    className={envColors[env.slug] ?? "text-indigo-400"}
                  />
                  <span className="text-sm font-medium">{env.name}</span>
                  <span className="text-[10px] font-mono text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                    {env.slug}
                  </span>
                  {env.isDefault && (
                    <span className="text-[10px] bg-green-500/10 text-green-400 px-1.5 py-0.5 rounded">
                      Default
                    </span>
                  )}
                </div>
                {!env.isDefault && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setDeleteTarget(env);
                    }}
                    className="text-muted-foreground hover:text-red-400"
                  >
                    <Trash2 size={12} />
                  </button>
                )}
              </div>
              <p className="text-[10px] text-muted-foreground mt-1">
                Created {fmtDate(env.createdAt)}
              </p>
            </div>
          ))}
        </div>
      )}

      {/* Members panel */}
      {selectedEnv && (
        <div className="border border-border rounded-lg p-4 mt-4">
          <h3 className="text-sm font-medium mb-3 flex items-center gap-2">
            <Users size={14} />
            Members of "{selectedEnv.name}"
          </h3>

          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-xs">User</TableHead>
                <TableHead className="text-xs">Role</TableHead>
                <TableHead className="text-xs w-16"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {members.map((m) => (
                <TableRow key={m.id}>
                  <TableCell className="text-xs font-mono">
                    {m.username}
                  </TableCell>
                  <TableCell>
                    <span
                      className={cn(
                        "text-xs px-1.5 py-0.5 rounded",
                        m.role === "admin"
                          ? "bg-indigo-500/10 text-indigo-400"
                          : "bg-muted text-muted-foreground",
                      )}
                    >
                      {m.role}
                    </span>
                  </TableCell>
                  <TableCell>
                    <button
                      onClick={() => handleRemoveMember(m.id)}
                      className="text-muted-foreground hover:text-red-400"
                    >
                      <Trash2 size={11} />
                    </button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>

          <div className="flex items-center gap-2 mt-3">
            <select
              value={addUserId}
              onChange={(e) => setAddUserId(e.target.value)}
              className={cn(inputClass, "flex-1")}
            >
              <option value="">Select user...</option>
              {allUsers
                .filter((u) => !members.some((m) => m.userId === u.id))
                .map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.username}
                  </option>
                ))}
            </select>
            <select
              value={addRole}
              onChange={(e) => setAddRole(e.target.value)}
              className={cn(inputClass, "w-28")}
            >
              <option value="admin">Admin</option>
              <option value="editor">Editor</option>
              <option value="viewer">Viewer</option>
            </select>
            <Button size="sm" onClick={handleAddMember} disabled={!addUserId}>
              <UserPlus size={13} className="mr-1" /> Add
            </Button>
          </div>
        </div>
      )}

      {/* Create dialog */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create Environment</DialogTitle>
            <DialogDescription>
              Create a new isolated environment for workflows, credentials, and
              variables.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div>
              <label className={labelClass}>Name</label>
              <input
                className={inputClass}
                value={newName}
                onChange={(e) => {
                  setNewName(e.target.value);
                  setNewSlug(
                    e.target.value
                      .toLowerCase()
                      .replace(/[^a-z0-9]+/g, "-")
                      .replace(/(^-|-$)/g, ""),
                  );
                }}
                placeholder="e.g., Staging"
              />
            </div>
            <div>
              <label className={labelClass}>Slug</label>
              <input
                className={cn(inputClass, "font-mono")}
                value={newSlug}
                onChange={(e) => setNewSlug(e.target.value)}
                placeholder="e.g., staging"
              />
              <p className="text-[10px] text-muted-foreground mt-0.5">
                Used in API URLs. Lowercase letters, numbers, and hyphens only.
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreate(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleCreate}
              disabled={creating || !newName.trim() || !newSlug.trim()}
            >
              {creating ? (
                <Loader2 size={13} className="animate-spin mr-1" />
              ) : (
                <Plus size={13} className="mr-1" />
              )}
              Create
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation */}
      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        title={`Delete "${deleteTarget?.name}" environment?`}
        description="This will permanently delete all workflows, credentials, variables, and executions in this environment. This action cannot be undone."
        confirmLabel="Delete Environment"
        destructive
        onConfirm={handleDelete}
      />
    </div>
  );
}

// ─── Organization tab ────────────────────────────────────────────────────────

function OrganizationTab() {
  const [org, setOrg] = useState<OrgDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [name, setName] = useState("");
  const [address, setAddress] = useState("");
  const [mfaEnforced, setMfaEnforced] = useState(false);
  const [saveResult, setSaveResult] = useState<{
    ok: boolean;
    msg: string;
  } | null>(null);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const data = await getOrganization();
        setOrg(data);
        setName(data.name);
        setAddress(data.address ?? "");
        setMfaEnforced(data.mfaEnforced);
      } catch {
        /* no org context */
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  async function handleSave() {
    setSaving(true);
    setSaveResult(null);
    try {
      const updated = await updateOrganization({
        name: name.trim(),
        address: address.trim(),
        mfaEnforced,
      });
      setOrg(updated);
      setMfaEnforced(updated.mfaEnforced);
      setSaveResult({ ok: true, msg: "Organization updated." });
    } catch (err) {
      setSaveResult({ ok: false, msg: (err as Error).message });
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8 text-muted-foreground">
        <Loader2 size={16} className="animate-spin mr-2" /> Loading…
      </div>
    );
  }

  if (!org) {
    return (
      <div className="px-5 py-4 text-xs text-muted-foreground">
        No organization context. Please select an organization first.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <div className="flex items-center gap-2 mb-1">
          <Building2 size={14} className="text-muted-foreground" />
          <h2 className="text-sm font-semibold text-foreground">
            Organization Details
          </h2>
        </div>
        <p className="text-xs text-muted-foreground mb-4">
          Manage your organization's name and address. Only admins and owners
          can edit these settings.
        </p>

        <div className="bg-card border border-border rounded-xl overflow-hidden">
          <div className="px-5 py-4 space-y-4">
            <div>
              <label className={labelClass}>Organization Name</label>
              <input
                className={inputClass}
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="My Organization"
              />
            </div>
            <div>
              <label className={labelClass}>Slug</label>
              <input
                className={
                  inputClass + " font-mono bg-muted/50 cursor-not-allowed"
                }
                type="text"
                value={org.slug}
                disabled
              />
              <p className="text-[10px] text-muted-foreground mt-0.5">
                Slug cannot be changed after creation.
              </p>
            </div>
            <div>
              <label className={labelClass}>Address</label>
              <textarea
                className={inputClass + " min-h-[80px] resize-y"}
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="123 Main Street&#10;City, State 12345&#10;Country"
                rows={3}
              />
            </div>
            <div className="border border-border rounded-lg p-3 bg-muted/20">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-sm font-medium text-foreground flex items-center gap-1.5">
                    <ShieldCheck size={14} className="text-primary" />
                    Enforce MFA org-wide
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    When enabled, members without MFA will be blocked until they
                    enroll in at least one method.
                  </p>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={mfaEnforced}
                  onClick={() => setMfaEnforced((v) => !v)}
                  className={cn(
                    "relative inline-flex h-6 w-11 items-center rounded-full border transition-colors",
                    mfaEnforced
                      ? "bg-indigo-600 border-indigo-500"
                      : "bg-secondary border-border",
                  )}
                >
                  <span
                    className={cn(
                      "inline-block h-4 w-4 transform rounded-full bg-white transition-transform",
                      mfaEnforced ? "translate-x-6" : "translate-x-1",
                    )}
                  />
                </button>
              </div>
              {mfaEnforced && (
                <p className="mt-2 text-[11px] text-amber-500 flex items-center gap-1">
                  <AlertTriangle size={11} />
                  Users will be restricted to MFA enrollment actions until
                  enrollment is complete.
                </p>
              )}
            </div>
          </div>

          <div className="px-5 py-3 border-t border-border flex items-center justify-between">
            <div className="flex items-center gap-3">
              <button
                onClick={handleSave}
                disabled={saving}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded bg-indigo-600 hover:bg-indigo-500 text-white transition-colors disabled:opacity-60"
              >
                {saving ? (
                  <Loader2 size={12} className="animate-spin" />
                ) : (
                  <Save size={12} />
                )}
                {saving ? "Saving…" : "Save Changes"}
              </button>
              {saveResult && <ResultPill {...saveResult} />}
            </div>
            <div className="text-[10px] text-muted-foreground">
              Created {fmtDate(org.createdAt)}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Security (MFA) tab ───────────────────────────────────────────────────────

function SecurityTab() {
  const [status, setStatus] = useState<MfaStatus | null>(null);
  const [loading, setLoading] = useState(true);

  // TOTP setup flow
  const [totpSetup, setTotpSetup] = useState<TotpSetupResult | null>(null);
  const [totpCode, setTotpCode] = useState("");
  const [totpLoading, setTotpLoading] = useState(false);
  const [totpError, setTotpError] = useState("");

  // Disable TOTP
  const [showDisableTotp, setShowDisableTotp] = useState(false);
  const [disableTotpCode, setDisableTotpCode] = useState("");
  const [disableTotpLoading, setDisableTotpLoading] = useState(false);
  const [disableTotpError, setDisableTotpError] = useState("");

  // Email toggle
  const [emailLoading, setEmailLoading] = useState(false);

  // Backup codes
  const [backupCodes, setBackupCodes] = useState<string[] | null>(null);
  const [showRegenBackup, setShowRegenBackup] = useState(false);
  const [regenCode, setRegenCode] = useState("");
  const [regenLoading, setRegenLoading] = useState(false);
  const [regenError, setRegenError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setStatus(await getMfaStatus());
    } catch {
      /* ignore */
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // ── TOTP setup ────────────────────────────────────────────────────────────

  const startTotpSetup = async () => {
    setTotpError("");
    setTotpLoading(true);
    try {
      setTotpSetup(await setupTotp());
    } catch (e) {
      setTotpError((e as Error).message);
    } finally {
      setTotpLoading(false);
    }
  };

  const confirmTotpEnable = async () => {
    if (!totpCode.trim()) {
      setTotpError("Enter the 6-digit code");
      return;
    }
    setTotpError("");
    setTotpLoading(true);
    try {
      const { backupCodes: codes } = await enableTotp(totpCode.trim());
      setBackupCodes(codes);
      setTotpSetup(null);
      setTotpCode("");
      toast.success("Authenticator app enabled");
      await load();
    } catch (e) {
      setTotpError((e as Error).message);
    } finally {
      setTotpLoading(false);
    }
  };

  const confirmTotpDisable = async () => {
    if (!disableTotpCode.trim()) {
      setDisableTotpError("Enter the 6-digit code");
      return;
    }
    setDisableTotpError("");
    setDisableTotpLoading(true);
    try {
      await disableTotp(disableTotpCode.trim());
      setShowDisableTotp(false);
      setDisableTotpCode("");
      toast.success("Authenticator app disabled");
      await load();
    } catch (e) {
      setDisableTotpError((e as Error).message);
    } finally {
      setDisableTotpLoading(false);
    }
  };

  // ── Email OTP ─────────────────────────────────────────────────────────────

  const toggleEmailOtp = async () => {
    setEmailLoading(true);
    try {
      if (status?.emailEnabled) {
        await disableEmailOtp();
        toast.success("Email OTP disabled");
      } else {
        await enableEmailOtp();
        toast.success("Email OTP enabled");
      }
      await load();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setEmailLoading(false);
    }
  };

  // ── Backup codes ──────────────────────────────────────────────────────────

  const confirmRegenBackup = async () => {
    if (!regenCode.trim()) {
      setRegenError("Enter your TOTP code");
      return;
    }
    setRegenError("");
    setRegenLoading(true);
    try {
      const { backupCodes: codes } = await regenerateBackupCodes(
        regenCode.trim(),
      );
      setBackupCodes(codes);
      setShowRegenBackup(false);
      setRegenCode("");
      await load();
    } catch (e) {
      setRegenError((e as Error).message);
    } finally {
      setRegenLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-muted-foreground py-8">
        <Loader2 size={16} className="animate-spin" /> Loading security
        settings…
      </div>
    );
  }

  return (
    <div className="space-y-6 py-4">
      {/* Backup codes display (shown after enabling TOTP or regenerating) */}
      {backupCodes && (
        <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-4 space-y-3">
          <div className="flex items-center gap-2 text-amber-500 font-medium text-sm">
            <AlertTriangle size={14} /> Save your backup codes
          </div>
          <p className="text-xs text-muted-foreground">
            Store these codes somewhere safe. Each can be used once to access
            your account if you lose your authenticator.
          </p>
          <div className="grid grid-cols-2 gap-1.5">
            {backupCodes.map((c) => (
              <code
                key={c}
                className="bg-secondary rounded px-2 py-1 text-xs font-mono text-center"
              >
                {c}
              </code>
            ))}
          </div>
          <Button
            size="sm"
            variant="outline"
            onClick={() => setBackupCodes(null)}
          >
            I've saved these codes
          </Button>
        </div>
      )}

      {/* TOTP */}
      <div className="bg-card border border-border rounded-xl p-5 space-y-4">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10">
              <Smartphone size={16} className="text-primary" />
            </div>
            <div>
              <div className="text-sm font-medium text-foreground">
                Authenticator App (TOTP)
              </div>
              <div className="text-xs text-muted-foreground mt-0.5">
                Use an app like Google Authenticator, Authy, or 1Password.
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {status?.totpEnabled ? (
              <span className="flex items-center gap-1 text-xs text-emerald-500 bg-emerald-500/10 border border-emerald-500/20 rounded-full px-2 py-0.5">
                <CheckCircle2 size={11} /> Enabled
              </span>
            ) : (
              <span className="text-xs text-muted-foreground">Disabled</span>
            )}
          </div>
        </div>

        {!status?.totpEnabled && !totpSetup && (
          <Button size="sm" onClick={startTotpSetup} disabled={totpLoading}>
            {totpLoading ? (
              <Loader2 size={12} className="animate-spin mr-1" />
            ) : (
              <Plus size={12} className="mr-1" />
            )}
            Set up authenticator
          </Button>
        )}

        {/* Setup flow */}
        {totpSetup && (
          <div className="space-y-4 border-t border-border pt-4">
            <p className="text-xs text-muted-foreground">
              Scan this QR code with your authenticator app, then enter the
              6-digit code to confirm.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 items-start">
              <img
                src={totpSetup.qrCodeUrl}
                alt="TOTP QR code"
                className="w-36 h-36 rounded-lg border border-border"
              />
              <div className="space-y-2 flex-1">
                <div className="text-xs text-muted-foreground">
                  Or enter this secret manually:
                </div>
                <code className="block bg-secondary rounded px-2 py-1 text-xs font-mono break-all">
                  {totpSetup.secret}
                </code>
              </div>
            </div>
            <div className="flex gap-2 items-end">
              <div className="flex-1 space-y-1.5">
                <label className="text-xs text-muted-foreground font-medium">
                  Verification code
                </label>
                <input
                  type="text"
                  inputMode="numeric"
                  maxLength={6}
                  value={totpCode}
                  onChange={(e) => setTotpCode(e.target.value)}
                  placeholder="000000"
                  className="w-full px-3 py-1.5 text-sm bg-secondary border border-border rounded text-foreground placeholder-muted-foreground focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary tracking-widest text-center"
                  autoFocus
                />
              </div>
              <Button
                size="sm"
                onClick={confirmTotpEnable}
                disabled={totpLoading}
              >
                {totpLoading ? (
                  <Loader2 size={12} className="animate-spin mr-1" />
                ) : null}
                Verify & enable
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  setTotpSetup(null);
                  setTotpCode("");
                  setTotpError("");
                }}
              >
                Cancel
              </Button>
            </div>
            {totpError && (
              <p className="text-xs text-destructive">{totpError}</p>
            )}
          </div>
        )}

        {status?.totpEnabled && !showDisableTotp && (
          <div className="flex items-center gap-3 border-t border-border pt-3">
            <Button
              size="sm"
              variant="outline"
              onClick={() => setShowDisableTotp(true)}
            >
              Disable
            </Button>
            {status.backupCodesRemaining > 0 && (
              <span className="text-xs text-muted-foreground">
                {status.backupCodesRemaining} backup codes remaining
              </span>
            )}
            <Button
              size="sm"
              variant="ghost"
              className="ml-auto text-xs"
              onClick={() => setShowRegenBackup(true)}
            >
              <RefreshCw size={11} className="mr-1" /> Regenerate backup codes
            </Button>
          </div>
        )}

        {showDisableTotp && (
          <div className="space-y-3 border-t border-border pt-4">
            <p className="text-xs text-muted-foreground">
              Enter your current TOTP code to confirm disabling.
            </p>
            <div className="flex gap-2 items-end">
              <input
                type="text"
                inputMode="numeric"
                maxLength={6}
                value={disableTotpCode}
                onChange={(e) => setDisableTotpCode(e.target.value)}
                placeholder="000000"
                className="flex-1 px-3 py-1.5 text-sm bg-secondary border border-border rounded text-foreground placeholder-muted-foreground focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary tracking-widest text-center"
                autoFocus
              />
              <Button
                size="sm"
                variant="destructive"
                onClick={confirmTotpDisable}
                disabled={disableTotpLoading}
              >
                {disableTotpLoading ? (
                  <Loader2 size={12} className="animate-spin mr-1" />
                ) : null}
                Disable
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  setShowDisableTotp(false);
                  setDisableTotpCode("");
                  setDisableTotpError("");
                }}
              >
                Cancel
              </Button>
            </div>
            {disableTotpError && (
              <p className="text-xs text-destructive">{disableTotpError}</p>
            )}
          </div>
        )}
      </div>

      {/* Email OTP */}
      <div className="bg-card border border-border rounded-xl p-5">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10">
              <Mail size={16} className="text-primary" />
            </div>
            <div>
              <div className="text-sm font-medium text-foreground">
                Email OTP
              </div>
              <div className="text-xs text-muted-foreground mt-0.5">
                Receive a one-time code to your email address each time you log
                in.
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {status?.emailEnabled ? (
              <span className="flex items-center gap-1 text-xs text-emerald-500 bg-emerald-500/10 border border-emerald-500/20 rounded-full px-2 py-0.5">
                <CheckCircle2 size={11} /> Enabled
              </span>
            ) : (
              <span className="text-xs text-muted-foreground">Disabled</span>
            )}
            <Button
              size="sm"
              variant={status?.emailEnabled ? "outline" : "default"}
              onClick={toggleEmailOtp}
              disabled={emailLoading}
            >
              {emailLoading ? (
                <Loader2 size={12} className="animate-spin mr-1" />
              ) : status?.emailEnabled ? (
                <XCircle size={12} className="mr-1" />
              ) : (
                <CheckCircle2 size={12} className="mr-1" />
              )}
              {status?.emailEnabled ? "Disable" : "Enable"}
            </Button>
          </div>
        </div>
      </div>

      {/* Regenerate backup codes dialog */}
      <Dialog
        open={showRegenBackup}
        onOpenChange={(o) => {
          if (!o) {
            setShowRegenBackup(false);
            setRegenCode("");
            setRegenError("");
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Regenerate backup codes</DialogTitle>
            <DialogDescription>
              Enter your current TOTP code to regenerate 10 new backup codes.
              Your old codes will be invalidated.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <label className="text-xs text-muted-foreground font-medium">
              TOTP code
            </label>
            <input
              type="text"
              inputMode="numeric"
              maxLength={6}
              value={regenCode}
              onChange={(e) => setRegenCode(e.target.value)}
              placeholder="000000"
              className="w-full px-3 py-1.5 text-sm bg-secondary border border-border rounded text-foreground placeholder-muted-foreground focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary tracking-widest text-center"
              autoFocus
            />
            {regenError && (
              <p className="text-xs text-destructive">{regenError}</p>
            )}
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setShowRegenBackup(false);
                setRegenCode("");
                setRegenError("");
              }}
            >
              Cancel
            </Button>
            <Button onClick={confirmRegenBackup} disabled={regenLoading}>
              {regenLoading ? (
                <Loader2 size={12} className="animate-spin mr-1" />
              ) : null}
              Regenerate
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─── Page ────────────────────────────────────────────────────────────────────

export function SettingsPage(): React.ReactElement {
  return (
    <div className="px-8 py-6 max-w-4xl mx-auto">
      <PageHeader icon={Settings} title="Settings" />

      <Tabs defaultValue="organization" className="w-full">
        <TabsList>
          <TabsTrigger value="organization">
            <Building2 size={13} className="mr-1.5" />
            Organization
          </TabsTrigger>
          <TabsTrigger value="users">
            <Users size={13} className="mr-1.5" />
            Users
          </TabsTrigger>
          <TabsTrigger value="environments">
            <Globe size={13} className="mr-1.5" />
            Environments
          </TabsTrigger>
          <TabsTrigger value="git">
            <GitBranch size={13} className="mr-1.5" />
            Git Integration
          </TabsTrigger>
          <TabsTrigger value="tokens">
            <Key size={13} className="mr-1.5" />
            API Tokens
          </TabsTrigger>
          <TabsTrigger value="security">
            <ShieldCheck size={13} className="mr-1.5" />
            Security
          </TabsTrigger>
        </TabsList>
        <TabsContent value="organization">
          <OrganizationTab />
        </TabsContent>
        <TabsContent value="users">
          <UsersTab />
        </TabsContent>
        <TabsContent value="environments">
          <EnvironmentsTab />
        </TabsContent>
        <TabsContent value="git">
          <GitTab />
        </TabsContent>
        <TabsContent value="tokens">
          <ApiTokensTab />
        </TabsContent>
        <TabsContent value="security">
          <SecurityTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}
