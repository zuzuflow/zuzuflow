import React from "react";
import type { DropboxConfig, DropboxOperation } from "@workflow/shared";
import { CredentialSelector } from "../CredentialSelector";
import { TemplateInput } from "../TemplateInput";
import { TemplateTextarea } from "../TemplateTextarea";
import { Input } from "../../ui/input";
import { Label } from "../../ui/label";

interface Props {
  config: DropboxConfig;
  onChange: (patch: Partial<DropboxConfig>) => void;
}

const OPERATIONS: DropboxOperation[] = [
  "files.upload",
  "files.download",
  "files.listFolder",
  "files.delete",
  "sharing.createSharedLink",
];

export function DropboxForm({ config, onChange }: Props): React.ReactElement {
  const op = config.operation ?? "files.upload";
  const isUpload = op === "files.upload";
  const isDownload = op === "files.download";
  const isList = op === "files.listFolder";
  const isDelete = op === "files.delete";
  const isShare = op === "sharing.createSharedLink";
  const needsPath = isUpload || isDownload || isDelete || isShare;

  return (
    <div className="space-y-4">
      <CredentialSelector
        kinds={["dropbox"]}
        value={config.credentialId}
        onChange={(id) => onChange({ credentialId: id })}
        label="Dropbox Credential"
        placeholder="— Access token —"
      />
      <div>
        <Label>Operation</Label>
        <select
          className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm"
          value={op}
          onChange={(e) =>
            onChange({ operation: e.target.value as DropboxOperation })
          }
        >
          {OPERATIONS.map((o) => (
            <option key={o} value={o}>
              {o}
            </option>
          ))}
        </select>
      </div>
      {needsPath && (
        <div>
          <Label>Path (must start with /)</Label>
          <TemplateInput
            value={config.path ?? ""}
            onChange={(v) => onChange({ path: v })}
            placeholder="/reports/{{input.filename}}"
          />
        </div>
      )}
      {isUpload && (
        <>
          <div>
            <Label>Content</Label>
            <TemplateTextarea
              value={config.content ?? ""}
              onChange={(v) => onChange({ content: v })}
              placeholder="(file body — supports {{...}})"
              rows={5}
            />
          </div>
          <div>
            <Label>Mode</Label>
            <select
              className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm"
              value={config.mode ?? "overwrite"}
              onChange={(e) =>
                onChange({ mode: e.target.value as DropboxConfig["mode"] })
              }
            >
              <option value="add">add (fail if exists)</option>
              <option value="overwrite">overwrite (default)</option>
              <option value="update">update (revision check)</option>
            </select>
          </div>
        </>
      )}
      {isList && (
        <>
          <div>
            <Label>Folder path (empty = root)</Label>
            <TemplateInput
              value={config.folderPath ?? ""}
              onChange={(v) => onChange({ folderPath: v || undefined })}
              placeholder="/reports"
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="flex items-end">
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={config.recursive ?? false}
                  onChange={(e) => onChange({ recursive: e.target.checked })}
                />
                <span className="text-sm">Recursive</span>
              </label>
            </div>
            <div>
              <Label>Limit</Label>
              <Input
                type="number"
                min={1}
                max={2000}
                value={config.limit ?? 100}
                onChange={(e) =>
                  onChange({ limit: Number(e.target.value) || undefined })
                }
              />
            </div>
          </div>
          <div>
            <Label>Cursor (optional — for list_folder/continue)</Label>
            <TemplateInput
              value={config.cursor ?? ""}
              onChange={(v) => onChange({ cursor: v || undefined })}
              placeholder="(from previous page's cursor)"
            />
          </div>
        </>
      )}
      {isShare && (
        <>
          <div>
            <Label>Link visibility</Label>
            <select
              className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm"
              value={config.linkVisibility ?? "public"}
              onChange={(e) =>
                onChange({
                  linkVisibility: e.target
                    .value as DropboxConfig["linkVisibility"],
                })
              }
            >
              <option value="public">public</option>
              <option value="team_only">team only</option>
              <option value="password">password-protected</option>
            </select>
          </div>
          {config.linkVisibility === "password" && (
            <div>
              <Label>Password</Label>
              <Input
                type="password"
                value={config.linkPassword ?? ""}
                onChange={(e) =>
                  onChange({ linkPassword: e.target.value || undefined })
                }
                placeholder="(link password)"
              />
            </div>
          )}
        </>
      )}
    </div>
  );
}
