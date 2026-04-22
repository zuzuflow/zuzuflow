import React from "react";
import type { KafkaConfig, KafkaOperation } from "@workflow/shared";
import { CredentialSelector } from "../CredentialSelector";
import { TemplateInput } from "../TemplateInput";
import { TemplateTextarea } from "../TemplateTextarea";
import { Input } from "../../ui/input";
import { Label } from "../../ui/label";

interface Props {
  config: KafkaConfig;
  onChange: (patch: Partial<KafkaConfig>) => void;
}

const OPERATIONS: KafkaOperation[] = ["produce", "consume"];

export function KafkaForm({ config, onChange }: Props): React.ReactElement {
  const op = config.operation ?? "produce";
  const isProduce = op === "produce";
  const isConsume = op === "consume";

  return (
    <div className="space-y-4">
      <CredentialSelector
        kinds={["kafka"]}
        value={config.credentialId}
        onChange={(id) => onChange({ credentialId: id })}
        label="Kafka Credential"
        placeholder="— brokers (CSV) + optional SASL / SSL —"
      />
      <div>
        <Label>Operation</Label>
        <select
          className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm"
          value={op}
          onChange={(e) =>
            onChange({ operation: e.target.value as KafkaOperation })
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
        <Label>Topic</Label>
        <TemplateInput
          value={config.topic ?? ""}
          onChange={(v) => onChange({ topic: v })}
          placeholder="events.orders"
        />
      </div>
      {isProduce && (
        <>
          <div>
            <Label>Message key (optional)</Label>
            <TemplateInput
              value={config.messageKey ?? ""}
              onChange={(v) => onChange({ messageKey: v || undefined })}
              placeholder="{{input.orderId}}"
            />
          </div>
          <div>
            <Label>Message value</Label>
            <TemplateTextarea
              value={config.messageValue ?? ""}
              onChange={(v) => onChange({ messageValue: v })}
              placeholder='{"event":"order_placed","id":"{{input.id}}"}'
              rows={4}
            />
          </div>
          <div>
            <Label>Headers JSON (optional)</Label>
            <TemplateTextarea
              value={config.headers ?? ""}
              onChange={(v) => onChange({ headers: v || undefined })}
              placeholder='{"trace-id":"{{executionId}}"}'
              rows={2}
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label>Partition (optional)</Label>
              <Input
                type="number"
                value={config.partition ?? ""}
                onChange={(e) =>
                  onChange({
                    partition:
                      e.target.value === "" ? undefined : Number(e.target.value),
                  })
                }
                placeholder="(leave blank for round-robin)"
              />
            </div>
            <div>
              <Label>Acks</Label>
              <select
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm"
                value={config.acks ?? "1"}
                onChange={(e) =>
                  onChange({ acks: e.target.value as KafkaConfig["acks"] })
                }
              >
                <option value="0">0 — fire-and-forget</option>
                <option value="1">1 — leader only (default)</option>
                <option value="-1">-1 — all in-sync replicas</option>
              </select>
            </div>
          </div>
        </>
      )}
      {isConsume && (
        <>
          <div>
            <Label>Consumer group ID</Label>
            <TemplateInput
              value={config.groupId ?? ""}
              onChange={(v) => onChange({ groupId: v || undefined })}
              placeholder="zuzuflow-{{workflowId}}"
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label>Max messages</Label>
              <Input
                type="number"
                min={1}
                max={1000}
                value={config.maxMessages ?? 10}
                onChange={(e) =>
                  onChange({
                    maxMessages: Number(e.target.value) || undefined,
                  })
                }
              />
            </div>
            <div>
              <Label>Max wait (ms)</Label>
              <Input
                type="number"
                min={100}
                max={60000}
                value={config.maxWaitMs ?? 5000}
                onChange={(e) =>
                  onChange({ maxWaitMs: Number(e.target.value) || undefined })
                }
              />
            </div>
          </div>
          <div className="flex items-center gap-2">
            <input
              id="kafka-from-beginning"
              type="checkbox"
              checked={config.fromBeginning ?? false}
              onChange={(e) => onChange({ fromBeginning: e.target.checked })}
            />
            <Label htmlFor="kafka-from-beginning" className="cursor-pointer">
              Read from beginning (when no committed offset)
            </Label>
          </div>
        </>
      )}
    </div>
  );
}
