import React from "react";
import type { AzureBlobConfig } from "@workflow/shared";
import { CredentialSelector } from "../CredentialSelector";
import { TemplateInput } from "../TemplateInput";
import { TemplateTextarea } from "../TemplateTextarea";
import { Input } from "../../ui/input";
import { Label } from "../../ui/label";

interface Props {
  config: AzureBlobConfig;
  onChange: (patch: Partial<AzureBlobConfig>) => void;
}

const OPERATIONS: AzureBlobConfig["operation"][] = [
  "uploadBlob",
  "downloadBlob",
  "listBlobs",
  "deleteBlob",
  "getBlobProperties",
];

export function AzureBlobForm({ config, onChange }: Props): React.ReactElement {
  const op = config.operation ?? "uploadBlob";

  return (
    <div className="space-y-4">
      <CredentialSelector
        kinds={["azure"]}
        value={config.credentialId}
        onChange={(id) => onChange({ credentialId: id })}
        label="Azure Credential"
        placeholder="— Connection string / shared key / SAS —"
      />

      <div>
        <Label>Operation</Label>
        <select
          className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          value={op}
          onChange={(e) =>
            onChange({
              operation: e.target.value as AzureBlobConfig["operation"],
            })
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
        <Label>Container</Label>
        <TemplateInput
          value={config.container ?? ""}
          onChange={(v) => onChange({ container: v })}
          placeholder="my-container"
        />
      </div>

      {op !== "listBlobs" && (
        <div>
          <Label>Blob name</Label>
          <TemplateInput
            value={config.blob ?? ""}
            onChange={(v) => onChange({ blob: v })}
            placeholder="path/to/blob.json"
          />
        </div>
      )}

      {op === "listBlobs" && (
        <>
          <div>
            <Label>Prefix (optional)</Label>
            <TemplateInput
              value={config.prefix ?? ""}
              onChange={(v) => onChange({ prefix: v || undefined })}
              placeholder="folder/"
            />
          </div>
          <div>
            <Label>Max results</Label>
            <Input
              type="number"
              min={1}
              max={5000}
              value={config.maxResults ?? 100}
              onChange={(e) =>
                onChange({ maxResults: Number(e.target.value) || undefined })
              }
            />
          </div>
        </>
      )}

      {op === "uploadBlob" && (
        <>
          <div>
            <Label>Content</Label>
            <TemplateTextarea
              value={config.content ?? ""}
              onChange={(v) => onChange({ content: v })}
              placeholder='{"hello": "world"}'
              rows={5}
            />
            <p className="text-[10px] text-muted-foreground mt-0.5">
              Supports {`{{...}}`} interpolation. For binary payloads, pass a
              base64 string and set Content-Type appropriately.
            </p>
          </div>
          <div>
            <Label>Content-Type</Label>
            <Input
              value={config.contentType ?? ""}
              onChange={(e) =>
                onChange({ contentType: e.target.value || undefined })
              }
              placeholder="application/json"
            />
          </div>
        </>
      )}
    </div>
  );
}
