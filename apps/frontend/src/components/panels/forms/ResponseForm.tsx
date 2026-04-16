import React from "react";
import { Plus, Trash2 } from "lucide-react";
import type { ResponseConfig } from "@workflow/shared";
import { TemplateInput } from "../TemplateInput";
import { TemplateTextarea } from "../TemplateTextarea";
import { Input } from "../../ui/input";
import { Label } from "../../ui/label";

interface Props {
  config: ResponseConfig;
  onChange: (patch: Partial<ResponseConfig>) => void;
}

export function ResponseForm({ config, onChange }: Props): React.ReactElement {
  const headers = config.headers ?? [];

  return (
    <div className="space-y-4">
      <div>
        <Label>Status Code</Label>
        <Input
          type="number"
          value={config.statusCode ?? 200}
          onChange={(e) => onChange({ statusCode: e.target.value ? Number(e.target.value) : 200 })}
          placeholder="200"
        />
      </div>

      <div>
        <Label>Content Type</Label>
        <Input
          value={config.contentType ?? "application/json"}
          onChange={(e) => onChange({ contentType: e.target.value || undefined })}
          placeholder="application/json"
        />
      </div>

      <div>
        <Label>Headers</Label>
        <div className="space-y-1.5">
          {headers.map((h, idx) => (
            <div key={idx} className="flex items-center gap-1.5">
              <TemplateInput
                wrapperClassName="relative flex-1"
                value={h.key}
                onChange={(v) => {
                  const updated = headers.map((x, i) => (i === idx ? { ...x, key: v } : x));
                  onChange({ headers: updated });
                }}
                placeholder="Header name"
              />
              <TemplateInput
                wrapperClassName="relative flex-1"
                value={h.value}
                onChange={(v) => {
                  const updated = headers.map((x, i) => (i === idx ? { ...x, value: v } : x));
                  onChange({ headers: updated });
                }}
                placeholder="Header value"
              />
              <button type="button" onClick={() => onChange({ headers: headers.filter((_, i) => i !== idx) })} className="text-muted-foreground hover:text-red-400">
                <Trash2 size={12} />
              </button>
            </div>
          ))}
        </div>
        <button type="button" onClick={() => onChange({ headers: [...headers, { key: "", value: "" }] })} className="flex items-center gap-1 mt-2 text-xs text-indigo-400 hover:text-indigo-300">
          <Plus size={12} /> Add header
        </button>
      </div>

      <div>
        <Label>Body</Label>
        <TemplateTextarea
          className="flex min-h-[100px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-xs shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring font-mono resize-y"
          value={config.body ?? ""}
          onChange={(v) => onChange({ body: v || undefined })}
          placeholder='{"success": true, "data": {{steps.process.output}}}'
        />
      </div>
    </div>
  );
}
