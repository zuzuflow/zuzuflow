import React from "react";
import type { AwsDynamoDBConfig } from "@workflow/shared";
import { AwsBaseFields } from "./AwsBaseFields";
import { TemplateInput } from "../TemplateInput";
import { TemplateTextarea } from "../TemplateTextarea";
import { Input } from "../../ui/input";
import { Label } from "../../ui/label";

interface Props {
  config: AwsDynamoDBConfig;
  onChange: (patch: Partial<AwsDynamoDBConfig>) => void;
}

const OPERATIONS: AwsDynamoDBConfig["operation"][] = [
  "getItem", "putItem", "updateItem", "deleteItem", "query", "scan",
];

export function AwsDynamoDBForm({ config, onChange }: Props): React.ReactElement {
  const op = config.operation ?? "getItem";

  return (
    <div className="space-y-4">
      <AwsBaseFields config={config} onChange={onChange} />

      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label>Operation</Label>
          <select
            className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            value={op}
            onChange={(e) => onChange({ operation: e.target.value as AwsDynamoDBConfig["operation"] })}
          >
            {OPERATIONS.map((o) => <option key={o} value={o}>{o}</option>)}
          </select>
        </div>
        <div>
          <Label>Table Name</Label>
          <TemplateInput
            value={config.tableName ?? ""}
            onChange={(v) => onChange({ tableName: v })}
            placeholder="my-table"
          />
        </div>
      </div>

      {(op === "getItem" || op === "deleteItem" || op === "updateItem") && (
        <div>
          <Label>Key (JSON — auto-marshalled)</Label>
          <TemplateTextarea
            className="flex min-h-[60px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-xs shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring font-mono resize-y"
            value={config.key ?? ""}
            onChange={(v) => onChange({ key: v || undefined })}
            placeholder='{"id": "{{input.id}}"}'
          />
          <p className="text-[10px] text-muted-foreground mt-0.5">Plain JSON — DynamoDB types are handled automatically</p>
        </div>
      )}

      {op === "putItem" && (
        <div>
          <Label>Item (JSON — auto-marshalled)</Label>
          <TemplateTextarea
            className="flex min-h-[80px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-xs shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring font-mono resize-y"
            value={config.item ?? ""}
            onChange={(v) => onChange({ item: v || undefined })}
            placeholder='{"id": "123", "name": "{{input.name}}"}'
          />
        </div>
      )}

      {op === "updateItem" && (
        <div>
          <Label>Update Expression</Label>
          <TemplateInput
            value={config.updateExpression ?? ""}
            onChange={(v) => onChange({ updateExpression: v || undefined })}
            placeholder="SET #name = :name"
          />
        </div>
      )}

      {(op === "query") && (
        <>
          <div>
            <Label>Key Condition Expression</Label>
            <TemplateInput
              value={config.keyConditionExpression ?? ""}
              onChange={(v) => onChange({ keyConditionExpression: v || undefined })}
              placeholder="pk = :pk AND begins_with(sk, :prefix)"
            />
          </div>
          <div>
            <Label>Index Name (optional)</Label>
            <Input
              value={config.indexName ?? ""}
              onChange={(e) => onChange({ indexName: e.target.value || undefined })}
              placeholder="GSI name"
            />
          </div>
        </>
      )}

      {(op === "query" || op === "scan") && (
        <>
          <div>
            <Label>Filter Expression (optional)</Label>
            <TemplateInput
              value={config.filterExpression ?? ""}
              onChange={(v) => onChange({ filterExpression: v || undefined })}
              placeholder="age > :minAge"
            />
          </div>
          <div>
            <Label>Limit</Label>
            <Input
              type="number"
              value={config.limit ?? ""}
              onChange={(e) => onChange({ limit: e.target.value ? Number(e.target.value) : undefined })}
              placeholder="100"
            />
          </div>
        </>
      )}

      {(op !== "scan" && op !== "putItem") && (
        <>
          <div>
            <Label>Condition Expression (optional)</Label>
            <TemplateInput
              value={config.conditionExpression ?? ""}
              onChange={(v) => onChange({ conditionExpression: v || undefined })}
              placeholder="attribute_exists(id)"
            />
          </div>
        </>
      )}

      {(op === "updateItem" || op === "query" || op === "scan" || op === "putItem" || op === "deleteItem") && (
        <>
          <div>
            <Label>Expression Attribute Names (JSON)</Label>
            <TemplateTextarea
              className="flex min-h-[40px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-xs shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring font-mono resize-y"
              value={config.expressionAttributeNames ?? ""}
              onChange={(v) => onChange({ expressionAttributeNames: v || undefined })}
              placeholder='{"#name": "name"}'
            />
          </div>
          <div>
            <Label>Expression Attribute Values (JSON — auto-marshalled)</Label>
            <TemplateTextarea
              className="flex min-h-[40px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-xs shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring font-mono resize-y"
              value={config.expressionAttributeValues ?? ""}
              onChange={(v) => onChange({ expressionAttributeValues: v || undefined })}
              placeholder='{":name": "{{input.name}}"}'
            />
          </div>
        </>
      )}
    </div>
  );
}
