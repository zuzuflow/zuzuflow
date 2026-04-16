import React, { useState } from "react";
import { Copy, Check, Eye, EyeOff } from "lucide-react";
import type { WebhookConfig, WebhookAuth } from "@workflow/shared";
import { API_BASE_URL } from "../../../lib/api";
import { Input } from "../../ui/input";
import { Label } from "../../ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../../ui/select";
import { CredentialSelector } from "../CredentialSelector";

interface WebhookFormProps {
  config: WebhookConfig;
  onChange: (patch: Partial<WebhookConfig>) => void;
}

const HTTP_METHODS = ["GET", "POST", "PUT", "PATCH", "DELETE"] as const;

type AuthType = "none" | "hmac" | "basic" | "jwt";

const AUTH_LABELS: Record<AuthType, string> = {
  none: "No Authentication",
  hmac: "HMAC-SHA256",
  basic: "Basic Auth",
  jwt: "JWT / Bearer",
};

/** Credential kinds that match each auth type */
const AUTH_CREDENTIAL_KINDS: Record<Exclude<AuthType, "none">, string[]> = {
  hmac: ["webhook_hmac"],
  basic: ["webhook_basic"],
  jwt: ["webhook_jwt"],
};

function getWebhookBaseUrl(): string {
  const base = API_BASE_URL.startsWith("http")
    ? API_BASE_URL
    : `${window.location.protocol}//${window.location.host}${API_BASE_URL}`;
  return `${base}/webhooks/inbound/`;
}

function SecretInput({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
}) {
  const [show, setShow] = useState(false);
  return (
    <div className="relative">
      <Input
        type={show ? "text" : "password"}
        className="pr-9 font-mono text-xs"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
      />
      <button
        type="button"
        onClick={() => setShow((v) => !v)}
        className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
      >
        {show ? <EyeOff size={14} /> : <Eye size={14} />}
      </button>
    </div>
  );
}

export function WebhookForm({ config, onChange }: WebhookFormProps): React.ReactElement {
  const [copied, setCopied] = useState(false);
  const authType: AuthType = config.auth?.type ?? "none";
  // authCredentialId is undefined when inline, a string (possibly empty) when credential mode
  const useCredential = config.authCredentialId !== undefined;
  const fullUrl = `${getWebhookBaseUrl()}${config.path}`;

  const handleCopy = () => {
    navigator.clipboard.writeText(fullUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const handleAuthTypeChange = (type: AuthType) => {
    // Clear credential reference when switching auth type
    if (type === "none") {
      onChange({ auth: { type: "none" }, authCredentialId: undefined, secret: undefined });
    } else if (type === "hmac") {
      onChange({ auth: { type: "hmac", secret: "" }, authCredentialId: undefined, secret: undefined });
    } else if (type === "basic") {
      onChange({ auth: { type: "basic", username: "", password: "" }, authCredentialId: undefined, secret: undefined });
    } else if (type === "jwt") {
      onChange({ auth: { type: "jwt" }, authCredentialId: undefined, secret: undefined });
    }
  };

  const handleAuthSourceToggle = (source: "inline" | "credential") => {
    if (source === "credential") {
      // Switch to credential-based: keep auth type, clear inline values
      onChange({ authCredentialId: "" });
    } else {
      // Switch to inline: clear credential ref, reset inline auth
      onChange({ authCredentialId: undefined });
      handleAuthTypeChange(authType);
    }
  };

  const patchAuth = (patch: Record<string, string>) => {
    if (!config.auth || config.auth.type === "none") return;
    onChange({ auth: { ...config.auth, ...patch } as WebhookAuth });
  };

  return (
    <div className="space-y-4">
      {/* ── Endpoint URL (read-only, copyable) ────────────────────────────── */}
      <div>
        <Label>Webhook URL</Label>
        <div className="flex items-center gap-1 mt-1">
          <div className="flex-1 flex items-center rounded-md border border-input bg-muted/50 px-2.5 py-1.5 text-xs font-mono text-muted-foreground overflow-hidden">
            <span className="truncate">{fullUrl}</span>
          </div>
          <button
            type="button"
            onClick={handleCopy}
            className="shrink-0 inline-flex items-center justify-center h-8 w-8 rounded-md border border-input text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
            title="Copy URL"
          >
            {copied ? <Check size={14} className="text-green-500" /> : <Copy size={14} />}
          </button>
        </div>
      </div>

      {/* ── Method ─────────────────────────────────────────────────────────── */}
      <div>
        <Label>Method</Label>
        <Select
          value={config.method}
          onValueChange={(v) => onChange({ method: v as WebhookConfig["method"] })}
        >
          <SelectTrigger className="mt-1">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {HTTP_METHODS.map((m) => (
              <SelectItem key={m} value={m}>{m}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* ── Path ───────────────────────────────────────────────────────────── */}
      <div>
        <Label>Path</Label>
        <div className="flex items-center gap-1 mt-1">
          <span className="text-muted-foreground text-sm">/</span>
          <Input
            type="text"
            value={config.path}
            onChange={(e) => onChange({ path: e.target.value })}
            placeholder="my-webhook"
          />
        </div>
      </div>

      {/* ── Authentication ─────────────────────────────────────────────────── */}
      <div className="space-y-3">
        <Label>Authentication</Label>
        <Select value={authType} onValueChange={(v) => handleAuthTypeChange(v as AuthType)}>
          <SelectTrigger className="mt-1">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {(Object.entries(AUTH_LABELS) as [AuthType, string][]).map(([value, label]) => (
              <SelectItem key={value} value={value}>{label}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Auth source toggle (inline vs credential) — only shown when auth is not "none" */}
        {authType !== "none" && (
          <div className="space-y-2">
            <div className="flex items-center gap-1 p-0.5 rounded-md bg-muted/50 border border-border">
              <button
                type="button"
                onClick={() => handleAuthSourceToggle("inline")}
                className={`flex-1 text-[11px] font-medium px-2 py-1 rounded transition-colors ${
                  !useCredential
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                Inline
              </button>
              <button
                type="button"
                onClick={() => handleAuthSourceToggle("credential")}
                className={`flex-1 text-[11px] font-medium px-2 py-1 rounded transition-colors ${
                  useCredential
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                Credential
              </button>
            </div>

            {/* Credential selector */}
            {useCredential && (
              <CredentialSelector
                kinds={AUTH_CREDENTIAL_KINDS[authType] as any}
                value={config.authCredentialId || undefined}
                onChange={(id) => onChange({ authCredentialId: id ?? "" })}
                label={`${AUTH_LABELS[authType]} Credential`}
                placeholder="— Select saved credential —"
              />
            )}

            {/* Inline fields — only when NOT using a credential */}
            {!useCredential && (
              <>
                {/* HMAC fields */}
                {authType === "hmac" && config.auth?.type === "hmac" && (
                  <div>
                    <Label className="text-xs">Signing Secret</Label>
                    <SecretInput
                      value={config.auth.secret}
                      onChange={(v) => patchAuth({ secret: v })}
                      placeholder="whsec_..."
                    />
                    <p className="text-[10px] text-muted-foreground mt-1">
                      Verified via <code className="text-[10px]">x-webhook-signature</code> header (SHA-256)
                    </p>
                  </div>
                )}

                {/* Basic Auth fields */}
                {authType === "basic" && config.auth?.type === "basic" && (
                  <div className="space-y-2">
                    <div>
                      <Label className="text-xs">Username</Label>
                      <Input
                        value={config.auth.username}
                        onChange={(e) => patchAuth({ username: e.target.value })}
                        placeholder="webhook-user"
                      />
                    </div>
                    <div>
                      <Label className="text-xs">Password</Label>
                      <SecretInput
                        value={config.auth.password}
                        onChange={(v) => patchAuth({ password: v })}
                        placeholder="password"
                      />
                    </div>
                  </div>
                )}

                {/* JWT fields */}
                {authType === "jwt" && config.auth?.type === "jwt" && (
                  <div className="space-y-2">
                    <div>
                      <Label className="text-xs">JWKS URI</Label>
                      <Input
                        value={config.auth.jwksUri ?? ""}
                        onChange={(e) => patchAuth({ jwksUri: e.target.value || "" })}
                        placeholder="https://auth.example.com/.well-known/jwks.json"
                      />
                      <p className="text-[10px] text-muted-foreground mt-0.5">
                        Leave empty to use a raw PEM public key instead
                      </p>
                    </div>
                    <div>
                      <Label className="text-xs">Public Key (PEM)</Label>
                      <textarea
                        className="flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-xs font-mono shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring min-h-[60px] resize-y"
                        value={config.auth.publicKey ?? ""}
                        onChange={(e) => patchAuth({ publicKey: e.target.value || "" })}
                        placeholder={"-----BEGIN PUBLIC KEY-----\n..."}
                      />
                    </div>
                    <div>
                      <Label className="text-xs">Issuer (optional)</Label>
                      <Input
                        value={config.auth.issuer ?? ""}
                        onChange={(e) => patchAuth({ issuer: e.target.value || "" })}
                        placeholder="https://auth.example.com/"
                      />
                    </div>
                    <div>
                      <Label className="text-xs">Audience (optional)</Label>
                      <Input
                        value={config.auth.audience ?? ""}
                        onChange={(e) => patchAuth({ audience: e.target.value || "" })}
                        placeholder="my-workflow-api"
                      />
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
