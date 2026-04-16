import type { WorkflowNodeProps } from "../../types/nodeProps";
import React from "react";
import type { SshTerminalConfig } from "@workflow/shared";
import { NodeWrapper } from "../canvas/NodeWrapper";

export function SshTerminalNode({ id, data, selected }: WorkflowNodeProps): React.ReactElement {
  const cfg = data.config as SshTerminalConfig;
  return (
    <NodeWrapper nodeId={id} kind={data.kind} label={data.label} selected={selected} style={data.style}>
      {cfg.host && (
        <div className="text-[10px] text-slate-400 font-mono">{cfg.username ? `${cfg.username}@` : ""}{cfg.host}</div>
      )}
      <div className="font-mono text-[10px] text-slate-300 truncate">
        {cfg.command?.slice(0, 40) || <span className="text-slate-500 italic">no command</span>}
      </div>
    </NodeWrapper>
  );
}
