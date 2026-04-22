import React from "react";
import type { SquareConfig, SquareOperation } from "@workflow/shared";
import { CredentialSelector } from "../CredentialSelector";
import { TemplateInput } from "../TemplateInput";
import { Input } from "../../ui/input";
import { Label } from "../../ui/label";

interface Props {
  config: SquareConfig;
  onChange: (patch: Partial<SquareConfig>) => void;
}

const OPERATIONS: SquareOperation[] = [
  "payments.create",
  "payments.get",
  "payments.list",
  "customers.create",
  "customers.list",
  "catalog.listItems",
];

const CURRENCIES = ["USD", "CAD", "GBP", "EUR", "AUD", "JPY"];

export function SquareForm({ config, onChange }: Props): React.ReactElement {
  const op = config.operation ?? "payments.create";
  const isPaymentCreate = op === "payments.create";
  const isPaymentGet = op === "payments.get";
  const isCustomerCreate = op === "customers.create";
  const isList =
    op === "payments.list" ||
    op === "customers.list" ||
    op === "catalog.listItems";

  return (
    <div className="space-y-4">
      <CredentialSelector
        kinds={["square"]}
        value={config.credentialId}
        onChange={(id) => onChange({ credentialId: id })}
        label="Square Credential"
        placeholder="— accessToken (+ environment: sandbox/production) —"
      />
      <div>
        <Label>Operation</Label>
        <select
          className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm"
          value={op}
          onChange={(e) =>
            onChange({ operation: e.target.value as SquareOperation })
          }
        >
          {OPERATIONS.map((o) => (
            <option key={o} value={o}>
              {o}
            </option>
          ))}
        </select>
      </div>
      {isPaymentCreate && (
        <>
          <div className="grid grid-cols-3 gap-2">
            <div className="col-span-2">
              <Label>Amount (smallest unit)</Label>
              <TemplateInput
                value={config.amountMinor ?? ""}
                onChange={(v) => onChange({ amountMinor: v })}
                placeholder="1999 (= $19.99)"
              />
            </div>
            <div>
              <Label>Currency</Label>
              <select
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm"
                value={config.currency ?? "USD"}
                onChange={(e) => onChange({ currency: e.target.value })}
              >
                {CURRENCIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div>
            <Label>Source ID</Label>
            <TemplateInput
              value={config.sourceId ?? ""}
              onChange={(v) => onChange({ sourceId: v })}
              placeholder="cnon:card-nonce-ok / ccof:..."
            />
          </div>
          <div>
            <Label>Note (optional)</Label>
            <TemplateInput
              value={config.note ?? ""}
              onChange={(v) => onChange({ note: v || undefined })}
              placeholder="Order #{{input.id}}"
            />
          </div>
        </>
      )}
      {isPaymentGet && (
        <div>
          <Label>Payment ID</Label>
          <TemplateInput
            value={config.resourceId ?? ""}
            onChange={(v) => onChange({ resourceId: v })}
            placeholder="payment ID"
          />
        </div>
      )}
      {isCustomerCreate && (
        <>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label>Given name</Label>
              <TemplateInput
                value={config.givenName ?? ""}
                onChange={(v) => onChange({ givenName: v || undefined })}
                placeholder="Ada"
              />
            </div>
            <div>
              <Label>Family name</Label>
              <TemplateInput
                value={config.familyName ?? ""}
                onChange={(v) => onChange({ familyName: v || undefined })}
                placeholder="Lovelace"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label>Email</Label>
              <TemplateInput
                value={config.emailAddress ?? ""}
                onChange={(v) => onChange({ emailAddress: v || undefined })}
                placeholder="user@example.com"
              />
            </div>
            <div>
              <Label>Phone (optional)</Label>
              <TemplateInput
                value={config.phoneNumber ?? ""}
                onChange={(v) => onChange({ phoneNumber: v || undefined })}
                placeholder="+14155551234"
              />
            </div>
          </div>
        </>
      )}
      {isList && (
        <div>
          <Label>Limit</Label>
          <Input
            type="number"
            min={1}
            max={100}
            value={config.limit ?? 100}
            onChange={(e) =>
              onChange({ limit: Number(e.target.value) || undefined })
            }
          />
        </div>
      )}
      {isPaymentCreate || isCustomerCreate ? (
        <div>
          <Label>Idempotency key (optional — auto-generated if blank)</Label>
          <Input
            value={config.idempotencyKey ?? ""}
            onChange={(e) =>
              onChange({ idempotencyKey: e.target.value || undefined })
            }
            placeholder="{{executionId}}-{{nodeId}}"
          />
        </div>
      ) : null}
    </div>
  );
}
