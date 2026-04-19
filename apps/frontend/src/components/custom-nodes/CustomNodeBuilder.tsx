import React, { useEffect, useState } from "react";
import { X, Plus, Trash2, Loader2, Sparkles } from "lucide-react";
import type {
  CustomBuilderHandle,
  CustomBuilderInputField,
  CustomBuilderInputType,
  CustomBuilderHttpTemplate,
} from "@workflow/shared";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "../ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "../ui/tabs";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { Button } from "../ui/button";
import { MonacoEditor } from "../panels/MonacoEditor";
import {
  createCustomNodeTemplate,
  updateCustomNodeTemplate,
  generateCustomNodeTemplate,
  type CustomNodeTemplateRecord,
} from "../../lib/api";

const NODE_CATEGORIES = [
  "trigger",
  "logical",
  "utilities",
  "data_storage",
  "communication",
  "ai_agents",
  "code",
  "cloud",
];

const INPUT_TYPES: CustomBuilderInputType[] = [
  "string",
  "number",
  "boolean",
  "select",
  "textarea",
  "json",
  "credential",
];

const STARTER_CODE = `// Inputs declared in the "Inputs" tab are passed in as \`fields\`.
// Upstream node outputs are on \`context\`.
// Return a plain value — or { __handle: "<outputId>", value: ... } to route to
// a specific output handle.
async function run(input) {
  const { fields, context } = input;
  return { message: "Hello from " + JSON.stringify(fields) };
}`;

interface BuilderState {
  name: string;
  description: string;
  icon: string;
  color: string;
  category: string;
  inputs: CustomBuilderHandle[];
  outputs: CustomBuilderHandle[];
  inputsSchema: CustomBuilderInputField[];
  executionMode: "sandbox" | "http";
  code: string;
  httpTemplate: CustomBuilderHttpTemplate;
  credentialType: string;
  isPublic: boolean;
}

const EMPTY_HTTP: CustomBuilderHttpTemplate = {
  method: "GET",
  url: "https://example.com/{{fields.path}}",
  headers: [],
  queryParams: [],
  bodyTemplate: "",
};

function emptyState(): BuilderState {
  return {
    name: "",
    description: "",
    icon: "Puzzle",
    color: "#8b5cf6",
    category: "utilities",
    inputs: [{ id: "in", label: "in" }],
    outputs: [{ id: "out", label: "out" }],
    inputsSchema: [],
    executionMode: "sandbox",
    code: STARTER_CODE,
    httpTemplate: { ...EMPTY_HTTP },
    credentialType: "",
    isPublic: false,
  };
}

function fromTemplate(t: CustomNodeTemplateRecord): BuilderState {
  return {
    name: t.name,
    description: t.description ?? "",
    icon: t.icon,
    color: t.color,
    category: t.category,
    inputs: t.handles.inputs,
    outputs: t.handles.outputs,
    inputsSchema: t.inputsSchema,
    executionMode: t.executionMode,
    code: t.code ?? STARTER_CODE,
    httpTemplate: t.httpTemplate ?? { ...EMPTY_HTTP },
    credentialType: t.credentialType ?? "",
    isPublic: t.isPublic,
  };
}

export interface CustomNodeBuilderProps {
  open: boolean;
  onClose: () => void;
  onSaved: (template: CustomNodeTemplateRecord) => void;
  editing?: CustomNodeTemplateRecord | null;
}

export function CustomNodeBuilder({
  open,
  onClose,
  onSaved,
  editing,
}: CustomNodeBuilderProps): React.ReactElement {
  const [state, setState] = useState<BuilderState>(() =>
    editing ? fromTemplate(editing) : emptyState(),
  );
  const [saving, setSaving] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiPrompt, setAiPrompt] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setState(editing ? fromTemplate(editing) : emptyState());
      setError(null);
    }
  }, [open, editing]);

  function patch(p: Partial<BuilderState>) {
    setState((prev) => ({ ...prev, ...p }));
  }

  async function handleSave() {
    setError(null);
    if (!state.name.trim()) {
      setError("Name is required");
      return;
    }
    if (state.outputs.length === 0) {
      setError("At least one output handle is required");
      return;
    }
    setSaving(true);
    try {
      const payload = {
        name: state.name.trim(),
        description: state.description.trim() || undefined,
        icon: state.icon,
        color: state.color,
        category: state.category,
        handles: {
          inputs: state.inputs,
          outputs: state.outputs,
        },
        inputsSchema: state.inputsSchema,
        executionMode: state.executionMode,
        code: state.executionMode === "sandbox" ? state.code : undefined,
        httpTemplate:
          state.executionMode === "http" ? state.httpTemplate : undefined,
        credentialType: state.credentialType.trim() || undefined,
        isPublic: state.isPublic,
      };
      const saved = editing
        ? await updateCustomNodeTemplate(editing.id, payload)
        : await createCustomNodeTemplate(payload);
      onSaved(saved);
      onClose();
    } catch (err) {
      setError((err as Error).message ?? "Save failed");
    } finally {
      setSaving(false);
    }
  }

  async function handleAiGenerate() {
    if (!aiPrompt.trim()) return;
    setAiLoading(true);
    setError(null);
    try {
      const draft = await generateCustomNodeTemplate(aiPrompt.trim());
      setState({
        name: draft.name,
        description: draft.description ?? "",
        icon: draft.icon ?? "Puzzle",
        color: draft.color ?? "#8b5cf6",
        category: draft.category ?? "utilities",
        inputs: draft.handles.inputs,
        outputs: draft.handles.outputs,
        inputsSchema: draft.inputsSchema,
        executionMode: draft.executionMode,
        code: draft.code ?? STARTER_CODE,
        httpTemplate: draft.httpTemplate ?? { ...EMPTY_HTTP },
        credentialType: draft.credentialType ?? "",
        isPublic: state.isPublic,
      });
      setAiPrompt("");
    } catch (err) {
      setError(`AI Generate failed: ${(err as Error).message}`);
    } finally {
      setAiLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-4xl w-[95vw] h-[85vh] flex flex-col p-0 overflow-hidden">
        <DialogHeader className="px-6 py-4 border-b border-border shrink-0">
          <DialogTitle className="flex items-center gap-2">
            <span
              className="w-6 h-6 rounded flex items-center justify-center text-white"
              style={{ backgroundColor: state.color }}
            >
              <span className="text-[11px]">◆</span>
            </span>
            {editing ? `Edit: ${editing.name}` : "Create Custom Node"}
          </DialogTitle>
        </DialogHeader>

        <Tabs
          defaultValue="basics"
          className="flex-1 flex flex-col overflow-hidden"
        >
          <TabsList className="mx-6 mt-4 shrink-0 w-fit">
            <TabsTrigger value="basics">Basics</TabsTrigger>
            <TabsTrigger value="ports">Ports</TabsTrigger>
            <TabsTrigger value="inputs">Inputs</TabsTrigger>
            <TabsTrigger value="execution">Execution</TabsTrigger>
            <TabsTrigger value="ai">
              <Sparkles size={11} className="mr-1" /> AI Generate
            </TabsTrigger>
          </TabsList>

          <div className="flex-1 overflow-y-auto px-6 pb-4">
            <TabsContent value="basics" className="space-y-4 mt-4">
              <div>
                <Label>Name *</Label>
                <Input
                  value={state.name}
                  onChange={(e) => patch({ name: e.target.value })}
                  placeholder="e.g. Slugify"
                />
              </div>
              <div>
                <Label>Description</Label>
                <Input
                  value={state.description}
                  onChange={(e) => patch({ description: e.target.value })}
                  placeholder="What does this node do?"
                />
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <Label>Icon (Lucide name)</Label>
                  <Input
                    value={state.icon}
                    onChange={(e) => patch({ icon: e.target.value })}
                    placeholder="Puzzle"
                  />
                </div>
                <div>
                  <Label>Color</Label>
                  <Input
                    type="color"
                    value={state.color}
                    onChange={(e) => patch({ color: e.target.value })}
                  />
                </div>
                <div>
                  <Label>Category</Label>
                  <select
                    className="w-full rounded-md border border-slate-700 bg-slate-900 px-2 py-1.5 text-xs text-slate-200"
                    value={state.category}
                    onChange={(e) => patch({ category: e.target.value })}
                  >
                    {NODE_CATEGORIES.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <label className="flex items-center gap-2 text-xs">
                <input
                  type="checkbox"
                  checked={state.isPublic}
                  onChange={(e) => patch({ isPublic: e.target.checked })}
                />
                Share publicly on this instance (other orgs can use it)
              </label>
            </TabsContent>

            <TabsContent value="ports" className="space-y-6 mt-4">
              <HandleTable
                title="Input handles"
                handles={state.inputs}
                onChange={(inputs) => patch({ inputs })}
              />
              <HandleTable
                title="Output handles"
                handles={state.outputs}
                onChange={(outputs) => patch({ outputs })}
              />
              <p className="text-[10px] text-muted-foreground">
                Declare at least one output. When there are multiple outputs,
                return{" "}
                <code className="text-slate-300">
                  {"{ __handle: \"<outputId>\", value: ... }"}
                </code>{" "}
                from your code to route to a specific handle.
              </p>
            </TabsContent>

            <TabsContent value="inputs" className="space-y-3 mt-4">
              <InputsTable
                fields={state.inputsSchema}
                onChange={(inputsSchema) => patch({ inputsSchema })}
              />
            </TabsContent>

            <TabsContent
              value="execution"
              className="flex flex-col h-full mt-4"
            >
              <div className="flex gap-2 mb-3">
                <button
                  onClick={() => patch({ executionMode: "sandbox" })}
                  className={`px-3 py-1.5 text-xs rounded-md border transition-colors ${
                    state.executionMode === "sandbox"
                      ? "bg-indigo-600 border-indigo-500 text-white"
                      : "bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700"
                  }`}
                >
                  Sandbox (TypeScript)
                </button>
                <button
                  onClick={() => patch({ executionMode: "http" })}
                  className={`px-3 py-1.5 text-xs rounded-md border transition-colors ${
                    state.executionMode === "http"
                      ? "bg-indigo-600 border-indigo-500 text-white"
                      : "bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700"
                  }`}
                >
                  HTTP request
                </button>
              </div>

              {state.executionMode === "sandbox" ? (
                <>
                  <p className="text-[10px] text-muted-foreground mb-2">
                    Receives{" "}
                    <code className="text-slate-300">input.fields</code>{" "}
                    (user-filled values) and{" "}
                    <code className="text-slate-300">input.context</code>{" "}
                    (upstream node outputs). For multi-output routing, return{" "}
                    <code className="text-slate-300">
                      {"{ __handle, value }"}
                    </code>
                    .
                  </p>
                  <div className="flex-1 min-h-[320px] border border-border rounded-md overflow-hidden">
                    <MonacoEditor
                      value={state.code}
                      onChange={(code) => patch({ code })}
                      height={360}
                      language="typescript"
                    />
                  </div>
                </>
              ) : (
                <HttpTemplateEditor
                  value={state.httpTemplate}
                  credentialType={state.credentialType}
                  onChange={(httpTemplate) => patch({ httpTemplate })}
                  onCredentialTypeChange={(credentialType) =>
                    patch({ credentialType })
                  }
                />
              )}
            </TabsContent>

            <TabsContent value="ai" className="space-y-3 mt-4">
              <Label>Describe the node you want</Label>
              <p className="text-[10px] text-muted-foreground -mt-2">
                The org's configured LLM (Settings → AI) will draft name, inputs, handles and code. You review before saving.
              </p>
              <textarea
                className="w-full rounded-md border border-slate-700 bg-slate-900 px-2 py-1.5 text-xs text-slate-200 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                rows={4}
                value={aiPrompt}
                onChange={(e) => setAiPrompt(e.target.value)}
                placeholder="e.g. a node that takes an email address and returns the domain part"
              />
              <Button
                onClick={handleAiGenerate}
                disabled={aiLoading || !aiPrompt.trim()}
              >
                {aiLoading ? (
                  <Loader2 size={13} className="animate-spin mr-1.5" />
                ) : (
                  <Sparkles size={13} className="mr-1.5" />
                )}
                Generate draft
              </Button>
              <p className="text-[10px] text-muted-foreground">
                Generated output is validated server-side against the same
                schema as manual saves. Switch tabs to review before clicking
                "Create node" / "Save".
              </p>
            </TabsContent>
          </div>
        </Tabs>

        <div className="border-t border-border px-6 py-3 flex items-center justify-between shrink-0">
          <div className="text-xs text-red-400">{error}</div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" onClick={onClose} disabled={saving}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving && <Loader2 size={13} className="animate-spin mr-1.5" />}
              {editing ? "Save" : "Create node"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── Handle table ─────────────────────────────────────────────────────────────

function HandleTable({
  title,
  handles,
  onChange,
}: {
  title: string;
  handles: CustomBuilderHandle[];
  onChange: (next: CustomBuilderHandle[]) => void;
}): React.ReactElement {
  function update(i: number, patch: Partial<CustomBuilderHandle>) {
    const next = handles.map((h, idx) => (idx === i ? { ...h, ...patch } : h));
    onChange(next);
  }
  function remove(i: number) {
    onChange(handles.filter((_, idx) => idx !== i));
  }
  function add() {
    const used = new Set(handles.map((h) => h.id));
    let n = handles.length;
    let id = `p${n}`;
    while (used.has(id)) {
      n += 1;
      id = `p${n}`;
    }
    onChange([...handles, { id, label: id }]);
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <Label className="mb-0">{title}</Label>
        <Button variant="ghost" size="sm" onClick={add}>
          <Plus size={12} className="mr-1" /> Add
        </Button>
      </div>
      <div className="space-y-1.5">
        {handles.length === 0 && (
          <p className="text-[10px] text-muted-foreground italic">None</p>
        )}
        {handles.map((h, i) => (
          <div key={i} className="grid grid-cols-[1fr_1fr_auto] gap-2">
            <Input
              value={h.id}
              onChange={(e) => update(i, { id: e.target.value })}
              placeholder="id (e.g. valid)"
            />
            <Input
              value={h.label}
              onChange={(e) => update(i, { label: e.target.value })}
              placeholder="label"
            />
            <button
              onClick={() => remove(i)}
              className="px-2 text-slate-500 hover:text-red-400"
              title="Remove"
            >
              <Trash2 size={13} />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Inputs table ─────────────────────────────────────────────────────────────

function InputsTable({
  fields,
  onChange,
}: {
  fields: CustomBuilderInputField[];
  onChange: (next: CustomBuilderInputField[]) => void;
}): React.ReactElement {
  function update(i: number, patch: Partial<CustomBuilderInputField>) {
    onChange(fields.map((f, idx) => (idx === i ? { ...f, ...patch } : f)));
  }
  function remove(i: number) {
    onChange(fields.filter((_, idx) => idx !== i));
  }
  function add() {
    onChange([
      ...fields,
      {
        name: `field_${fields.length + 1}`,
        label: `Field ${fields.length + 1}`,
        type: "string",
      },
    ]);
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <Label className="mb-0">User-facing input fields</Label>
        <Button variant="ghost" size="sm" onClick={add}>
          <Plus size={12} className="mr-1" /> Add field
        </Button>
      </div>
      <div className="space-y-2">
        {fields.length === 0 && (
          <p className="text-[10px] text-muted-foreground italic">
            None — the node will take no user input.
          </p>
        )}
        {fields.map((f, i) => (
          <div
            key={i}
            className="rounded-md border border-slate-700 bg-slate-900/60 p-2 space-y-2"
          >
            <div className="grid grid-cols-[1fr_1fr_140px_auto] gap-2">
              <Input
                value={f.name}
                onChange={(e) => update(i, { name: e.target.value })}
                placeholder="name (used in code)"
              />
              <Input
                value={f.label}
                onChange={(e) => update(i, { label: e.target.value })}
                placeholder="label"
              />
              <select
                className="rounded-md border border-slate-700 bg-slate-900 px-2 text-xs text-slate-200"
                value={f.type}
                onChange={(e) =>
                  update(i, { type: e.target.value as CustomBuilderInputType })
                }
              >
                {INPUT_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
              <button
                onClick={() => remove(i)}
                className="px-2 text-slate-500 hover:text-red-400"
                title="Remove"
              >
                <Trash2 size={13} />
              </button>
            </div>
            <div className="grid grid-cols-[1fr_1fr_auto] gap-2 items-center">
              <Input
                value={f.description ?? ""}
                onChange={(e) => update(i, { description: e.target.value })}
                placeholder="Description (placeholder)"
              />
              <Input
                value={f.default === undefined ? "" : String(f.default)}
                onChange={(e) =>
                  update(i, {
                    default: e.target.value === "" ? undefined : e.target.value,
                  })
                }
                placeholder="Default value"
              />
              <label className="flex items-center gap-1 text-[10px] whitespace-nowrap">
                <input
                  type="checkbox"
                  checked={!!f.required}
                  onChange={(e) => update(i, { required: e.target.checked })}
                />
                required
              </label>
            </div>
            {f.type === "select" && (
              <SelectOptions
                options={f.options ?? []}
                onChange={(options) => update(i, { options })}
              />
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── HTTP template editor ─────────────────────────────────────────────────────

const HTTP_METHODS = ["GET", "POST", "PUT", "PATCH", "DELETE"];

function HttpTemplateEditor({
  value,
  credentialType,
  onChange,
  onCredentialTypeChange,
}: {
  value: CustomBuilderHttpTemplate;
  credentialType: string;
  onChange: (v: CustomBuilderHttpTemplate) => void;
  onCredentialTypeChange: (v: string) => void;
}): React.ReactElement {
  function patchTpl(p: Partial<CustomBuilderHttpTemplate>) {
    onChange({ ...value, ...p });
  }
  function addHeader() {
    patchTpl({ headers: [...(value.headers ?? []), { key: "", value: "" }] });
  }
  function addQuery() {
    patchTpl({
      queryParams: [...(value.queryParams ?? []), { key: "", value: "" }],
    });
  }
  return (
    <div className="space-y-3">
      <p className="text-[10px] text-muted-foreground">
        URL, headers, query params, and body all support{" "}
        <code className="text-slate-300">{"{{fields.foo}}"}</code> (user input)
        and <code className="text-slate-300">{"{{nodeId.field}}"}</code>{" "}
        (upstream outputs).
      </p>
      <div className="grid grid-cols-[120px_1fr] gap-2">
        <select
          className="rounded-md border border-slate-700 bg-slate-900 px-2 text-xs text-slate-200"
          value={value.method}
          onChange={(e) => patchTpl({ method: e.target.value })}
        >
          {HTTP_METHODS.map((m) => (
            <option key={m} value={m}>
              {m}
            </option>
          ))}
        </select>
        <Input
          value={value.url}
          onChange={(e) => patchTpl({ url: e.target.value })}
          placeholder="https://api.example.com/{{fields.path}}"
        />
      </div>

      <div>
        <div className="flex items-center justify-between mb-1">
          <Label className="mb-0">Headers</Label>
          <Button variant="ghost" size="sm" onClick={addHeader}>
            <Plus size={11} className="mr-1" /> Add
          </Button>
        </div>
        {(value.headers ?? []).map((h, i) => (
          <div key={i} className="grid grid-cols-[1fr_1fr_auto] gap-2 mb-1">
            <Input
              value={h.key}
              onChange={(e) => {
                const next = (value.headers ?? []).map((x, idx) =>
                  idx === i ? { ...x, key: e.target.value } : x,
                );
                patchTpl({ headers: next });
              }}
              placeholder="Header-Name"
            />
            <Input
              value={h.value}
              onChange={(e) => {
                const next = (value.headers ?? []).map((x, idx) =>
                  idx === i ? { ...x, value: e.target.value } : x,
                );
                patchTpl({ headers: next });
              }}
              placeholder="Value (supports {{fields.X}})"
            />
            <button
              onClick={() =>
                patchTpl({
                  headers: (value.headers ?? []).filter((_, idx) => idx !== i),
                })
              }
              className="px-2 text-slate-500 hover:text-red-400"
            >
              <X size={12} />
            </button>
          </div>
        ))}
      </div>

      <div>
        <div className="flex items-center justify-between mb-1">
          <Label className="mb-0">Query parameters</Label>
          <Button variant="ghost" size="sm" onClick={addQuery}>
            <Plus size={11} className="mr-1" /> Add
          </Button>
        </div>
        {(value.queryParams ?? []).map((q, i) => (
          <div key={i} className="grid grid-cols-[1fr_1fr_auto] gap-2 mb-1">
            <Input
              value={q.key}
              onChange={(e) => {
                const next = (value.queryParams ?? []).map((x, idx) =>
                  idx === i ? { ...x, key: e.target.value } : x,
                );
                patchTpl({ queryParams: next });
              }}
              placeholder="name"
            />
            <Input
              value={q.value}
              onChange={(e) => {
                const next = (value.queryParams ?? []).map((x, idx) =>
                  idx === i ? { ...x, value: e.target.value } : x,
                );
                patchTpl({ queryParams: next });
              }}
              placeholder="value"
            />
            <button
              onClick={() =>
                patchTpl({
                  queryParams: (value.queryParams ?? []).filter(
                    (_, idx) => idx !== i,
                  ),
                })
              }
              className="px-2 text-slate-500 hover:text-red-400"
            >
              <X size={12} />
            </button>
          </div>
        ))}
      </div>

      <div>
        <Label>Body template (JSON or string)</Label>
        <textarea
          className="w-full rounded-md border border-slate-700 bg-slate-900 px-2 py-1.5 text-xs font-mono text-slate-200 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          rows={5}
          value={value.bodyTemplate ?? ""}
          onChange={(e) => patchTpl({ bodyTemplate: e.target.value })}
          placeholder={'{"message": "{{fields.text}}"}'}
        />
      </div>

      <div>
        <Label>Credential type (optional)</Label>
        <Input
          value={credentialType}
          onChange={(e) => onCredentialTypeChange(e.target.value)}
          placeholder="e.g. api_key, http_basic, bearer_token"
        />
        <p className="text-[10px] text-muted-foreground mt-1">
          When set, placed nodes show a credential selector. Never embed raw
          secrets in headers — bind a credential on the canvas.
        </p>
      </div>
    </div>
  );
}

function SelectOptions({
  options,
  onChange,
}: {
  options: { value: string; label: string }[];
  onChange: (next: { value: string; label: string }[]) => void;
}): React.ReactElement {
  return (
    <div className="pl-3 border-l-2 border-slate-700 space-y-1.5">
      <div className="flex items-center justify-between">
        <span className="text-[10px] text-muted-foreground">Select options</span>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => onChange([...options, { value: "", label: "" }])}
        >
          <Plus size={10} className="mr-1" /> Add option
        </Button>
      </div>
      {options.map((o, i) => (
        <div key={i} className="grid grid-cols-[1fr_1fr_auto] gap-2">
          <Input
            value={o.value}
            onChange={(e) => {
              const next = options.map((x, idx) =>
                idx === i ? { ...x, value: e.target.value } : x,
              );
              onChange(next);
            }}
            placeholder="value"
          />
          <Input
            value={o.label}
            onChange={(e) => {
              const next = options.map((x, idx) =>
                idx === i ? { ...x, label: e.target.value } : x,
              );
              onChange(next);
            }}
            placeholder="label"
          />
          <button
            onClick={() => onChange(options.filter((_, idx) => idx !== i))}
            className="px-2 text-slate-500 hover:text-red-400"
          >
            <X size={12} />
          </button>
        </div>
      ))}
    </div>
  );
}
