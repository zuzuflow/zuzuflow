import React from "react";
import type { DateFormatterConfig } from "@workflow/shared";
import { TemplateInput } from "../TemplateInput";
import { Input } from "../../ui/input";
import { Label } from "../../ui/label";

interface Props {
  config: DateFormatterConfig;
  onChange: (patch: Partial<DateFormatterConfig>) => void;
}

export function DateFormatterForm({ config, onChange }: Props): React.ReactElement {
  return (
    <div className="space-y-4">
      <div>
        <Label>Input Date</Label>
        <TemplateInput
          value={config.input ?? ""}
          onChange={(v) => onChange({ input: v })}
          placeholder="{{input.timestamp}} or now"
        />
        <p className="text-[10px] text-muted-foreground mt-0.5">
          ISO string, Unix timestamp, or <code className="text-muted-foreground">now</code> for current time.
        </p>
      </div>

      <div>
        <Label>Output Format (Day.js)</Label>
        <Input
          className="font-mono"
          value={config.outputFormat ?? ""}
          onChange={(e) => onChange({ outputFormat: e.target.value })}
          placeholder="YYYY-MM-DD HH:mm:ss"
        />
        <p className="text-[10px] text-muted-foreground mt-0.5">
          e.g. <code className="text-muted-foreground">YYYY-MM-DD</code>, <code className="text-muted-foreground">dddd, MMM D YYYY</code>
        </p>
      </div>

      <div>
        <Label>Timezone (optional)</Label>
        <Input
          value={config.timezone ?? ""}
          onChange={(e) => onChange({ timezone: e.target.value || undefined })}
          placeholder="UTC (default)"
        />
        <p className="text-[10px] text-muted-foreground mt-0.5">
          e.g. <code className="text-muted-foreground">America/New_York</code>, <code className="text-muted-foreground">Asia/Kolkata</code>
        </p>
      </div>
    </div>
  );
}
