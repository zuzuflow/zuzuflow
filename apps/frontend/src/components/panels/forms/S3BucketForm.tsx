import React from "react";
import type { S3BucketConfig } from "@workflow/shared";
import { CredentialSelector } from "../CredentialSelector";
import { TemplateInput } from "../TemplateInput";
import { TemplateTextarea } from "../TemplateTextarea";
import { Input } from "../../ui/input";
import { Label } from "../../ui/label";

interface Props {
  config: S3BucketConfig;
  onChange: (patch: Partial<S3BucketConfig>) => void;
}

const OPERATIONS: S3BucketConfig["operation"][] = [
  "getObject", "putObject", "listObjects", "deleteObject",
];

export function S3BucketForm({ config, onChange }: Props): React.ReactElement {
  const op = config.operation ?? "getObject";

  return (
    <div className="space-y-4">
      <CredentialSelector
        kinds={["aws"]}
        value={config.credentialId}
        onChange={(id) => onChange({ credentialId: id })}
        label="AWS Credential"
        placeholder="— Use environment variables —"
      />

      <div>
        <Label>Custom Endpoint (MinIO / GCS)</Label>
        <Input
          value={(config as any).endpoint ?? ""}
          onChange={(e) => onChange({ endpoint: e.target.value || undefined } as any)}
          placeholder="https://play.min.io or https://storage.googleapis.com"
        />
        <p className="text-[10px] text-muted-foreground mt-0.5">
          Leave empty for AWS S3. Set for MinIO, GCS, or other S3-compatible services.
        </p>
      </div>

      {(config as any).endpoint && (
        <div className="flex items-center gap-2">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={(config as any).forcePathStyle ?? false}
              onChange={(e) => onChange({ forcePathStyle: e.target.checked } as any)}
              className="w-3.5 h-3.5 rounded accent-indigo-500"
            />
            <span className="text-xs text-muted-foreground">Force path-style URLs (required for MinIO)</span>
          </label>
        </div>
      )}

      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label>Region</Label>
          <Input
            value={config.region ?? ""}
            onChange={(e) => onChange({ region: e.target.value || undefined })}
            placeholder="us-east-1"
          />
        </div>
        <div>
          <Label>Operation</Label>
          <select
            className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            value={op}
            onChange={(e) => onChange({ operation: e.target.value as S3BucketConfig["operation"] })}
          >
            {OPERATIONS.map((o) => <option key={o} value={o}>{o}</option>)}
          </select>
        </div>
      </div>

      <div>
        <Label>Bucket</Label>
        <TemplateInput
          value={config.bucket ?? ""}
          onChange={(v) => onChange({ bucket: v })}
          placeholder="my-bucket"
        />
      </div>

      {op !== "listObjects" && (
        <div>
          <Label>Key (Object Path)</Label>
          <TemplateInput
            className="font-mono"
            value={config.key ?? ""}
            onChange={(v) => onChange({ key: v })}
            placeholder="uploads/{{input.filename}}"
          />
        </div>
      )}

      {op === "listObjects" && (
        <div>
          <Label>Prefix (optional)</Label>
          <TemplateInput
            className="font-mono"
            value={config.prefix ?? ""}
            onChange={(v) => onChange({ prefix: v || undefined })}
            placeholder="uploads/"
          />
        </div>
      )}

      {op === "putObject" && (
        <>
          <div>
            <Label>Body</Label>
            <TemplateTextarea
              className="flex min-h-[80px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-xs shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring font-mono resize-y"
              value={config.body ?? ""}
              onChange={(v) => onChange({ body: v || undefined })}
              placeholder="{{input.fileContent}}"
            />
          </div>
          <div>
            <Label>Content-Type</Label>
            <Input
              value={config.contentType ?? ""}
              onChange={(e) => onChange({ contentType: e.target.value || undefined })}
              placeholder="application/json"
            />
          </div>
        </>
      )}
    </div>
  );
}
