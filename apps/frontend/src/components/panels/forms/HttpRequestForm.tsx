import React from "react";
import { Plus, Trash2 } from "lucide-react";
import type { HttpRequestConfig, HttpHeader } from "@workflow/shared";
import { CredentialSelector } from "../CredentialSelector";
import { TemplateInput } from "../TemplateInput";
import { TemplateTextarea } from "../TemplateTextarea";
import { Input } from "../../ui/input";
import { Label } from "../../ui/label";

interface HttpRequestFormProps {
  config: HttpRequestConfig;
  onChange: (patch: Partial<HttpRequestConfig>) => void;
}

const HTTP_METHODS = ["GET", "POST", "PUT", "PATCH", "DELETE", "HEAD", "OPTIONS"] as const;

const BODY_METHODS = new Set(["POST", "PUT", "PATCH"]);

function emptyHeader(): HttpHeader {
  return { key: "", value: "" };
}

interface KVTableProps {
  rows: HttpHeader[];
  onChange: (rows: HttpHeader[]) => void;
  keyPlaceholder?: string;
  valuePlaceholder?: string;
}

function KVTable({ rows, onChange, keyPlaceholder = "key", valuePlaceholder = "value" }: KVTableProps): React.ReactElement {
  const update = (idx: number, patch: Partial<HttpHeader>) => {
    onChange(rows.map((r, i) => (i === idx ? { ...r, ...patch } : r)));
  };
  const remove = (idx: number) => onChange(rows.filter((_, i) => i !== idx));
  const add = () => onChange([...rows, emptyHeader()]);

  return (
    <div className="space-y-1">
      {rows.map((row, idx) => (
        <div key={idx} className="flex items-center gap-1.5">
          <Input
            type="text"
            className="flex-1"
            value={row.key}
            onChange={(e) => update(idx, { key: e.target.value })}
            placeholder={keyPlaceholder}
          />
          <TemplateInput
            wrapperClassName="relative flex-1"
            value={row.value}
            onChange={(v) => update(idx, { value: v })}
            placeholder={valuePlaceholder}
          />
          <button type="button" onClick={() => remove(idx)} className="text-muted-foreground hover:text-red-400 shrink-0">
            <Trash2 size={12} />
          </button>
        </div>
      ))}
      <button
        type="button"
        onClick={add}
        className="flex items-center gap-1 text-xs text-indigo-400 hover:text-indigo-300 mt-1"
      >
        <Plus size={12} />
        Add row
      </button>
    </div>
  );
}

export function HttpRequestForm({ config, onChange }: HttpRequestFormProps): React.ReactElement {
  const isGraphQL = !!(config as any).graphqlQuery;
  const showBody = !isGraphQL && BODY_METHODS.has(config.method);

  return (
    <div className="space-y-4">
      {/* REST vs GraphQL toggle */}
      <div className="flex items-center gap-1 p-0.5 rounded-md bg-muted/50 border border-border">
        <button
          type="button"
          onClick={() => onChange({ graphqlQuery: undefined, graphqlVariables: undefined, graphqlOperationName: undefined } as any)}
          className={`flex-1 text-[11px] font-medium px-2 py-1 rounded transition-colors ${
            !isGraphQL ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
          }`}
        >
          REST
        </button>
        <button
          type="button"
          onClick={() => onChange({ graphqlQuery: "", method: "POST" } as any)}
          className={`flex-1 text-[11px] font-medium px-2 py-1 rounded transition-colors ${
            isGraphQL ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
          }`}
        >
          GraphQL
        </button>
      </div>

      <div>
        <Label>{isGraphQL ? "Endpoint URL" : "Method & URL"}</Label>
        <div className="flex gap-2">
          <select
            className="flex h-9 rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring w-28 shrink-0"
            value={config.method}
            onChange={(e) => onChange({ method: e.target.value as HttpRequestConfig["method"] })}
          >
            {HTTP_METHODS.map((m) => (
              <option key={m} value={m}>{m}</option>
            ))}
          </select>
          <TemplateInput
            wrapperClassName="relative flex-1"
            value={config.url}
            onChange={(v) => onChange({ url: v })}
            placeholder="https://api.example.com/endpoint"
          />
        </div>
      </div>

      <CredentialSelector
        kinds={["http_bearer", "http_basic", "http_api_key"]}
        value={(config as any).credentialId}
        onChange={(id) => onChange({ ...config, credentialId: id } as any)}
        label="Auth Credential (optional)"
        placeholder="— No auth / manual headers —"
      />

      <div>
        <Label>Headers</Label>
        <KVTable
          rows={config.headers ?? []}
          onChange={(headers) => onChange({ headers })}
          keyPlaceholder="Header-Name"
          valuePlaceholder="value"
        />
      </div>

      <div>
        <Label>Query Params</Label>
        <KVTable
          rows={config.queryParams ?? []}
          onChange={(queryParams) => onChange({ queryParams })}
          keyPlaceholder="param"
          valuePlaceholder="value"
        />
      </div>

      {showBody && (
        <div>
          <Label>Request Body (JSON)</Label>
          <TemplateTextarea
            className="flex min-h-[100px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring font-mono resize-y"
            value={config.body ?? ""}
            onChange={(v) => onChange({ body: v || undefined })}
            placeholder='{"key": "{{input.field}}"}'
          />
        </div>
      )}

      {isGraphQL && (
        <div className="space-y-3">
          <div>
            <Label>GraphQL Query</Label>
            <TemplateTextarea
              className="flex min-h-[120px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring font-mono resize-y"
              value={(config as any).graphqlQuery ?? ""}
              onChange={(v) => onChange({ graphqlQuery: v } as any)}
              placeholder={"query GetUser($id: ID!) {\n  user(id: $id) {\n    name\n    email\n  }\n}"}
            />
          </div>
          <div>
            <Label>Variables (JSON)</Label>
            <TemplateTextarea
              className="flex min-h-[60px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring font-mono resize-y"
              value={(config as any).graphqlVariables ?? ""}
              onChange={(v) => onChange({ graphqlVariables: v || undefined } as any)}
              placeholder='{"id": "{{input.userId}}"}'
            />
          </div>
          <div>
            <Label>Operation Name (optional)</Label>
            <Input
              value={(config as any).graphqlOperationName ?? ""}
              onChange={(e) => onChange({ graphqlOperationName: e.target.value || undefined } as any)}
              placeholder="GetUser"
            />
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label>Timeout (ms)</Label>
          <Input
            type="number"
            min={0}
            value={config.timeoutMs ?? 30000}
            onChange={(e) => onChange({ timeoutMs: Number(e.target.value) || undefined })}
          />
        </div>

        <div className="flex items-end pb-1.5">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={config.failOnError ?? true}
              onChange={(e) => onChange({ failOnError: e.target.checked })}
              className="w-3.5 h-3.5 rounded accent-indigo-500"
            />
            <span className="text-xs text-muted-foreground">Fail on error</span>
          </label>
        </div>
      </div>
    </div>
  );
}
