import React from "react";
import type { SentryConfig, SentryOperation } from "@workflow/shared";
import { CredentialSelector } from "../CredentialSelector";
import { TemplateInput } from "../TemplateInput";
import { TemplateTextarea } from "../TemplateTextarea";
import { Input } from "../../ui/input";
import { Label } from "../../ui/label";

interface Props {
  config: SentryConfig;
  onChange: (patch: Partial<SentryConfig>) => void;
}

const OPERATIONS: SentryOperation[] = [
  "events.captureMessage",
  "events.captureException",
  "issues.list",
  "issues.resolve",
];

export function SentryForm({ config, onChange }: Props): React.ReactElement {
  const op = config.operation ?? "events.captureMessage";
  const isMsg = op === "events.captureMessage";
  const isEx = op === "events.captureException";
  const isEvent = isMsg || isEx;
  const isList = op === "issues.list";
  const isResolve = op === "issues.resolve";

  return (
    <div className="space-y-4">
      <CredentialSelector
        kinds={["sentry"]}
        value={config.credentialId}
        onChange={(id) => onChange({ credentialId: id })}
        label="Sentry Credential"
        placeholder="— dsn (events) / authToken+org+project (REST) —"
      />
      <div>
        <Label>Operation</Label>
        <select
          className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm"
          value={op}
          onChange={(e) =>
            onChange({ operation: e.target.value as SentryOperation })
          }
        >
          {OPERATIONS.map((o) => (
            <option key={o} value={o}>
              {o}
            </option>
          ))}
        </select>
      </div>
      {(isMsg || isEx) && (
        <div>
          <Label>Message</Label>
          <TemplateInput
            value={config.message ?? ""}
            onChange={(v) => onChange({ message: v })}
            placeholder="Something went wrong in workflow {{workflowId}}"
          />
        </div>
      )}
      {isEx && (
        <div className="grid grid-cols-2 gap-2">
          <div>
            <Label>Exception type</Label>
            <TemplateInput
              value={config.exceptionType ?? ""}
              onChange={(v) => onChange({ exceptionType: v })}
              placeholder="PaymentFailed"
            />
          </div>
          <div>
            <Label>Exception value</Label>
            <TemplateInput
              value={config.exceptionValue ?? ""}
              onChange={(v) => onChange({ exceptionValue: v })}
              placeholder="Card was declined"
            />
          </div>
        </div>
      )}
      {isEvent && (
        <>
          <div className="grid grid-cols-3 gap-2">
            <div>
              <Label>Level</Label>
              <select
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm"
                value={config.level ?? "error"}
                onChange={(e) =>
                  onChange({ level: e.target.value as SentryConfig["level"] })
                }
              >
                <option value="fatal">fatal</option>
                <option value="error">error</option>
                <option value="warning">warning</option>
                <option value="info">info</option>
                <option value="debug">debug</option>
              </select>
            </div>
            <div>
              <Label>Environment</Label>
              <TemplateInput
                value={config.environment ?? ""}
                onChange={(v) => onChange({ environment: v || undefined })}
                placeholder="production"
              />
            </div>
            <div>
              <Label>Release</Label>
              <TemplateInput
                value={config.release ?? ""}
                onChange={(v) => onChange({ release: v || undefined })}
                placeholder="v1.2.3"
              />
            </div>
          </div>
          <div>
            <Label>Tags JSON (optional)</Label>
            <TemplateTextarea
              value={config.tags ?? ""}
              onChange={(v) => onChange({ tags: v || undefined })}
              placeholder='{"tenant":"acme"}'
              rows={2}
            />
          </div>
          <div>
            <Label>Extra context JSON (optional)</Label>
            <TemplateTextarea
              value={config.extra ?? ""}
              onChange={(v) => onChange({ extra: v || undefined })}
              placeholder='{"userId":"{{input.userId}}"}'
              rows={3}
            />
          </div>
        </>
      )}
      {isList && (
        <>
          <div>
            <Label>Query (Sentry Discover syntax, optional)</Label>
            <TemplateInput
              value={config.query ?? ""}
              onChange={(v) => onChange({ query: v || undefined })}
              placeholder="is:unresolved environment:production"
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
        </>
      )}
      {isResolve && (
        <div>
          <Label>Issue ID</Label>
          <TemplateInput
            value={config.issueId ?? ""}
            onChange={(v) => onChange({ issueId: v })}
            placeholder="Sentry numeric issue ID"
          />
        </div>
      )}
    </div>
  );
}
