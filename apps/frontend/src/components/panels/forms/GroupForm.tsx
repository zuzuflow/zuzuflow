import React from "react";
import { Lock, Unlock } from "lucide-react";
import type { GroupConfig } from "@workflow/shared";
import { Input } from "../../ui/input";
import { Label } from "../../ui/label";

interface GroupFormProps {
  config: GroupConfig;
  onChange: (patch: Partial<GroupConfig>) => void;
}

export function GroupForm({
  config,
  onChange,
}: GroupFormProps): React.ReactElement {
  return (
    <div className="space-y-4">
      <div>
        <Label>Label</Label>
        <Input
          value={config.label ?? ""}
          onChange={(e) => onChange({ label: e.target.value })}
          placeholder="Group"
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label>Color</Label>
          <Input
            type="color"
            value={config.color ?? "#64748b"}
            onChange={(e) => onChange({ color: e.target.value })}
          />
        </div>
        <div>
          <Label className="mb-1.5">Behaviour</Label>
          <button
            type="button"
            onClick={() => onChange({ locked: !config.locked })}
            className={`w-full flex items-center gap-2 px-2.5 py-1.5 rounded-md border text-xs font-medium transition-colors ${
              config.locked
                ? "bg-amber-900/30 border-amber-700 text-amber-300"
                : "bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700"
            }`}
          >
            {config.locked ? (
              <>
                <Lock size={11} /> Locked
              </>
            ) : (
              <>
                <Unlock size={11} /> Unlocked
              </>
            )}
          </button>
        </div>
      </div>

      <p className="text-[10px] text-muted-foreground leading-relaxed">
        {config.locked
          ? "Children are frozen — they can't be dragged or deleted individually. Drag the group to move everything. Unlock here or ungroup (Cmd/Ctrl+Shift+G) to edit individual nodes."
          : "Children can be dragged and deleted individually. Re-lock to treat the group as a unit again."}
      </p>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label>Width</Label>
          <Input
            type="number"
            min={120}
            max={4000}
            value={config.width}
            onChange={(e) => {
              const v = Number(e.target.value);
              if (!Number.isNaN(v) && v > 0) onChange({ width: v });
            }}
          />
        </div>
        <div>
          <Label>Height</Label>
          <Input
            type="number"
            min={80}
            max={4000}
            value={config.height}
            onChange={(e) => {
              const v = Number(e.target.value);
              if (!Number.isNaN(v) && v > 0) onChange({ height: v });
            }}
          />
        </div>
      </div>
    </div>
  );
}
