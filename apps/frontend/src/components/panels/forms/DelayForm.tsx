import React from "react";
import type { DelayConfig } from "@workflow/shared";
import { Input } from "../../ui/input";
import { Label } from "../../ui/label";

interface DelayFormProps {
  config: DelayConfig;
  onChange: (patch: Partial<DelayConfig>) => void;
}

const UNITS: DelayConfig["unit"][] = ["seconds", "minutes", "hours", "days"];

export function DelayForm({ config, onChange }: DelayFormProps): React.ReactElement {
  return (
    <div className="space-y-4">
      <div>
        <Label>Duration</Label>
        <div className="flex gap-2">
          <Input
            type="number"
            min={1}
            value={config.amount}
            onChange={(e) => onChange({ amount: Number(e.target.value) })}
          />
          <select
            className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            value={config.unit}
            onChange={(e) => onChange({ unit: e.target.value as DelayConfig["unit"] })}
          >
            {UNITS.map((u) => (
              <option key={u} value={u}>{u}</option>
            ))}
          </select>
        </div>
      </div>

      <p className="text-xs text-muted-foreground">
        Pause execution for{" "}
        <span className="text-amber-400 font-medium">
          {config.amount} {config.unit}
        </span>{" "}
        before continuing.
      </p>
    </div>
  );
}
