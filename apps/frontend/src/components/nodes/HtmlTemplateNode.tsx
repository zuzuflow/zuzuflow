import type { WorkflowNodeProps } from "../../types/nodeProps";
import React from "react";
import type { HtmlTemplateConfig } from "@workflow/shared";
import { NodeWrapper } from "../canvas/NodeWrapper";

export function HtmlTemplateNode({ id, data, selected }: WorkflowNodeProps): React.ReactElement {
  const cfg = data.config as HtmlTemplateConfig;
  const preview = cfg.template?.replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim().slice(0, 40) ?? "";
  return (
    <NodeWrapper nodeId={id} kind={data.kind} label={data.label} selected={selected} style={data.style}>
      <div className="text-[10px] text-slate-400 truncate">
        {preview || <span className="text-slate-500 italic">no template</span>}
      </div>
    </NodeWrapper>
  );
}
