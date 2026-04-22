import React from "react";
import type { PipedriveConfig, PipedriveOperation } from "@workflow/shared";
import { CredentialSelector } from "../CredentialSelector";
import { TemplateInput } from "../TemplateInput";
import { TemplateTextarea } from "../TemplateTextarea";
import { Input } from "../../ui/input";
import { Label } from "../../ui/label";

interface Props {
  config: PipedriveConfig;
  onChange: (patch: Partial<PipedriveConfig>) => void;
}

const OPERATIONS: PipedriveOperation[] = [
  "deals.create",
  "deals.get",
  "deals.update",
  "deals.list",
  "persons.create",
  "persons.get",
  "persons.update",
  "persons.search",
  "activities.create",
];

export function PipedriveForm({
  config,
  onChange,
}: Props): React.ReactElement {
  const op = config.operation ?? "deals.create";
  const needsObjectId =
    op === "deals.get" ||
    op === "deals.update" ||
    op === "persons.get" ||
    op === "persons.update";
  const needsBody = op.endsWith(".create") || op.endsWith(".update");
  const isList = op === "deals.list";
  const isSearch = op === "persons.search";

  return (
    <div className="space-y-4">
      <CredentialSelector
        kinds={["pipedrive"]}
        value={config.credentialId}
        onChange={(id) => onChange({ credentialId: id })}
        label="Pipedrive Credential"
        placeholder="— apiToken + companyDomain —"
      />
      <div>
        <Label>Operation</Label>
        <select
          className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm"
          value={op}
          onChange={(e) =>
            onChange({ operation: e.target.value as PipedriveOperation })
          }
        >
          {OPERATIONS.map((o) => (
            <option key={o} value={o}>
              {o}
            </option>
          ))}
        </select>
      </div>
      {needsObjectId && (
        <div>
          <Label>Object ID</Label>
          <TemplateInput
            value={config.objectId ?? ""}
            onChange={(v) => onChange({ objectId: v })}
            placeholder="(deal / person ID)"
          />
        </div>
      )}
      {needsBody && (
        <div>
          <Label>Body JSON</Label>
          <TemplateTextarea
            value={config.body ?? ""}
            onChange={(v) => onChange({ body: v })}
            placeholder={
              op === "deals.create"
                ? '{"title":"{{input.name}}","value":1000,"currency":"USD"}'
                : op.startsWith("persons")
                  ? '{"name":"{{input.name}}","email":[{"value":"{{input.email}}","primary":true}]}'
                  : '{"subject":"Follow-up call","due_date":"2026-05-01"}'
            }
            rows={5}
          />
        </div>
      )}
      {isSearch && (
        <>
          <div>
            <Label>Search term</Label>
            <TemplateInput
              value={config.searchTerm ?? ""}
              onChange={(v) => onChange({ searchTerm: v })}
              placeholder="{{input.email}}"
            />
          </div>
          <div>
            <Label>Fields (CSV, default name,email,phone)</Label>
            <Input
              value={config.searchFields ?? ""}
              onChange={(e) =>
                onChange({ searchFields: e.target.value || undefined })
              }
              placeholder="name,email,phone"
            />
          </div>
        </>
      )}
      {(isList || isSearch) && (
        <div className="grid grid-cols-2 gap-2">
          <div>
            <Label>Limit</Label>
            <Input
              type="number"
              min={1}
              max={500}
              value={config.limit ?? 100}
              onChange={(e) =>
                onChange({ limit: Number(e.target.value) || undefined })
              }
            />
          </div>
          {isList && (
            <div>
              <Label>Start (offset)</Label>
              <Input
                type="number"
                min={0}
                value={config.start ?? 0}
                onChange={(e) =>
                  onChange({ start: Number(e.target.value) || undefined })
                }
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
}
