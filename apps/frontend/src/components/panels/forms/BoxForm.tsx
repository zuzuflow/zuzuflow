import React from "react";
import type { BoxConfig, BoxOperation } from "@workflow/shared";
import { CredentialSelector } from "../CredentialSelector";
import { TemplateInput } from "../TemplateInput";
import { TemplateTextarea } from "../TemplateTextarea";
import { Input } from "../../ui/input";
import { Label } from "../../ui/label";

interface Props {
  config: BoxConfig;
  onChange: (patch: Partial<BoxConfig>) => void;
}

const OPERATIONS: BoxOperation[] = [
  "files.upload",
  "files.download",
  "files.get",
  "files.delete",
  "folders.list",
  "files.createSharedLink",
];

export function BoxForm({ config, onChange }: Props): React.ReactElement {
  const op = config.operation ?? "files.upload";
  const needsFile =
    op === "files.download" ||
    op === "files.get" ||
    op === "files.delete" ||
    op === "files.createSharedLink";
  const isUpload = op === "files.upload";
  const isList = op === "folders.list";
  const isShare = op === "files.createSharedLink";

  return (
    <div className="space-y-4">
      <CredentialSelector
        kinds={["box"]}
        value={config.credentialId}
        onChange={(id) => onChange({ credentialId: id })}
        label="Box Credential"
        placeholder="— OAuth / JWT developer access token —"
      />
      <div>
        <Label>Operation</Label>
        <select
          className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm"
          value={op}
          onChange={(e) =>
            onChange({ operation: e.target.value as BoxOperation })
          }
        >
          {OPERATIONS.map((o) => (
            <option key={o} value={o}>
              {o}
            </option>
          ))}
        </select>
      </div>
      {needsFile && (
        <div>
          <Label>File ID</Label>
          <TemplateInput
            value={config.fileId ?? ""}
            onChange={(v) => onChange({ fileId: v })}
            placeholder="(numeric Box file ID)"
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
              <Label>Parent folder ID (0 = root)</Label>
              <TemplateInput
                value={config.folderId ?? ""}
                onChange={(v) => onChange({ folderId: v || undefined })}
                placeholder="0"
              />
            </div>
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
      {isList && (
        <>
          <div>
            <Label>Folder ID (0 = root)</Label>
            <TemplateInput
              value={config.folderId ?? ""}
              onChange={(v) => onChange({ folderId: v || undefined })}
              placeholder="0"
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label>Limit</Label>
              <Input
                type="number"
                min={1}
                max={1000}
                value={config.limit ?? 100}
                onChange={(e) =>
                  onChange({ limit: Number(e.target.value) || undefined })
                }
              />
            </div>
            <div>
              <Label>Offset</Label>
              <Input
                type="number"
                min={0}
                value={config.offset ?? 0}
                onChange={(e) =>
                  onChange({ offset: Number(e.target.value) || undefined })
                }
              />
            </div>
          </div>
        </>
      )}
      {isShare && (
        <>
          <div>
            <Label>Access</Label>
            <select
              className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm"
              value={config.linkAccess ?? "open"}
              onChange={(e) =>
                onChange({
                  linkAccess: e.target.value as BoxConfig["linkAccess"],
                })
              }
            >
              <option value="open">open (anyone with link)</option>
              <option value="company">company (domain-restricted)</option>
              <option value="collaborators">collaborators</option>
            </select>
          </div>
          {config.linkAccess === "open" && (
            <div>
              <Label>Link password (optional)</Label>
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
