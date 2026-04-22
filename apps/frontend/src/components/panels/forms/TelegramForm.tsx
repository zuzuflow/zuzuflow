import React from "react";
import type { TelegramConfig, TelegramOperation } from "@workflow/shared";
import { CredentialSelector } from "../CredentialSelector";
import { TemplateInput } from "../TemplateInput";
import { TemplateTextarea } from "../TemplateTextarea";
import { Label } from "../../ui/label";

interface Props {
  config: TelegramConfig;
  onChange: (patch: Partial<TelegramConfig>) => void;
}

const OPERATIONS: TelegramOperation[] = [
  "sendMessage",
  "sendPhoto",
  "sendDocument",
  "editMessageText",
  "answerCallbackQuery",
];

export function TelegramForm({
  config,
  onChange,
}: Props): React.ReactElement {
  const op = config.operation ?? "sendMessage";
  const needsChat = op !== "answerCallbackQuery";
  const needsText =
    op === "sendMessage" || op === "editMessageText";
  const isPhoto = op === "sendPhoto";
  const isDoc = op === "sendDocument";
  const isEdit = op === "editMessageText";
  const isCallback = op === "answerCallbackQuery";
  const supportsMarkup =
    op === "sendMessage" ||
    op === "sendPhoto" ||
    op === "sendDocument" ||
    op === "editMessageText";

  return (
    <div className="space-y-4">
      <CredentialSelector
        kinds={["telegram"]}
        value={config.credentialId}
        onChange={(id) => onChange({ credentialId: id })}
        label="Telegram Credential"
        placeholder="— Bot token (from @BotFather) —"
      />
      <div>
        <Label>Operation</Label>
        <select
          className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm"
          value={op}
          onChange={(e) =>
            onChange({ operation: e.target.value as TelegramOperation })
          }
        >
          {OPERATIONS.map((o) => (
            <option key={o} value={o}>
              {o}
            </option>
          ))}
        </select>
      </div>
      {needsChat && (
        <div>
          <Label>Chat ID</Label>
          <TemplateInput
            value={config.chatId ?? ""}
            onChange={(v) => onChange({ chatId: v })}
            placeholder="-100123... or @channelusername"
          />
        </div>
      )}
      {isEdit && (
        <div>
          <Label>Message ID</Label>
          <TemplateInput
            value={config.messageId ?? ""}
            onChange={(v) => onChange({ messageId: v })}
            placeholder="42"
          />
        </div>
      )}
      {needsText && (
        <div>
          <Label>Text</Label>
          <TemplateTextarea
            value={config.text ?? ""}
            onChange={(v) => onChange({ text: v })}
            placeholder="Hello from workflow"
            rows={4}
          />
        </div>
      )}
      {isPhoto && (
        <>
          <div>
            <Label>Photo URL</Label>
            <TemplateInput
              value={config.photoUrl ?? ""}
              onChange={(v) => onChange({ photoUrl: v })}
              placeholder="https://example.com/image.png"
            />
          </div>
          <div>
            <Label>Caption (optional)</Label>
            <TemplateInput
              value={config.caption ?? ""}
              onChange={(v) => onChange({ caption: v })}
              placeholder="Caption"
            />
          </div>
        </>
      )}
      {isDoc && (
        <>
          <div>
            <Label>Document URL</Label>
            <TemplateInput
              value={config.documentUrl ?? ""}
              onChange={(v) => onChange({ documentUrl: v })}
              placeholder="https://example.com/file.pdf"
            />
          </div>
          <div>
            <Label>Caption (optional)</Label>
            <TemplateInput
              value={config.caption ?? ""}
              onChange={(v) => onChange({ caption: v })}
              placeholder="Caption"
            />
          </div>
        </>
      )}
      {isCallback && (
        <>
          <div>
            <Label>Callback query ID</Label>
            <TemplateInput
              value={config.callbackQueryId ?? ""}
              onChange={(v) => onChange({ callbackQueryId: v })}
              placeholder="{{input.callback_query.id}}"
            />
          </div>
          <div>
            <Label>Text (optional toast)</Label>
            <TemplateInput
              value={config.text ?? ""}
              onChange={(v) => onChange({ text: v })}
              placeholder="Got it!"
            />
          </div>
        </>
      )}
      {(needsText || isPhoto || isDoc) && (
        <div className="grid grid-cols-2 gap-2">
          <div>
            <Label>Parse mode</Label>
            <select
              className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm"
              value={config.parseMode ?? ""}
              onChange={(e) =>
                onChange({
                  parseMode:
                    (e.target.value as TelegramConfig["parseMode"]) ||
                    undefined,
                })
              }
            >
              <option value="">(none)</option>
              <option value="Markdown">Markdown</option>
              <option value="MarkdownV2">MarkdownV2</option>
              <option value="HTML">HTML</option>
            </select>
          </div>
          <div className="flex items-end">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={config.disableNotification ?? false}
                onChange={(e) =>
                  onChange({ disableNotification: e.target.checked })
                }
              />
              <span className="text-sm">Silent delivery</span>
            </label>
          </div>
        </div>
      )}
      {supportsMarkup && (
        <div>
          <Label>reply_markup JSON (optional — inline keyboard)</Label>
          <TemplateTextarea
            value={config.replyMarkup ?? ""}
            onChange={(v) => onChange({ replyMarkup: v || undefined })}
            placeholder='{"inline_keyboard":[[{"text":"Open","url":"https://..."}]]}'
            rows={3}
          />
        </div>
      )}
    </div>
  );
}
