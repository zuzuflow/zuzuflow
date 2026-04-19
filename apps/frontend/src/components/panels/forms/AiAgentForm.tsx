import React from "react";
import type {
  AiAgentConfig,
  AiAgentToolDef,
  AiAgentToolKind,
  LlmPromptConfig,
} from "@workflow/shared";
import { CredentialSelector } from "../CredentialSelector";
import { TemplateTextarea } from "../TemplateTextarea";
import { Input } from "../../ui/input";
import { Label } from "../../ui/label";
import { Plus, Trash2 } from "lucide-react";

interface Props {
  config: AiAgentConfig;
  onChange: (patch: Partial<AiAgentConfig>) => void;
}

const PROVIDER_MODELS: Record<string, string[]> = {
  openai: ["gpt-4o", "gpt-4o-mini", "gpt-4-turbo", "gpt-3.5-turbo"],
  ollama: ["llama3", "mistral", "gemma2", "phi3", "qwen2"],
  anthropic: [
    "claude-sonnet-4-20250514",
    "claude-haiku-4-20250414",
    "claude-3-5-sonnet-20241022",
    "claude-3-haiku-20240307",
  ],
  gemini: [
    "gemini-2.0-flash",
    "gemini-2.0-flash-lite",
    "gemini-1.5-pro",
    "gemini-1.5-flash",
  ],
  huggingface: [
    "mistralai/Mistral-7B-Instruct-v0.2",
    "meta-llama/Llama-2-7b-chat-hf",
    "google/flan-t5-xxl",
  ],
};

const PROVIDER_CRED_KINDS: Record<string, string[]> = {
  openai: ["openai"],
  anthropic: ["anthropic"],
  gemini: ["gemini"],
  huggingface: ["huggingface"],
};

const TOOL_KINDS: { value: AiAgentToolKind; label: string }[] = [
  { value: "http_request", label: "HTTP Request" },
  { value: "js_code", label: "JavaScript Code" },
  { value: "json_extract", label: "JSON Extract" },
];

const selectClass =
  "flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring";

export function AiAgentForm({ config, onChange }: Props): React.ReactElement {
  const provider = config.provider ?? "openai";
  const isOllama = provider === "ollama";
  const suggestedModels = PROVIDER_MODELS[provider] ?? PROVIDER_MODELS.openai;
  const credKinds = PROVIDER_CRED_KINDS[provider];
  const tools = config.tools ?? [];

  const updateTool = (index: number, patch: Partial<AiAgentToolDef>) => {
    const updated = tools.map((t, i) => (i === index ? { ...t, ...patch } : t));
    onChange({ tools: updated });
  };

  const addTool = () => {
    onChange({
      tools: [
        ...tools,
        { name: "", description: "", kind: "http_request" as AiAgentToolKind },
      ],
    });
  };

  const removeTool = (index: number) => {
    onChange({ tools: tools.filter((_, i) => i !== index) });
  };

  return (
    <div className="space-y-4">
      {/* ── LLM Settings ────────────────────────────────────────────── */}
      <div className="text-xs font-semibold text-slate-400 uppercase tracking-wide">
        LLM Settings
      </div>

      <div>
        <Label>Provider</Label>
        <select
          className={selectClass}
          value={provider}
          onChange={(e) =>
            onChange({
              provider: e.target.value as LlmPromptConfig["provider"],
              model: "",
            })
          }
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
          list="ai-agent-models"
          className="font-mono"
          value={config.model ?? ""}
          onChange={(e) => onChange({ model: e.target.value })}
          placeholder={isOllama ? "llama3" : "gpt-4o"}
        />
        <datalist id="ai-agent-models">
          {suggestedModels.map((m) => (
            <option key={m} value={m} />
          ))}
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
          placeholder="You are a helpful AI assistant with access to tools."
        />
      </div>

      <div>
        <Label>User Prompt</Label>
        <TemplateTextarea
          className="flex min-h-[100px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring resize-y"
          value={config.prompt ?? ""}
          onChange={(v) => onChange({ prompt: v })}
          placeholder="Look up the weather in {{input.city}} and summarize it."
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
            onChange={(e) =>
              onChange({ maxTokens: parseInt(e.target.value, 10) || undefined })
            }
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
            onChange={(e) =>
              onChange({ temperature: parseFloat(e.target.value) || undefined })
            }
            placeholder="0.7"
          />
        </div>
      </div>

      {/* ── Tools ────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between pt-2">
        <div className="text-xs font-semibold text-slate-400 uppercase tracking-wide">
          Tools
        </div>
        <button
          type="button"
          onClick={addTool}
          className="flex items-center gap-1 text-xs text-blue-400 hover:text-blue-300 transition-colors"
        >
          <Plus size={12} /> Add Tool
        </button>
      </div>

      {tools.length === 0 && (
        <div className="text-xs text-slate-500 italic">
          No tools configured. The agent will behave like a simple LLM prompt.
        </div>
      )}

      {tools.map((tool, idx) => (
        <div
          key={idx}
          className="border border-slate-700 rounded-md p-3 space-y-2 relative"
        >
          <button
            type="button"
            onClick={() => removeTool(idx)}
            className="absolute top-2 right-2 text-slate-500 hover:text-red-400 transition-colors"
          >
            <Trash2 size={14} />
          </button>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label className="text-xs">Tool Name</Label>
              <Input
                value={tool.name}
                onChange={(e) => updateTool(idx, { name: e.target.value })}
                placeholder="get_weather"
                className="text-xs"
              />
            </div>
            <div>
              <Label className="text-xs">Type</Label>
              <select
                className={selectClass + " text-xs"}
                value={tool.kind}
                onChange={(e) =>
                  updateTool(idx, { kind: e.target.value as AiAgentToolKind })
                }
              >
                {TOOL_KINDS.map((tk) => (
                  <option key={tk.value} value={tk.value}>
                    {tk.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <Label className="text-xs">Description</Label>
            <Input
              value={tool.description}
              onChange={(e) => updateTool(idx, { description: e.target.value })}
              placeholder="Fetches current weather data for a given city"
              className="text-xs"
            />
          </div>
        </div>
      ))}

      {/* ── Agent Settings ─────────────────────────────────────────── */}
      <div className="text-xs font-semibold text-slate-400 uppercase tracking-wide pt-2">
        Agent Settings
      </div>

      <div>
        <Label>Max Iterations</Label>
        <Input
          type="number"
          min={1}
          max={50}
          value={config.maxIterations ?? 10}
          onChange={(e) =>
            onChange({ maxIterations: parseInt(e.target.value, 10) || 10 })
          }
        />
        <p className="text-[10px] text-slate-500 mt-1">
          Maximum number of tool-calling rounds before stopping.
        </p>
      </div>
    </div>
  );
}
