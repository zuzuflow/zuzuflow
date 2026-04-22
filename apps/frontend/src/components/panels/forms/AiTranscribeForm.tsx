import React from "react";
import type {
  AiTranscribeConfig,
  AiTranscribeProvider,
} from "@workflow/shared";
import { CredentialSelector } from "../CredentialSelector";
import { TemplateInput } from "../TemplateInput";
import { TemplateTextarea } from "../TemplateTextarea";
import { Input } from "../../ui/input";
import { Label } from "../../ui/label";

interface Props {
  config: AiTranscribeConfig;
  onChange: (patch: Partial<AiTranscribeConfig>) => void;
}

export function AiTranscribeForm({
  config,
  onChange,
}: Props): React.ReactElement {
  const provider = config.provider ?? "openai";
  const isOpenAI = provider === "openai";
  const isAssembly = provider === "assemblyai";

  return (
    <div className="space-y-4">
      <div>
        <Label>Provider</Label>
        <select
          className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm"
          value={provider}
          onChange={(e) =>
            onChange({ provider: e.target.value as AiTranscribeProvider })
          }
        >
          <option value="openai">OpenAI (Whisper)</option>
          <option value="assemblyai">AssemblyAI</option>
        </select>
      </div>

      <CredentialSelector
        kinds={isOpenAI ? ["openai"] : ["assemblyai"]}
        value={config.credentialId}
        onChange={(id) => onChange({ credentialId: id })}
        label={isOpenAI ? "OpenAI Credential" : "AssemblyAI Credential"}
        placeholder="— API key —"
      />

      <div>
        <Label>Model</Label>
        <Input
          value={config.model ?? ""}
          onChange={(e) => onChange({ model: e.target.value || undefined })}
          placeholder={isOpenAI ? "whisper-1" : "best / nano"}
        />
      </div>

      <div>
        <Label>Audio URL</Label>
        <TemplateInput
          value={config.audioUrl ?? ""}
          onChange={(v) => onChange({ audioUrl: v || undefined })}
          placeholder="https://example.com/recording.mp3"
        />
      </div>

      {isOpenAI && (
        <>
          <div>
            <Label>OR Audio base64 (alternative — OpenAI only)</Label>
            <TemplateTextarea
              value={config.audioBase64 ?? ""}
              onChange={(v) => onChange({ audioBase64: v || undefined })}
              placeholder="{{upstreamNode.result.audioBase64}}"
              rows={2}
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label>Audio MIME type</Label>
              <Input
                value={config.audioMimeType ?? ""}
                onChange={(e) =>
                  onChange({ audioMimeType: e.target.value || undefined })
                }
                placeholder="audio/mpeg"
              />
            </div>
            <div>
              <Label>Audio filename</Label>
              <Input
                value={config.audioFilename ?? ""}
                onChange={(e) =>
                  onChange({ audioFilename: e.target.value || undefined })
                }
                placeholder="audio.mp3"
              />
            </div>
          </div>
        </>
      )}

      <div>
        <Label>Language (optional)</Label>
        <TemplateInput
          value={config.language ?? ""}
          onChange={(v) => onChange({ language: v || undefined })}
          placeholder="en / es / fr"
        />
      </div>

      {isOpenAI && (
        <>
          <div>
            <Label>Response format</Label>
            <select
              className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm"
              value={config.responseFormat ?? "json"}
              onChange={(e) =>
                onChange({
                  responseFormat: e.target
                    .value as AiTranscribeConfig["responseFormat"],
                })
              }
            >
              <option value="json">json</option>
              <option value="text">text</option>
              <option value="srt">srt</option>
              <option value="verbose_json">verbose_json (+timestamps)</option>
              <option value="vtt">vtt</option>
            </select>
          </div>
          <div>
            <Label>Prompt / context (optional)</Label>
            <TemplateTextarea
              value={config.prompt ?? ""}
              onChange={(v) => onChange({ prompt: v || undefined })}
              placeholder="Technical vocabulary: Kubernetes, Temporal, ..."
              rows={2}
            />
          </div>
        </>
      )}

      {isAssembly && (
        <div className="flex items-center gap-2">
          <input
            id="aa-speaker"
            type="checkbox"
            checked={config.speakerLabels ?? false}
            onChange={(e) => onChange({ speakerLabels: e.target.checked })}
          />
          <Label htmlFor="aa-speaker" className="cursor-pointer">
            Enable speaker labels (diarization)
          </Label>
        </div>
      )}
    </div>
  );
}
