import type { WorkflowNodeProps } from "../../types/nodeProps";
import React from "react";
import type { GoogleSheetsConfig } from "@workflow/shared";
import { NodeWrapper } from "../canvas/NodeWrapper";

const OP_LABELS: Record<string, string> = {
  read_range: "Read",
  append_rows: "Append",
  update_range: "Update",
  clear_range: "Clear",
};

export function GoogleSheetsNode({ id, data, selected }: WorkflowNodeProps): React.ReactElement {
  const cfg = data.config as GoogleSheetsConfig;
  const opLabel = OP_LABELS[cfg.operation] ?? cfg.operation;
  return (
    <NodeWrapper nodeId={id} kind={data.kind} label={data.label} selected={selected} style={data.style}>
      <div className="flex items-center gap-1.5">
        <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-green-800/60 text-green-300">
          {opLabel}
        </span>
        <span className="text-[10px] text-slate-300 truncate font-mono">
          {cfg.range || "—"}
        </span>
      </div>
    </NodeWrapper>
  );
}
