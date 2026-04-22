import React from "react";
import type { NatsConfig, NatsOperation } from "@workflow/shared";
import { CredentialSelector } from "../CredentialSelector";
import { TemplateInput } from "../TemplateInput";
import { TemplateTextarea } from "../TemplateTextarea";
import { Input } from "../../ui/input";
import { Label } from "../../ui/label";

interface Props {
  config: NatsConfig;
  onChange: (patch: Partial<NatsConfig>) => void;
}

const OPERATIONS: NatsOperation[] = [
  "publish",
  "request",
  "subscribe",
  "jetstream.publish",
];

export function NatsForm({ config, onChange }: Props): React.ReactElement {
  const op = config.operation ?? "publish";
  const isPublish = op === "publish";
  const isRequest = op === "request";
  const isSubscribe = op === "subscribe";
  const isJetstream = op === "jetstream.publish";
  const needsPayload = isPublish || isRequest || isJetstream;

  return (
    <div className="space-y-4">
      <CredentialSelector
        kinds={["nats"]}
        value={config.credentialId}
        onChange={(id) => onChange({ credentialId: id })}
        label="NATS Credential"
        placeholder="— servers (CSV) + optional user/pass or token —"
      />
      <div>
        <Label>Operation</Label>
        <select
          className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm"
          value={op}
          onChange={(e) =>
            onChange({ operation: e.target.value as NatsOperation })
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
        <Label>Subject</Label>
        <TemplateInput
          value={config.subject ?? ""}
          onChange={(v) => onChange({ subject: v })}
          placeholder="orders.created"
        />
      </div>
      {needsPayload && (
        <div>
          <Label>Payload</Label>
          <TemplateTextarea
            value={config.payload ?? ""}
            onChange={(v) => onChange({ payload: v || undefined })}
            placeholder='{"event":"order_placed"}'
            rows={4}
          />
        </div>
      )}
      {isPublish && (
        <div>
          <Label>Reply-to subject (optional)</Label>
          <TemplateInput
            value={config.replyTo ?? ""}
            onChange={(v) => onChange({ replyTo: v || undefined })}
            placeholder="inbox.{{nodeId}}"
          />
        </div>
      )}
      {(isPublish || isRequest || isJetstream) && (
        <div>
          <Label>Headers JSON (optional)</Label>
          <TemplateTextarea
            value={config.headers ?? ""}
            onChange={(v) => onChange({ headers: v || undefined })}
            placeholder='{"trace-id":"{{executionId}}"}'
            rows={2}
          />
        </div>
      )}
      {isJetstream && (
        <>
          <div>
            <Label>Stream</Label>
            <TemplateInput
              value={config.stream ?? ""}
              onChange={(v) => onChange({ stream: v || undefined })}
              placeholder="ORDERS"
            />
          </div>
          <div>
            <Label>Msg-Id (dedup, optional)</Label>
            <TemplateInput
              value={config.msgId ?? ""}
              onChange={(v) => onChange({ msgId: v || undefined })}
              placeholder="{{executionId}}-{{nodeId}}"
            />
          </div>
        </>
      )}
      {(isRequest || isSubscribe) && (
        <div className="grid grid-cols-2 gap-2">
          <div>
            <Label>Timeout (ms)</Label>
            <Input
              type="number"
              min={100}
              max={60000}
              value={config.timeoutMs ?? 5000}
              onChange={(e) =>
                onChange({ timeoutMs: Number(e.target.value) || undefined })
              }
            />
          </div>
          {isSubscribe && (
            <div>
              <Label>Max messages</Label>
              <Input
                type="number"
                min={1}
                max={1000}
                value={config.maxMessages ?? 1}
                onChange={(e) =>
                  onChange({
                    maxMessages: Number(e.target.value) || undefined,
                  })
                }
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
}
