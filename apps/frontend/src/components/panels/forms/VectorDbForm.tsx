import React from "react";
import type {
  VectorDbConfig,
  VectorDbOperation,
  VectorDbProvider,
} from "@workflow/shared";
import { CredentialSelector } from "../CredentialSelector";
import { TemplateInput } from "../TemplateInput";
import { TemplateTextarea } from "../TemplateTextarea";
import { Input } from "../../ui/input";
import { Label } from "../../ui/label";

interface Props {
  config: VectorDbConfig;
  onChange: (patch: Partial<VectorDbConfig>) => void;
}

const OPERATIONS: VectorDbOperation[] = ["upsert", "query", "delete", "fetch"];

export function VectorDbForm({
  config,
  onChange,
}: Props): React.ReactElement {
  const provider = config.provider ?? "pinecone";
  const op = config.operation ?? "upsert";
  const isPinecone = provider === "pinecone";
  const isUpsert = op === "upsert";
  const isQuery = op === "query";
  const isDelete = op === "delete";
  const isFetch = op === "fetch";
  const needsIds = isDelete || isFetch;

  const credKinds: ("pinecone" | "weaviate" | "qdrant")[] = [provider];

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-2">
        <div>
          <Label>Provider</Label>
          <select
            className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm"
            value={provider}
            onChange={(e) =>
              onChange({ provider: e.target.value as VectorDbProvider })
            }
          >
            <option value="pinecone">Pinecone</option>
            <option value="weaviate">Weaviate</option>
            <option value="qdrant">Qdrant</option>
          </select>
        </div>
        <div>
          <Label>Operation</Label>
          <select
            className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm"
            value={op}
            onChange={(e) =>
              onChange({ operation: e.target.value as VectorDbOperation })
            }
          >
            {OPERATIONS.map((o) => (
              <option key={o} value={o}>
                {o}
              </option>
            ))}
          </select>
        </div>
      </div>

      <CredentialSelector
        kinds={credKinds}
        value={config.credentialId}
        onChange={(id) => onChange({ credentialId: id })}
        label={`${provider} Credential`}
        placeholder={
          isPinecone
            ? "— apiKey + indexHost —"
            : "— url (+ apiKey) —"
        }
      />

      <div>
        <Label>
          {isPinecone ? "Index" : provider === "weaviate" ? "Class" : "Collection"}
        </Label>
        <TemplateInput
          value={config.collection ?? ""}
          onChange={(v) => onChange({ collection: v })}
          placeholder="my-collection"
        />
      </div>

      {isPinecone && (
        <div>
          <Label>Namespace (optional)</Label>
          <TemplateInput
            value={config.namespace ?? ""}
            onChange={(v) => onChange({ namespace: v || undefined })}
            placeholder="tenant-{{input.tenantId}}"
          />
        </div>
      )}

      {isUpsert && (
        <div>
          <Label>Vectors JSON</Label>
          <TemplateTextarea
            value={config.vectors ?? ""}
            onChange={(v) => onChange({ vectors: v })}
            placeholder={'[{"id":"doc1","values":[0.1,0.2,...],"metadata":{"category":"tech"}}]'}
            rows={5}
          />
        </div>
      )}

      {isQuery && (
        <>
          <div>
            <Label>Query vector JSON</Label>
            <TemplateTextarea
              value={config.queryVector ?? ""}
              onChange={(v) => onChange({ queryVector: v })}
              placeholder='[0.1, 0.2, 0.3, ...]'
              rows={3}
            />
          </div>
          <div className="grid grid-cols-3 gap-2">
            <div>
              <Label>Top-k</Label>
              <Input
                type="number"
                min={1}
                max={1000}
                value={config.topK ?? 10}
                onChange={(e) =>
                  onChange({ topK: Number(e.target.value) || undefined })
                }
              />
            </div>
            <div className="flex items-end">
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={config.includeValues ?? false}
                  onChange={(e) =>
                    onChange({ includeValues: e.target.checked })
                  }
                />
                <span className="text-sm">Incl. values</span>
              </label>
            </div>
            <div className="flex items-end">
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={config.includeMetadata ?? true}
                  onChange={(e) =>
                    onChange({ includeMetadata: e.target.checked })
                  }
                />
                <span className="text-sm">Incl. metadata</span>
              </label>
            </div>
          </div>
          <div>
            <Label>Filter JSON (provider-specific, optional)</Label>
            <TemplateTextarea
              value={config.filter ?? ""}
              onChange={(v) => onChange({ filter: v || undefined })}
              placeholder='{"category":{"$eq":"tech"}}'
              rows={3}
            />
          </div>
        </>
      )}

      {needsIds && (
        <div>
          <Label>IDs JSON array</Label>
          <TemplateTextarea
            value={config.ids ?? ""}
            onChange={(v) => onChange({ ids: v })}
            placeholder='["doc1","doc2","doc3"]'
            rows={2}
          />
        </div>
      )}
    </div>
  );
}
