import React from "react";
import type { MergeConfig } from "@workflow/shared";
import { Input } from "../../ui/input";
import { Label } from "../../ui/label";

interface MergeFormProps {
  config: MergeConfig;
  onChange: (patch: Partial<MergeConfig>) => void;
}

export function MergeForm({ config, onChange }: MergeFormProps): React.ReactElement {
  return (
    <div className="space-y-4">
      <div>
        <Label>Merge Mode</Label>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => onChange({ mode: "all" })}
            className={`flex-1 py-2 text-xs font-semibold rounded-md border transition-colors ${
              config.mode === "all"
                ? "bg-amber-700 border-amber-500 text-white"
                : "bg-secondary border-border text-muted-foreground hover:border-border"
            }`}
          >
            AND-join
          </button>
          <button
            type="button"
            onClick={() => onChange({ mode: "first" })}
            className={`flex-1 py-2 text-xs font-semibold rounded-md border transition-colors ${
              config.mode === "first"
                ? "bg-amber-700 border-amber-500 text-white"
                : "bg-secondary border-border text-muted-foreground hover:border-border"
            }`}
          >
            OR-join
          </button>
        </div>
        <p className="text-[10px] text-muted-foreground mt-1">
          {config.mode === "all"
            ? "Wait for all branches to complete before continuing"
            : "Continue as soon as the first branch completes"}
        </p>
      </div>

      <div>
        <Label>Branch Count</Label>
        <Input
          type="number"
          min={2}
          max={20}
          value={config.branchCount}
          onChange={(e) => onChange({ branchCount: Number(e.target.value) })}
        />
        <p className="text-[10px] text-muted-foreground mt-1">
          Number of incoming branches expected
        </p>
      </div>
    </div>
  );
}
