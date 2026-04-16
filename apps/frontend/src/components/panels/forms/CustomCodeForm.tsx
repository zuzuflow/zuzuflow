import React from "react";
import type { CustomCodeConfig } from "@workflow/shared";
import { MonacoEditor } from "../MonacoEditor";
import { Input } from "../../ui/input";
import { Label } from "../../ui/label";

interface CustomCodeFormProps {
  config: CustomCodeConfig;
  onChange: (patch: Partial<CustomCodeConfig>) => void;
}

export function CustomCodeForm({ config, onChange }: CustomCodeFormProps): React.ReactElement {
  return (
    <div className="space-y-4">
      <div>
        <div className="flex items-center justify-between mb-1">
          <Label className="mb-0">TypeScript Code</Label>
          <span className="px-1.5 py-0.5 text-[10px] rounded bg-rose-900 text-rose-300 font-bold">
            TypeScript
          </span>
        </div>
        <MonacoEditor
          value={config.code}
          onChange={(code) => onChange({ code })}
          height={300}
          language="typescript"
        />
        <p className="text-[10px] text-muted-foreground mt-1">
          Export or return a value from the{" "}
          <code className="text-rose-400">run(nodeOutputs)</code> function.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label>Timeout (ms)</Label>
          <Input
            type="number"
            min={1000}
            max={300000}
            value={config.timeoutMs ?? 10000}
            onChange={(e) =>
              onChange({ timeoutMs: Number(e.target.value) || undefined })
            }
          />
        </div>
        <div>
          <Label>Memory (MB)</Label>
          <Input
            type="number"
            min={64}
            max={1024}
            value={config.memoryMb ?? 128}
            onChange={(e) =>
              onChange({ memoryMb: Number(e.target.value) || undefined })
            }
          />
        </div>
      </div>
    </div>
  );
}
