import React from "react";
import type { OciObjectStorageConfig } from "@workflow/shared";
import { CredentialSelector } from "../CredentialSelector";
import { TemplateInput } from "../TemplateInput";
import { TemplateTextarea } from "../TemplateTextarea";
import { Input } from "../../ui/input";
import { Label } from "../../ui/label";

interface Props {
  config: OciObjectStorageConfig;
  onChange: (patch: Partial<OciObjectStorageConfig>) => void;
}

const OPERATIONS: OciObjectStorageConfig["operation"][] = [
  "putObject",
  "getObject",
  "listObjects",
  "deleteObject",
];

const SELECT =
  "flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring";

export function OciObjectStorageForm({ config, onChange }: Props): React.ReactElement {
  const op = config.operation ?? "putObject";
  return (
    <div className="space-y-4">
      <CredentialSelector kinds={["oci"]} value={config.credentialId} onChange={(id) => onChange({ credentialId: id })} label="OCI Credential" />
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label>Operation</Label>
          <select className={SELECT} value={op} onChange={(e) => onChange({ operation: e.target.value as OciObjectStorageConfig["operation"] })}>
            {OPERATIONS.map((o) => <option key={o} value={o}>{o}</option>)}
          </select>
        </div>
        <div>
          <Label>Namespace (optional)</Label>
          <Input value={config.namespace ?? ""} onChange={(e) => onChange({ namespace: e.target.value || undefined })} placeholder="leave empty to auto-detect" />
        </div>
      </div>
      <div>
        <Label>Bucket</Label>
        <TemplateInput value={config.bucket ?? ""} onChange={(v) => onChange({ bucket: v })} placeholder="my-bucket" />
      </div>
      {op !== "listObjects" && (
        <div>
          <Label>Object</Label>
          <TemplateInput value={config.object ?? ""} onChange={(v) => onChange({ object: v })} placeholder="path/to/object" />
        </div>
      )}
      {op === "listObjects" && (
        <>
          <div>
            <Label>Prefix</Label>
            <TemplateInput value={config.prefix ?? ""} onChange={(v) => onChange({ prefix: v || undefined })} placeholder="folder/" />
          </div>
          <div>
            <Label>Max results</Label>
            <Input type="number" min={1} max={1000} value={config.maxResults ?? 100} onChange={(e) => onChange({ maxResults: Number(e.target.value) || undefined })} />
          </div>
        </>
      )}
      {op === "putObject" && (
        <>
          <div>
            <Label>Content</Label>
            <TemplateTextarea value={config.content ?? ""} onChange={(v) => onChange({ content: v })} rows={5} placeholder='{"hello":"world"}' />
          </div>
          <div>
            <Label>Content-Type</Label>
            <Input value={config.contentType ?? ""} onChange={(e) => onChange({ contentType: e.target.value || undefined })} placeholder="application/json" />
          </div>
        </>
      )}
    </div>
  );
}
