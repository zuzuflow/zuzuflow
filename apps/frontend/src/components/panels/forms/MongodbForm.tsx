import React from "react";
import type { MongodbConfig } from "@workflow/shared";
import { CredentialSelector } from "../CredentialSelector";
import { TemplateInput } from "../TemplateInput";
import { TemplateTextarea } from "../TemplateTextarea";
import { Input } from "../../ui/input";
import { Label } from "../../ui/label";

interface Props {
  config: MongodbConfig;
  onChange: (patch: Partial<MongodbConfig>) => void;
}

const OPERATIONS: MongodbConfig["operation"][] = [
  "findOne", "find", "insertOne", "updateOne", "deleteOne",
];

export function MongodbForm({ config, onChange }: Props): React.ReactElement {
  const op = config.operation ?? "findOne";
  const showFilter = ["findOne", "find", "updateOne", "deleteOne"].includes(op);
  const showDocument = op === "insertOne";
  const showUpdate = op === "updateOne";

  return (
    <div className="space-y-4">
      <CredentialSelector
        kinds={["mongodb"]}
        value={config.credentialId}
        onChange={(id) => onChange({ credentialId: id, uri: id ? undefined : config.uri })}
        label="MongoDB Credential"
        placeholder="— Use inline URI —"
      />

      {!config.credentialId && (
        <div>
          <Label>URI (fallback)</Label>
          <Input
            type="password"
            value={config.uri ?? ""}
            onChange={(e) => onChange({ uri: e.target.value || undefined })}
            placeholder="mongodb://user:pass@host:27017"
          />
        </div>
      )}

      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label>Database</Label>
          <TemplateInput
            value={config.database ?? ""}
            onChange={(v) => onChange({ database: v })}
            placeholder="mydb"
          />
        </div>
        <div>
          <Label>Collection</Label>
          <TemplateInput
            value={config.collection ?? ""}
            onChange={(v) => onChange({ collection: v })}
            placeholder="users"
          />
        </div>
      </div>

      <div>
        <Label>Operation</Label>
        <select
          className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          value={op}
          onChange={(e) => onChange({ operation: e.target.value as MongodbConfig["operation"] })}
        >
          {OPERATIONS.map((o) => <option key={o} value={o}>{o}</option>)}
        </select>
      </div>

      {showFilter && (
        <div>
          <Label>Filter (JSON)</Label>
          <TemplateTextarea
            className="flex min-h-[72px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-xs shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring font-mono resize-y"
            value={config.filter ?? ""}
            onChange={(v) => onChange({ filter: v || undefined })}
            placeholder='{"_id": "{{input.id}}"}'
          />
        </div>
      )}

      {showDocument && (
        <div>
          <Label>Document (JSON)</Label>
          <TemplateTextarea
            className="flex min-h-[96px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-xs shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring font-mono resize-y"
            value={config.document ?? ""}
            onChange={(v) => onChange({ document: v || undefined })}
            placeholder='{"name": "{{input.name}}", "createdAt": "{{input.ts}}"}'
          />
        </div>
      )}

      {showUpdate && (
        <div>
          <Label>Update (JSON)</Label>
          <TemplateTextarea
            className="flex min-h-[72px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-xs shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring font-mono resize-y"
            value={config.update ?? ""}
            onChange={(v) => onChange({ update: v || undefined })}
            placeholder='{"$set": {"status": "{{input.status}}"}}'
          />
        </div>
      )}
    </div>
  );
}
