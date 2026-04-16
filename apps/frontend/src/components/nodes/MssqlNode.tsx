import type { WorkflowNodeProps } from "../../types/nodeProps";
import React from "react";
import type { MssqlConfig } from "@workflow/shared";
import { NodeWrapper } from "../canvas/NodeWrapper";

export function MssqlNode({ id, data, selected }: WorkflowNodeProps): React.ReactElement {
  const cfg = data.config as MssqlConfig;
  const preview = cfg.query?.replace(/\s+/g, " ").trim() ?? "";
  const truncated = preview.length > 50 ? preview.slice(0, 47) + "..." : preview;
  const serverInfo = cfg.server ? `${cfg.server}${cfg.database ? `/${cfg.database}` : ""}` : "";
  return (
    <NodeWrapper nodeId={id} kind={data.kind} label={data.label} selected={selected} style={data.style}>
      {serverInfo && (
        <div className="text-[10px] text-slate-400 truncate">{serverInfo}</div>
      )}
      <div className="font-mono text-[10px] text-slate-300 break-all">
        {truncated || <span className="text-slate-500 italic">no query</span>}
      </div>
    </NodeWrapper>
  );
}
