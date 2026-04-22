import React from "react";
import type { AzureServiceBusConfig } from "@workflow/shared";
import { CredentialSelector } from "../CredentialSelector";
import { TemplateInput } from "../TemplateInput";
import { TemplateTextarea } from "../TemplateTextarea";
import { Input } from "../../ui/input";
import { Label } from "../../ui/label";

interface Props {
  config: AzureServiceBusConfig;
  onChange: (patch: Partial<AzureServiceBusConfig>) => void;
}

const OPERATIONS: AzureServiceBusConfig["operation"][] = [
  "sendMessage",
  "receiveMessages",
  "peekMessages",
];

const SELECT =
  "flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring";

export function AzureServiceBusForm({ config, onChange }: Props): React.ReactElement {
  const op = config.operation ?? "sendMessage";
  const needsSub = op === "receiveMessages" || op === "peekMessages";

  return (
    <div className="space-y-4">
      <CredentialSelector
        kinds={["azure"]}
        value={config.credentialId}
        onChange={(id) => onChange({ credentialId: id })}
        label="Azure Credential (connection string)"
      />
      <div>
        <Label>Operation</Label>
        <select className={SELECT} value={op} onChange={(e) => onChange({ operation: e.target.value as AzureServiceBusConfig["operation"] })}>
          {OPERATIONS.map((o) => <option key={o} value={o}>{o}</option>)}
        </select>
      </div>
      <div>
        <Label>Queue / Topic name</Label>
        <TemplateInput value={config.entityName ?? ""} onChange={(v) => onChange({ entityName: v })} placeholder="my-queue" />
      </div>
      {needsSub && (
        <div>
          <Label>Subscription (topics only)</Label>
          <Input
            value={config.subscriptionName ?? ""}
            onChange={(e) => onChange({ subscriptionName: e.target.value || undefined })}
            placeholder="sub1"
          />
        </div>
      )}
      {op === "sendMessage" && (
        <>
          <div>
            <Label>Message body</Label>
            <TemplateTextarea value={config.messageBody ?? ""} onChange={(v) => onChange({ messageBody: v })} rows={5} placeholder='{"orderId": "{{input.body.orderId}}"}' />
          </div>
          <div>
            <Label>Content-Type (optional)</Label>
            <Input value={config.contentType ?? ""} onChange={(e) => onChange({ contentType: e.target.value || undefined })} placeholder="application/json" />
          </div>
        </>
      )}
      {(op === "receiveMessages" || op === "peekMessages") && (
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label>Max messages</Label>
            <Input type="number" min={1} max={100} value={config.maxMessages ?? 1} onChange={(e) => onChange({ maxMessages: Number(e.target.value) || undefined })} />
          </div>
          {op === "receiveMessages" && (
            <div>
              <Label>Max wait (s)</Label>
              <Input type="number" min={1} max={60} value={config.maxWaitTimeSeconds ?? 5} onChange={(e) => onChange({ maxWaitTimeSeconds: Number(e.target.value) || undefined })} />
            </div>
          )}
        </div>
      )}
    </div>
  );
}
