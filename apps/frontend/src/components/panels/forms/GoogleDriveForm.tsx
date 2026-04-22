import React from "react";
import type { GoogleDriveConfig, GoogleDriveOperation } from "@workflow/shared";
import { CredentialSelector } from "../CredentialSelector";
import { TemplateInput } from "../TemplateInput";
import { TemplateTextarea } from "../TemplateTextarea";
import { Input } from "../../ui/input";
import { Label } from "../../ui/label";

interface Props {
  config: GoogleDriveConfig;
  onChange: (patch: Partial<GoogleDriveConfig>) => void;
}

const OPERATIONS: GoogleDriveOperation[] = [
  "files.list",
  "files.get",
  "files.upload",
  "files.delete",
  "files.share",
];

export function GoogleDriveForm({
  config,
  onChange,
}: Props): React.ReactElement {
  const op = config.operation ?? "files.list";
  const needsFileId =
    op === "files.get" || op === "files.delete" || op === "files.share";
  const isList = op === "files.list";
  const isUpload = op === "files.upload";
  const isShare = op === "files.share";

  return (
    <div className="space-y-4">
      <CredentialSelector
        kinds={["gcp", "google_drive_oauth"]}
        value={config.credentialId}
        onChange={(id) => onChange({ credentialId: id })}
        label="Google Credential"
        placeholder="— Service account JSON (gcp) or OAuth token —"
      />
      <div>
        <Label>Operation</Label>
        <select
          className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm"
          value={op}
          onChange={(e) =>
            onChange({ operation: e.target.value as GoogleDriveOperation })
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
        <Label>Impersonate user (optional, domain-wide delegation)</Label>
        <TemplateInput
          value={config.impersonateUser ?? ""}
          onChange={(v) => onChange({ impersonateUser: v || undefined })}
          placeholder="user@example.com"
        />
      </div>
      {needsFileId && (
        <div>
          <Label>File ID</Label>
          <TemplateInput
            value={config.fileId ?? ""}
            onChange={(v) => onChange({ fileId: v })}
            placeholder="1AbCdEf..."
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
              <Label>MIME type</Label>
              <Input
                value={config.mimeType ?? ""}
                onChange={(e) =>
                  onChange({ mimeType: e.target.value || undefined })
                }
                placeholder="text/plain"
              />
            </div>
          </div>
          <div>
            <Label>Content</Label>
            <TemplateTextarea
              value={config.content ?? ""}
              onChange={(v) => onChange({ content: v })}
              placeholder="(file body — supports {{...}} interpolation)"
              rows={5}
            />
          </div>
          <div>
            <Label>Parents folder IDs (CSV, optional)</Label>
            <TemplateInput
              value={config.parents ?? ""}
              onChange={(v) => onChange({ parents: v || undefined })}
              placeholder="folderId1,folderId2"
            />
          </div>
        </>
      )}
      {isList && (
        <>
          <div>
            <Label>Query (Drive `q` syntax, optional)</Label>
            <TemplateInput
              value={config.query ?? ""}
              onChange={(v) => onChange({ query: v || undefined })}
              placeholder="name contains 'report' and trashed = false"
            />
          </div>
          <div>
            <Label>Page size</Label>
            <Input
              type="number"
              min={1}
              max={1000}
              value={config.pageSize ?? 100}
              onChange={(e) =>
                onChange({ pageSize: Number(e.target.value) || undefined })
              }
            />
          </div>
        </>
      )}
      {isShare && (
        <>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label>Share type</Label>
              <select
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm"
                value={config.shareType ?? "user"}
                onChange={(e) =>
                  onChange({
                    shareType: e.target.value as GoogleDriveConfig["shareType"],
                  })
                }
              >
                <option value="user">user</option>
                <option value="group">group</option>
                <option value="domain">domain</option>
                <option value="anyone">anyone</option>
              </select>
            </div>
            <div>
              <Label>Role</Label>
              <select
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm"
                value={config.shareRole ?? "reader"}
                onChange={(e) =>
                  onChange({
                    shareRole: e.target.value as GoogleDriveConfig["shareRole"],
                  })
                }
              >
                <option value="reader">reader</option>
                <option value="commenter">commenter</option>
                <option value="writer">writer</option>
                <option value="owner">owner</option>
              </select>
            </div>
          </div>
          {(config.shareType === "user" || config.shareType === "group") && (
            <div>
              <Label>Target email / domain</Label>
              <TemplateInput
                value={config.shareEmail ?? ""}
                onChange={(v) => onChange({ shareEmail: v })}
                placeholder="user@example.com"
              />
            </div>
          )}
        </>
      )}
    </div>
  );
}
