import React from "react";
import type { AzureKeyVaultConfig } from "@workflow/shared";
import { CredentialSelector } from "../CredentialSelector";
import { TemplateInput } from "../TemplateInput";
import { TemplateTextarea } from "../TemplateTextarea";
import { Input } from "../../ui/input";
import { Label } from "../../ui/label";

interface Props {
  config: AzureKeyVaultConfig;
  onChange: (patch: Partial<AzureKeyVaultConfig>) => void;
}

const OPERATIONS: AzureKeyVaultConfig["operation"][] = [
  "getSecret",
  "setSecret",
  "listSecrets",
  "deleteSecret",
];

const SELECT =
  "flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring";

export function AzureKeyVaultForm({ config, onChange }: Props): React.ReactElement {
  const op = config.operation ?? "getSecret";
  const needsName = op !== "listSecrets";

  return (
    <div className="space-y-4">
      <CredentialSelector
        kinds={["azure"]}
        value={config.credentialId}
        onChange={(id) => onChange({ credentialId: id })}
        label="Azure Credential (Service Principal + vaultUrl)"
      />
      <div>
        <Label>Operation</Label>
        <select className={SELECT} value={op} onChange={(e) => onChange({ operation: e.target.value as AzureKeyVaultConfig["operation"] })}>
          {OPERATIONS.map((o) => <option key={o} value={o}>{o}</option>)}
        </select>
      </div>
      {needsName && (
        <div>
          <Label>Secret name</Label>
          <TemplateInput value={config.secretName ?? ""} onChange={(v) => onChange({ secretName: v })} placeholder="my-secret" />
        </div>
      )}
      {op === "getSecret" && (
        <div>
          <Label>Version (optional)</Label>
          <Input value={config.secretVersion ?? ""} onChange={(e) => onChange({ secretVersion: e.target.value || undefined })} placeholder="4a…7b" />
        </div>
      )}
      {op === "setSecret" && (
        <div>
          <Label>Secret value</Label>
          <TemplateTextarea value={config.secretValue ?? ""} onChange={(v) => onChange({ secretValue: v })} rows={4} placeholder="{{input.body.newValue}}" />
        </div>
      )}
    </div>
  );
}
