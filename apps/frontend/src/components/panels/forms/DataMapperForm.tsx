import React from "react";
import { Plus, Trash2 } from "lucide-react";
import type { DataMapperConfig } from "@workflow/shared";
import { TemplateInput } from "../TemplateInput";
import { Input } from "../../ui/input";
import { Label } from "../../ui/label";

interface Props {
  config: DataMapperConfig;
  onChange: (patch: Partial<DataMapperConfig>) => void;
}

export function DataMapperForm({ config, onChange }: Props): React.ReactElement {
  const mappings = config.mappings ?? [];

  const update = (idx: number, field: "from" | "to", value: string) => {
    const updated = mappings.map((m, i) => (i === idx ? { ...m, [field]: value } : m));
    onChange({ mappings: updated });
  };

  const add = () => onChange({ mappings: [...mappings, { from: "", to: "" }] });
  const remove = (idx: number) => onChange({ mappings: mappings.filter((_, i) => i !== idx) });

  return (
    <div className="space-y-3">
      <Label>Field Mappings</Label>
      <p className="text-[10px] text-muted-foreground -mt-1">
        Map values from upstream nodes to new field names. Use <code className="text-muted-foreground">{"{{nodeId.field}}"}</code> in the From column.
      </p>

      <div className="space-y-2">
        {mappings.length > 0 && (
          <div className="grid grid-cols-[1fr_auto_1fr_auto] gap-1 text-[10px] text-muted-foreground px-1">
            <span>From (expression)</span>
            <span />
            <span>To (field name)</span>
            <span />
          </div>
        )}
        {mappings.map((m, idx) => (
          <div key={idx} className="grid grid-cols-[1fr_auto_1fr_auto] gap-1 items-center">
            <TemplateInput
              wrapperClassName="relative"
              value={m.from}
              onChange={(v) => update(idx, "from", v)}
              placeholder="{{input.name}}"
            />
            <span className="text-muted-foreground text-xs px-1">→</span>
            <Input
              value={m.to}
              onChange={(e) => update(idx, "to", e.target.value)}
              placeholder="fieldName"
            />
            <button type="button" onClick={() => remove(idx)} className="text-muted-foreground hover:text-red-400 ml-1">
              <Trash2 size={12} />
            </button>
          </div>
        ))}
      </div>

      <button
        type="button"
        onClick={add}
        className="flex items-center gap-1 text-xs text-indigo-400 hover:text-indigo-300"
      >
        <Plus size={12} /> Add mapping
      </button>
    </div>
  );
}
