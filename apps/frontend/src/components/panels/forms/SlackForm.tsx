import React from "react";
import type { SlackConfig } from "@workflow/shared";
import { CredentialSelector } from "../CredentialSelector";
import { TemplateInput } from "../TemplateInput";
import { TemplateTextarea } from "../TemplateTextarea";
import { Input } from "../../ui/input";
import { Label } from "../../ui/label";

interface Props {
  config: SlackConfig;
  onChange: (patch: Partial<SlackConfig>) => void;
}

export function SlackForm({ config, onChange }: Props): React.ReactElement {
  return (
    <div className="space-y-4">
      <CredentialSelector
        kinds={["slack"]}
        value={config.credentialId}
        onChange={(id) => onChange({ credentialId: id, webhookUrl: id ? undefined : config.webhookUrl })}
        label="Slack Credential"
        placeholder="— Use inline webhook URL —"
      />

      {!config.credentialId && (
        <div>
          <Label>Webhook URL (fallback)</Label>
          <Input
            type="password"
            value={config.webhookUrl ?? ""}
            onChange={(e) => onChange({ webhookUrl: e.target.value || undefined })}
            placeholder="https://hooks.slack.com/services/..."
          />
        </div>
      )}

      <div>
        <Label>Channel</Label>
        <TemplateInput
          value={config.channel ?? ""}
          onChange={(v) => onChange({ channel: v })}
          placeholder="#general"
        />
      </div>

      <div>
        <Label>Message</Label>
        <TemplateTextarea
          className="flex min-h-[80px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring resize-y"
          value={config.message ?? ""}
          onChange={(v) => onChange({ message: v })}
          placeholder="Hello from workflow! {{input.name}} just triggered this."
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label>Username (optional)</Label>
          <Input
            value={config.username ?? ""}
            onChange={(e) => onChange({ username: e.target.value || undefined })}
            placeholder="Workflow Bot"
          />
        </div>
        <div>
          <Label>Icon Emoji (optional)</Label>
          <Input
            value={config.iconEmoji ?? ""}
            onChange={(e) => onChange({ iconEmoji: e.target.value || undefined })}
            placeholder=":robot_face:"
          />
        </div>
      </div>
    </div>
  );
}
