import React from "react";
import type { AzureFunctionsConfig } from "@workflow/shared";
import { CredentialSelector } from "../CredentialSelector";
import { TemplateInput } from "../TemplateInput";
import { TemplateTextarea } from "../TemplateTextarea";
import { Input } from "../../ui/input";
import { Label } from "../../ui/label";
import { Button } from "../../ui/button";
import { Plus, X } from "lucide-react";

interface Props {
  config: AzureFunctionsConfig;
  onChange: (patch: Partial<AzureFunctionsConfig>) => void;
}

const METHODS: NonNullable<AzureFunctionsConfig["method"]>[] = ["GET", "POST", "PUT", "PATCH", "DELETE"];

const SELECT =
  "flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring";

export function AzureFunctionsForm({ config, onChange }: Props): React.ReactElement {
  return (
    <div className="space-y-4">
      <CredentialSelector
        kinds={["azure"]}
        value={config.credentialId}
        onChange={(id) => onChange({ credentialId: id })}
        label="Azure Credential (functionKey — optional for anonymous functions)"
      />
      <div className="grid grid-cols-[120px_1fr] gap-2">
        <div>
          <Label>Method</Label>
          <select className={SELECT} value={config.method ?? "POST"} onChange={(e) => onChange({ method: e.target.value as AzureFunctionsConfig["method"] })}>
            {METHODS.map((m) => <option key={m} value={m}>{m}</option>)}
          </select>
        </div>
        <div>
          <Label>Function URL</Label>
          <TemplateInput value={config.functionUrl ?? ""} onChange={(v) => onChange({ functionUrl: v })} placeholder="https://myapp.azurewebsites.net/api/my-func" />
        </div>
      </div>
      <div>
        <div className="flex items-center justify-between mb-1">
          <Label className="mb-0">Extra headers</Label>
          <Button
            variant="ghost"
            size="sm"
            onClick={() =>
              onChange({ headers: [...(config.headers ?? []), { key: "", value: "" }] })
            }
          >
            <Plus size={11} className="mr-1" /> Add
          </Button>
        </div>
        {(config.headers ?? []).map((h, i) => (
          <div key={i} className="grid grid-cols-[1fr_1fr_auto] gap-2 mb-1">
            <Input
              value={h.key}
              onChange={(e) => {
                const next = (config.headers ?? []).map((x, idx) =>
                  idx === i ? { ...x, key: e.target.value } : x,
                );
                onChange({ headers: next });
              }}
              placeholder="X-Header"
            />
            <Input
              value={h.value}
              onChange={(e) => {
                const next = (config.headers ?? []).map((x, idx) =>
                  idx === i ? { ...x, value: e.target.value } : x,
                );
                onChange({ headers: next });
              }}
              placeholder="value"
            />
            <button
              onClick={() =>
                onChange({
                  headers: (config.headers ?? []).filter((_, idx) => idx !== i),
                })
              }
              className="px-2 text-slate-500 hover:text-red-400"
            >
              <X size={12} />
            </button>
          </div>
        ))}
      </div>
      <div>
        <Label>Body (JSON or raw)</Label>
        <TemplateTextarea value={config.body ?? ""} onChange={(v) => onChange({ body: v })} rows={6} placeholder='{"name":"{{input.body.name}}"}' />
      </div>
      <div>
        <Label>Timeout (ms)</Label>
        <Input type="number" min={1000} max={300000} value={config.timeoutMs ?? 30000} onChange={(e) => onChange({ timeoutMs: Number(e.target.value) || undefined })} />
      </div>
    </div>
  );
}
