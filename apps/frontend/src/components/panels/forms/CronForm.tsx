import React from "react";
import type { CronConfig } from "@workflow/shared";
import { Input } from "../../ui/input";
import { Label } from "../../ui/label";

interface CronFormProps {
  config: CronConfig;
  onChange: (patch: Partial<CronConfig>) => void;
}

const COMMON_TIMEZONES = [
  "UTC",
  "America/New_York",
  "America/Chicago",
  "America/Denver",
  "America/Los_Angeles",
  "America/Anchorage",
  "America/Honolulu",
  "America/Toronto",
  "America/Vancouver",
  "America/Sao_Paulo",
  "Europe/London",
  "Europe/Paris",
  "Europe/Berlin",
  "Europe/Moscow",
  "Asia/Dubai",
  "Asia/Kolkata",
  "Asia/Singapore",
  "Asia/Tokyo",
  "Asia/Shanghai",
  "Australia/Sydney",
];

const CRON_PRESETS = [
  { label: "Every minute", value: "* * * * *" },
  { label: "Every hour", value: "0 * * * *" },
  { label: "Every day at midnight", value: "0 0 * * *" },
  { label: "Every Monday at 9am", value: "0 9 * * 1" },
  { label: "Every 15 minutes", value: "*/15 * * * *" },
];

function describeCron(expr: string): string {
  // Simple human-readable fallback description
  const parts = expr.trim().split(/\s+/);
  if (parts.length < 5) return "Invalid expression";
  const [min, hour, dom, month, dow] = parts;
  if (min === "*" && hour === "*") return "Every minute";
  if (min === "0" && hour === "*") return "Every hour at :00";
  if (min === "0" && hour === "0" && dom === "*") return "Daily at midnight";
  if (min.startsWith("*/")) return `Every ${min.slice(2)} minutes`;
  return expr;
}

export function CronForm({ config, onChange }: CronFormProps): React.ReactElement {
  return (
    <div className="space-y-4">
      <div>
        <Label>Cron Expression</Label>
        <Input
          type="text"
          className="font-mono"
          value={config.expression}
          onChange={(e) => onChange({ expression: e.target.value })}
          placeholder="* * * * *"
        />
        <p className="text-[10px] text-muted-foreground mt-1">
          {describeCron(config.expression)}
        </p>
      </div>

      <div>
        <Label>Presets</Label>
        <div className="flex flex-wrap gap-1.5">
          {CRON_PRESETS.map((p) => (
            <button
              key={p.value}
              type="button"
              onClick={() => onChange({ expression: p.value })}
              className="px-2 py-1 text-[10px] rounded bg-muted hover:bg-slate-600 text-foreground transition-colors"
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      <div>
        <Label>Timezone</Label>
        <select
          className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          value={config.timezone}
          onChange={(e) => onChange({ timezone: e.target.value })}
        >
          {COMMON_TIMEZONES.map((tz) => (
            <option key={tz} value={tz}>{tz}</option>
          ))}
        </select>
      </div>
    </div>
  );
}
