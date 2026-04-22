import React from "react";
import type { AiEmbedConfig, AiEmbedProvider } from "@workflow/shared";
import { CredentialSelector } from "../CredentialSelector";
import { TemplateTextarea } from "../TemplateTextarea";
import { Input } from "../../ui/input";
import { Label } from "../../ui/label";

interface Props {
  config: AiEmbedConfig;
  onChange: (patch: Partial<AiEmbedConfig>) => void;
}

export function AiEmbedForm({ config, onChange }: Props): React.ReactElement {
  const provider = config.provider ?? "openai";
  const isOpenAI = provider === "openai";
  const isCohere = provider === "cohere";
  const isHf = provider === "huggingface";

  const credKinds = isOpenAI
    ? (["openai"] as const)
    : isCohere
      ? (["cohere"] as const)
      : (["huggingface"] as const);

  return (
    <div className="space-y-4">
      <div>
        <Label>Provider</Label>
        <select
          className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm"
          value={provider}
          onChange={(e) =>
            onChange({ provider: e.target.value as AiEmbedProvider })
          }
        >
          <option value="openai">OpenAI</option>
          <option value="cohere">Cohere</option>
          <option value="huggingface">Hugging Face</option>
        </select>
      </div>

      <CredentialSelector
        kinds={[...credKinds]}
        value={config.credentialId}
        onChange={(id) => onChange({ credentialId: id })}
        label={`${provider} Credential`}
        placeholder="— API key / token —"
      />

      <div>
        <Label>Model</Label>
        <Input
          value={config.model ?? ""}
          onChange={(e) => onChange({ model: e.target.value })}
          placeholder={
            isOpenAI
              ? "text-embedding-3-small / text-embedding-3-large"
              : isCohere
                ? "embed-english-v3.0 / embed-multilingual-v3.0"
                : "sentence-transformers/all-MiniLM-L6-v2"
          }
        />
      </div>

      <div>
        <Label>Input (JSON array of strings, or a single string)</Label>
        <TemplateTextarea
          value={config.input ?? ""}
          onChange={(v) => onChange({ input: v })}
          placeholder={'["Hello world", "Another doc"]\n\n  or just "Some text"'}
          rows={5}
        />
      </div>

      {isCohere && (
        <div>
          <Label>Input type</Label>
          <select
            className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm"
            value={config.inputType ?? "search_document"}
            onChange={(e) =>
              onChange({
                inputType: e.target.value as AiEmbedConfig["inputType"],
              })
            }
          >
            <option value="search_document">search_document</option>
            <option value="search_query">search_query</option>
            <option value="classification">classification</option>
            <option value="clustering">clustering</option>
          </select>
        </div>
      )}

      {isOpenAI && (
        <div className="grid grid-cols-2 gap-2">
          <div>
            <Label>Dimensions (optional, for text-embedding-3)</Label>
            <Input
              type="number"
              min={1}
              value={config.dimensions ?? ""}
              onChange={(e) =>
                onChange({
                  dimensions:
                    e.target.value === ""
                      ? undefined
                      : Number(e.target.value),
                })
              }
              placeholder="(default)"
            />
          </div>
          <div>
            <Label>Encoding format</Label>
            <select
              className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm"
              value={config.encodingFormat ?? "float"}
              onChange={(e) =>
                onChange({
                  encodingFormat: e.target
                    .value as AiEmbedConfig["encodingFormat"],
                })
              }
            >
              <option value="float">float</option>
              <option value="base64">base64</option>
            </select>
          </div>
        </div>
      )}

      {isHf && (
        <p className="text-[10px] text-muted-foreground">
          Uses the Hugging Face Inference API (feature-extraction). Dedicated
          Inference Endpoints work too — set the model ID to the endpoint URL
          path after `/pipeline/feature-extraction/`.
        </p>
      )}
    </div>
  );
}
