import React from "react";
import { Plus, Trash2 } from "lucide-react";
import type { SwitchConfig, SwitchCase } from "@workflow/shared";
import { TemplateInput } from "../TemplateInput";
import { Input } from "../../ui/input";
import { Label } from "../../ui/label";

interface SwitchFormProps {
  config: SwitchConfig;
  onChange: (patch: Partial<SwitchConfig>) => void;
}

function emptyCase(): SwitchCase {
  return { value: "", label: "" };
}

export function SwitchForm({ config, onChange }: SwitchFormProps): React.ReactElement {
  const updateCase = (idx: number, patch: Partial<SwitchCase>) => {
    const cases = config.cases.map((c, i) => (i === idx ? { ...c, ...patch } : c));
    onChange({ cases });
  };

  const addCase = () => {
    onChange({ cases: [...config.cases, emptyCase()] });
  };

  const removeCase = (idx: number) => {
    onChange({ cases: config.cases.filter((_, i) => i !== idx) });
  };

  return (
    <div className="space-y-4">
      <div>
        <Label>Expression</Label>
        <TemplateInput
          className="font-mono"
          value={config.expression}
          onChange={(v) => onChange({ expression: v })}
          placeholder="{{input.status}}"
        />
        <p className="text-[10px] text-muted-foreground mt-1">
          Use {"{{...}}"} syntax to reference node outputs
        </p>
      </div>

      <div>
        <Label>Cases</Label>
        <div className="space-y-1.5">
          {config.cases.map((c, idx) => (
            <div key={idx} className="flex items-center gap-1.5">
              <Input
                type="text"
                value={String(c.value)}
                onChange={(e) => updateCase(idx, { value: e.target.value })}
                placeholder="value"
              />
              <span className="text-muted-foreground shrink-0">→</span>
              <Input
                type="text"
                value={c.label}
                onChange={(e) => updateCase(idx, { label: e.target.value })}
                placeholder="label"
              />
              <button
                type="button"
                onClick={() => removeCase(idx)}
                className="text-muted-foreground hover:text-red-400 transition-colors shrink-0"
              >
                <Trash2 size={13} />
              </button>
            </div>
          ))}
        </div>

        <button
          type="button"
          onClick={addCase}
          className="flex items-center gap-1.5 mt-2 text-xs text-indigo-400 hover:text-indigo-300 transition-colors"
        >
          <Plus size={13} />
          Add case
        </button>
      </div>

      <div>
        <Label>Default label (optional)</Label>
        <Input
          type="text"
          value={config.defaultLabel ?? ""}
          onChange={(e) => onChange({ defaultLabel: e.target.value || undefined })}
          placeholder="default"
        />
      </div>
    </div>
  );
}
