import React from "react";
import type { AwsSecretsManagerConfig } from "@workflow/shared";
import { AwsBaseFields } from "./AwsBaseFields";
import { TemplateInput } from "../TemplateInput";
import { TemplateTextarea } from "../TemplateTextarea";
import { Input } from "../../ui/input";
import { Label } from "../../ui/label";

interface Props {
  config: AwsSecretsManagerConfig;
  onChange: (patch: Partial<AwsSecretsManagerConfig>) => void;
}

const OPERATIONS: AwsSecretsManagerConfig["operation"][] = [
  "getSecretValue", "putSecretValue", "createSecret", "deleteSecret",
];

export function AwsSecretsManagerForm({ config, onChange }: Props): React.ReactElement {
  const op = config.operation ?? "getSecretValue";

  return (
    <div className="space-y-4">
      <AwsBaseFields config={config} onChange={onChange} />

      <div>
        <Label>Operation</Label>
        <select
          className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          value={op}
          onChange={(e) => onChange({ operation: e.target.value as AwsSecretsManagerConfig["operation"] })}
        >
          {OPERATIONS.map((o) => <option key={o} value={o}>{o}</option>)}
        </select>
      </div>

      <div>
        <Label>Secret Name / ARN</Label>
        <TemplateInput
          value={config.secretId ?? ""}
          onChange={(v) => onChange({ secretId: v })}
          placeholder="my-app/db-password"
        />
      </div>

      {(op === "putSecretValue" || op === "createSecret") && (
        <div>
          <Label>Secret Value</Label>
          <TemplateTextarea
            className="flex min-h-[80px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-xs shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring font-mono resize-y"
            value={config.secretString ?? ""}
            onChange={(v) => onChange({ secretString: v || undefined })}
            placeholder='{"username": "admin", "password": "secret"}'
          />
        </div>
      )}

      {op === "createSecret" && (
        <div>
          <Label>Description</Label>
          <Input
            value={config.description ?? ""}
            onChange={(e) => onChange({ description: e.target.value || undefined })}
            placeholder="Optional description"
          />
        </div>
      )}
    </div>
  );
}
