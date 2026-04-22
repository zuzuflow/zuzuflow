import React from "react";
import type {
  ElasticsearchConfig,
  ElasticsearchOperation,
} from "@workflow/shared";
import { CredentialSelector } from "../CredentialSelector";
import { TemplateInput } from "../TemplateInput";
import { TemplateTextarea } from "../TemplateTextarea";
import { Input } from "../../ui/input";
import { Label } from "../../ui/label";

interface Props {
  config: ElasticsearchConfig;
  onChange: (patch: Partial<ElasticsearchConfig>) => void;
}

const OPERATIONS: ElasticsearchOperation[] = [
  "index",
  "get",
  "update",
  "delete",
  "search",
  "bulk",
];

export function ElasticsearchForm({
  config,
  onChange,
}: Props): React.ReactElement {
  const op = config.operation ?? "index";
  const needsDocId =
    op === "get" || op === "update" || op === "delete" || op === "index";
  const needsDocument = op === "index";
  const needsDoc = op === "update";
  const needsSearch = op === "search";
  const needsBulk = op === "bulk";

  return (
    <div className="space-y-4">
      <CredentialSelector
        kinds={["elasticsearch"]}
        value={config.credentialId}
        onChange={(id) => onChange({ credentialId: id })}
        label="Elasticsearch Credential"
        placeholder="— node URL + apiKey or username/password —"
      />
      <div>
        <Label>Operation</Label>
        <select
          className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm"
          value={op}
          onChange={(e) =>
            onChange({ operation: e.target.value as ElasticsearchOperation })
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
        <Label>Index</Label>
        <TemplateInput
          value={config.index ?? ""}
          onChange={(v) => onChange({ index: v })}
          placeholder="logs-2026-04"
        />
      </div>
      {needsDocId && (
        <div>
          <Label>Document ID {op === "index" ? "(optional — auto-generated if blank)" : ""}</Label>
          <TemplateInput
            value={config.documentId ?? ""}
            onChange={(v) => onChange({ documentId: v || undefined })}
            placeholder="{{input.id}}"
          />
        </div>
      )}
      {needsDocument && (
        <div>
          <Label>Document JSON</Label>
          <TemplateTextarea
            value={config.document ?? ""}
            onChange={(v) => onChange({ document: v })}
            placeholder='{"level":"info","msg":"{{input.message}}","ts":"{{now}}"}'
            rows={5}
          />
        </div>
      )}
      {needsDoc && (
        <div>
          <Label>Partial `doc` JSON (for update)</Label>
          <TemplateTextarea
            value={config.doc ?? ""}
            onChange={(v) => onChange({ doc: v || undefined })}
            placeholder='{"status":"resolved"}'
            rows={3}
          />
        </div>
      )}
      {needsSearch && (
        <>
          <div>
            <Label>Search body JSON (query DSL)</Label>
            <TemplateTextarea
              value={config.body ?? ""}
              onChange={(v) => onChange({ body: v || undefined })}
              placeholder='{"query":{"match":{"message":"error"}}}'
              rows={5}
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label>Size</Label>
              <Input
                type="number"
                min={0}
                max={10000}
                value={config.size ?? 10}
                onChange={(e) =>
                  onChange({ size: Number(e.target.value) || undefined })
                }
              />
            </div>
            <div>
              <Label>From (offset)</Label>
              <Input
                type="number"
                min={0}
                value={config.from ?? 0}
                onChange={(e) =>
                  onChange({ from: Number(e.target.value) || undefined })
                }
              />
            </div>
          </div>
        </>
      )}
      {needsBulk && (
        <div>
          <Label>Operations (NDJSON or JSON array)</Label>
          <TemplateTextarea
            value={config.operations ?? ""}
            onChange={(v) => onChange({ operations: v })}
            placeholder={`{"index":{"_id":"1"}}
{"msg":"hello"}
{"index":{"_id":"2"}}
{"msg":"world"}`}
            rows={6}
          />
          <p className="text-[10px] text-muted-foreground mt-0.5">
            Standard ES bulk format: alternating action + doc lines, or a JSON
            array of those objects.
          </p>
        </div>
      )}
      {(op === "index" ||
        op === "update" ||
        op === "delete" ||
        op === "bulk") && (
        <div>
          <Label>Refresh policy</Label>
          <select
            className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm"
            value={config.refresh ?? ""}
            onChange={(e) =>
              onChange({
                refresh:
                  (e.target.value as ElasticsearchConfig["refresh"]) ||
                  undefined,
              })
            }
          >
            <option value="">(none — default)</option>
            <option value="false">false</option>
            <option value="true">true</option>
            <option value="wait_for">wait_for</option>
          </select>
        </div>
      )}
    </div>
  );
}
