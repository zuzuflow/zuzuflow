import React, { useCallback, useEffect, useState } from "react";
import { useEnvironmentStore } from "@/store/environmentStore";
import {
  Plus,
  Trash2,
  Pencil,
  KeyRound,
  RefreshCw,
  Save,
  ChevronDown,
  ChevronUp,
  SlidersHorizontal,
  Lock,
  Eye,
  EyeOff,
  Copy,
  Check,
} from "lucide-react";
import * as api from "../lib/api";
import { cn } from "../lib/utils";
import { TemplateInput } from "../components/panels/TemplateInput";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { PageHeader } from "../components/layout/PageHeader";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "../components/ui/dialog";
import { Button } from "../components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../components/ui/table";

// ─── Credential kind metadata ─────────────────────────────────────────────────

interface FieldDef {
  key: string;
  label: string;
  placeholder?: string;
  secret?: boolean;
}

const KIND_DEFS: Record<api.CredentialKind, { label: string; description: string; fields: FieldDef[] }> = {
  postgres: {
    label: "PostgreSQL",
    description: "Database connection for the PostgreSQL Query node",
    fields: [{ key: "connectionString", label: "Connection String", placeholder: "postgresql://user:pass@host:5432/db", secret: true }],
  },
  smtp: {
    label: "SMTP",
    description: "Email server credentials for the Send Email node",
    fields: [
      { key: "host", label: "Host", placeholder: "smtp.gmail.com" },
      { key: "port", label: "Port", placeholder: "587" },
      { key: "user", label: "Username / Email", placeholder: "you@gmail.com" },
      { key: "pass", label: "Password / App Password", secret: true },
      { key: "from", label: "From Address", placeholder: "noreply@example.com" },
      { key: "secure", label: "Secure (true/false)", placeholder: "false" },
    ],
  },
  sendgrid: {
    label: "SendGrid",
    description: "SendGrid API key for the Send Email node",
    fields: [
      { key: "apiKey", label: "API Key", placeholder: "SG.xxxxxxxx", secret: true },
      { key: "from", label: "From Address", placeholder: "noreply@example.com" },
    ],
  },
  mqtt: {
    label: "MQTT",
    description: "MQTT broker credentials for the MQTT Trigger node",
    fields: [
      { key: "brokerUrl", label: "Broker URL", placeholder: "mqtt://broker:1883" },
      { key: "username", label: "Username", placeholder: "mqtt-user" },
      { key: "password", label: "Password", secret: true },
    ],
  },
  rabbitmq: {
    label: "RabbitMQ",
    description: "AMQP connection for the RabbitMQ node",
    fields: [
      { key: "url", label: "AMQP URL", placeholder: "amqp://user:pass@localhost:5672/vhost", secret: true },
    ],
  },
  http_bearer: {
    label: "HTTP Bearer Token",
    description: "Injects Authorization: Bearer <token> header into HTTP Request nodes",
    fields: [{ key: "token", label: "Bearer Token", secret: true, placeholder: "eyJhbGciOi..." }],
  },
  http_basic: {
    label: "HTTP Basic Auth",
    description: "Injects Authorization: Basic header into HTTP Request nodes",
    fields: [
      { key: "username", label: "Username" },
      { key: "password", label: "Password", secret: true },
    ],
  },
  http_api_key: {
    label: "HTTP API Key",
    description: "Injects a custom header (e.g. X-Api-Key) into HTTP Request nodes",
    fields: [
      { key: "headerName", label: "Header Name", placeholder: "X-Api-Key" },
      { key: "headerValue", label: "Header Value", secret: true },
    ],
  },
  webhook_hmac: {
    label: "Webhook HMAC",
    description: "HMAC-SHA256 signing secret for verifying inbound webhook requests",
    fields: [
      { key: "secret", label: "Signing Secret", placeholder: "whsec_...", secret: true },
    ],
  },
  webhook_basic: {
    label: "Webhook Basic Auth",
    description: "Basic Auth credentials for verifying inbound webhook requests",
    fields: [
      { key: "username", label: "Username", placeholder: "webhook-user" },
      { key: "password", label: "Password", secret: true },
    ],
  },
  webhook_jwt: {
    label: "Webhook JWT",
    description: "JWT / Bearer token verification settings for inbound webhook requests",
    fields: [
      { key: "jwksUri", label: "JWKS URI", placeholder: "https://auth.example.com/.well-known/jwks.json" },
      { key: "publicKey", label: "Public Key (PEM)", placeholder: "-----BEGIN PUBLIC KEY-----", secret: true },
      { key: "issuer", label: "Issuer (optional)", placeholder: "https://auth.example.com/" },
      { key: "audience", label: "Audience (optional)", placeholder: "my-workflow-api" },
    ],
  },
  mysql: {
    label: "MySQL",
    description: "MySQL database connection for the MySQL node",
    fields: [{ key: "connectionString", label: "Connection String", placeholder: "mysql://user:pass@host:3306/db", secret: true }],
  },
  mariadb: {
    label: "MariaDB",
    description: "MariaDB database connection for the MariaDB node",
    fields: [{ key: "connectionString", label: "Connection String", placeholder: "mysql://user:pass@host:3306/db", secret: true }],
  },
  mssql: {
    label: "MS SQL Server",
    description: "SQL Server connection for the MSSQL node",
    fields: [
      { key: "server", label: "Server", placeholder: "localhost" },
      { key: "port", label: "Port", placeholder: "1433" },
      { key: "database", label: "Database", placeholder: "mydb" },
      { key: "user", label: "Username" },
      { key: "password", label: "Password", secret: true },
    ],
  },
  mongodb: {
    label: "MongoDB",
    description: "MongoDB connection URI for the MongoDB node",
    fields: [{ key: "uri", label: "Connection URI", placeholder: "mongodb://user:pass@host:27017/db", secret: true }],
  },
  redis: {
    label: "Redis",
    description: "Redis connection URL for the Redis node",
    fields: [{ key: "url", label: "Connection URL", placeholder: "redis://user:pass@host:6379", secret: true }],
  },
  aws: {
    label: "AWS",
    description: "AWS credentials for S3 and other AWS services",
    fields: [
      { key: "accessKeyId", label: "Access Key ID", placeholder: "AKIA..." },
      { key: "secretAccessKey", label: "Secret Access Key", secret: true },
      { key: "region", label: "Region (optional)", placeholder: "us-east-1" },
    ],
  },
  google_sheets: {
    label: "Google Sheets",
    description: "Service account credentials for Google Sheets API",
    fields: [{ key: "serviceAccountJson", label: "Service Account JSON", placeholder: '{"type":"service_account",...}', secret: true }],
  },
  firebase: {
    label: "Firebase",
    description: "Firebase Admin SDK service account for push notifications (FCM)",
    fields: [{ key: "serviceAccountJson", label: "Service Account JSON", placeholder: '{"type":"service_account",...}', secret: true }],
  },
  apns: {
    label: "Apple Push (APNs)",
    description: "APNs token-based authentication for iOS push notifications",
    fields: [
      { key: "keyId", label: "Key ID", placeholder: "ABC123DEFG" },
      { key: "teamId", label: "Team ID", placeholder: "ABCDE12345" },
      { key: "privateKey", label: "Private Key (.p8)", placeholder: "-----BEGIN PRIVATE KEY-----", secret: true },
      { key: "bundleId", label: "Bundle ID", placeholder: "com.myapp.ios" },
    ],
  },
  slack: {
    label: "Slack",
    description: "Slack webhook URL for the Slack node",
    fields: [{ key: "webhookUrl", label: "Webhook URL", placeholder: "https://hooks.slack.com/services/T.../B.../...", secret: true }],
  },
  ssh: {
    label: "SSH",
    description: "SSH credentials for the SSH Terminal node",
    fields: [
      { key: "password", label: "Password", secret: true, placeholder: "SSH password" },
      { key: "privateKey", label: "Private Key (PEM)", secret: true, placeholder: "-----BEGIN OPENSSH PRIVATE KEY-----" },
    ],
  },
  twilio: {
    label: "Twilio",
    description: "Twilio credentials for SMS and voice",
    fields: [
      { key: "accountSid", label: "Account SID", placeholder: "AC..." },
      { key: "authToken", label: "Auth Token", secret: true },
    ],
  },
  openai: {
    label: "OpenAI",
    description: "OpenAI API key for GPT models in LLM Prompt node",
    fields: [{ key: "apiKey", label: "API Key", placeholder: "sk-...", secret: true }],
  },
  anthropic: {
    label: "Anthropic",
    description: "Anthropic API key for Claude models in LLM Prompt node",
    fields: [{ key: "apiKey", label: "API Key", placeholder: "sk-ant-...", secret: true }],
  },
  gemini: {
    label: "Google Gemini",
    description: "Google AI API key for Gemini models in LLM Prompt node",
    fields: [{ key: "apiKey", label: "API Key", placeholder: "AIza...", secret: true }],
  },
  huggingface: {
    label: "Hugging Face",
    description: "Hugging Face access token for inference API in LLM Prompt node",
    fields: [{ key: "apiToken", label: "Access Token", placeholder: "hf_...", secret: true }],
  },
  generic: {
    label: "Generic / Custom",
    description: "Free-form key-value pairs, resolved at runtime",
    fields: [
      { key: "key1", label: "Key 1", placeholder: "MY_SECRET" },
      { key: "value1", label: "Value 1", secret: true },
    ],
  },
};

const KIND_BADGE: Record<string, string> = {
  postgres: "bg-blue-900 text-blue-300",
  mysql: "bg-blue-900 text-blue-300",
  mongodb: "bg-green-900 text-green-300",
  redis: "bg-red-900 text-red-300",
  smtp: "bg-violet-900 text-violet-300",
  sendgrid: "bg-cyan-900 text-cyan-300",
  mqtt: "bg-amber-900 text-amber-300",
  rabbitmq: "bg-orange-900 text-orange-300",
  http_bearer: "bg-green-900 text-green-300",
  http_basic: "bg-green-900 text-green-300",
  http_api_key: "bg-green-900 text-green-300",
  webhook_hmac: "bg-emerald-900 text-emerald-300",
  webhook_basic: "bg-amber-900 text-amber-300",
  webhook_jwt: "bg-sky-900 text-sky-300",
  aws: "bg-orange-900 text-orange-300",
  slack: "bg-purple-900 text-purple-300",
  ssh: "bg-slate-800 text-slate-300",
  twilio: "bg-red-900 text-red-300",
  openai: "bg-emerald-900 text-emerald-300",
  mariadb: "bg-blue-900 text-blue-300",
  mssql: "bg-blue-900 text-blue-300",
  google_sheets: "bg-green-900 text-green-300",
  firebase: "bg-yellow-900 text-yellow-300",
  apns: "bg-slate-800 text-slate-300",
  anthropic: "bg-orange-900 text-orange-300",
  gemini: "bg-blue-900 text-blue-300",
  huggingface: "bg-yellow-900 text-yellow-300",
  generic: "bg-muted text-foreground",
};

const inputClass =
  "w-full px-3 py-1.5 text-sm bg-secondary border border-border rounded text-foreground placeholder-muted-foreground focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500";

// ─── Credential form modal ────────────────────────────────────────────────────

function CredentialForm({ existing, onSave, onClose }: {
  existing?: api.CredentialItem; onSave: () => void; onClose: () => void;
}) {
  const [name, setName] = useState(existing?.name ?? "");
  const [kind, setKind] = useState<api.CredentialKind>(existing?.kind ?? "postgres");
  const [data, setData] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [showSecrets, setShowSecrets] = useState<Record<string, boolean>>({});
  const def = KIND_DEFS[kind];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) { setError("Name is required"); return; }
    setSaving(true); setError("");
    try {
      if (existing) {
        await api.updateCredential(existing.id, { name: name.trim(), data });
      } else {
        await api.createCredential({ name: name.trim(), kind, data });
      }
      onSave();
    } catch (err) { setError(String(err)); }
    finally { setSaving(false); }
  };

  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="max-w-lg max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>{existing ? "Edit Credential" : "New Credential"}</DialogTitle>
          <DialogDescription>{existing ? "Update credential values below." : "Configure a new credential for your workflows."}</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto space-y-4">
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">Name *</label>
            <input className={inputClass} value={name} onChange={(e) => setName(e.target.value)} placeholder="My Postgres DB" autoFocus />
          </div>
          {!existing && (
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">Type *</label>
              <select className={inputClass} value={kind} onChange={(e) => { setKind(e.target.value as api.CredentialKind); setData({}); }}>
                {(Object.keys(KIND_DEFS) as api.CredentialKind[]).map((k) => (
                  <option key={k} value={k}>{KIND_DEFS[k].label}</option>
                ))}
              </select>
              <p className="text-[10px] text-muted-foreground mt-1">{def.description}</p>
            </div>
          )}
          <div className="space-y-3">
            <label className="block text-xs font-medium text-muted-foreground">
              {existing ? "Update values (leave blank to keep existing)" : "Values"}
            </label>
            {def.fields.map((field) => (
              <div key={field.key}>
                <label className="block text-[10px] text-muted-foreground mb-0.5">{field.label}</label>
                <TemplateInput
                  type={field.secret && !showSecrets[field.key] ? "password" : "text"}
                  className={inputClass + (field.secret ? " pr-16" : "")}
                  value={data[field.key] ?? ""}
                  onChange={(v) => setData((d) => ({ ...d, [field.key]: v }))}
                  placeholder={existing ? "(unchanged)" : field.placeholder}
                  endAdornment={field.secret ? (
                    <button
                      type="button"
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-muted-foreground hover:text-foreground"
                      onClick={() => setShowSecrets((s) => ({ ...s, [field.key]: !s[field.key] }))}
                    >
                      {showSecrets[field.key] ? "Hide" : "Show"}
                    </button>
                  ) : undefined}
                />
              </div>
            ))}
          </div>
          {error && <p className="text-xs text-red-400">{error}</p>}
        </form>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSubmit as any} disabled={saving}>
            {saving ? <RefreshCw size={12} className="animate-spin mr-1.5" /> : <Save size={12} className="mr-1.5" />}
            {saving ? "Saving…" : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Variable form modal ──────────────────────────────────────────────────────

function VariableForm({ existing, onSave, onClose }: {
  existing?: api.VariableItem; onSave: () => void; onClose: () => void;
}) {
  const [key, setKey] = useState(existing?.key ?? "");
  const [value, setValue] = useState("");
  const [description, setDescription] = useState(existing?.description ?? "");
  const [isSecret, setIsSecret] = useState(existing?.isSecret ?? false);
  const [showValue, setShowValue] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!key.trim()) { setError("Key is required"); return; }
    if (!existing && !value.trim()) { setError("Value is required"); return; }
    // Validate key format: only letters, numbers, underscores
    if (!/^[A-Z0-9_]+$/i.test(key.trim())) { setError("Key must contain only letters, numbers, and underscores"); return; }
    setSaving(true); setError("");
    try {
      if (existing) {
        await api.updateVariable(existing.id, {
          key: key.trim(),
          ...(value.trim() ? { value: value.trim() } : {}),
          description: description || undefined,
        });
      } else {
        await api.createVariable({ key: key.trim().toUpperCase(), value: value.trim(), description: description || undefined, isSecret });
      }
      onSave();
    } catch (err) { setError(String(err)); }
    finally { setSaving(false); }
  };

  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{existing ? "Edit Variable" : "New Variable"}</DialogTitle>
          <DialogDescription>{existing ? "Update variable values below." : "Add a new environment variable."}</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">Key *</label>
            <input
              className={inputClass + " font-mono uppercase"}
              value={key}
              onChange={(e) => setKey(e.target.value.toUpperCase().replace(/[^A-Z0-9_]/g, ""))}
              placeholder="DB_HOST"
              autoFocus
            />
            <p className="text-[10px] text-muted-foreground mt-0.5">
              Reference in nodes as <code className="font-mono text-indigo-400">{"{{$env." + (key || "KEY") + "}}"}</code>
            </p>
          </div>

          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">
              Value {existing ? "(leave blank to keep existing)" : "*"}
            </label>
            <div className="relative">
              <input
                type={isSecret && !showValue ? "password" : "text"}
                className={inputClass + " pr-9"}
                value={value}
                onChange={(e) => setValue(e.target.value)}
                placeholder={existing ? "(unchanged)" : "your-value-here"}
              />
              <button type="button" className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                onClick={() => setShowValue((v) => !v)}>
                {showValue ? <EyeOff size={13} /> : <Eye size={13} />}
              </button>
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">Description (optional)</label>
            <input
              className={inputClass}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What this variable is for"
            />
          </div>

          {!existing && (
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={isSecret} onChange={(e) => setIsSecret(e.target.checked)}
                className="w-3.5 h-3.5 rounded accent-indigo-500" />
              <span className="text-xs text-muted-foreground">
                Secret — encrypt value, mask in UI
              </span>
              <Lock size={11} className="text-muted-foreground" />
            </label>
          )}

          {error && <p className="text-xs text-red-400">{error}</p>}
        </form>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSubmit as any} disabled={saving}>
            {saving ? <RefreshCw size={12} className="animate-spin mr-1.5" /> : <Save size={12} className="mr-1.5" />}
            {saving ? "Saving…" : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Variables panel ──────────────────────────────────────────────────────────

function VariablesPanel() {
  const currentSlug = useEnvironmentStore((s) => s.currentSlug);
  const [variables, setVariables] = useState<api.VariableItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<api.VariableItem | undefined>();
  const [deleting, setDeleting] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string } | null>(null);

  const load = useCallback(() => {
    if (!currentSlug) return;
    setLoading(true);
    api.listVariables().then(setVariables).catch(console.error).finally(() => setLoading(false));
  }, [currentSlug]);

  useEffect(() => { load(); }, [load]);

  const handleDelete = (v: api.VariableItem) => {
    setDeleteTarget({ id: v.id, name: v.key });
  };

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(deleteTarget.id);
    setDeleteTarget(null);
    try {
      await api.deleteVariable(deleteTarget.id);
      setVariables((prev) => prev.filter((x) => x.id !== deleteTarget.id));
    } catch (err) { toast.error(String(err)); }
    finally { setDeleting(null); }
  };

  const copyRef = (key: string) => {
    navigator.clipboard.writeText(`{{$env.${key}}}`);
    setCopied(key);
    setTimeout(() => setCopied(null), 1500);
  };

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-sm font-semibold text-foreground">Environment Variables</h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Reference in any node config as{" "}
            <code className="font-mono text-indigo-400">{"{{$env.MY_KEY}}"}</code>
          </p>
        </div>
        <button onClick={() => { setEditing(undefined); setShowForm(true); }}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded bg-indigo-600 hover:bg-indigo-500 text-white transition-colors">
          <Plus size={13} /> Add Variable
        </button>
      </div>

      {/* Banner */}
      <div className="bg-card border border-border rounded-lg px-4 py-3 text-xs text-muted-foreground leading-relaxed mb-5">
        Variables let you manage environment-specific values (URLs, feature flags, non-secret config) in one place.
        Change a variable once and every workflow that uses it picks up the new value automatically.
        For secrets (passwords, tokens), mark the variable as <strong className="text-foreground">Secret</strong> — it will be encrypted and masked in the UI.
      </div>

      {loading && variables.length === 0 ? (
        <div className="flex items-center justify-center py-12 text-muted-foreground">
          <RefreshCw size={16} className="animate-spin mr-2" /> Loading…
        </div>
      ) : variables.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
          <SlidersHorizontal size={36} className="mb-3 opacity-30" />
          <p className="text-sm mb-1">No variables yet</p>
          <button onClick={() => { setEditing(undefined); setShowForm(true); }}
            className="mt-4 flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded bg-indigo-600 hover:bg-indigo-500 text-white transition-colors">
            <Plus size={13} /> Add Variable
          </button>
        </div>
      ) : (
        <div className="bg-card border border-border rounded-xl overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Key</TableHead>
                <TableHead>Value</TableHead>
                <TableHead className="hidden sm:table-cell">Description</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {variables.map((v) => (
                <TableRow key={v.id}>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      {v.isSecret && <Lock size={10} className="text-amber-400 shrink-0" />}
                      <code className="font-mono text-foreground">{v.key}</code>
                      <button title="Copy reference" onClick={() => copyRef(v.key)}
                        className="text-muted-foreground hover:text-indigo-400 transition-colors">
                        {copied === v.key ? <Check size={11} className="text-emerald-400" /> : <Copy size={11} />}
                      </button>
                    </div>
                    <p className="text-[10px] text-indigo-500 font-mono mt-0.5">{`{{$env.${v.key}}}`}</p>
                  </TableCell>
                  <TableCell>
                    <span className={cn("font-mono", v.isSecret ? "text-muted-foreground" : "text-foreground")}>
                      {v.value}
                    </span>
                  </TableCell>
                  <TableCell className="text-muted-foreground hidden sm:table-cell">
                    {v.description ?? "—"}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1 justify-end">
                      <button onClick={() => { setEditing(v); setShowForm(true); }}
                        className="flex items-center gap-1 px-2 py-1 text-muted-foreground hover:text-foreground hover:bg-muted rounded transition-colors">
                        <Pencil size={12} />
                      </button>
                      <button onClick={() => handleDelete(v)} disabled={deleting === v.id}
                        className="flex items-center justify-center w-7 h-7 text-muted-foreground hover:text-red-400 hover:bg-red-900/30 rounded transition-colors">
                        {deleting === v.id ? <RefreshCw size={12} className="animate-spin" /> : <Trash2 size={12} />}
                      </button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {showForm && (
        <VariableForm
          existing={editing}
          onSave={() => { setShowForm(false); load(); }}
          onClose={() => setShowForm(false)}
        />
      )}

      <ConfirmDialog
        open={deleteTarget !== null}
        onOpenChange={(open) => { if (!open) setDeleteTarget(null); }}
        title="Delete Variable"
        description={`Delete variable "${deleteTarget?.name}"?`}
        confirmLabel="Delete"
        onConfirm={handleConfirmDelete}
        destructive
      />
    </div>
  );
}

// ─── Credentials panel ────────────────────────────────────────────────────────

function CredentialsPanel() {
  const currentSlug = useEnvironmentStore((s) => s.currentSlug);
  const [credentials, setCredentials] = useState<api.CredentialItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<api.CredentialItem | undefined>();
  const [deleting, setDeleting] = useState<string | null>(null);
  const [expandedKinds, setExpandedKinds] = useState<Set<string>>(new Set(Object.keys(KIND_DEFS)));
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string } | null>(null);

  const load = useCallback(() => {
    if (!currentSlug) return;
    setLoading(true);
    api.listCredentials().then(setCredentials).catch(console.error).finally(() => setLoading(false));
  }, [currentSlug]);

  useEffect(() => { load(); }, [load]);

  const handleDelete = (c: api.CredentialItem) => {
    setDeleteTarget({ id: c.id, name: c.name });
  };

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(deleteTarget.id);
    setDeleteTarget(null);
    try {
      await api.deleteCredential(deleteTarget.id);
      setCredentials((prev) => prev.filter((x) => x.id !== deleteTarget.id));
    } catch (err) { toast.error(String(err)); }
    finally { setDeleting(null); }
  };

  const grouped = credentials.reduce<Record<string, api.CredentialItem[]>>((acc, c) => {
    if (!acc[c.kind]) acc[c.kind] = [];
    acc[c.kind].push(c); return acc;
  }, {});

  const toggleKind = (kind: string) => {
    setExpandedKinds((prev) => {
      const next = new Set(prev);
      next.has(kind) ? next.delete(kind) : next.add(kind);
      return next;
    });
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-sm font-semibold text-foreground">Credentials</h2>
          <p className="text-xs text-muted-foreground mt-0.5">Encrypted connection details for nodes</p>
        </div>
        <button onClick={() => { setEditing(undefined); setShowForm(true); }}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded bg-indigo-600 hover:bg-indigo-500 text-white transition-colors">
          <Plus size={13} /> New Credential
        </button>
      </div>

      <div className="bg-card border border-border rounded-lg px-4 py-3 text-xs text-muted-foreground leading-relaxed mb-5">
        <strong className="text-foreground">Credentials</strong> store connection details and secrets (passwords, API keys, tokens)
        encrypted at rest with AES-256-GCM. Select a credential in node config — the engine decrypts and injects values at runtime.
        Nodes: PostgreSQL, Send Email, HTTP Request, MQTT.
      </div>

      {loading && credentials.length === 0 ? (
        <div className="flex items-center justify-center py-12 text-muted-foreground">
          <RefreshCw size={16} className="animate-spin mr-2" /> Loading…
        </div>
      ) : credentials.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
          <KeyRound size={36} className="mb-3 opacity-30" />
          <p className="text-sm mb-1">No credentials yet</p>
          <button onClick={() => { setEditing(undefined); setShowForm(true); }}
            className="mt-4 flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded bg-indigo-600 hover:bg-indigo-500 text-white transition-colors">
            <Plus size={13} /> Add Credential
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {(Object.keys(KIND_DEFS) as api.CredentialKind[]).map((kind) => {
            const items = grouped[kind];
            if (!items) return null;
            const def = KIND_DEFS[kind];
            const expanded = expandedKinds.has(kind);
            return (
              <div key={kind} className="bg-card border border-border rounded-xl overflow-hidden">
                <button className="w-full flex items-center gap-3 px-5 py-3 hover:bg-secondary/50 transition-colors" onClick={() => toggleKind(kind)}>
                  <span className={cn("px-2 py-0.5 text-[10px] font-bold rounded uppercase", KIND_BADGE[kind] ?? "bg-muted text-foreground")}>{kind}</span>
                  <span className="text-sm font-medium text-foreground">{def.label}</span>
                  <span className="text-xs text-muted-foreground ml-1">{items.length} credential{items.length !== 1 ? "s" : ""}</span>
                  <span className="ml-auto text-muted-foreground">{expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}</span>
                </button>
                {expanded && (
                  <div className="border-t border-border">
                    {items.map((c) => (
                      <div key={c.id} className="flex items-center gap-3 px-5 py-3 border-b border-border/50 last:border-0 hover:bg-secondary/20 transition-colors">
                        <KeyRound size={13} className="text-muted-foreground shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-foreground font-medium">{c.name}</p>
                          <p className="text-[10px] text-muted-foreground font-mono">{c.id}</p>
                        </div>
                        <p className="text-[10px] text-muted-foreground hidden sm:block">Updated {new Date(c.updatedAt).toLocaleDateString()}</p>
                        <div className="flex items-center gap-1 shrink-0">
                          <button onClick={() => { setEditing(c); setShowForm(true); }}
                            className="flex items-center gap-1 px-2 py-1.5 text-xs text-muted-foreground hover:text-foreground hover:bg-muted rounded transition-colors">
                            <Pencil size={12} /> Edit
                          </button>
                          <button onClick={() => handleDelete(c)} disabled={deleting === c.id}
                            className="flex items-center justify-center w-7 h-7 text-muted-foreground hover:text-red-400 hover:bg-red-900/30 rounded transition-colors">
                            {deleting === c.id ? <RefreshCw size={12} className="animate-spin" /> : <Trash2 size={12} />}
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {showForm && (
        <CredentialForm
          existing={editing}
          onSave={() => { setShowForm(false); load(); }}
          onClose={() => setShowForm(false)}
        />
      )}

      <ConfirmDialog
        open={deleteTarget !== null}
        onOpenChange={(open) => { if (!open) setDeleteTarget(null); }}
        title="Delete Credential"
        description={`Delete "${deleteTarget?.name}"? Workflows using this credential will stop working.`}
        confirmLabel="Delete"
        onConfirm={handleConfirmDelete}
        destructive
      />
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export function CredentialsPage(): React.ReactElement {
  return (
    <div className="px-8 py-6 max-w-4xl mx-auto">
      <PageHeader icon={KeyRound} title="Secrets & Variables" />

      <Tabs defaultValue="variables" className="w-full">
        <TabsList>
          <TabsTrigger value="variables">
            <SlidersHorizontal size={13} className="mr-1.5" />
            Variables
          </TabsTrigger>
          <TabsTrigger value="credentials">
            <KeyRound size={13} className="mr-1.5" />
            Credentials
          </TabsTrigger>
        </TabsList>
        <TabsContent value="variables"><VariablesPanel /></TabsContent>
        <TabsContent value="credentials"><CredentialsPanel /></TabsContent>
      </Tabs>
    </div>
  );
}
