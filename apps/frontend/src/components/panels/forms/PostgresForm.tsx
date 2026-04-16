import React from "react";
import { Plus, Trash2 } from "lucide-react";
import type { PostgresConfig } from "@workflow/shared";
import { CredentialSelector } from "../CredentialSelector";
import { TemplateInput } from "../TemplateInput";
import { TemplateTextarea } from "../TemplateTextarea";
import { Input } from "../../ui/input";
import { Label } from "../../ui/label";

interface PostgresFormProps {
  config: PostgresConfig;
  onChange: (patch: Partial<PostgresConfig>) => void;
}

export function PostgresForm({ config, onChange }: PostgresFormProps): React.ReactElement {
  const params = config.params ?? [];

  const updateParam = (idx: number, value: string) => {
    const updated = params.map((p, i) => (i === idx ? value : p));
    onChange({ params: updated });
  };

  const addParam = () => {
    onChange({ params: [...params, ""] });
  };

  const removeParam = (idx: number) => {
    onChange({ params: params.filter((_, i) => i !== idx) });
  };

  return (
    <div className="space-y-4">
      <CredentialSelector
        kinds={["postgres"]}
        value={config.credentialId}
        onChange={(id) => onChange({ credentialId: id, connectionString: id ? undefined : config.connectionString })}
        label="PostgreSQL Credential"
        placeholder="— Use inline connection string —"
      />

      {!config.credentialId && (
        <div>
          <Label>Connection String (fallback)</Label>
          <Input
            type="password"
            value={config.connectionString ?? ""}
            onChange={(e) => onChange({ connectionString: e.target.value || undefined })}
            placeholder="postgresql://user:pass@host:5432/db"
          />
          <p className="text-[10px] text-muted-foreground mt-0.5">
            Ignored when a credential is selected above
          </p>
        </div>
      )}

      <div>
        <Label>Query</Label>
        <TemplateTextarea
          className="flex min-h-[100px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-xs shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring font-mono resize-y"
          value={config.query}
          onChange={(v) => onChange({ query: v })}
          placeholder="SELECT * FROM users WHERE id = $1"
        />
      </div>

      <div>
        <Label>Parameters ($1, $2, ...)</Label>
        <div className="space-y-1.5">
          {params.map((param, idx) => (
            <div key={idx} className="flex items-center gap-1.5">
              <span className="text-[10px] text-muted-foreground w-5 shrink-0 text-right">
                ${idx + 1}
              </span>
              <TemplateInput
                wrapperClassName="relative flex-1"
                value={param}
                onChange={(v) => updateParam(idx, v)}
                placeholder="{{input.userId}}"
              />
              <button
                type="button"
                onClick={() => removeParam(idx)}
                className="text-muted-foreground hover:text-red-400"
              >
                <Trash2 size={12} />
              </button>
            </div>
          ))}
        </div>
        <button
          type="button"
          onClick={addParam}
          className="flex items-center gap-1 mt-2 text-xs text-indigo-400 hover:text-indigo-300"
        >
          <Plus size={12} />
          Add parameter
        </button>
      </div>
    </div>
  );
}
