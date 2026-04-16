import React, { useEffect, useState } from "react";
import type { SubworkflowCallConfig } from "@workflow/shared";
import { TemplateTextarea } from "../TemplateTextarea";
import { listSubworkflows } from "../../../lib/api";
import type { WorkflowListItem } from "../../../lib/api";
import { Label } from "../../ui/label";

interface Props {
  config: SubworkflowCallConfig;
  onChange: (patch: Partial<SubworkflowCallConfig>) => void;
}

export function SubworkflowCallForm({ config, onChange }: Props): React.ReactElement {
  const [subworkflows, setSubworkflows] = useState<WorkflowListItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    listSubworkflows()
      .then((r) => setSubworkflows(r.items.filter((wf) => wf.status === "active")))
      .catch(() => setSubworkflows([]))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="space-y-4">
      <div>
        <Label>Subworkflow</Label>
        {loading ? (
          <div className="text-xs text-muted-foreground py-1">Loading subworkflows…</div>
        ) : (
          <select
            className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            value={config.subworkflowId ?? ""}
            onChange={(e) => onChange({ subworkflowId: e.target.value })}
          >
            <option value="">— Select a subworkflow —</option>
            {subworkflows.map((wf) => (
              <option key={wf.id} value={wf.id}>
                {wf.name}
              </option>
            ))}
          </select>
        )}
        <p className="text-[10px] text-muted-foreground mt-0.5">
          Only active workflows marked as subworkflows appear here.
        </p>
      </div>

      <div>
        <Label>Input Payload (JSON, optional)</Label>
        <TemplateTextarea
          className="flex min-h-[80px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-xs shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring font-mono resize-y"
          value={config.payload ?? ""}
          onChange={(v) => onChange({ payload: v || undefined })}
          placeholder={'{"key": "{{input.value}}"}'}
        />
        <p className="text-[10px] text-muted-foreground mt-0.5">
          JSON object passed to the subworkflow as its trigger payload.
        </p>
      </div>
    </div>
  );
}
