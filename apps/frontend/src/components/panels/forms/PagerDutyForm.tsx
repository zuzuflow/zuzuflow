import React from "react";
import type { PagerDutyConfig, PagerDutyOperation } from "@workflow/shared";
import { CredentialSelector } from "../CredentialSelector";
import { TemplateInput } from "../TemplateInput";
import { TemplateTextarea } from "../TemplateTextarea";
import { Input } from "../../ui/input";
import { Label } from "../../ui/label";

interface Props {
  config: PagerDutyConfig;
  onChange: (patch: Partial<PagerDutyConfig>) => void;
}

const OPERATIONS: PagerDutyOperation[] = [
  "events.trigger",
  "events.acknowledge",
  "events.resolve",
  "incidents.create",
  "incidents.list",
];

export function PagerDutyForm({
  config,
  onChange,
}: Props): React.ReactElement {
  const op = config.operation ?? "events.trigger";
  const isTrigger = op === "events.trigger";
  const isAckResolve = op === "events.acknowledge" || op === "events.resolve";
  const isCreate = op === "incidents.create";
  const isList = op === "incidents.list";

  return (
    <div className="space-y-4">
      <CredentialSelector
        kinds={["pagerduty"]}
        value={config.credentialId}
        onChange={(id) => onChange({ credentialId: id })}
        label="PagerDuty Credential"
        placeholder="— routingKey (Events API) or apiToken (REST) —"
      />

      <div>
        <Label>Operation</Label>
        <select
          className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm"
          value={op}
          onChange={(e) =>
            onChange({ operation: e.target.value as PagerDutyOperation })
          }
        >
          {OPERATIONS.map((o) => (
            <option key={o} value={o}>
              {o}
            </option>
          ))}
        </select>
      </div>

      {(isTrigger || isCreate) && (
        <div>
          <Label>Summary / title</Label>
          <TemplateInput
            value={config.summary ?? ""}
            onChange={(v) => onChange({ summary: v })}
            placeholder="Checkout API is down"
          />
        </div>
      )}

      {isTrigger && (
        <>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label>Source</Label>
              <TemplateInput
                value={config.source ?? ""}
                onChange={(v) => onChange({ source: v })}
                placeholder="prod-api-01"
              />
            </div>
            <div>
              <Label>Severity</Label>
              <select
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm"
                value={config.severity ?? "error"}
                onChange={(e) =>
                  onChange({
                    severity: e.target
                      .value as PagerDutyConfig["severity"],
                  })
                }
              >
                <option value="critical">critical</option>
                <option value="error">error</option>
                <option value="warning">warning</option>
                <option value="info">info</option>
              </select>
            </div>
          </div>
          <div>
            <Label>Dedup key (optional)</Label>
            <TemplateInput
              value={config.dedupKey ?? ""}
              onChange={(v) => onChange({ dedupKey: v || undefined })}
              placeholder="{{workflowId}}-{{nodeId}}"
            />
          </div>
          <div>
            <Label>Custom details JSON (optional)</Label>
            <TemplateTextarea
              value={config.customDetails ?? ""}
              onChange={(v) =>
                onChange({ customDetails: v || undefined })
              }
              placeholder='{"runbook": "https://..."}'
              rows={3}
            />
          </div>
        </>
      )}

      {isAckResolve && (
        <div>
          <Label>Dedup key</Label>
          <TemplateInput
            value={config.dedupKey ?? ""}
            onChange={(v) => onChange({ dedupKey: v })}
            placeholder="(same key used for events.trigger)"
          />
        </div>
      )}

      {isCreate && (
        <>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label>Service ID</Label>
              <TemplateInput
                value={config.serviceId ?? ""}
                onChange={(v) => onChange({ serviceId: v })}
                placeholder="P..."
              />
            </div>
            <div>
              <Label>Escalation policy ID (optional)</Label>
              <TemplateInput
                value={config.escalationPolicyId ?? ""}
                onChange={(v) =>
                  onChange({ escalationPolicyId: v || undefined })
                }
                placeholder="P..."
              />
            </div>
          </div>
          <div>
            <Label>Requester email</Label>
            <TemplateInput
              value={config.userEmail ?? ""}
              onChange={(v) => onChange({ userEmail: v })}
              placeholder="oncall@example.com"
            />
          </div>
        </>
      )}

      {isList && (
        <div className="grid grid-cols-2 gap-2">
          <div>
            <Label>Status filter (optional)</Label>
            <Input
              value={config.statusFilter ?? ""}
              onChange={(e) =>
                onChange({ statusFilter: e.target.value || undefined })
              }
              placeholder="triggered / acknowledged / resolved"
            />
          </div>
          <div>
            <Label>Limit</Label>
            <Input
              type="number"
              min={1}
              max={100}
              value={config.limit ?? 25}
              onChange={(e) =>
                onChange({ limit: Number(e.target.value) || undefined })
              }
            />
          </div>
        </div>
      )}
    </div>
  );
}
