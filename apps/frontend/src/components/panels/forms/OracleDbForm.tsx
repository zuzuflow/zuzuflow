import React from "react";
import type { OracleDbConfig } from "@workflow/shared";
import { CredentialSelector } from "../CredentialSelector";
import { TemplateInput } from "../TemplateInput";
import { TemplateTextarea } from "../TemplateTextarea";
import { Input } from "../../ui/input";
import { Label } from "../../ui/label";

interface Props {
  config: OracleDbConfig;
  onChange: (patch: Partial<OracleDbConfig>) => void;
}

export function OracleDbForm({ config, onChange }: Props): React.ReactElement {
  return (
    <div className="space-y-4">
      <CredentialSelector kinds={["oracle"]} value={config.credentialId} onChange={(id) => onChange({ credentialId: id })} label="Oracle Credential" />
      <div>
        <Label>Connect string (overrides credential)</Label>
        <TemplateInput value={config.connectString ?? ""} onChange={(v) => onChange({ connectString: v || undefined })} placeholder="host:1521/service_name" />
      </div>
      <div>
        <Label>SQL</Label>
        <TemplateTextarea value={config.query ?? ""} onChange={(v) => onChange({ query: v })} rows={8} placeholder="SELECT * FROM employees WHERE dept_id = :deptId" />
      </div>
      <div>
        <Label>Binds (JSON object or array)</Label>
        <TemplateTextarea value={config.binds ?? ""} onChange={(v) => onChange({ binds: v || undefined })} rows={3} placeholder='{"deptId": 10}' />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label>Max rows</Label>
          <Input type="number" min={1} max={100000} value={config.maxRows ?? 1000} onChange={(e) => onChange({ maxRows: Number(e.target.value) || undefined })} />
        </div>
        <label className="flex items-center gap-2 mt-6 text-xs text-muted-foreground">
          <input type="checkbox" checked={config.autoCommit ?? true} onChange={(e) => onChange({ autoCommit: e.target.checked })} className="h-3.5 w-3.5 rounded accent-indigo-500" />
          Auto-commit
        </label>
      </div>
    </div>
  );
}
