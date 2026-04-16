import React from "react";
import { Plus, Trash2 } from "lucide-react";
import type { MssqlConfig } from "@workflow/shared";
import { CredentialSelector } from "../CredentialSelector";
import { TemplateInput } from "../TemplateInput";
import { TemplateTextarea } from "../TemplateTextarea";
import { Input } from "../../ui/input";
import { Label } from "../../ui/label";

interface Props {
  config: MssqlConfig;
  onChange: (patch: Partial<MssqlConfig>) => void;
}

export function MssqlForm({ config, onChange }: Props): React.ReactElement {
  const params = config.params ?? [];

  return (
    <div className="space-y-4">
      <CredentialSelector
        kinds={["mssql"]}
        value={config.credentialId}
        onChange={(id) => onChange({ credentialId: id })}
        label="MSSQL Credential"
        placeholder="— Use inline connection details —"
      />

      {!config.credentialId && (
        <div className="space-y-4">
          <div>
            <Label>Server</Label>
            <Input
              value={config.server ?? ""}
              onChange={(e) => onChange({ server: e.target.value })}
              placeholder="localhost"
            />
          </div>
          <div>
            <Label>Port</Label>
            <Input
              type="number"
              value={config.port ?? 1433}
              onChange={(e) => onChange({ port: e.target.value ? Number(e.target.value) : undefined })}
              placeholder="1433"
            />
          </div>
          <div>
            <Label>Database</Label>
            <Input
              value={config.database ?? ""}
              onChange={(e) => onChange({ database: e.target.value })}
              placeholder="mydb"
            />
          </div>
          <div>
            <Label>User</Label>
            <Input
              value={config.user ?? ""}
              onChange={(e) => onChange({ user: e.target.value || undefined })}
              placeholder="sa"
            />
          </div>
          <div>
            <Label>Password</Label>
            <Input
              type="password"
              value={config.password ?? ""}
              onChange={(e) => onChange({ password: e.target.value || undefined })}
              placeholder="password"
            />
          </div>
        </div>
      )}

      <div className="flex items-center gap-4">
        <label className="flex items-center gap-2 text-xs">
          <input
            type="checkbox"
            checked={config.encrypt ?? false}
            onChange={(e) => onChange({ encrypt: e.target.checked })}
            className="rounded border-input"
          />
          Encrypt
        </label>
        <label className="flex items-center gap-2 text-xs">
          <input
            type="checkbox"
            checked={config.trustServerCertificate ?? false}
            onChange={(e) => onChange({ trustServerCertificate: e.target.checked })}
            className="rounded border-input"
          />
          Trust Server Certificate
        </label>
      </div>

      <div>
        <Label>Query</Label>
        <TemplateTextarea
          className="flex min-h-[100px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-xs shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring font-mono resize-y"
          value={config.query ?? ""}
          onChange={(v) => onChange({ query: v })}
          placeholder="SELECT * FROM users WHERE id = @p1"
        />
      </div>

      <div>
        <Label>Parameters (@p1, @p2, ...)</Label>
        <div className="space-y-1.5">
          {params.map((p, idx) => (
            <div key={idx} className="flex items-center gap-1.5">
              <span className="text-[10px] text-muted-foreground w-5 shrink-0 text-right">@p{idx + 1}</span>
              <TemplateInput
                wrapperClassName="relative flex-1"
                value={p}
                onChange={(v) => {
                  const updated = params.map((x, i) => (i === idx ? v : x));
                  onChange({ params: updated });
                }}
                placeholder="{{input.userId}}"
              />
              <button type="button" onClick={() => onChange({ params: params.filter((_, i) => i !== idx) })} className="text-muted-foreground hover:text-red-400">
                <Trash2 size={12} />
              </button>
            </div>
          ))}
        </div>
        <button type="button" onClick={() => onChange({ params: [...params, ""] })} className="flex items-center gap-1 mt-2 text-xs text-indigo-400 hover:text-indigo-300">
          <Plus size={12} /> Add parameter
        </button>
      </div>
    </div>
  );
}
