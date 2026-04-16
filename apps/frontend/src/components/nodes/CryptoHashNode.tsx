import type { WorkflowNodeProps } from "../../types/nodeProps";
import React from "react";
import type { CryptoHashConfig } from "@workflow/shared";
import { NodeWrapper } from "../canvas/NodeWrapper";

export function CryptoHashNode({ id, data, selected }: WorkflowNodeProps): React.ReactElement {
  const cfg = data.config as CryptoHashConfig;
  return (
    <NodeWrapper nodeId={id} kind={data.kind} label={data.label} selected={selected} style={data.style}>
      <div className="text-[10px] text-slate-300">
        <span className="font-mono uppercase">{cfg.algorithm ?? "sha256"}</span>
        <span className="text-slate-500"> → {cfg.encoding ?? "hex"}</span>
      </div>
    </NodeWrapper>
  );
}
