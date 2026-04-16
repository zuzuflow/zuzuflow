import React from "react";
import type { LlmPromptConfig } from "@workflow/shared";
import { CredentialSelector } from "../CredentialSelector";
import { TemplateInput } from "../TemplateInput";
import { TemplateTextarea } from "../TemplateTextarea";
import { Input } from "../../ui/input";
import { Label } from "../../ui/label";

interface Props {
  config: LlmPromptConfig;
  onChange: (patch: Partial<LlmPromptConfig>) => void;
}

const PROVIDER_MODELS: Record<string, string[]> = {
  openai: ["gpt-4o", "gpt-4o-mini", "gpt-4-turbo", "gpt-3.5-turbo"],
  ollama: ["llama3", "mistral", "gemma2", "phi3", "qwen2"],
  anthropic: ["claude-sonnet-4-20250514", "claude-haiku-4-20250414", "claude-3-5-sonnet-20241022", "claude-3-haiku-20240307"],
  gemini: ["gemini-2.0-flash", "gemini-2.0-flash-lite", "gemini-1.5-pro", "gemini-1.5-flash"],
  huggingface: ["mistralai/Mistral-7B-Instruct-v0.2", "meta-llama/Llama-2-7b-chat-hf", "google/flan-t5-xxl"],
};

const PROVIDER_CRED_KINDS: Record<string, string[]> = {
  openai: ["openai"],
  anthropic: ["anthropic"],
  gemini: ["gemini"],
  huggingface: ["huggingface"],
};

export function LlmPromptForm({ config, onChange }: Props): React.ReactElement {
  const provider = config.provider ?? "openai";
  const isOllama = provider === "ollama";
  const suggestedModels = PROVIDER_MODELS[provider] ?? PROVIDER_MODELS.openai;
  const credKinds = PROVIDER_CRED_KINDS[provider];

  return (
    <div className="space-y-4">
      <div>
        <Label>Provider</Label>
        <select
          className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          value={provider}
          onChange={(e) => onChange({ provider: e.target.value as LlmPromptConfig["provider"], model: "" })}
        >
          <option value="openai">OpenAI (or compatible)</option>
          <option value="anthropic">Anthropic Claude</option>
          <option value="gemini">Google Gemini</option>
          <option value="huggingface">Hugging Face</option>
          <option value="ollama">Ollama (local)</option>
        </select>
      </div>

      <div>
        <Label>Model</Label>
        <Input
          list="llm-models"
          className="font-mono"
          value={config.model ?? ""}
          onChange={(e) => onChange({ model: e.target.value })}
          placeholder={isOllama ? "llama3" : "gpt-4o"}
        />
        <datalist id="llm-models">
          {suggestedModels.map((m) => <option key={m} value={m} />)}
        </datalist>
      </div>

      {credKinds && (
        <CredentialSelector
          kinds={credKinds as any}
          value={config.credentialId}
          onChange={(id) => onChange({ credentialId: id })}
          label="API Key Credential"
          placeholder="— Use environment variable —"
        />
      )}

      {isOllama && (
        <div>
          <Label>Ollama API URL</Label>
          <Input
            value={config.apiUrl ?? ""}
            onChange={(e) => onChange({ apiUrl: e.target.value || undefined })}
            placeholder="http://localhost:11434/api/chat"
          />
        </div>
      )}

      {!isOllama && (
        <div>
          <Label>API URL (optional override)</Label>
          <Input
            value={config.apiUrl ?? ""}
            onChange={(e) => onChange({ apiUrl: e.target.value || undefined })}
            placeholder="https://api.openai.com/v1/chat/completions"
          />
        </div>
      )}

      <div>
        <Label>System Prompt (optional)</Label>
        <TemplateTextarea
          className="flex min-h-[60px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring resize-y"
          value={config.systemPrompt ?? ""}
          onChange={(v) => onChange({ systemPrompt: v || undefined })}
          placeholder="You are a helpful assistant."
        />
      </div>

      <div>
        <Label>User Prompt</Label>
        <TemplateTextarea
          className="flex min-h-[100px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring resize-y"
          value={config.prompt ?? ""}
          onChange={(v) => onChange({ prompt: v })}
          placeholder="Summarize the following text: {{input.text}}"
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label>Max Tokens</Label>
          <Input
            type="number"
            min={1}
            max={32000}
            value={config.maxTokens ?? ""}
            onChange={(e) => onChange({ maxTokens: parseInt(e.target.value, 10) || undefined })}
            placeholder="1024"
          />
        </div>
        <div>
          <Label>Temperature</Label>
          <Input
            type="number"
            min={0}
            max={2}
            step={0.1}
            value={config.temperature ?? ""}
            onChange={(e) => onChange({ temperature: parseFloat(e.target.value) || undefined })}
            placeholder="0.7"
          />
        </div>
      </div>
    </div>
  );
}
