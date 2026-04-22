import React from "react";
import type { AiTtsConfig, AiTtsProvider } from "@workflow/shared";
import { CredentialSelector } from "../CredentialSelector";
import { TemplateInput } from "../TemplateInput";
import { TemplateTextarea } from "../TemplateTextarea";
import { Input } from "../../ui/input";
import { Label } from "../../ui/label";

interface Props {
  config: AiTtsConfig;
  onChange: (patch: Partial<AiTtsConfig>) => void;
}

const OPENAI_VOICES = ["alloy", "echo", "fable", "onyx", "nova", "shimmer"];
const OPENAI_FORMATS = ["mp3", "opus", "aac", "flac"];

export function AiTtsForm({ config, onChange }: Props): React.ReactElement {
  const provider = config.provider ?? "openai";
  const isOpenAI = provider === "openai";
  const isEleven = provider === "elevenlabs";

  return (
    <div className="space-y-4">
      <div>
        <Label>Provider</Label>
        <select
          className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm"
          value={provider}
          onChange={(e) =>
            onChange({ provider: e.target.value as AiTtsProvider })
          }
        >
          <option value="openai">OpenAI TTS</option>
          <option value="elevenlabs">ElevenLabs</option>
        </select>
      </div>

      <CredentialSelector
        kinds={isOpenAI ? ["openai"] : ["elevenlabs"]}
        value={config.credentialId}
        onChange={(id) => onChange({ credentialId: id })}
        label={isOpenAI ? "OpenAI Credential" : "ElevenLabs Credential"}
        placeholder="— API key —"
      />

      <div>
        <Label>Model</Label>
        <Input
          value={config.model ?? ""}
          onChange={(e) => onChange({ model: e.target.value || undefined })}
          placeholder={
            isOpenAI ? "tts-1 / tts-1-hd" : "eleven_multilingual_v2 / eleven_turbo_v2_5"
          }
        />
      </div>

      <div>
        <Label>Text</Label>
        <TemplateTextarea
          value={config.text ?? ""}
          onChange={(v) => onChange({ text: v })}
          placeholder="Hello from workflow {{workflowId}}."
          rows={4}
        />
      </div>

      {isOpenAI && (
        <>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label>Voice</Label>
              <select
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm"
                value={config.voice ?? "alloy"}
                onChange={(e) => onChange({ voice: e.target.value })}
              >
                {OPENAI_VOICES.map((v) => (
                  <option key={v} value={v}>
                    {v}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <Label>Format</Label>
              <select
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm"
                value={config.format ?? "mp3"}
                onChange={(e) =>
                  onChange({ format: e.target.value || undefined })
                }
              >
                {OPENAI_FORMATS.map((f) => (
                  <option key={f} value={f}>
                    {f}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div>
            <Label>Speed (0.25 – 4.0)</Label>
            <Input
              type="number"
              min={0.25}
              max={4}
              step="0.05"
              value={config.speed ?? 1}
              onChange={(e) =>
                onChange({ speed: Number(e.target.value) || undefined })
              }
            />
          </div>
        </>
      )}

      {isEleven && (
        <>
          <div>
            <Label>Voice ID</Label>
            <TemplateInput
              value={config.voice ?? ""}
              onChange={(v) => onChange({ voice: v })}
              placeholder="(ElevenLabs voice UUID)"
            />
          </div>
          <div>
            <Label>Output format</Label>
            <Input
              value={config.format ?? ""}
              onChange={(e) =>
                onChange({ format: e.target.value || undefined })
              }
              placeholder="mp3_44100_128"
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label>Stability (0 – 1)</Label>
              <Input
                type="number"
                min={0}
                max={1}
                step="0.05"
                value={config.stability ?? 0.5}
                onChange={(e) =>
                  onChange({
                    stability: Number(e.target.value) || undefined,
                  })
                }
              />
            </div>
            <div>
              <Label>Similarity boost (0 – 1)</Label>
              <Input
                type="number"
                min={0}
                max={1}
                step="0.05"
                value={config.similarityBoost ?? 0.75}
                onChange={(e) =>
                  onChange({
                    similarityBoost: Number(e.target.value) || undefined,
                  })
                }
              />
            </div>
          </div>
        </>
      )}
    </div>
  );
}
