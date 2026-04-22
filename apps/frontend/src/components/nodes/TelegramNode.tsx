import type { WorkflowNodeProps } from "../../types/nodeProps";
import React from "react";
import type { TelegramConfig } from "@workflow/shared";
import { NodeWrapper } from "../canvas/NodeWrapper";

export function TelegramNode({
  id,
  data,
  selected,
}: WorkflowNodeProps): React.ReactElement {
  const cfg = data.config as TelegramConfig;
  return (
    <NodeWrapper
      nodeId={id}
      kind={data.kind}
      label={data.label}
      selected={selected}
      style={data.style}
    >
      <div className="text-[10px] text-slate-300">
        <span className="font-semibold">{cfg.operation ?? "sendMessage"}</span>
        {cfg.chatId && (
          <span className="text-slate-500"> · {cfg.chatId}</span>
        )}
      </div>
    </NodeWrapper>
  );
}
