import React from "react";
import type { WhatsappConfig, WhatsappOperation } from "@workflow/shared";
import { CredentialSelector } from "../CredentialSelector";
import { TemplateInput } from "../TemplateInput";
import { TemplateTextarea } from "../TemplateTextarea";
import { Input } from "../../ui/input";
import { Label } from "../../ui/label";

interface Props {
  config: WhatsappConfig;
  onChange: (patch: Partial<WhatsappConfig>) => void;
}

const OPERATIONS: WhatsappOperation[] = [
  "messages.sendText",
  "messages.sendTemplate",
  "messages.sendMedia",
  "messages.markAsRead",
];

export function WhatsappForm({
  config,
  onChange,
}: Props): React.ReactElement {
  const op = config.operation ?? "messages.sendText";
  const isText = op === "messages.sendText";
  const isTemplate = op === "messages.sendTemplate";
  const isMedia = op === "messages.sendMedia";
  const isRead = op === "messages.markAsRead";
  const needsTo =
    op === "messages.sendText" ||
    op === "messages.sendTemplate" ||
    op === "messages.sendMedia";

  return (
    <div className="space-y-4">
      <CredentialSelector
        kinds={["whatsapp_business"]}
        value={config.credentialId}
        onChange={(id) => onChange({ credentialId: id })}
        label="WhatsApp Credential"
        placeholder="— accessToken + phoneNumberId —"
      />
      <div>
        <Label>Operation</Label>
        <select
          className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm"
          value={op}
          onChange={(e) =>
            onChange({ operation: e.target.value as WhatsappOperation })
          }
        >
          {OPERATIONS.map((o) => (
            <option key={o} value={o}>
              {o}
            </option>
          ))}
        </select>
      </div>
      {needsTo && (
        <div>
          <Label>Recipient (E.164, no +)</Label>
          <TemplateInput
            value={config.to ?? ""}
            onChange={(v) => onChange({ to: v })}
            placeholder="14155551234"
          />
        </div>
      )}
      {isText && (
        <>
          <div>
            <Label>Text</Label>
            <TemplateTextarea
              value={config.text ?? ""}
              onChange={(v) => onChange({ text: v })}
              placeholder="Hello from workflow {{workflowId}}"
              rows={4}
            />
          </div>
          <div className="flex items-center gap-2">
            <input
              id="wa-preview"
              type="checkbox"
              checked={config.previewUrl ?? false}
              onChange={(e) => onChange({ previewUrl: e.target.checked })}
            />
            <Label htmlFor="wa-preview" className="cursor-pointer">
              Render link preview
            </Label>
          </div>
        </>
      )}
      {isTemplate && (
        <>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label>Template name</Label>
              <TemplateInput
                value={config.templateName ?? ""}
                onChange={(v) => onChange({ templateName: v })}
                placeholder="order_confirmation"
              />
            </div>
            <div>
              <Label>Language code</Label>
              <Input
                value={config.templateLanguage ?? ""}
                onChange={(e) =>
                  onChange({ templateLanguage: e.target.value || undefined })
                }
                placeholder="en_US"
              />
            </div>
          </div>
          <div>
            <Label>Components JSON (optional)</Label>
            <TemplateTextarea
              value={config.templateComponents ?? ""}
              onChange={(v) =>
                onChange({ templateComponents: v || undefined })
              }
              placeholder='[{"type":"body","parameters":[{"type":"text","text":"{{input.name}}"}]}]'
              rows={4}
            />
          </div>
        </>
      )}
      {isMedia && (
        <>
          <div>
            <Label>Media type</Label>
            <select
              className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm"
              value={config.mediaType ?? "image"}
              onChange={(e) =>
                onChange({
                  mediaType: e.target.value as WhatsappConfig["mediaType"],
                })
              }
            >
              <option value="image">image</option>
              <option value="document">document</option>
              <option value="audio">audio</option>
              <option value="video">video</option>
              <option value="sticker">sticker</option>
            </select>
          </div>
          <div>
            <Label>Media URL</Label>
            <TemplateInput
              value={config.mediaUrl ?? ""}
              onChange={(v) => onChange({ mediaUrl: v })}
              placeholder="https://example.com/file.png"
            />
          </div>
          <div>
            <Label>Caption (image/video/document, optional)</Label>
            <TemplateInput
              value={config.caption ?? ""}
              onChange={(v) => onChange({ caption: v || undefined })}
              placeholder="Caption text"
            />
          </div>
          {config.mediaType === "document" && (
            <div>
              <Label>Filename</Label>
              <TemplateInput
                value={config.filename ?? ""}
                onChange={(v) => onChange({ filename: v || undefined })}
                placeholder="invoice.pdf"
              />
            </div>
          )}
        </>
      )}
      {isRead && (
        <div>
          <Label>Message ID</Label>
          <TemplateInput
            value={config.messageId ?? ""}
            onChange={(v) => onChange({ messageId: v })}
            placeholder="(inbound message ID)"
          />
        </div>
      )}
    </div>
  );
}
