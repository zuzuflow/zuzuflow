import React from "react";
import type { GcpBigQueryConfig } from "@workflow/shared";
import { CredentialSelector } from "../CredentialSelector";
import { TemplateInput } from "../TemplateInput";
import { TemplateTextarea } from "../TemplateTextarea";
import { Input } from "../../ui/input";
import { Label } from "../../ui/label";

interface Props {
  config: GcpBigQueryConfig;
  onChange: (patch: Partial<GcpBigQueryConfig>) => void;
}

const OPERATIONS: GcpBigQueryConfig["operation"][] = ["query", "insertRows"];

const SELECT =
  "flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring";

export function GcpBigQueryForm({ config, onChange }: Props): React.ReactElement {
  const op = config.operation ?? "query";
  return (
    <div className="space-y-4">
      <CredentialSelector kinds={["gcp"]} value={config.credentialId} onChange={(id) => onChange({ credentialId: id })} label="GCP Credential" />
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label>Operation</Label>
          <select className={SELECT} value={op} onChange={(e) => onChange({ operation: e.target.value as GcpBigQueryConfig["operation"] })}>
            {OPERATIONS.map((o) => <option key={o} value={o}>{o}</option>)}
          </select>
        </div>
        <div>
          <Label>Project (override)</Label>
          <Input value={config.projectId ?? ""} onChange={(e) => onChange({ projectId: e.target.value || undefined })} placeholder="my-project" />
        </div>
      </div>
      {op === "query" && (
        <>
          <div>
            <Label>SQL</Label>
            <TemplateTextarea value={config.query ?? ""} onChange={(v) => onChange({ query: v })} rows={6} placeholder="SELECT * FROM `project.dataset.table` WHERE created_at > @since" />
          </div>
          <div>
            <Label>Named parameters (JSON)</Label>
            <TemplateTextarea value={config.queryParameters ?? ""} onChange={(v) => onChange({ queryParameters: v || undefined })} rows={3} placeholder='{"since":"2024-01-01"}' />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Max results</Label>
              <Input type="number" min={1} max={100000} value={config.maxResults ?? 100} onChange={(e) => onChange({ maxResults: Number(e.target.value) || undefined })} />
            </div>
            <label className="flex items-center gap-2 mt-6 text-xs text-muted-foreground">
              <input type="checkbox" checked={!!config.useLegacySql} onChange={(e) => onChange({ useLegacySql: e.target.checked })} className="h-3.5 w-3.5 rounded accent-indigo-500" />
              Legacy SQL
            </label>
          </div>
        </>
      )}
      {op === "insertRows" && (
        <>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Dataset</Label>
              <Input value={config.datasetId ?? ""} onChange={(e) => onChange({ datasetId: e.target.value })} placeholder="events" />
            </div>
            <div>
              <Label>Table</Label>
              <Input value={config.tableId ?? ""} onChange={(e) => onChange({ tableId: e.target.value })} placeholder="signups" />
            </div>
          </div>
          <div>
            <Label>Rows (JSON array)</Label>
            <TemplateTextarea value={config.rows ?? ""} onChange={(v) => onChange({ rows: v })} rows={6} placeholder='[{"userId":"{{input.body.id}}","ts":"{{input.body.at}}"}]' />
          </div>
        </>
      )}
    </div>
  );
}
