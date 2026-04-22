import React from "react";
import type { GcpPubSubConfig } from "@workflow/shared";
import { CredentialSelector } from "../CredentialSelector";
import { TemplateInput } from "../TemplateInput";
import { TemplateTextarea } from "../TemplateTextarea";
import { Input } from "../../ui/input";
import { Label } from "../../ui/label";

interface Props {
  config: GcpPubSubConfig;
  onChange: (patch: Partial<GcpPubSubConfig>) => void;
}

const OPERATIONS: GcpPubSubConfig["operation"][] = ["publish", "pull", "ack"];

const SELECT =
  "flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring";

export function GcpPubSubForm({ config, onChange }: Props): React.ReactElement {
  const op = config.operation ?? "publish";
  return (
    <div className="space-y-4">
      <CredentialSelector kinds={["gcp"]} value={config.credentialId} onChange={(id) => onChange({ credentialId: id })} label="GCP Credential" />
      <div>
        <Label>Operation</Label>
        <select className={SELECT} value={op} onChange={(e) => onChange({ operation: e.target.value as GcpPubSubConfig["operation"] })}>
          {OPERATIONS.map((o) => <option key={o} value={o}>{o}</option>)}
        </select>
      </div>
      {op === "publish" && (
        <>
          <div>
            <Label>Topic</Label>
            <TemplateInput value={config.topic ?? ""} onChange={(v) => onChange({ topic: v })} placeholder="my-topic" />
          </div>
          <div>
            <Label>Message body</Label>
            <TemplateTextarea value={config.messageBody ?? ""} onChange={(v) => onChange({ messageBody: v })} rows={5} placeholder='{"event":"order.created"}' />
          </div>
          <div>
            <Label>Attributes (JSON object)</Label>
            <TemplateTextarea value={config.attributes ?? ""} onChange={(v) => onChange({ attributes: v || undefined })} rows={3} placeholder='{"tenant":"acme"}' />
          </div>
        </>
      )}
      {op === "pull" && (
        <>
          <div>
            <Label>Subscription</Label>
            <TemplateInput value={config.subscription ?? ""} onChange={(v) => onChange({ subscription: v })} placeholder="my-sub" />
          </div>
          <div>
            <Label>Max messages</Label>
            <Input type="number" min={1} max={1000} value={config.maxMessages ?? 10} onChange={(e) => onChange({ maxMessages: Number(e.target.value) || undefined })} />
          </div>
          <p className="text-[10px] text-muted-foreground">Messages are returned with their <code className="text-slate-300">ackId</code> — chain a second PubSub node in <strong>ack</strong> mode to confirm receipt.</p>
        </>
      )}
      {op === "ack" && (
        <>
          <div>
            <Label>Subscription</Label>
            <TemplateInput value={config.subscription ?? ""} onChange={(v) => onChange({ subscription: v })} placeholder="my-sub" />
          </div>
          <div>
            <Label>Ack IDs (comma-separated)</Label>
            <TemplateTextarea value={config.ackIds ?? ""} onChange={(v) => onChange({ ackIds: v })} rows={3} placeholder="{{pull_1.items.*.ackId}}" />
          </div>
        </>
      )}
    </div>
  );
}
