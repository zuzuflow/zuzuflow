import React from "react";
import type { AiImageConfig, AiImageProvider } from "@workflow/shared";
import { CredentialSelector } from "../CredentialSelector";
import { TemplateInput } from "../TemplateInput";
import { TemplateTextarea } from "../TemplateTextarea";
import { Input } from "../../ui/input";
import { Label } from "../../ui/label";

interface Props {
  config: AiImageConfig;
  onChange: (patch: Partial<AiImageConfig>) => void;
}

const OPENAI_SIZES = ["256x256", "512x512", "1024x1024", "1792x1024", "1024x1792"];
const STABILITY_SIZES = ["512x512", "768x768", "1024x1024"];

export function AiImageForm({ config, onChange }: Props): React.ReactElement {
  const provider = config.provider ?? "openai";
  const isOpenAI = provider === "openai";
  const isStability = provider === "stability";

  return (
    <div className="space-y-4">
      <div>
        <Label>Provider</Label>
        <select
          className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm"
          value={provider}
          onChange={(e) =>
            onChange({ provider: e.target.value as AiImageProvider })
          }
        >
          <option value="openai">OpenAI (DALL·E, gpt-image-1)</option>
          <option value="stability">Stability AI (SDXL)</option>
        </select>
      </div>

      <CredentialSelector
        kinds={isOpenAI ? ["openai"] : ["stability"]}
        value={config.credentialId}
        onChange={(id) => onChange({ credentialId: id })}
        label={isOpenAI ? "OpenAI Credential" : "Stability AI Credential"}
        placeholder="— API key —"
      />

      <div>
        <Label>Model</Label>
        <Input
          value={config.model ?? ""}
          onChange={(e) => onChange({ model: e.target.value })}
          placeholder={
            isOpenAI
              ? "dall-e-3 / dall-e-2 / gpt-image-1"
              : "stable-diffusion-xl-1024-v1-0"
          }
        />
      </div>

      <div>
        <Label>Prompt</Label>
        <TemplateTextarea
          value={config.prompt ?? ""}
          onChange={(v) => onChange({ prompt: v })}
          placeholder="A futuristic city at dawn, photorealistic"
          rows={4}
        />
      </div>

      {isStability && (
        <div>
          <Label>Negative prompt (optional)</Label>
          <TemplateTextarea
            value={config.negativePrompt ?? ""}
            onChange={(v) => onChange({ negativePrompt: v || undefined })}
            placeholder="blurry, text, watermark"
            rows={2}
          />
        </div>
      )}

      <div className="grid grid-cols-3 gap-2">
        <div className="col-span-2">
          <Label>Size</Label>
          <select
            className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm"
            value={config.size ?? (isOpenAI ? "1024x1024" : "1024x1024")}
            onChange={(e) => onChange({ size: e.target.value })}
          >
            {(isOpenAI ? OPENAI_SIZES : STABILITY_SIZES).map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>
        <div>
          <Label>N (count)</Label>
          <Input
            type="number"
            min={1}
            max={10}
            value={config.n ?? 1}
            onChange={(e) =>
              onChange({ n: Number(e.target.value) || undefined })
            }
          />
        </div>
      </div>

      {isOpenAI && (
        <div className="grid grid-cols-2 gap-2">
          <div>
            <Label>Quality (dall-e-3)</Label>
            <select
              className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm"
              value={config.quality ?? "standard"}
              onChange={(e) =>
                onChange({
                  quality: e.target.value as AiImageConfig["quality"],
                })
              }
            >
              <option value="standard">standard</option>
              <option value="hd">hd</option>
            </select>
          </div>
          <div>
            <Label>Style (dall-e-3)</Label>
            <select
              className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm"
              value={config.style ?? "vivid"}
              onChange={(e) =>
                onChange({ style: e.target.value as AiImageConfig["style"] })
              }
            >
              <option value="vivid">vivid</option>
              <option value="natural">natural</option>
            </select>
          </div>
        </div>
      )}

      {isOpenAI && (
        <div>
          <Label>Response format</Label>
          <select
            className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm"
            value={config.responseFormat ?? "url"}
            onChange={(e) =>
              onChange({
                responseFormat: e.target
                  .value as AiImageConfig["responseFormat"],
              })
            }
          >
            <option value="url">url (hosted for 60 minutes)</option>
            <option value="b64_json">b64_json (inline base64)</option>
          </select>
        </div>
      )}

      {isStability && (
        <div className="grid grid-cols-3 gap-2">
          <div>
            <Label>Steps</Label>
            <Input
              type="number"
              min={10}
              max={150}
              value={config.steps ?? 30}
              onChange={(e) =>
                onChange({ steps: Number(e.target.value) || undefined })
              }
            />
          </div>
          <div>
            <Label>CFG scale</Label>
            <Input
              type="number"
              min={0}
              max={30}
              step="0.1"
              value={config.cfgScale ?? 7}
              onChange={(e) =>
                onChange({ cfgScale: Number(e.target.value) || undefined })
              }
            />
          </div>
          <div>
            <Label>Seed (optional)</Label>
            <Input
              type="number"
              value={config.seed ?? ""}
              onChange={(e) =>
                onChange({
                  seed:
                    e.target.value === ""
                      ? undefined
                      : Number(e.target.value),
                })
              }
              placeholder="(random)"
            />
          </div>
        </div>
      )}
    </div>
  );
}
