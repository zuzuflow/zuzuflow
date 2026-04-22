import React from "react";
import type { NotionConfig, NotionOperation } from "@workflow/shared";
import { CredentialSelector } from "../CredentialSelector";
import { TemplateInput } from "../TemplateInput";
import { TemplateTextarea } from "../TemplateTextarea";
import { Input } from "../../ui/input";
import { Label } from "../../ui/label";

interface Props {
  config: NotionConfig;
  onChange: (patch: Partial<NotionConfig>) => void;
}

const OPERATIONS: NotionOperation[] = [
  "pages.create",
  "pages.retrieve",
  "pages.update",
  "blocks.append",
  "blocks.children",
  "databases.query",
  "databases.retrieve",
  "search",
];

export function NotionForm({ config, onChange }: Props): React.ReactElement {
  const op = config.operation ?? "pages.create";
  const needsDatabaseId =
    op === "databases.query" ||
    op === "databases.retrieve" ||
    op === "pages.create";
  const needsParent = op === "pages.create";
  const needsPageId = op === "pages.retrieve" || op === "pages.update";
  const needsBlockId = op === "blocks.append" || op === "blocks.children";
  const needsProperties = op === "pages.create" || op === "pages.update";
  const needsChildren = op === "pages.create" || op === "blocks.append";
  const needsFilter = op === "databases.query";
  const needsQuery = op === "search";

  return (
    <div className="space-y-4">
      <CredentialSelector
        kinds={["notion"]}
        value={config.credentialId}
        onChange={(id) => onChange({ credentialId: id })}
        label="Notion Credential"
        placeholder="— Internal integration token (secret_...) —"
      />

      <div>
        <Label>Operation</Label>
        <select
          className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm"
          value={op}
          onChange={(e) =>
            onChange({ operation: e.target.value as NotionOperation })
          }
        >
          {OPERATIONS.map((o) => (
            <option key={o} value={o}>
              {o}
            </option>
          ))}
        </select>
      </div>

      {needsParent && (
        <>
          <div>
            <Label>Parent page ID (when creating under a page)</Label>
            <TemplateInput
              value={config.parentPageId ?? ""}
              onChange={(v) =>
                onChange({ parentPageId: v || undefined })
              }
              placeholder="(alternatively fill database ID below)"
            />
          </div>
        </>
      )}

      {needsDatabaseId && (
        <div>
          <Label>Database ID</Label>
          <TemplateInput
            value={config.databaseId ?? ""}
            onChange={(v) => onChange({ databaseId: v || undefined })}
            placeholder="abc123..."
          />
        </div>
      )}

      {needsPageId && (
        <div>
          <Label>Page ID</Label>
          <TemplateInput
            value={config.pageId ?? ""}
            onChange={(v) => onChange({ pageId: v })}
            placeholder="abc123..."
          />
        </div>
      )}

      {needsBlockId && (
        <div>
          <Label>Block / Page ID</Label>
          <TemplateInput
            value={config.blockId ?? config.pageId ?? ""}
            onChange={(v) => onChange({ blockId: v })}
            placeholder="abc123..."
          />
        </div>
      )}

      {needsProperties && (
        <div>
          <Label>Properties JSON</Label>
          <TemplateTextarea
            value={config.properties ?? ""}
            onChange={(v) => onChange({ properties: v })}
            placeholder='{"Name": {"title": [{"text": {"content": "{{input.title}}"}}]}}'
            rows={5}
          />
        </div>
      )}

      {needsChildren && (
        <div>
          <Label>Children blocks JSON array (optional)</Label>
          <TemplateTextarea
            value={config.children ?? ""}
            onChange={(v) => onChange({ children: v || undefined })}
            placeholder='[{"object":"block","type":"paragraph","paragraph":{"rich_text":[{"type":"text","text":{"content":"Hello"}}]}}]'
            rows={4}
          />
        </div>
      )}

      {needsFilter && (
        <>
          <div>
            <Label>Filter JSON (optional)</Label>
            <TemplateTextarea
              value={config.filter ?? ""}
              onChange={(v) => onChange({ filter: v || undefined })}
              placeholder='{"property":"Status","status":{"equals":"Open"}}'
              rows={3}
            />
          </div>
          <div>
            <Label>Sorts JSON (optional)</Label>
            <TemplateTextarea
              value={config.sorts ?? ""}
              onChange={(v) => onChange({ sorts: v || undefined })}
              placeholder='[{"timestamp":"created_time","direction":"descending"}]'
              rows={2}
            />
          </div>
        </>
      )}

      {needsQuery && (
        <div>
          <Label>Search query</Label>
          <TemplateInput
            value={config.query ?? ""}
            onChange={(v) => onChange({ query: v || undefined })}
            placeholder="Launch plan"
          />
        </div>
      )}

      {op === "pages.update" && (
        <div className="flex items-center gap-2">
          <input
            id="notion-archived"
            type="checkbox"
            checked={config.archived ?? false}
            onChange={(e) => onChange({ archived: e.target.checked })}
          />
          <Label htmlFor="notion-archived" className="cursor-pointer">
            Archive page
          </Label>
        </div>
      )}

      <div className="grid grid-cols-2 gap-2">
        <div>
          <Label>Page size</Label>
          <Input
            type="number"
            min={1}
            max={100}
            value={config.pageSize ?? 100}
            onChange={(e) =>
              onChange({ pageSize: Number(e.target.value) || undefined })
            }
          />
        </div>
        <div>
          <Label>Start cursor (optional)</Label>
          <TemplateInput
            value={config.startCursor ?? ""}
            onChange={(v) => onChange({ startCursor: v || undefined })}
            placeholder="(for pagination)"
          />
        </div>
      </div>
    </div>
  );
}
