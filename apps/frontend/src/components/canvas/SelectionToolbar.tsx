import React from "react";
import { Group as GroupIcon, Ungroup, Trash2 } from "lucide-react";
import { useWorkflowStore, getNodeData } from "../../store/workflowStore";
import { Button } from "../ui/button";

/**
 * Floating pill at the top of the canvas — shows how many nodes are selected
 * and gives one-click access to the batch actions (Group / Ungroup / Delete).
 *
 * Appears only when something actionable is selected:
 *   - 2+ nodes → "Group" + "Delete" are useful
 *   - exactly one group → "Ungroup" + "Delete" are useful
 */
export function SelectionToolbar(): React.ReactElement | null {
  const selectedIds = useWorkflowStore((s) => s.selectedNodeIds);
  const nodes = useWorkflowStore((s) => s.nodes);
  const groupNodes = useWorkflowStore((s) => s.groupNodes);
  const ungroupNode = useWorkflowStore((s) => s.ungroupNode);
  const removeNodes = useWorkflowStore((s) => s.removeNodes);

  if (selectedIds.length === 0) return null;

  const selected = nodes.filter((n) => selectedIds.includes(n.id));
  const wns = selected.map(getNodeData);

  const onlyGroupSelected =
    selectedIds.length === 1 && wns[0]?.kind === "group";

  // Hide the pill for a single non-group selection — the Properties panel
  // already covers that case with its Delete button.
  if (selectedIds.length === 1 && !onlyGroupSelected) return null;

  const alreadyParented = wns.some((wn) => !!wn.parentId);
  const includesGroup = wns.some((wn) => wn.kind === "group");
  const canGroup =
    selectedIds.length >= 2 && !alreadyParented && !includesGroup;

  return (
    <div className="absolute top-4 left-1/2 -translate-x-1/2 z-20 flex items-center gap-1.5 px-2 py-1.5 rounded-lg bg-slate-900/95 border border-slate-700 shadow-lg backdrop-blur-sm">
      <span className="px-2 text-[11px] font-medium text-slate-300">
        {onlyGroupSelected
          ? "Group selected"
          : `${selectedIds.length} nodes selected`}
      </span>
      <div className="w-px h-5 bg-slate-700" />

      {onlyGroupSelected ? (
        <Button
          size="sm"
          variant="ghost"
          className="h-7 px-2 text-xs"
          onClick={() => ungroupNode(selectedIds[0])}
          title="Ungroup (Cmd/Ctrl+Shift+G)"
        >
          <Ungroup size={12} className="mr-1" /> Ungroup
        </Button>
      ) : (
        <Button
          size="sm"
          variant="ghost"
          className="h-7 px-2 text-xs"
          disabled={!canGroup}
          onClick={() => groupNodes(selectedIds)}
          title={
            canGroup
              ? "Group (Cmd/Ctrl+G)"
              : alreadyParented
                ? "Some nodes already belong to a group"
                : includesGroup
                  ? "Selection includes a group"
                  : "Select 2 or more nodes"
          }
        >
          <GroupIcon size={12} className="mr-1" /> Group
        </Button>
      )}

      <Button
        size="sm"
        variant="ghost"
        className="h-7 px-2 text-xs text-red-300 hover:text-red-200 hover:bg-red-900/30"
        onClick={() => removeNodes(selectedIds)}
        title="Delete (Delete / Backspace)"
      >
        <Trash2 size={12} className="mr-1" /> Delete
      </Button>
    </div>
  );
}
