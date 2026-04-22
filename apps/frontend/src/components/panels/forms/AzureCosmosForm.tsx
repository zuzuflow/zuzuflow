import React from "react";
import type { AzureCosmosConfig } from "@workflow/shared";
import { CredentialSelector } from "../CredentialSelector";
import { TemplateInput } from "../TemplateInput";
import { TemplateTextarea } from "../TemplateTextarea";
import { Input } from "../../ui/input";
import { Label } from "../../ui/label";

interface Props {
  config: AzureCosmosConfig;
  onChange: (patch: Partial<AzureCosmosConfig>) => void;
}

const OPERATIONS: AzureCosmosConfig["operation"][] = [
  "query",
  "upsertItem",
  "readItem",
  "deleteItem",
];

const SELECT =
  "flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring";

export function AzureCosmosForm({ config, onChange }: Props): React.ReactElement {
  const op = config.operation ?? "query";

  return (
    <div className="space-y-4">
      <CredentialSelector
        kinds={["azure"]}
        value={config.credentialId}
        onChange={(id) => onChange({ credentialId: id })}
        label="Azure Credential (cosmosEndpoint + cosmosKey, or connection string)"
      />
      <div>
        <Label>Operation</Label>
        <select className={SELECT} value={op} onChange={(e) => onChange({ operation: e.target.value as AzureCosmosConfig["operation"] })}>
          {OPERATIONS.map((o) => <option key={o} value={o}>{o}</option>)}
        </select>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label>Database</Label>
          <TemplateInput value={config.databaseId ?? ""} onChange={(v) => onChange({ databaseId: v })} placeholder="mydb" />
        </div>
        <div>
          <Label>Container</Label>
          <TemplateInput value={config.containerId ?? ""} onChange={(v) => onChange({ containerId: v })} placeholder="items" />
        </div>
      </div>
      <div>
        <Label>Partition key value</Label>
        <TemplateInput value={config.partitionKey ?? ""} onChange={(v) => onChange({ partitionKey: v || undefined })} placeholder="{{input.body.tenantId}}" />
      </div>
      {op === "query" && (
        <>
          <div>
            <Label>Query (SQL)</Label>
            <TemplateTextarea value={config.query ?? ""} onChange={(v) => onChange({ query: v })} rows={4} placeholder="SELECT * FROM c WHERE c.status = @status" />
          </div>
          <div>
            <Label>Parameters (JSON array)</Label>
            <TemplateTextarea value={config.queryParameters ?? ""} onChange={(v) => onChange({ queryParameters: v || undefined })} rows={3} placeholder='[{"name":"@status","value":"active"}]' />
          </div>
          <div>
            <Label>Max items</Label>
            <Input type="number" min={1} max={10000} value={config.maxItems ?? 100} onChange={(e) => onChange({ maxItems: Number(e.target.value) || undefined })} />
          </div>
        </>
      )}
      {(op === "readItem" || op === "deleteItem") && (
        <div>
          <Label>Item ID</Label>
          <TemplateInput value={config.itemId ?? ""} onChange={(v) => onChange({ itemId: v })} placeholder="{{input.body.id}}" />
        </div>
      )}
      {op === "upsertItem" && (
        <div>
          <Label>Item JSON</Label>
          <TemplateTextarea value={config.item ?? ""} onChange={(v) => onChange({ item: v })} rows={6} placeholder='{"id":"{{input.body.id}}","status":"active"}' />
        </div>
      )}
    </div>
  );
}
