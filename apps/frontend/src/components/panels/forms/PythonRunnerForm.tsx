import React, { useState } from "react";
import { Plus, Trash2, Maximize2 } from "lucide-react";
import type { PythonRunnerConfig } from "@workflow/shared";
import { TemplateTextarea } from "../TemplateTextarea";
import { Input } from "../../ui/input";
import { Label } from "../../ui/label";
import { CodeEditorModal } from "../../editor/CodeEditorModal";

interface Props {
  config: PythonRunnerConfig;
  onChange: (patch: Partial<PythonRunnerConfig>) => void;
}

export function PythonRunnerForm({ config, onChange }: Props): React.ReactElement {
  const [editorOpen, setEditorOpen] = useState(false);
  const requirements = config.requirements ?? [];

  return (
    <>
      <div className="space-y-4">
        <div>
          <div className="flex items-center justify-between mb-1">
            <Label>Python Code</Label>
            <button
              onClick={() => setEditorOpen(true)}
              className="flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground transition-colors px-1.5 py-0.5 rounded hover:bg-accent"
              title="Open full editor"
            >
              <Maximize2 size={11} />
              Open Editor
            </button>
          </div>
          <TemplateTextarea
            className="flex min-h-[200px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-xs shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring font-mono resize-y"
            value={config.code ?? ""}
            onChange={(v) => onChange({ code: v })}
            placeholder={'import json\n\n# `input` dict has all previous node outputs\ndata = input.get("nodeId", {})\n\nresult = {"message": "hello"}'}
          />
          <p className="text-[10px] text-muted-foreground mt-0.5">
            <code className="text-muted-foreground">input</code> dict = prior node outputs keyed by node ID. Set <code className="text-muted-foreground">result</code> variable to return data.
          </p>
        </div>

        <div>
          <Label>Timeout (ms)</Label>
          <Input
            type="number"
            min={100}
            max={60000}
            step={100}
            value={config.timeoutMs ?? 10000}
            onChange={(e) => onChange({ timeoutMs: e.target.value ? Number(e.target.value) : undefined })}
            placeholder="10000"
          />
        </div>

        <div>
          <Label>Pip Requirements</Label>
          <div className="space-y-1.5">
            {requirements.map((r, idx) => (
              <div key={idx} className="flex items-center gap-1.5">
                <Input
                  className="flex-1 font-mono text-xs"
                  value={r}
                  onChange={(e) => {
                    const updated = requirements.map((x, i) => (i === idx ? e.target.value : x));
                    onChange({ requirements: updated });
                  }}
                  placeholder="requests==2.31.0"
                />
                <button type="button" onClick={() => onChange({ requirements: requirements.filter((_, i) => i !== idx) })} className="text-muted-foreground hover:text-red-400">
                  <Trash2 size={12} />
                </button>
              </div>
            ))}
          </div>
          <button type="button" onClick={() => onChange({ requirements: [...requirements, ""] })} className="flex items-center gap-1 mt-2 text-xs text-indigo-400 hover:text-indigo-300">
            <Plus size={12} /> Add requirement
          </button>
        </div>
      </div>

      <CodeEditorModal
        open={editorOpen}
        onClose={() => setEditorOpen(false)}
        language="python"
        value={config.code ?? ""}
        onChange={(v) => onChange({ code: v })}
        title="python-runner"
      />
    </>
  );
}
