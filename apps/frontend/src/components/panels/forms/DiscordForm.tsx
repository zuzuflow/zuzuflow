import React from "react";
import type { DiscordConfig, DiscordOperation } from "@workflow/shared";
import { CredentialSelector } from "../CredentialSelector";
import { TemplateInput } from "../TemplateInput";
import { TemplateTextarea } from "../TemplateTextarea";
import { Label } from "../../ui/label";

interface Props {
  config: DiscordConfig;
  onChange: (patch: Partial<DiscordConfig>) => void;
}

const OPERATIONS: DiscordOperation[] = [
  "sendWebhookMessage",
  "sendChannelMessage",
  "addReaction",
];

export function DiscordForm({ config, onChange }: Props): React.ReactElement {
  const op = config.operation ?? "sendWebhookMessage";
  const isWebhook = op === "sendWebhookMessage";
  const needsChannel = op === "sendChannelMessage" || op === "addReaction";
  const needsContent = op === "sendWebhookMessage" || op === "sendChannelMessage";
  const needsReaction = op === "addReaction";

  return (
    <div className="space-y-4">
      <CredentialSelector
        kinds={["discord"]}
        value={config.credentialId}
        onChange={(id) => onChange({ credentialId: id })}
        label="Discord Credential"
        placeholder={
          isWebhook
            ? "— Webhook URL —"
            : "— Bot token —"
        }
      />

      <div>
        <Label>Operation</Label>
        <select
          className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm"
          value={op}
          onChange={(e) =>
            onChange({ operation: e.target.value as DiscordOperation })
          }
        >
          {OPERATIONS.map((o) => (
            <option key={o} value={o}>
              {o}
            </option>
          ))}
        </select>
      </div>

      {needsChannel && (
        <div>
          <Label>Channel ID</Label>
          <TemplateInput
            value={config.channelId ?? ""}
            onChange={(v) => onChange({ channelId: v })}
            placeholder="1234567890"
          />
        </div>
      )}

      {needsReaction && (
        <>
          <div>
            <Label>Message ID</Label>
            <TemplateInput
              value={config.messageId ?? ""}
              onChange={(v) => onChange({ messageId: v })}
              placeholder="1234567890"
            />
          </div>
          <div>
            <Label>Emoji</Label>
            <TemplateInput
              value={config.emoji ?? ""}
              onChange={(v) => onChange({ emoji: v })}
              placeholder="👍 or thumbsup:12345"
            />
            <p className="text-[10px] text-muted-foreground mt-0.5">
              Unicode emoji, or `name:id` for custom server emoji.
            </p>
          </div>
        </>
      )}

      {needsContent && (
        <>
          <div>
            <Label>Content</Label>
            <TemplateTextarea
              value={config.content ?? ""}
              onChange={(v) => onChange({ content: v })}
              placeholder="Hello from workflow {{workflowId}}"
              rows={4}
            />
          </div>
          {isWebhook && (
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label>Username (optional)</Label>
                <TemplateInput
                  value={config.username ?? ""}
                  onChange={(v) => onChange({ username: v })}
                  placeholder="ZuzuBot"
                />
              </div>
              <div>
                <Label>Avatar URL (optional)</Label>
                <TemplateInput
                  value={config.avatarUrl ?? ""}
                  onChange={(v) => onChange({ avatarUrl: v })}
                  placeholder="https://..."
                />
              </div>
            </div>
          )}
          <div>
            <Label>Embeds JSON array (optional)</Label>
            <TemplateTextarea
              value={config.embeds ?? ""}
              onChange={(v) => onChange({ embeds: v })}
              placeholder='[{"title":"Deploy done","color":5814783}]'
              rows={3}
            />
          </div>
          <div className="flex items-center gap-2">
            <input
              id="discord-tts"
              type="checkbox"
              checked={config.tts ?? false}
              onChange={(e) => onChange({ tts: e.target.checked })}
            />
            <Label htmlFor="discord-tts" className="cursor-pointer">
              Send as TTS
            </Label>
          </div>
        </>
      )}
    </div>
  );
}
