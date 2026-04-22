import React from "react";
import type { HubspotConfig, HubspotOperation } from "@workflow/shared";
import { CredentialSelector } from "../CredentialSelector";
import { TemplateInput } from "../TemplateInput";
import { TemplateTextarea } from "../TemplateTextarea";
import { Label } from "../../ui/label";

interface Props {
  config: HubspotConfig;
  onChange: (patch: Partial<HubspotConfig>) => void;
}

const OPERATIONS: HubspotOperation[] = [
  "contacts.create",
  "contacts.update",
  "contacts.get",
  "contacts.searchByEmail",
  "companies.create",
  "companies.update",
  "companies.get",
  "deals.create",
  "deals.update",
  "deals.get",
];

export function HubspotForm({
  config,
  onChange,
}: Props): React.ReactElement {
  const op = config.operation ?? "contacts.create";
  const needsObjectId = op.endsWith(".update") || op.endsWith(".get");
  const isCreate = op.endsWith(".create");
  const isUpdate = op.endsWith(".update");
  const isSearch = op === "contacts.searchByEmail";
  const needsProperties = isCreate || isUpdate;

  return (
    <div className="space-y-4">
      <CredentialSelector
        kinds={["hubspot"]}
        value={config.credentialId}
        onChange={(id) => onChange({ credentialId: id })}
        label="HubSpot Credential"
        placeholder="— Private App token / API key —"
      />

      <div>
        <Label>Operation</Label>
        <select
          className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm"
          value={op}
          onChange={(e) =>
            onChange({ operation: e.target.value as HubspotOperation })
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
            placeholder="HubSpot record ID"
          />
        </div>
      )}

      {isSearch && (
        <div>
          <Label>Email</Label>
          <TemplateInput
            value={config.email ?? ""}
            onChange={(v) => onChange({ email: v })}
            placeholder="user@example.com"
          />
        </div>
      )}

      {needsProperties && (
        <div>
          <Label>Properties JSON</Label>
          <TemplateTextarea
            value={config.properties ?? ""}
            onChange={(v) => onChange({ properties: v })}
            placeholder={
              op.startsWith("deals")
                ? '{"dealname": "New deal", "amount": "5000"}'
                : op.startsWith("companies")
                  ? '{"name": "Acme Corp", "domain": "acme.com"}'
                  : '{"firstname": "Ada", "lastname": "Lovelace", "email": "ada@example.com"}'
            }
            rows={5}
          />
        </div>
      )}

      {isCreate && (
        <div>
          <Label>Associations JSON (optional)</Label>
          <TemplateTextarea
            value={config.associations ?? ""}
            onChange={(v) => onChange({ associations: v })}
            placeholder='[{"to":{"id":"123"},"types":[{"associationCategory":"HUBSPOT_DEFINED","associationTypeId":1}]}]'
            rows={3}
          />
        </div>
      )}
    </div>
  );
}
