import React from "react";
import type { MsTeamsConfig, MsTeamsOperation } from "@workflow/shared";
import { CredentialSelector } from "../CredentialSelector";
import { TemplateInput } from "../TemplateInput";
import { TemplateTextarea } from "../TemplateTextarea";
import { Input } from "../../ui/input";
import { Label } from "../../ui/label";

interface Props {
  config: MsTeamsConfig;
  onChange: (patch: Partial<MsTeamsConfig>) => void;
}

const OPERATIONS: MsTeamsOperation[] = [
  "sendWebhookMessage",
  "sendAdaptiveCard",
];

export function MsTeamsForm({
  config,
  onChange,
}: Props): React.ReactElement {
  const op = config.operation ?? "sendWebhookMessage";
  const isMsg = op === "sendWebhookMessage";
  const isCard = op === "sendAdaptiveCard";

  return (
    <div className="space-y-4">
      <CredentialSelector
        kinds={["ms_teams"]}
        value={config.credentialId}
        onChange={(id) => onChange({ credentialId: id })}
        label="MS Teams Credential"
        placeholder="— Incoming webhook URL —"
      />

      <div>
        <Label>Operation</Label>
        <select
          className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm"
          value={op}
          onChange={(e) =>
            onChange({ operation: e.target.value as MsTeamsOperation })
          }
        >
          {OPERATIONS.map((o) => (
            <option key={o} value={o}>
              {o}
            </option>
          ))}
        </select>
      </div>

      {isMsg && (
        <>
          <div>
            <Label>Title (optional)</Label>
            <TemplateInput
              value={config.title ?? ""}
              onChange={(v) => onChange({ title: v })}
              placeholder="Deploy notification"
            />
          </div>
          <div>
            <Label>Message</Label>
            <TemplateTextarea
              value={config.message ?? ""}
              onChange={(v) => onChange({ message: v })}
              placeholder="**Success** — deploy {{nodeId}} completed."
              rows={4}
            />
          </div>
          <div>
            <Label>Theme color (hex, no #)</Label>
            <Input
              value={config.themeColor ?? ""}
              onChange={(e) =>
                onChange({ themeColor: e.target.value || undefined })
              }
              placeholder="0076D7"
            />
          </div>
        </>
      )}

      {isCard && (
        <div>
          <Label>Adaptive Card JSON</Label>
          <TemplateTextarea
            value={config.cardJson ?? ""}
            onChange={(v) => onChange({ cardJson: v })}
            placeholder='{"type":"AdaptiveCard","version":"1.4","body":[...]}'
            rows={10}
          />
          <p className="text-[10px] text-muted-foreground mt-0.5">
            Paste the full Adaptive Card content (everything that goes inside
            `attachments[0].content`). See{" "}
            <a
              className="underline"
              href="https://adaptivecards.io"
              target="_blank"
              rel="noreferrer"
            >
              adaptivecards.io
            </a>
            .
          </p>
        </div>
      )}
    </div>
  );
}
