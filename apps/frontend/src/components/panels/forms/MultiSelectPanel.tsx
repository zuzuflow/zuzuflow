import React from "react";
import { Group as GroupIcon, Trash2 } from "lucide-react";
import type { WorkflowNode } from "@workflow/shared";
import { useWorkflowStore, getNodeData } from "../../../store/workflowStore";
import { nodeRegistry } from "../../../lib/nodeRegistry";
import { Button } from "../../ui/button";

/**
 * Shown in PropertiesPanel when 2+ nodes are selected. Gives the user a
 * quick summary of the selection and the batch actions — Group and Delete.
 *
 * Group is disabled when any selected node is already a child of a group
 * (nested groups are out of scope for v1) or when fewer than 2 nodes are
 * selected.
 */
export function MultiSelectPanel(): React.ReactElement | null {
  const selectedIds = useWorkflowStore((s) => s.selectedNodeIds);
  const nodes = useWorkflowStore((s) => s.nodes);
  const groupNodes = useWorkflowStore((s) => s.groupNodes);
  const removeNodes = useWorkflowStore((s) => s.removeNodes);

  if (selectedIds.length < 2) return null;

  const selected = nodes.filter((n) => selectedIds.includes(n.id));
  const wns: WorkflowNode[] = selected.map(getNodeData);

  const kindCounts = new Map<string, number>();
  for (const wn of wns) {
    kindCounts.set(wn.kind, (kindCounts.get(wn.kind) ?? 0) + 1);
  }

  const alreadyParented = wns.some((wn) => !!wn.parentId);
  const includesGroup = wns.some((wn) => wn.kind === "group");
  const canGroup = !alreadyParented && !includesGroup;

  return (
    <div className="flex flex-col h-full">
      <div className="px-4 py-3 border-b border-border">
        <div className="text-xs font-semibold text-foreground">
          {selectedIds.length} nodes selected
        </div>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {[...kindCounts.entries()].map(([kind, count]) => {
            const entry = nodeRegistry[kind as keyof typeof nodeRegistry];
            return (
              <span
                key={kind}
                className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium"
                style={{
                  backgroundColor: (entry?.color ?? "#64748b") + "25",
                  color: entry?.color ?? "#94a3b8",
                }}
                title={kind}
              >
                {entry?.label ?? kind}
                {count > 1 && <span className="opacity-60">×{count}</span>}
              </span>
            );
          })}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        <div>
          <Button
            variant="default"
            className="w-full justify-center"
            disabled={!canGroup}
            onClick={() => groupNodes(selectedIds)}
          >
            <GroupIcon size={13} className="mr-1.5" />
            Group {selectedIds.length} nodes
          </Button>
          <p className="text-[10px] text-muted-foreground mt-1.5 leading-relaxed">
            {canGroup
              ? "Wraps the selection in a dotted-border container and freezes children. Shortcut: Cmd/Ctrl+G."
              : alreadyParented
                ? "Some of the selected nodes are already in a group. Nested groups aren't supported."
                : "A group is in the selection. Ungroup first or remove it from the selection."}
          </p>
        </div>

        <div className="pt-3 border-t border-border">
          <Button
            variant="destructive"
            className="w-full justify-center"
            onClick={() => removeNodes(selectedIds)}
          >
            <Trash2 size={13} className="mr-1.5" />
            Delete {selectedIds.length} nodes
          </Button>
          <p className="text-[10px] text-muted-foreground mt-1.5 leading-relaxed">
            Also removes edges connected to any of these nodes. Deleting a
            group leaves its children on the canvas at their world positions.
          </p>
        </div>
      </div>
    </div>
  );
}
