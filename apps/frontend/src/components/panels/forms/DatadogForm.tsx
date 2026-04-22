import React from "react";
import type { DatadogConfig, DatadogOperation } from "@workflow/shared";
import { CredentialSelector } from "../CredentialSelector";
import { TemplateInput } from "../TemplateInput";
import { TemplateTextarea } from "../TemplateTextarea";
import { Input } from "../../ui/input";
import { Label } from "../../ui/label";

interface Props {
  config: DatadogConfig;
  onChange: (patch: Partial<DatadogConfig>) => void;
}

const OPERATIONS: DatadogOperation[] = [
  "metrics.submit",
  "events.post",
  "logs.submit",
];

export function DatadogForm({ config, onChange }: Props): React.ReactElement {
  const op = config.operation ?? "metrics.submit";
  const isMetric = op === "metrics.submit";
  const isEvent = op === "events.post";
  const isLog = op === "logs.submit";

  return (
    <div className="space-y-4">
      <CredentialSelector
        kinds={["datadog"]}
        value={config.credentialId}
        onChange={(id) => onChange({ credentialId: id })}
        label="Datadog Credential"
        placeholder="— apiKey (+ appKey for some APIs, + site for EU) —"
      />
      <div>
        <Label>Operation</Label>
        <select
          className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm"
          value={op}
          onChange={(e) =>
            onChange({ operation: e.target.value as DatadogOperation })
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
        <Label>Tags (CSV, optional)</Label>
        <TemplateInput
          value={config.tags ?? ""}
          onChange={(v) => onChange({ tags: v || undefined })}
          placeholder="env:prod,service:api"
        />
      </div>
      {isMetric && (
        <>
          <div>
            <Label>Metric name</Label>
            <TemplateInput
              value={config.metricName ?? ""}
              onChange={(v) => onChange({ metricName: v })}
              placeholder="my.workflow.count"
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label>Value</Label>
              <TemplateInput
                value={config.metricValue ?? ""}
                onChange={(v) => onChange({ metricValue: v })}
                placeholder="1"
              />
            </div>
            <div>
              <Label>Type</Label>
              <select
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm"
                value={config.metricType ?? "count"}
                onChange={(e) =>
                  onChange({
                    metricType: e.target
                      .value as DatadogConfig["metricType"],
                  })
                }
              >
                <option value="count">count</option>
                <option value="rate">rate</option>
                <option value="gauge">gauge</option>
              </select>
            </div>
          </div>
        </>
      )}
      {isEvent && (
        <>
          <div>
            <Label>Title</Label>
            <TemplateInput
              value={config.title ?? ""}
              onChange={(v) => onChange({ title: v })}
              placeholder="Deploy succeeded"
            />
          </div>
          <div>
            <Label>Text (body)</Label>
            <TemplateTextarea
              value={config.text ?? ""}
              onChange={(v) => onChange({ text: v })}
              placeholder="Details..."
              rows={4}
            />
          </div>
          <div>
            <Label>Alert type</Label>
            <select
              className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm"
              value={config.alertType ?? "info"}
              onChange={(e) =>
                onChange({
                  alertType: e.target.value as DatadogConfig["alertType"],
                })
              }
            >
              <option value="info">info</option>
              <option value="success">success</option>
              <option value="warning">warning</option>
              <option value="error">error</option>
            </select>
          </div>
          <div>
            <Label>Source type name (optional)</Label>
            <Input
              value={config.source ?? ""}
              onChange={(e) =>
                onChange({ source: e.target.value || undefined })
              }
              placeholder="zuzuflow"
            />
          </div>
        </>
      )}
      {isLog && (
        <>
          <div>
            <Label>Message</Label>
            <TemplateTextarea
              value={config.text ?? ""}
              onChange={(v) => onChange({ text: v })}
              placeholder="Log line..."
              rows={3}
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label>Service</Label>
              <TemplateInput
                value={config.service ?? ""}
                onChange={(v) => onChange({ service: v || undefined })}
                placeholder="workflow"
              />
            </div>
            <div>
              <Label>Host (optional)</Label>
              <TemplateInput
                value={config.host ?? ""}
                onChange={(v) => onChange({ host: v || undefined })}
                placeholder="prod-01"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label>Status</Label>
              <select
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm"
                value={config.logStatus ?? "info"}
                onChange={(e) =>
                  onChange({
                    logStatus: e.target
                      .value as DatadogConfig["logStatus"],
                  })
                }
              >
                <option value="ok">ok</option>
                <option value="info">info</option>
                <option value="warning">warning</option>
                <option value="error">error</option>
                <option value="critical">critical</option>
              </select>
            </div>
            <div>
              <Label>Source (ddsource)</Label>
              <Input
                value={config.source ?? ""}
                onChange={(e) =>
                  onChange({ source: e.target.value || undefined })
                }
                placeholder="zuzuflow"
              />
            </div>
          </div>
          <div>
            <Label>Title (optional, included as log field)</Label>
            <TemplateInput
              value={config.title ?? ""}
              onChange={(v) => onChange({ title: v || undefined })}
              placeholder=""
            />
          </div>
        </>
      )}
    </div>
  );
}
