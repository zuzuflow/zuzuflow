import React from "react";
import type {
  CustomerIoConfig,
  CustomerIoOperation,
} from "@workflow/shared";
import { CredentialSelector } from "../CredentialSelector";
import { TemplateInput } from "../TemplateInput";
import { TemplateTextarea } from "../TemplateTextarea";
import { Label } from "../../ui/label";

interface Props {
  config: CustomerIoConfig;
  onChange: (patch: Partial<CustomerIoConfig>) => void;
}

const OPERATIONS: CustomerIoOperation[] = [
  "identify",
  "track",
  "deleteCustomer",
  "sendTransactional",
];

export function CustomerIoForm({
  config,
  onChange,
}: Props): React.ReactElement {
  const op = config.operation ?? "identify";
  const needsCustomerId =
    op === "identify" || op === "track" || op === "deleteCustomer";
  const isTrack = op === "track";
  const isIdentify = op === "identify";
  const isTransactional = op === "sendTransactional";

  return (
    <div className="space-y-4">
      <CredentialSelector
        kinds={["customer_io"]}
        value={config.credentialId}
        onChange={(id) => onChange({ credentialId: id })}
        label="Customer.io Credential"
        placeholder="— siteId + apiKey (track) / appApiKey (app) + region —"
      />
      <div>
        <Label>Operation</Label>
        <select
          className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm"
          value={op}
          onChange={(e) =>
            onChange({ operation: e.target.value as CustomerIoOperation })
          }
        >
          {OPERATIONS.map((o) => (
            <option key={o} value={o}>
              {o}
            </option>
          ))}
        </select>
      </div>
      {needsCustomerId && (
        <div>
          <Label>Customer ID (email or internal ID)</Label>
          <TemplateInput
            value={config.customerId ?? ""}
            onChange={(v) => onChange({ customerId: v })}
            placeholder="{{input.email}}"
          />
        </div>
      )}
      {isIdentify && (
        <div>
          <Label>Attributes JSON</Label>
          <TemplateTextarea
            value={config.attributes ?? ""}
            onChange={(v) => onChange({ attributes: v || undefined })}
            placeholder='{"first_name":"Ada","plan":"pro"}'
            rows={4}
          />
        </div>
      )}
      {isTrack && (
        <>
          <div>
            <Label>Event name</Label>
            <TemplateInput
              value={config.eventName ?? ""}
              onChange={(v) => onChange({ eventName: v })}
              placeholder="purchase"
            />
          </div>
          <div>
            <Label>Data JSON (optional)</Label>
            <TemplateTextarea
              value={config.data ?? ""}
              onChange={(v) => onChange({ data: v || undefined })}
              placeholder='{"product_id":"sku_abc","amount":1999}'
              rows={4}
            />
          </div>
        </>
      )}
      {isTransactional && (
        <>
          <div>
            <Label>Transactional message ID</Label>
            <TemplateInput
              value={config.transactionalId ?? ""}
              onChange={(v) => onChange({ transactionalId: v })}
              placeholder="welcome-email"
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label>Identifier type</Label>
              <select
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm"
                value={config.identifierType ?? "email"}
                onChange={(e) =>
                  onChange({
                    identifierType: e.target
                      .value as CustomerIoConfig["identifierType"],
                  })
                }
              >
                <option value="email">email</option>
                <option value="id">id (internal)</option>
              </select>
            </div>
            <div>
              <Label>Identifier value</Label>
              <TemplateInput
                value={config.identifierValue ?? ""}
                onChange={(v) => onChange({ identifierValue: v })}
                placeholder="{{input.email}}"
              />
            </div>
          </div>
          <div>
            <Label>To address (optional override)</Label>
            <TemplateInput
              value={config.to ?? ""}
              onChange={(v) => onChange({ to: v || undefined })}
              placeholder="user@example.com"
            />
          </div>
          <div>
            <Label>Message data JSON (optional)</Label>
            <TemplateTextarea
              value={config.data ?? ""}
              onChange={(v) => onChange({ data: v || undefined })}
              placeholder='{"name":"Ada","orderId":"1234"}'
              rows={4}
            />
          </div>
        </>
      )}
    </div>
  );
}
