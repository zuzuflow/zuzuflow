import React from "react";
import type { ApnsPushConfig } from "@workflow/shared";
import { CredentialSelector } from "../CredentialSelector";
import { TemplateInput } from "../TemplateInput";
import { TemplateTextarea } from "../TemplateTextarea";
import { Input } from "../../ui/input";
import { Label } from "../../ui/label";

interface Props {
  config: ApnsPushConfig;
  onChange: (patch: Partial<ApnsPushConfig>) => void;
}

export function ApnsPushForm({ config, onChange }: Props): React.ReactElement {
  return (
    <div className="space-y-4">
      <CredentialSelector
        kinds={["apns"]}
        value={config.credentialId}
        onChange={(id) => onChange({ credentialId: id })}
        label="APNs Credential"
        placeholder="— Select credential —"
      />

      <div>
        <Label>Device Token</Label>
        <TemplateInput
          wrapperClassName="relative"
          value={config.deviceToken ?? ""}
          onChange={(v) => onChange({ deviceToken: v })}
          placeholder="{{input.deviceToken}}"
        />
      </div>

      <div>
        <Label>Bundle ID</Label>
        <Input
          value={config.bundleId ?? ""}
          onChange={(e) => onChange({ bundleId: e.target.value })}
          placeholder="com.myapp.ios"
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
        <Label>Payload (optional JSON)</Label>
        <TemplateTextarea
          className="flex min-h-[60px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-xs shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring font-mono resize-y"
          value={config.payload ?? ""}
          onChange={(v) => onChange({ payload: v || undefined })}
          placeholder='{"aps": {"sound": "default"}}'
        />
      </div>

      <div className="flex items-center gap-4">
        <label className="flex items-center gap-2 text-xs">
          <input
            type="checkbox"
            checked={config.production ?? false}
            onChange={(e) => onChange({ production: e.target.checked })}
            className="rounded border-input"
          />
          Production
        </label>
      </div>

      <div>
        <Label>Push Type</Label>
        <select
          value={config.pushType ?? "alert"}
          onChange={(e) => onChange({ pushType: e.target.value as ApnsPushConfig["pushType"] })}
          className="flex h-8 w-full rounded-md border border-input bg-transparent px-3 py-1 text-xs shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
        >
          <option value="alert">Alert</option>
          <option value="background">Background</option>
          <option value="voip">VoIP</option>
        </select>
      </div>
    </div>
  );
}
