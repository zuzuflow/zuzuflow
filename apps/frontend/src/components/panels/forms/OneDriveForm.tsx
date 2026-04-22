import React from "react";
import type { OneDriveConfig, OneDriveOperation } from "@workflow/shared";
import { CredentialSelector } from "../CredentialSelector";
import { TemplateInput } from "../TemplateInput";
import { TemplateTextarea } from "../TemplateTextarea";
import { Input } from "../../ui/input";
import { Label } from "../../ui/label";

interface Props {
  config: OneDriveConfig;
  onChange: (patch: Partial<OneDriveConfig>) => void;
}

const OPERATIONS: OneDriveOperation[] = [
  "files.list",
  "files.get",
  "files.upload",
  "files.delete",
  "files.createShareLink",
];

export function OneDriveForm({
  config,
  onChange,
}: Props): React.ReactElement {
  const op = config.operation ?? "files.list";
  const needsItem =
    op === "files.get" ||
    op === "files.delete" ||
    op === "files.createShareLink";
  const isList = op === "files.list";
  const isUpload = op === "files.upload";
  const isShare = op === "files.createShareLink";

  return (
    <div className="space-y-4">
      <CredentialSelector
        kinds={["onedrive"]}
        value={config.credentialId}
        onChange={(id) => onChange({ credentialId: id })}
        label="OneDrive Credential"
        placeholder="— OAuth access token (Graph, Files.ReadWrite) —"
      />
      <div>
        <Label>Operation</Label>
        <select
          className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm"
          value={op}
          onChange={(e) =>
            onChange({ operation: e.target.value as OneDriveOperation })
          }
        >
          {OPERATIONS.map((o) => (
            <option key={o} value={o}>
              {o}
            </option>
          ))}
        </select>
      </div>
      {needsItem && (
        <div className="grid grid-cols-2 gap-2">
          <div>
            <Label>Item ID (preferred)</Label>
            <TemplateInput
              value={config.itemId ?? ""}
              onChange={(v) => onChange({ itemId: v || undefined })}
              placeholder="01ABCD..."
            />
          </div>
          <div>
            <Label>OR path</Label>
            <TemplateInput
              value={config.path ?? ""}
              onChange={(v) => onChange({ path: v || undefined })}
              placeholder="/Reports/file.txt"
            />
          </div>
        </div>
      )}
      {isList && (
        <div>
          <Label>Parent folder path (optional — empty = drive root)</Label>
          <TemplateInput
            value={config.parentPath ?? ""}
            onChange={(v) => onChange({ parentPath: v || undefined })}
            placeholder="/Reports"
          />
        </div>
      )}
      {isUpload && (
        <>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label>File name</Label>
              <TemplateInput
                value={config.name ?? ""}
                onChange={(v) => onChange({ name: v })}
                placeholder="report.txt"
              />
            </div>
            <div>
              <Label>Content-Type</Label>
              <Input
                value={config.contentType ?? ""}
                onChange={(e) =>
                  onChange({ contentType: e.target.value || undefined })
                }
                placeholder="text/plain"
              />
            </div>
          </div>
          <div>
            <Label>Parent path (optional — empty = drive root)</Label>
            <TemplateInput
              value={config.parentPath ?? ""}
              onChange={(v) => onChange({ parentPath: v || undefined })}
              placeholder="/Reports"
            />
          </div>
          <div>
            <Label>Content</Label>
            <TemplateTextarea
              value={config.content ?? ""}
              onChange={(v) => onChange({ content: v })}
              placeholder="(file body)"
              rows={5}
            />
          </div>
        </>
      )}
      {isShare && (
        <div className="grid grid-cols-2 gap-2">
          <div>
            <Label>Link type</Label>
            <select
              className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm"
              value={config.linkType ?? "view"}
              onChange={(e) =>
                onChange({
                  linkType: e.target.value as OneDriveConfig["linkType"],
                })
              }
            >
              <option value="view">view</option>
              <option value="edit">edit</option>
              <option value="embed">embed</option>
            </select>
          </div>
          <div>
            <Label>Scope</Label>
            <select
              className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm"
              value={config.linkScope ?? "anonymous"}
              onChange={(e) =>
                onChange({
                  linkScope: e.target.value as OneDriveConfig["linkScope"],
                })
              }
            >
              <option value="anonymous">anonymous</option>
              <option value="organization">organization</option>
            </select>
          </div>
        </div>
      )}
    </div>
  );
}
