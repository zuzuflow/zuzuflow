import React from "react";
import { Plus, Trash2 } from "lucide-react";
import type { MysqlConfig } from "@workflow/shared";
import { CredentialSelector } from "../CredentialSelector";
import { TemplateInput } from "../TemplateInput";
import { TemplateTextarea } from "../TemplateTextarea";
import { Input } from "../../ui/input";
import { Label } from "../../ui/label";

interface Props {
  config: MysqlConfig;
  onChange: (patch: Partial<MysqlConfig>) => void;
}

export function MysqlForm({ config, onChange }: Props): React.ReactElement {
  const params = config.params ?? [];

  return (
    <div className="space-y-4">
      <CredentialSelector
        kinds={["mysql"]}
        value={config.credentialId}
        onChange={(id) => onChange({ credentialId: id, connectionString: id ? undefined : config.connectionString })}
        label="MySQL Credential"
        placeholder="— Use inline connection string —"
      />

      {!config.credentialId && (
        <div>
          <Label>Connection String (fallback)</Label>
          <Input
            type="password"
            value={config.connectionString ?? ""}
            onChange={(e) => onChange({ connectionString: e.target.value || undefined })}
            placeholder="mysql://user:pass@host:3306/db"
          />
        </div>
      )}

      <div>
        <Label>Query</Label>
        <TemplateTextarea
          className="flex min-h-[100px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-xs shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring font-mono resize-y"
          value={config.query ?? ""}
          onChange={(v) => onChange({ query: v })}
          placeholder="SELECT * FROM users WHERE id = ?"
        />
      </div>

      <div>
        <Label>Parameters (?, ?, ...)</Label>
        <div className="space-y-1.5">
          {params.map((p, idx) => (
            <div key={idx} className="flex items-center gap-1.5">
              <span className="text-[10px] text-muted-foreground w-5 shrink-0 text-right">?{idx + 1}</span>
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
