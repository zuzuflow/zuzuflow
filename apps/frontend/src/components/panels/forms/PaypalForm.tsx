import React from "react";
import type { PaypalConfig, PaypalOperation } from "@workflow/shared";
import { CredentialSelector } from "../CredentialSelector";
import { TemplateInput } from "../TemplateInput";
import { TemplateTextarea } from "../TemplateTextarea";
import { Input } from "../../ui/input";
import { Label } from "../../ui/label";

interface Props {
  config: PaypalConfig;
  onChange: (patch: Partial<PaypalConfig>) => void;
}

const OPERATIONS: PaypalOperation[] = [
  "orders.create",
  "orders.get",
  "orders.capture",
  "payments.captureAuthorization",
  "payments.refund",
];

const CURRENCIES = ["USD", "EUR", "GBP", "CAD", "AUD", "JPY", "INR"];

export function PaypalForm({ config, onChange }: Props): React.ReactElement {
  const op = config.operation ?? "orders.create";
  const needsResource =
    op === "orders.get" ||
    op === "orders.capture" ||
    op === "payments.captureAuthorization" ||
    op === "payments.refund";
  const needsAmount =
    op === "orders.create" ||
    op === "payments.captureAuthorization" ||
    op === "payments.refund";
  const isCreate = op === "orders.create";

  return (
    <div className="space-y-4">
      <CredentialSelector
        kinds={["paypal"]}
        value={config.credentialId}
        onChange={(id) => onChange({ credentialId: id })}
        label="PayPal Credential"
        placeholder="— clientId + clientSecret (+ environment) —"
      />
      <div>
        <Label>Operation</Label>
        <select
          className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm"
          value={op}
          onChange={(e) =>
            onChange({ operation: e.target.value as PaypalOperation })
          }
        >
          {OPERATIONS.map((o) => (
            <option key={o} value={o}>
              {o}
            </option>
          ))}
        </select>
      </div>
      {needsResource && (
        <div>
          <Label>Resource ID</Label>
          <TemplateInput
            value={config.resourceId ?? ""}
            onChange={(v) => onChange({ resourceId: v })}
            placeholder="(order / authorization / capture ID)"
          />
        </div>
      )}
      {needsAmount && (
        <div className="grid grid-cols-3 gap-2">
          <div className="col-span-2">
            <Label>Amount</Label>
            <TemplateInput
              value={config.amount ?? ""}
              onChange={(v) => onChange({ amount: v })}
              placeholder="19.99"
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
      )}
      {isCreate && (
        <>
          <div>
            <Label>Intent</Label>
            <select
              className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm"
              value={config.intent ?? "CAPTURE"}
              onChange={(e) =>
                onChange({
                  intent: e.target.value as PaypalConfig["intent"],
                })
              }
            >
              <option value="CAPTURE">CAPTURE (charge immediately)</option>
              <option value="AUTHORIZE">AUTHORIZE (hold, capture later)</option>
            </select>
          </div>
          <div>
            <Label>Description (optional)</Label>
            <TemplateInput
              value={config.description ?? ""}
              onChange={(v) => onChange({ description: v || undefined })}
              placeholder="Order #{{input.id}}"
            />
          </div>
          <div>
            <Label>Extra params JSON (optional)</Label>
            <TemplateTextarea
              value={config.extraParams ?? ""}
              onChange={(v) => onChange({ extraParams: v || undefined })}
              placeholder='{"application_context":{"brand_name":"Acme"}}'
              rows={3}
            />
          </div>
        </>
      )}
      <div>
        <Label>Idempotency key / PayPal-Request-Id (optional)</Label>
        <Input
          value={config.idempotencyKey ?? ""}
          onChange={(e) =>
            onChange({ idempotencyKey: e.target.value || undefined })
          }
          placeholder="{{executionId}}-{{nodeId}}"
        />
      </div>
    </div>
  );
}
