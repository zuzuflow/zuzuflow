import React from "react";
import type { SalesforceConfig, SalesforceOperation } from "@workflow/shared";
import { CredentialSelector } from "../CredentialSelector";
import { TemplateInput } from "../TemplateInput";
import { TemplateTextarea } from "../TemplateTextarea";
import { Input } from "../../ui/input";
import { Label } from "../../ui/label";

interface Props {
  config: SalesforceConfig;
  onChange: (patch: Partial<SalesforceConfig>) => void;
}

const OPERATIONS: SalesforceOperation[] = [
  "query",
  "sobject.create",
  "sobject.retrieve",
  "sobject.update",
  "sobject.delete",
  "sobject.upsert",
  "describe",
  "apex.rest",
];

const COMMON_SOBJECTS = [
  "Account",
  "Contact",
  "Lead",
  "Opportunity",
  "Case",
  "Task",
  "User",
];

export function SalesforceForm({
  config,
  onChange,
}: Props): React.ReactElement {
  const op = config.operation ?? "query";
  const needsSObject =
    op === "sobject.create" ||
    op === "sobject.retrieve" ||
    op === "sobject.update" ||
    op === "sobject.delete" ||
    op === "sobject.upsert" ||
    op === "describe";
  const needsRecordId =
    op === "sobject.retrieve" ||
    op === "sobject.update" ||
    op === "sobject.delete";
  const needsRecord =
    op === "sobject.create" ||
    op === "sobject.update" ||
    op === "sobject.upsert";
  const needsUpsertKey = op === "sobject.upsert";
  const isQuery = op === "query";
  const isApex = op === "apex.rest";

  return (
    <div className="space-y-4">
      <CredentialSelector
        kinds={["salesforce"]}
        value={config.credentialId}
        onChange={(id) => onChange({ credentialId: id })}
        label="Salesforce Credential"
        placeholder="— OAuth token or username+password+security token —"
      />

      <div>
        <Label>Operation</Label>
        <select
          className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm"
          value={op}
          onChange={(e) =>
            onChange({ operation: e.target.value as SalesforceOperation })
          }
        >
          {OPERATIONS.map((o) => (
            <option key={o} value={o}>
              {o}
            </option>
          ))}
        </select>
      </div>

      {needsSObject && (
        <div>
          <Label>Object API name</Label>
          <div className="flex gap-2">
            <select
              className="flex h-9 w-40 rounded-md border border-input bg-transparent px-3 py-1 text-sm"
              value=""
              onChange={(e) => {
                if (e.target.value) onChange({ sobject: e.target.value });
              }}
            >
              <option value="">— pick —</option>
              {COMMON_SOBJECTS.map((o) => (
                <option key={o} value={o}>
                  {o}
                </option>
              ))}
            </select>
            <TemplateInput
              value={config.sobject ?? ""}
              onChange={(v) => onChange({ sobject: v })}
              placeholder="Account / Contact / Custom__c"
            />
          </div>
        </div>
      )}

      {needsRecordId && (
        <div>
          <Label>Record ID</Label>
          <TemplateInput
            value={config.recordId ?? ""}
            onChange={(v) => onChange({ recordId: v })}
            placeholder="001..."
          />
        </div>
      )}

      {needsUpsertKey && (
        <div>
          <Label>External ID field</Label>
          <TemplateInput
            value={config.externalIdField ?? ""}
            onChange={(v) => onChange({ externalIdField: v })}
            placeholder="Email / Custom_Id__c"
          />
        </div>
      )}

      {needsRecord && (
        <div>
          <Label>Record JSON</Label>
          <TemplateTextarea
            value={config.record ?? ""}
            onChange={(v) => onChange({ record: v })}
            placeholder='{"Name": "{{input.name}}", "Industry": "Technology"}'
            rows={5}
          />
        </div>
      )}

      {isQuery && (
        <>
          <div>
            <Label>SOQL</Label>
            <TemplateTextarea
              value={config.soql ?? ""}
              onChange={(v) => onChange({ soql: v })}
              placeholder="SELECT Id, Name FROM Account WHERE CreatedDate = TODAY"
              rows={4}
            />
          </div>
          <div>
            <Label>Max rows</Label>
            <Input
              type="number"
              min={1}
              max={50000}
              value={config.maxRows ?? 2000}
              onChange={(e) =>
                onChange({ maxRows: Number(e.target.value) || undefined })
              }
            />
          </div>
        </>
      )}

      {isApex && (
        <>
          <div>
            <Label>Apex REST path</Label>
            <TemplateInput
              value={config.apexPath ?? ""}
              onChange={(v) => onChange({ apexPath: v })}
              placeholder="/MyResource/{{input.id}}"
            />
          </div>
          <div>
            <Label>Method</Label>
            <select
              className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm"
              value={config.apexMethod ?? "GET"}
              onChange={(e) =>
                onChange({
                  apexMethod: e.target
                    .value as SalesforceConfig["apexMethod"],
                })
              }
            >
              <option value="GET">GET</option>
              <option value="POST">POST</option>
              <option value="PUT">PUT</option>
              <option value="PATCH">PATCH</option>
              <option value="DELETE">DELETE</option>
            </select>
          </div>
          <div>
            <Label>Body JSON (optional)</Label>
            <TemplateTextarea
              value={config.apexBody ?? ""}
              onChange={(v) => onChange({ apexBody: v || undefined })}
              placeholder='{"foo": "bar"}'
              rows={3}
            />
          </div>
        </>
      )}
    </div>
  );
}
