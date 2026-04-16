import React from "react";
import type { FirebasePushConfig } from "@workflow/shared";
import { CredentialSelector } from "../CredentialSelector";
import { TemplateInput } from "../TemplateInput";
import { TemplateTextarea } from "../TemplateTextarea";
import { Label } from "../../ui/label";

interface Props {
  config: FirebasePushConfig;
  onChange: (patch: Partial<FirebasePushConfig>) => void;
}

export function FirebasePushForm({ config, onChange }: Props): React.ReactElement {
  return (
    <div className="space-y-4">
      <CredentialSelector
        kinds={["firebase"]}
        value={config.credentialId}
        onChange={(id) => onChange({ credentialId: id })}
        label="Firebase Credential"
        placeholder="— Select credential —"
      />

      <div>
        <Label>Target Type</Label>
        <select
          value={config.targetType ?? "token"}
          onChange={(e) => onChange({ targetType: e.target.value as FirebasePushConfig["targetType"] })}
          className="flex h-8 w-full rounded-md border border-input bg-transparent px-3 py-1 text-xs shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
        >
          <option value="token">Device Token</option>
          <option value="topic">Topic</option>
        </select>
      </div>

      <div>
        <Label>{config.targetType === "topic" ? "Topic" : "Device Token"}</Label>
        <TemplateInput
          wrapperClassName="relative"
          value={config.target ?? ""}
          onChange={(v) => onChange({ target: v })}
          placeholder={config.targetType === "topic" ? "news" : "{{input.deviceToken}}"}
        />
      </div>

      <div>
        <Label>Title</Label>
        <TemplateInput
          wrapperClassName="relative"
          value={config.title ?? ""}
          onChange={(v) => onChange({ title: v })}
          placeholder="New message"
        />
      </div>

      <div>
        <Label>Body</Label>
        <TemplateTextarea
          className="flex min-h-[60px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-xs shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring resize-y"
          value={config.body ?? ""}
          onChange={(v) => onChange({ body: v })}
          placeholder="You have a new notification"
        />
      </div>

      <div>
        <Label>Data (optional JSON)</Label>
        <TemplateTextarea
          className="flex min-h-[60px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-xs shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring font-mono resize-y"
          value={config.data ?? ""}
          onChange={(v) => onChange({ data: v || undefined })}
          placeholder='{"orderId": "{{input.orderId}}"}'
        />
      </div>

      <div>
        <Label>Image URL (optional)</Label>
        <TemplateInput
          wrapperClassName="relative"
          value={config.imageUrl ?? ""}
          onChange={(v) => onChange({ imageUrl: v || undefined })}
          placeholder="https://example.com/image.png"
        />
      </div>
    </div>
  );
}
