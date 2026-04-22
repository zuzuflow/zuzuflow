import React from "react";
import type { StripeConfig, StripeOperation } from "@workflow/shared";
import { CredentialSelector } from "../CredentialSelector";
import { TemplateInput } from "../TemplateInput";
import { TemplateTextarea } from "../TemplateTextarea";
import { Input } from "../../ui/input";
import { Label } from "../../ui/label";

interface Props {
  config: StripeConfig;
  onChange: (patch: Partial<StripeConfig>) => void;
}

const OPERATIONS: StripeOperation[] = [
  "charges.create",
  "charges.retrieve",
  "charges.refund",
  "customers.create",
  "customers.retrieve",
  "customers.update",
  "paymentIntents.create",
  "paymentIntents.retrieve",
  "paymentIntents.capture",
  "subscriptions.create",
  "subscriptions.cancel",
  "invoices.create",
  "invoices.send",
];

const CURRENCIES = [
  "usd",
  "eur",
  "gbp",
  "inr",
  "jpy",
  "cad",
  "aud",
  "chf",
  "sgd",
  "hkd",
];

export function StripeForm({ config, onChange }: Props): React.ReactElement {
  const op = config.operation ?? "charges.create";
  const needsAmount =
    op === "charges.create" ||
    op === "paymentIntents.create" ||
    op === "charges.refund" ||
    op === "paymentIntents.capture";
  const needsCustomer =
    op === "charges.create" ||
    op === "paymentIntents.create" ||
    op === "subscriptions.create" ||
    op === "invoices.create";
  const needsResource =
    op === "charges.retrieve" ||
    op === "charges.refund" ||
    op === "customers.retrieve" ||
    op === "customers.update" ||
    op === "paymentIntents.retrieve" ||
    op === "paymentIntents.capture" ||
    op === "subscriptions.cancel" ||
    op === "invoices.send";

  return (
    <div className="space-y-4">
      <CredentialSelector
        kinds={["stripe"]}
        value={config.credentialId}
        onChange={(id) => onChange({ credentialId: id })}
        label="Stripe Credential"
        placeholder="— API key (sk_...) —"
      />

      <div>
        <Label>Operation</Label>
        <select
          className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          value={op}
          onChange={(e) =>
            onChange({ operation: e.target.value as StripeOperation })
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
            placeholder="ch_... / cus_... / pi_... / sub_... / in_..."
          />
        </div>
      )}

      {needsAmount && (
        <div className="grid grid-cols-3 gap-2">
          <div className="col-span-2">
            <Label>Amount (smallest unit)</Label>
            <TemplateInput
              value={config.amount ?? ""}
              onChange={(v) => onChange({ amount: v })}
              placeholder="e.g. 1999 (= $19.99)"
            />
          </div>
          <div>
            <Label>Currency</Label>
            <select
              className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm"
              value={config.currency ?? "usd"}
              onChange={(e) => onChange({ currency: e.target.value })}
            >
              {CURRENCIES.map((c) => (
                <option key={c} value={c}>
                  {c.toUpperCase()}
                </option>
              ))}
            </select>
          </div>
        </div>
      )}

      {needsCustomer && (
        <div>
          <Label>Customer ID</Label>
          <TemplateInput
            value={config.customerId ?? ""}
            onChange={(v) => onChange({ customerId: v })}
            placeholder="cus_..."
          />
        </div>
      )}

      {op === "charges.create" && (
        <div>
          <Label>Source / Payment method</Label>
          <TemplateInput
            value={config.source ?? ""}
            onChange={(v) => onChange({ source: v })}
            placeholder="tok_visa / pm_..."
          />
        </div>
      )}

      <div>
        <Label>Description (optional)</Label>
        <TemplateInput
          value={config.description ?? ""}
          onChange={(v) => onChange({ description: v })}
          placeholder="Order #{{input.id}}"
        />
      </div>

      <div>
        <Label>Metadata JSON (optional)</Label>
        <TemplateTextarea
          value={config.metadata ?? ""}
          onChange={(v) => onChange({ metadata: v })}
          placeholder='{"orderId": "{{input.id}}"}'
          rows={3}
        />
      </div>

      <div>
        <Label>Extra params JSON (optional)</Label>
        <TemplateTextarea
          value={config.extraParams ?? ""}
          onChange={(v) => onChange({ extraParams: v })}
          placeholder='{"statement_descriptor": "ACME"}'
          rows={3}
        />
        <p className="text-[10px] text-muted-foreground mt-0.5">
          Merged into the Stripe call — see Stripe docs for each operation's
          params.
        </p>
      </div>

      <div>
        <Label>Idempotency key (optional)</Label>
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
