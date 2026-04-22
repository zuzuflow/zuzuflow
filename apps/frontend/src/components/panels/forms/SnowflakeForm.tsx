import React from "react";
import type { SnowflakeConfig, SnowflakeOperation } from "@workflow/shared";
import { CredentialSelector } from "../CredentialSelector";
import { TemplateInput } from "../TemplateInput";
import { TemplateTextarea } from "../TemplateTextarea";
import { Input } from "../../ui/input";
import { Label } from "../../ui/label";

interface Props {
  config: SnowflakeConfig;
  onChange: (patch: Partial<SnowflakeConfig>) => void;
}

const OPERATIONS: SnowflakeOperation[] = ["query", "execute"];

export function SnowflakeForm({
  config,
  onChange,
}: Props): React.ReactElement {
  const op = config.operation ?? "query";
  return (
    <div className="space-y-4">
      <CredentialSelector
        kinds={["snowflake"]}
        value={config.credentialId}
        onChange={(id) => onChange({ credentialId: id })}
        label="Snowflake Credential"
        placeholder="— account + username + password/privateKey + (optional) database/schema/warehouse/role —"
      />
      <div>
        <Label>Operation</Label>
        <select
          className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm"
          value={op}
          onChange={(e) =>
            onChange({ operation: e.target.value as SnowflakeOperation })
          }
        >
          {OPERATIONS.map((o) => (
            <option key={o} value={o}>
              {o}
            </option>
          ))}
        </select>
      </div>
      <div>
        <Label>SQL</Label>
        <TemplateTextarea
          value={config.sql ?? ""}
          onChange={(v) => onChange({ sql: v })}
          placeholder={
            op === "query"
              ? "SELECT * FROM my_db.my_schema.orders WHERE id = ?"
              : "INSERT INTO events (user_id, event) VALUES (?, ?)"
          }
          rows={5}
        />
      </div>
      <div>
        <Label>Binds JSON array (positional ?)</Label>
        <TemplateTextarea
          value={config.binds ?? ""}
          onChange={(v) => onChange({ binds: v || undefined })}
          placeholder='["{{input.id}}", "login"]'
          rows={2}
        />
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div>
          <Label>Warehouse override</Label>
          <TemplateInput
            value={config.warehouse ?? ""}
            onChange={(v) => onChange({ warehouse: v || undefined })}
            placeholder="COMPUTE_WH"
          />
        </div>
        <div>
          <Label>Role override</Label>
          <TemplateInput
            value={config.role ?? ""}
            onChange={(v) => onChange({ role: v || undefined })}
            placeholder="ANALYST"
          />
        </div>
      </div>
      <div className="grid grid-cols-3 gap-2">
        <div>
          <Label>Database</Label>
          <TemplateInput
            value={config.database ?? ""}
            onChange={(v) => onChange({ database: v || undefined })}
            placeholder="ANALYTICS"
          />
        </div>
        <div>
          <Label>Schema</Label>
          <TemplateInput
            value={config.schema ?? ""}
            onChange={(v) => onChange({ schema: v || undefined })}
            placeholder="PUBLIC"
          />
        </div>
        <div>
          <Label>Max rows</Label>
          <Input
            type="number"
            min={1}
            max={1000000}
            value={config.maxRows ?? 10000}
            onChange={(e) =>
              onChange({ maxRows: Number(e.target.value) || undefined })
            }
          />
        </div>
      </div>
    </div>
  );
}
