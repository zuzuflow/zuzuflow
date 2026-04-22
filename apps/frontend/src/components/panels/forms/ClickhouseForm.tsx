import React from "react";
import type { ClickhouseConfig, ClickhouseOperation } from "@workflow/shared";
import { CredentialSelector } from "../CredentialSelector";
import { TemplateInput } from "../TemplateInput";
import { TemplateTextarea } from "../TemplateTextarea";
import { Input } from "../../ui/input";
import { Label } from "../../ui/label";

interface Props {
  config: ClickhouseConfig;
  onChange: (patch: Partial<ClickhouseConfig>) => void;
}

const OPERATIONS: ClickhouseOperation[] = ["query", "insert", "command"];

export function ClickhouseForm({
  config,
  onChange,
}: Props): React.ReactElement {
  const op = config.operation ?? "query";
  const isQuery = op === "query";
  const isInsert = op === "insert";
  const isCommand = op === "command";

  return (
    <div className="space-y-4">
      <CredentialSelector
        kinds={["clickhouse"]}
        value={config.credentialId}
        onChange={(id) => onChange({ credentialId: id })}
        label="ClickHouse Credential"
        placeholder="— url + username/password (+ database) —"
      />
      <div>
        <Label>Operation</Label>
        <select
          className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm"
          value={op}
          onChange={(e) =>
            onChange({ operation: e.target.value as ClickhouseOperation })
          }
        >
          {OPERATIONS.map((o) => (
            <option key={o} value={o}>
              {o}
            </option>
          ))}
        </select>
      </div>
      {(isQuery || isCommand) && (
        <>
          <div>
            <Label>SQL</Label>
            <TemplateTextarea
              value={config.query ?? ""}
              onChange={(v) => onChange({ query: v })}
              placeholder={
                isQuery
                  ? "SELECT event, count() FROM events WHERE user_id = {user:String} GROUP BY event"
                  : "ALTER TABLE events DROP PARTITION '202501'"
              }
              rows={5}
            />
          </div>
          <div>
            <Label>Query params JSON (named params)</Label>
            <TemplateTextarea
              value={config.queryParams ?? ""}
              onChange={(v) => onChange({ queryParams: v || undefined })}
              placeholder='{"user": "{{input.id}}"}'
              rows={2}
            />
          </div>
        </>
      )}
      {isQuery && (
        <div className="grid grid-cols-2 gap-2">
          <div>
            <Label>Format</Label>
            <select
              className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm"
              value={config.format ?? "JSONEachRow"}
              onChange={(e) =>
                onChange({ format: e.target.value as ClickhouseConfig["format"] })
              }
            >
              <option value="JSONEachRow">JSONEachRow</option>
              <option value="JSON">JSON</option>
              <option value="JSONCompact">JSONCompact</option>
              <option value="CSV">CSV</option>
              <option value="TabSeparated">TabSeparated</option>
            </select>
          </div>
          <div>
            <Label>Max rows</Label>
            <Input
              type="number"
              min={1}
              max={1000000}
              value={config.maxRows ?? 10000}
              onChange={(e) =>
                onChange({ maxRows: Number(e.target.value) || undefined })
              }
            />
          </div>
        </div>
      )}
      {isInsert && (
        <>
          <div>
            <Label>Table</Label>
            <TemplateInput
              value={config.table ?? ""}
              onChange={(v) => onChange({ table: v })}
              placeholder="events"
            />
          </div>
          <div>
            <Label>Rows JSON array</Label>
            <TemplateTextarea
              value={config.rows ?? ""}
              onChange={(v) => onChange({ rows: v })}
              placeholder='[{"user_id":"u1","event":"click","ts":"2026-04-22T00:00:00Z"}]'
              rows={5}
            />
          </div>
        </>
      )}
    </div>
  );
}
