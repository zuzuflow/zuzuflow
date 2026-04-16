import type { WorkflowTemplate, ExecutionStatus } from "@workflow/shared";
import { getApiConfig } from "../store/apiConfigStore";
import { getEnvironmentState } from "../store/environmentStore";
import type { EnvironmentItem } from "../store/environmentStore";
import type { OrgItem } from "../store/orgStore";

// ─── Base URL (fixed at build time) ──────────────────────────────────────────

export const API_BASE_URL =
  (import.meta.env.VITE_API_URL as string | undefined) ?? "/api";

// ─── Environment-scoped path helper ──────────────────────────────────────────

/**
 * Returns the current environment slug prefix for API calls.
 * Scoped routes are prefixed with /env/{slug}/.
 */
function envPrefix(): string {
  const slug = getEnvironmentState().currentSlug;
  return slug ? `/env/${slug}` : "/env/production";
}

// ─── Generic fetch helper ─────────────────────────────────────────────────────

export async function request<T>(
  path: string,
  options?: RequestInit
): Promise<T> {
  const { token, clearAuth } = getApiConfig();
  const url = `${API_BASE_URL}${path}`;

  const authHeaders: Record<string, string> = token
    ? { Authorization: `Bearer ${token}` }
    : {};

  const res = await fetch(url, {
    headers: {
      "Content-Type": "application/json",
      ...authHeaders,
      ...(options?.headers ?? {}),
    },
    ...options,
  });

  // Auto-logout on 401 (token expired / revoked)
  if (res.status === 401) {
    clearAuth();
    throw new Error(`API ${options?.method ?? "GET"} ${path} → 401: Unauthorized`);
  }

  if (!res.ok) {
    const text = await res.text().catch(() => res.statusText);
    throw new Error(`API ${options?.method ?? "GET"} ${path} → ${res.status}: ${text}`);
  }

  // DELETE returns 204 with no body
  if (res.status === 204) {
    return undefined as unknown as T;
  }

  return res.json() as Promise<T>;
}

// ─── Auth API ─────────────────────────────────────────────────────────────────

export interface UserPublic {
  id: string;
  username: string;
  email: string;
  role: "admin" | "editor";
  lastLoginAt?: string;
  lastLoginIp?: string;
  createdAt: string;
}

export interface OrgDetail {
  id: string;
  name: string;
  slug: string;
  address?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ApiTokenPublic {
  id: string;
  name: string;
  userId: string;
  createdAt: string;
  lastUsedAt: string | null;
}

export interface ApiTokenCreated extends ApiTokenPublic {
  token: string; // raw token — shown once only
}

// ─── Auth result types ───────────────────────────────────────────────────────

export interface LoginResult {
  token: string;
  user: { id: string; username: string; email?: string; role: string };
  organization?: { id: string; name: string; slug: string };
  organizations?: Array<{ id: string; name: string; slug: string; role: string }>;
}

/**
 * Login with username/email + password. Stores returned JWT in apiConfigStore.
 * Returns the full login result so the caller can handle multi-org scenarios.
 */
export async function login(usernameOrEmail: string, password: string): Promise<LoginResult> {
  const res = await fetch(`${API_BASE_URL}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ usernameOrEmail, password }),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({})) as { error?: string };
    throw new Error(data.error || "Invalid credentials");
  }
  const result = await res.json() as LoginResult;
  getApiConfig().setToken(result.token);
  return result;
}

/**
 * Signup with org name, username, email, and password.
 * Creates a new organization and user account.
 */
export async function signup(
  orgName: string,
  username: string,
  email: string,
  password: string
): Promise<LoginResult> {
  const res = await fetch(`${API_BASE_URL}/auth/signup`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ orgName, username, email, password }),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({})) as { error?: string };
    throw new Error(data.error || "Signup failed");
  }
  const result = await res.json() as LoginResult;
  getApiConfig().setToken(result.token);
  return result;
}

/**
 * List organizations the current user belongs to.
 */
export function listMyOrganizations(): Promise<OrgItem[]> {
  return request<OrgItem[]>("/auth/organizations");
}

/**
 * Switch to a different organization. Returns a new JWT scoped to that org.
 */
export async function switchOrganization(organizationId: string): Promise<string> {
  const result = await request<{ token: string }>("/auth/switch-org", {
    method: "POST",
    body: JSON.stringify({ organizationId }),
  });
  getApiConfig().setToken(result.token);
  return result.token;
}

// ─── User management API ──────────────────────────────────────────────────────

export function listUsers(): Promise<UserPublic[]> {
  return request<UserPublic[]>("/auth/users");
}

export function createUser(username: string, email: string, password: string, role?: "admin" | "editor"): Promise<UserPublic> {
  return request<UserPublic>("/auth/users", {
    method: "POST",
    body: JSON.stringify({ username, email, password, role }),
  });
}

export function getOrganization(): Promise<OrgDetail> {
  return request<OrgDetail>("/auth/organization");
}

export function updateOrganization(data: { name?: string; address?: string }): Promise<OrgDetail> {
  return request<OrgDetail>("/auth/organization", {
    method: "PUT",
    body: JSON.stringify(data),
  });
}

export function changePassword(userId: string, password: string): Promise<void> {
  return request<void>(`/auth/users/${userId}/password`, {
    method: "PUT",
    body: JSON.stringify({ password }),
  });
}

export function deleteUser(userId: string): Promise<void> {
  return request<void>(`/auth/users/${userId}`, { method: "DELETE" });
}

// ─── API token management ─────────────────────────────────────────────────────

export function listApiTokens(): Promise<ApiTokenPublic[]> {
  return request<ApiTokenPublic[]>("/auth/tokens");
}

export function createApiToken(name: string): Promise<ApiTokenCreated> {
  return request<ApiTokenCreated>("/auth/tokens", {
    method: "POST",
    body: JSON.stringify({ name }),
  });
}

export function revokeApiToken(id: string): Promise<void> {
  return request<void>(`/auth/tokens/${id}`, { method: "DELETE" });
}

// ─── Workflow types ───────────────────────────────────────────────────────────

export interface WorkflowExecStats {
  totalExecutions: number;
  completed: number;
  failed: number;
  running: number;
  avgDurationMs: number | null;
  lastExecution: {
    id: string;
    status: string;
    startedAt: string;
    completedAt?: string | null;
    durationMs: number | null;
  } | null;
}

export interface WorkflowListItem {
  id: string;
  /** Stable, export/import-safe identifier (e.g. `"wf_a7b3k2m9pq"`). */
  key: string;
  name: string;
  description?: string;
  status: string; // "draft" | "active" | "inactive" | "archived"
  version?: number;
  folderId: string | null;
  stats?: WorkflowExecStats;
  isSubworkflow?: boolean;
  tags?: string[];
  createdAt: string;
  updatedAt: string;
}

// ─── Tag types ────────────────────────────────────────────────────────────────

export interface Tag {
  name: string;
  color: string | null;
  count: number;
}

// ─── Folder types ─────────────────────────────────────────────────────────────

export interface FolderItem {
  id: string;
  name: string;
  parentId: string | null;
  createdAt: string;
  updatedAt: string;
}

// ─── Git / Settings types ─────────────────────────────────────────────────────

export type GitProvider = "github" | "bitbucket" | "gitlab" | "custom";

export interface GitConfig {
  provider: GitProvider;
  repoUrl: string;
  branch: string;
  username?: string;
  token: string;
}

export interface GitStatus {
  configured: boolean;
  lastPush?: string;
  lastPull?: string;
}

export interface WorkflowDetail extends WorkflowListItem {
  template: WorkflowTemplate;
}

export interface PaginatedResult<T> {
  total: number;
  items: T[];
  limit: number;
  offset: number;
}

export interface CreateWorkflowPayload {
  name: string;
  description?: string;
  template: WorkflowTemplate;
  isSubworkflow?: boolean;
  tags?: string[];
  /** Optional stable key; auto-generated server-side when omitted. */
  key?: string;
}

export interface UpdateWorkflowPayload {
  name?: string;
  description?: string;
  template?: WorkflowTemplate;
  tags?: string[];
  /** Rename the stable key (unique per env). */
  key?: string;
}

// ─── Execution types ──────────────────────────────────────────────────────────

export interface ExecutionLogEntry {
  id: string;
  nodeId: string;
  nodeKind: string;
  level: "debug" | "info" | "warn" | "error";
  message: string;
  data?: Record<string, unknown>;
  createdAt: string;
}

export interface ExecutionDetail {
  id: string;
  workflowId: string;
  status: ExecutionStatus;
  startedAt: string;
  completedAt?: string;
  triggerPayload?: Record<string, unknown>;
  error?: string | null;
  output?: unknown;
  /** Present when the list endpoint includes the parent workflow */
  workflow?: { id: string; name: string } | null;
  logs?: ExecutionLogEntry[];
}

export interface ExecutionListFilters {
  workflowId?: string;
  status?: ExecutionStatus;
  /** Free-text search on error message or workflow name */
  q?: string;
  /** ISO timestamp lower bound (inclusive) on startedAt */
  from?: string;
  /** ISO timestamp upper bound (inclusive) on startedAt */
  to?: string;
  limit?: number;
  offset?: number;
}

export interface ExecutionNodeMeta {
  nodeId: string;
  nodeKind: string;
}

export interface ExecutionLogsResult {
  execution: { id: string; status: ExecutionStatus; workflowId: string; startedAt: string; completedAt?: string };
  total: number;
  logs: ExecutionLogEntry[];
  nodes: ExecutionNodeMeta[];
  limit: number;
  offset: number;
}

export interface ExecutionLogsFilter {
  nodeId?: string;
  nodeKind?: string;
  level?: string;
  search?: string;
  limit?: number;
  offset?: number;
}

/** A single log line as returned by the cross-execution search endpoint. */
export interface LogSearchItem {
  id: string;
  executionId: string;
  nodeId: string;
  nodeKind: string;
  level: "debug" | "info" | "warn" | "error";
  message: string;
  data?: Record<string, unknown> | null;
  createdAt: string;
  execution: {
    id: string;
    status: ExecutionStatus;
    workflowId: string;
    workflow: { name: string } | null;
  };
}

export interface LogSearchFilters {
  q?: string;
  level?: "debug" | "info" | "warn" | "error";
  workflowId?: string;
  nodeKind?: string;
  from?: string;
  to?: string;
  limit?: number;
  offset?: number;
}

// ─── Environment API (global — not scoped) ───────────────────────────────────

export { EnvironmentItem };

export function listEnvironments(): Promise<EnvironmentItem[]> {
  return request<EnvironmentItem[]>("/environments");
}

export function createEnvironment(name: string, slug: string): Promise<EnvironmentItem> {
  return request<EnvironmentItem>("/environments", {
    method: "POST",
    body: JSON.stringify({ name, slug }),
  });
}

export function updateEnvironment(id: string, data: { name?: string; slug?: string }): Promise<EnvironmentItem> {
  return request<EnvironmentItem>(`/environments/${id}`, {
    method: "PUT",
    body: JSON.stringify(data),
  });
}

export function deleteEnvironment(id: string): Promise<void> {
  return request<void>(`/environments/${id}`, { method: "DELETE" });
}

export interface EnvironmentMember {
  id: string;
  userId: string;
  username: string;
  role: string;
  createdAt: string;
}

export function listEnvironmentMembers(envId: string): Promise<EnvironmentMember[]> {
  return request<EnvironmentMember[]>(`/environments/${envId}/members`);
}

export function addEnvironmentMember(envId: string, userId: string, role?: string): Promise<EnvironmentMember> {
  return request<EnvironmentMember>(`/environments/${envId}/members`, {
    method: "POST",
    body: JSON.stringify({ userId, role }),
  });
}

export function removeEnvironmentMember(envId: string, memberId: string): Promise<void> {
  return request<void>(`/environments/${envId}/members/${memberId}`, { method: "DELETE" });
}

// ─── Workflow API (environment-scoped) ───────────────────────────────────────

export interface WorkflowListFilters {
  folderId?: string;
  /** OR filter — return workflows tagged with any of these names */
  tagsAny?: string[];
  /** AND filter — return workflows tagged with every one of these names */
  tagsAll?: string[];
  limit?: number;
  offset?: number;
}

export function listWorkflows(
  filters?: string | WorkflowListFilters
): Promise<PaginatedResult<WorkflowListItem>> {
  // Backwards-compat: a bare string is treated as folderId
  const f: WorkflowListFilters =
    typeof filters === "string" ? { folderId: filters } : filters ?? {};

  const params = new URLSearchParams();
  if (f.folderId) params.set("folderId", f.folderId);
  if (f.tagsAny && f.tagsAny.length > 0) params.set("tags", f.tagsAny.join(","));
  if (f.tagsAll && f.tagsAll.length > 0) params.set("tagsAll", f.tagsAll.join(","));
  params.set("limit", String(f.limit ?? 200));
  if (f.offset) params.set("offset", String(f.offset));

  return request<PaginatedResult<WorkflowListItem>>(
    `${envPrefix()}/workflows?${params.toString()}`
  );
}

// ─── Tag API (environment-scoped) ─────────────────────────────────────────────

export function listTags(): Promise<Tag[]> {
  return request<Tag[]>(`${envPrefix()}/tags`);
}

export function updateTag(
  name: string,
  input: { name?: string; color?: string | null }
): Promise<Tag> {
  return request<Tag>(`${envPrefix()}/tags/${encodeURIComponent(name)}`, {
    method: "PATCH",
    body: JSON.stringify(input),
  });
}

export function deleteTag(name: string): Promise<void> {
  return request<void>(`${envPrefix()}/tags/${encodeURIComponent(name)}`, {
    method: "DELETE",
  });
}

export function listSubworkflows(): Promise<PaginatedResult<WorkflowListItem>> {
  return request<PaginatedResult<WorkflowListItem>>(`${envPrefix()}/workflows?isSubworkflow=true&limit=200`);
}

// ─── Folder API ───────────────────────────────────────────────────────────────

export function listFolders(): Promise<FolderItem[]> {
  return request<FolderItem[]>(`${envPrefix()}/folders`);
}

export function createFolder(name: string, parentId?: string): Promise<FolderItem> {
  return request<FolderItem>(`${envPrefix()}/folders`, { method: "POST", body: JSON.stringify({ name, parentId }) });
}

export function renameFolder(id: string, name: string): Promise<FolderItem> {
  return request<FolderItem>(`${envPrefix()}/folders/${id}`, { method: "PUT", body: JSON.stringify({ name }) });
}

export function moveFolder(id: string, parentId: string | null): Promise<FolderItem> {
  return request<FolderItem>(`${envPrefix()}/folders/${id}/move`, { method: "PATCH", body: JSON.stringify({ parentId }) });
}

export function deleteFolder(id: string): Promise<void> {
  return request<void>(`${envPrefix()}/folders/${id}`, { method: "DELETE" });
}

export function moveWorkflowToFolder(workflowId: string, folderId: string | null): Promise<void> {
  return request<void>(`${envPrefix()}/workflows/${workflowId}`, {
    method: "PUT",
    body: JSON.stringify({ folderId }),
  });
}

// ─── Git API ──────────────────────────────────────────────────────────────────

export function getGitConfig(): Promise<GitConfig | null> {
  return request<GitConfig | null>("/git/config");
}

export function saveGitConfig(cfg: GitConfig): Promise<void> {
  return request<void>("/git/config", { method: "PUT", body: JSON.stringify(cfg) });
}

export function getGitStatus(): Promise<GitStatus> {
  return request<GitStatus>("/git/status");
}

export function gitPush(): Promise<{ committed: number; message: string }> {
  return request<{ committed: number; message: string }>("/git/push", { method: "POST" });
}

export function gitPull(): Promise<{ upserted: number; message: string }> {
  return request<{ upserted: number; message: string }>("/git/pull", { method: "POST" });
}

export function createWorkflow(payload: CreateWorkflowPayload): Promise<WorkflowDetail> {
  return request<WorkflowDetail>(`${envPrefix()}/workflows`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function getWorkflow(id: string): Promise<WorkflowDetail> {
  return request<WorkflowDetail>(`${envPrefix()}/workflows/${id}`);
}

export function updateWorkflow(
  id: string,
  payload: UpdateWorkflowPayload
): Promise<WorkflowDetail> {
  return request<WorkflowDetail>(`${envPrefix()}/workflows/${id}`, {
    method: "PUT",
    body: JSON.stringify(payload),
  });
}

export function deleteWorkflow(id: string): Promise<void> {
  return request<void>(`${envPrefix()}/workflows/${id}`, { method: "DELETE" });
}

export function activateWorkflow(id: string): Promise<WorkflowDetail> {
  return request<WorkflowDetail>(`${envPrefix()}/workflows/${id}/activate`, { method: "POST" });
}

export function deactivateWorkflow(id: string): Promise<WorkflowDetail> {
  return request<WorkflowDetail>(`${envPrefix()}/workflows/${id}/deactivate`, { method: "POST" });
}

// ─── Execution API ────────────────────────────────────────────────────────────

export function startExecution(
  workflowId: string,
  triggerPayload?: Record<string, unknown>
): Promise<ExecutionDetail> {
  return request<ExecutionDetail>(`${envPrefix()}/executions/start`, {
    method: "POST",
    body: JSON.stringify({ workflowId, triggerPayload }),
  });
}

export function getExecution(id: string): Promise<ExecutionDetail> {
  return request<ExecutionDetail>(`${envPrefix()}/executions/${id}`);
}

export function cancelExecution(id: string): Promise<void> {
  return request<void>(`${envPrefix()}/executions/${id}`, { method: "DELETE" });
}

export function listExecutions(
  filtersOrWorkflowId: string | ExecutionListFilters = {}
): Promise<PaginatedResult<ExecutionDetail>> {
  const filters: ExecutionListFilters =
    typeof filtersOrWorkflowId === "string"
      ? { workflowId: filtersOrWorkflowId, limit: 50 }
      : filtersOrWorkflowId;

  const params = new URLSearchParams();
  if (filters.workflowId) params.set("workflowId", filters.workflowId);
  if (filters.status) params.set("status", filters.status);
  if (filters.q && filters.q.trim()) params.set("q", filters.q.trim());
  if (filters.from) params.set("from", filters.from);
  if (filters.to) params.set("to", filters.to);
  params.set("limit", String(filters.limit ?? 50));
  if (filters.offset) params.set("offset", String(filters.offset));

  return request<PaginatedResult<ExecutionDetail>>(
    `${envPrefix()}/executions?${params.toString()}`
  );
}

export function searchLogs(filters: LogSearchFilters = {}): Promise<PaginatedResult<LogSearchItem>> {
  const params = new URLSearchParams();
  if (filters.q && filters.q.trim()) params.set("q", filters.q.trim());
  if (filters.level) params.set("level", filters.level);
  if (filters.workflowId) params.set("workflowId", filters.workflowId);
  if (filters.nodeKind) params.set("nodeKind", filters.nodeKind);
  if (filters.from) params.set("from", filters.from);
  if (filters.to) params.set("to", filters.to);
  params.set("limit", String(filters.limit ?? 100));
  if (filters.offset) params.set("offset", String(filters.offset));
  return request<PaginatedResult<LogSearchItem>>(
    `${envPrefix()}/executions/logs/search?${params.toString()}`
  );
}

export function getExecutionLogs(id: string, filters?: ExecutionLogsFilter): Promise<ExecutionLogsResult> {
  const params = new URLSearchParams();
  if (filters?.nodeId) params.set("nodeId", filters.nodeId);
  if (filters?.nodeKind) params.set("nodeKind", filters.nodeKind);
  if (filters?.level) params.set("level", filters.level);
  if (filters?.search) params.set("search", filters.search);
  if (filters?.limit) params.set("limit", String(filters.limit));
  if (filters?.offset) params.set("offset", String(filters.offset));
  const qs = params.toString();
  return request<ExecutionLogsResult>(`${envPrefix()}/executions/${id}/logs${qs ? `?${qs}` : ""}`);
}

// ─── Credential types ─────────────────────────────────────────────────────────

export type CredentialKind =
  | "postgres"
  | "mysql"
  | "mariadb"
  | "mssql"
  | "mongodb"
  | "redis"
  | "smtp"
  | "sendgrid"
  | "mqtt"
  | "rabbitmq"
  | "http_bearer"
  | "http_basic"
  | "http_api_key"
  | "webhook_hmac"
  | "webhook_basic"
  | "webhook_jwt"
  | "aws"
  | "google_sheets"
  | "firebase"
  | "apns"
  | "slack"
  | "ssh"
  | "twilio"
  | "openai"
  | "anthropic"
  | "gemini"
  | "huggingface"
  | "generic";

export interface CredentialItem {
  id: string;
  name: string;
  kind: CredentialKind;
  createdAt: string;
  updatedAt: string;
}

// ─── Credential API ───────────────────────────────────────────────────────────

export function listCredentials(): Promise<CredentialItem[]> {
  return request<CredentialItem[]>(`${envPrefix()}/credentials`);
}

export function createCredential(payload: {
  name: string;
  kind: CredentialKind;
  data: Record<string, string>;
}): Promise<CredentialItem> {
  return request<CredentialItem>(`${envPrefix()}/credentials`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function updateCredential(
  id: string,
  payload: { name?: string; data?: Record<string, string> }
): Promise<CredentialItem> {
  return request<CredentialItem>(`${envPrefix()}/credentials/${id}`, {
    method: "PUT",
    body: JSON.stringify(payload),
  });
}

export function deleteCredential(id: string): Promise<void> {
  return request<void>(`${envPrefix()}/credentials/${id}`, { method: "DELETE" });
}

// ─── Variable types ───────────────────────────────────────────────────────────

export interface VariableItem {
  id: string;
  key: string;
  /** Masked as "••••••" for secret variables */
  value: string;
  description: string | null;
  isSecret: boolean;
  createdAt: string;
  updatedAt: string;
}

// ─── Variable API ─────────────────────────────────────────────────────────────

export function listVariables(): Promise<VariableItem[]> {
  return request<VariableItem[]>(`${envPrefix()}/variables`);
}

export function createVariable(payload: {
  key: string;
  value: string;
  description?: string;
  isSecret?: boolean;
}): Promise<VariableItem> {
  return request<VariableItem>(`${envPrefix()}/variables`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function updateVariable(
  id: string,
  payload: { key?: string; value?: string; description?: string }
): Promise<VariableItem> {
  return request<VariableItem>(`${envPrefix()}/variables/${id}`, {
    method: "PUT",
    body: JSON.stringify(payload),
  });
}

export function deleteVariable(id: string): Promise<void> {
  return request<void>(`${envPrefix()}/variables/${id}`, { method: "DELETE" });
}
