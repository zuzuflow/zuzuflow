import type { WorkflowNodeProps } from "../../types/nodeProps";
import React from "react";
import type { MqttConfig } from "@workflow/shared";
import { NodeWrapper } from "../canvas/NodeWrapper";

function getBrokerHost(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    return url;
  }
}

export function MqttTriggerNode({ id, data, selected }: WorkflowNodeProps): React.ReactElement {
  const cfg = data.config as MqttConfig;

  return (
    <NodeWrapper nodeId={id} kind={data.kind} label={data.label} selected={selected} style={data.style}>
      <div className="text-slate-300 truncate">
        <span className="text-slate-500">topic: </span>{cfg.topic}
      </div>
      <div className="text-slate-500 text-[10px] truncate">{getBrokerHost(cfg.brokerUrl)}</div>
    </NodeWrapper>
  );
}
