import React from "react";
import type { AwsSqsConfig } from "@workflow/shared";
import { AwsBaseFields } from "./AwsBaseFields";
import { TemplateInput } from "../TemplateInput";
import { TemplateTextarea } from "../TemplateTextarea";
import { Input } from "../../ui/input";
import { Label } from "../../ui/label";

interface Props {
  config: AwsSqsConfig;
  onChange: (patch: Partial<AwsSqsConfig>) => void;
}

const OPERATIONS: AwsSqsConfig["operation"][] = ["sendMessage", "receiveMessage", "deleteMessage", "purgeQueue"];

export function AwsSqsForm({ config, onChange }: Props): React.ReactElement {
  const op = config.operation ?? "sendMessage";

  return (
    <div className="space-y-4">
      <AwsBaseFields config={config} onChange={onChange} />

      <div>
        <Label>Operation</Label>
        <select
          className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          value={op}
          onChange={(e) => onChange({ operation: e.target.value as AwsSqsConfig["operation"] })}
        >
          {OPERATIONS.map((o) => <option key={o} value={o}>{o}</option>)}
        </select>
      </div>

      <div>
        <Label>Queue URL</Label>
        <TemplateInput
          value={config.queueUrl ?? ""}
          onChange={(v) => onChange({ queueUrl: v })}
          placeholder="https://sqs.us-east-1.amazonaws.com/123456/my-queue"
        />
      </div>

      {op === "sendMessage" && (
        <>
          <div>
            <Label>Message Body</Label>
            <TemplateTextarea
              className="flex min-h-[80px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-xs shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring font-mono resize-y"
              value={config.messageBody ?? ""}
              onChange={(v) => onChange({ messageBody: v || undefined })}
              placeholder='{"event": "{{input.type}}"}'
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Delay (seconds)</Label>
              <Input
                type="number"
                value={config.delaySeconds ?? ""}
                onChange={(e) => onChange({ delaySeconds: e.target.value ? Number(e.target.value) : undefined })}
                placeholder="0"
              />
            </div>
            <div>
              <Label>Message Group ID</Label>
              <TemplateInput
                value={config.messageGroupId ?? ""}
                onChange={(v) => onChange({ messageGroupId: v || undefined })}
                placeholder="FIFO only"
              />
            </div>
          </div>
        </>
      )}

      {op === "receiveMessage" && (
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label>Max Messages</Label>
            <Input
              type="number"
              min={1}
              max={10}
              value={config.maxMessages ?? 1}
              onChange={(e) => onChange({ maxMessages: Number(e.target.value) })}
            />
          </div>
          <div>
            <Label>Wait Time (seconds)</Label>
            <Input
              type="number"
              value={config.waitTimeSeconds ?? 0}
              onChange={(e) => onChange({ waitTimeSeconds: Number(e.target.value) })}
            />
          </div>
        </div>
      )}

      {op === "deleteMessage" && (
        <div>
          <Label>Receipt Handle</Label>
          <TemplateInput
            value={config.receiptHandle ?? ""}
            onChange={(v) => onChange({ receiptHandle: v || undefined })}
            placeholder="{{input.receiptHandle}}"
          />
        </div>
      )}
    </div>
  );
}
