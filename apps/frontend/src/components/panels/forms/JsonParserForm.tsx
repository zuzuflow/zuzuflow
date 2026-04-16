import React from "react";
import type { JsonParserConfig } from "@workflow/shared";
import { TemplateInput } from "../TemplateInput";
import { Label } from "../../ui/label";

interface Props {
  config: JsonParserConfig;
  onChange: (patch: Partial<JsonParserConfig>) => void;
}

export function JsonParserForm({ config, onChange }: Props): React.ReactElement {
  return (
    <div className="space-y-4">
      <div>
        <Label>JSON Input</Label>
        <TemplateInput
          className="font-mono"
          value={config.input ?? ""}
          onChange={(v) => onChange({ input: v })}
          placeholder='{{input.rawBody}} or {"key": "value"}'
        />
        <p className="text-[10px] text-muted-foreground mt-0.5">
          A template expression or raw JSON string. The parsed object becomes the node output.
        </p>
      </div>
    </div>
  );
}
