import React from "react";
import type { AirtableConfig, AirtableOperation } from "@workflow/shared";
import { CredentialSelector } from "../CredentialSelector";
import { TemplateInput } from "../TemplateInput";
import { TemplateTextarea } from "../TemplateTextarea";
import { Input } from "../../ui/input";
import { Label } from "../../ui/label";

interface Props {
  config: AirtableConfig;
  onChange: (patch: Partial<AirtableConfig>) => void;
}

const OPERATIONS: AirtableOperation[] = [
  "records.list",
  "records.get",
  "records.create",
  "records.update",
  "records.delete",
];

export function AirtableForm({
  config,
  onChange,
}: Props): React.ReactElement {
  const op = config.operation ?? "records.list";
  const needsRecordId =
    op === "records.get" ||
    op === "records.update" ||
    op === "records.delete";
  const needsFields = op === "records.create" || op === "records.update";
  const isList = op === "records.list";

  return (
    <div className="space-y-4">
      <CredentialSelector
        kinds={["airtable"]}
        value={config.credentialId}
        onChange={(id) => onChange({ credentialId: id })}
        label="Airtable Credential"
        placeholder="— Personal access token / API key —"
      />

      <div>
        <Label>Operation</Label>
        <select
          className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm"
          value={op}
          onChange={(e) =>
            onChange({ operation: e.target.value as AirtableOperation })
          }
        >
          {OPERATIONS.map((o) => (
            <option key={o} value={o}>
              {o}
            </option>
          ))}
        </select>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div>
          <Label>Base ID</Label>
          <TemplateInput
            value={config.baseId ?? ""}
            onChange={(v) => onChange({ baseId: v })}
            placeholder="appXXXXXXXXXXXXXX"
          />
        </div>
        <div>
          <Label>Table</Label>
          <TemplateInput
            value={config.table ?? ""}
            onChange={(v) => onChange({ table: v })}
            placeholder="Tasks"
          />
        </div>
      </div>

      {needsRecordId && (
        <div>
          <Label>Record ID</Label>
          <TemplateInput
            value={config.recordId ?? ""}
            onChange={(v) => onChange({ recordId: v })}
            placeholder="recXXXXXXXXXXXXXX"
          />
        </div>
      )}

      {needsFields && (
        <div>
          <Label>Fields JSON</Label>
          <TemplateTextarea
            value={config.fields ?? ""}
            onChange={(v) => onChange({ fields: v })}
            placeholder='{"Name": "{{input.name}}", "Status": "Done"}'
            rows={5}
          />
        </div>
      )}

      {isList && (
        <>
          <div>
            <Label>filterByFormula (optional)</Label>
            <TemplateInput
              value={config.filterByFormula ?? ""}
              onChange={(v) =>
                onChange({ filterByFormula: v || undefined })
              }
              placeholder="{Status} = 'Done'"
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label>View (optional)</Label>
              <Input
                value={config.view ?? ""}
                onChange={(e) =>
                  onChange({ view: e.target.value || undefined })
                }
                placeholder="Grid view"
              />
            </div>
            <div>
              <Label>Max records</Label>
              <Input
                type="number"
                min={1}
                max={100}
                value={config.maxRecords ?? 100}
                onChange={(e) =>
                  onChange({
                    maxRecords: Number(e.target.value) || undefined,
                  })
                }
              />
            </div>
          </div>
        </>
      )}
    </div>
  );
}
