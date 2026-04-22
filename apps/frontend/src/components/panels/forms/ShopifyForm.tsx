import React from "react";
import type { ShopifyConfig, ShopifyOperation } from "@workflow/shared";
import { CredentialSelector } from "../CredentialSelector";
import { TemplateInput } from "../TemplateInput";
import { TemplateTextarea } from "../TemplateTextarea";
import { Input } from "../../ui/input";
import { Label } from "../../ui/label";

interface Props {
  config: ShopifyConfig;
  onChange: (patch: Partial<ShopifyConfig>) => void;
}

const OPERATIONS: ShopifyOperation[] = [
  "orders.list",
  "orders.get",
  "orders.cancel",
  "products.list",
  "products.get",
  "products.create",
  "products.update",
  "customers.list",
  "customers.get",
  "inventory.adjust",
];

export function ShopifyForm({ config, onChange }: Props): React.ReactElement {
  const op = config.operation ?? "orders.list";
  const isList = op.endsWith(".list");
  const needsId =
    op === "orders.get" ||
    op === "orders.cancel" ||
    op === "products.get" ||
    op === "products.update" ||
    op === "customers.get";
  const needsBody = op === "products.create" || op === "products.update";
  const isInventory = op === "inventory.adjust";

  return (
    <div className="space-y-4">
      <CredentialSelector
        kinds={["shopify"]}
        value={config.credentialId}
        onChange={(id) => onChange({ credentialId: id })}
        label="Shopify Credential"
        placeholder="— shopDomain + Admin API access token —"
      />
      <div>
        <Label>Operation</Label>
        <select
          className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm"
          value={op}
          onChange={(e) =>
            onChange({ operation: e.target.value as ShopifyOperation })
          }
        >
          {OPERATIONS.map((o) => (
            <option key={o} value={o}>
              {o}
            </option>
          ))}
        </select>
      </div>
      <div>
        <Label>API Version (optional)</Label>
        <Input
          value={config.apiVersion ?? ""}
          onChange={(e) =>
            onChange({ apiVersion: e.target.value || undefined })
          }
          placeholder="2024-10"
        />
      </div>
      {needsId && (
        <div>
          <Label>Object ID</Label>
          <TemplateInput
            value={config.objectId ?? ""}
            onChange={(v) => onChange({ objectId: v })}
            placeholder="(order / product / customer ID)"
          />
        </div>
      )}
      {needsBody && (
        <div>
          <Label>Body JSON (product attributes)</Label>
          <TemplateTextarea
            value={config.body ?? ""}
            onChange={(v) => onChange({ body: v })}
            placeholder='{"title":"My Product","body_html":"<p>Desc</p>","vendor":"Acme"}'
            rows={5}
          />
        </div>
      )}
      {isList && (
        <>
          <div>
            <Label>Query params JSON (optional)</Label>
            <TemplateTextarea
              value={config.queryParams ?? ""}
              onChange={(v) => onChange({ queryParams: v || undefined })}
              placeholder='{"status":"any","fields":"id,name,email"}'
              rows={3}
            />
          </div>
          <div>
            <Label>Limit</Label>
            <Input
              type="number"
              min={1}
              max={250}
              value={config.limit ?? 50}
              onChange={(e) =>
                onChange({ limit: Number(e.target.value) || undefined })
              }
            />
          </div>
        </>
      )}
      {isInventory && (
        <>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label>Inventory item ID</Label>
              <TemplateInput
                value={config.inventoryItemId ?? ""}
                onChange={(v) => onChange({ inventoryItemId: v })}
                placeholder="12345"
              />
            </div>
            <div>
              <Label>Location ID</Label>
              <TemplateInput
                value={config.locationId ?? ""}
                onChange={(v) => onChange({ locationId: v })}
                placeholder="67890"
              />
            </div>
          </div>
          <div>
            <Label>Adjust by (positive or negative)</Label>
            <TemplateInput
              value={config.adjustBy ?? ""}
              onChange={(v) => onChange({ adjustBy: v })}
              placeholder="-1 (sell) or +10 (restock)"
            />
          </div>
        </>
      )}
    </div>
  );
}
