import React from "react";
import type { HtmlTemplateConfig } from "@workflow/shared";
import { TemplateTextarea } from "../TemplateTextarea";
import { Label } from "../../ui/label";

interface Props {
  config: HtmlTemplateConfig;
  onChange: (patch: Partial<HtmlTemplateConfig>) => void;
}

export function HtmlTemplateForm({ config, onChange }: Props): React.ReactElement {
  return (
    <div className="space-y-4">
      <div>
        <Label>HTML Template</Label>
        <TemplateTextarea
          className="flex min-h-[160px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-xs shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring font-mono resize-y"
          value={config.template ?? ""}
          onChange={(v) => onChange({ template: v })}
          placeholder={"<h1>Hello {{input.name}}</h1>\n<p>Your order #{{input.orderId}} is ready.</p>"}
        />
        <p className="text-[10px] text-muted-foreground mt-0.5">
          Use <code className="text-muted-foreground">{"{{nodeId.field}}"}</code> placeholders. Output: <code className="text-muted-foreground">html</code> field.
        </p>
      </div>
    </div>
  );
}
