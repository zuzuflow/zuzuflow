import type { WorkflowNodeProps } from "../../types/nodeProps";
import React from "react";
import type { RabbitMQConfig } from "@workflow/shared";
import { NodeWrapper } from "../canvas/NodeWrapper";

const OP_LABEL: Record<string, string> = {
  consume: "Consume",
  publish_queue: "→ Queue",
  publish_exchange: "→ Exchange",
};

export function RabbitMQNode({ id, data, selected }: WorkflowNodeProps): React.ReactElement {
  const cfg = data.config as RabbitMQConfig;
  const opLabel = OP_LABEL[cfg.operation] ?? cfg.operation;

  const destination =
    cfg.operation === "publish_exchange"
      ? cfg.exchangeName
      : cfg.queueName;

  return (
    <NodeWrapper nodeId={id} kind={data.kind} label={data.label} selected={selected} style={data.style}>
      <div className="text-slate-300 truncate">
        <span className="text-slate-500">op: </span>{opLabel}
      </div>
      {destination && (
        <div className="text-slate-500 text-[10px] truncate">{destination}</div>
      )}
    </NodeWrapper>
  );
}
