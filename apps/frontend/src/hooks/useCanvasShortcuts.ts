import { useEffect } from "react";
import { useWorkflowStore, getNodeData } from "../store/workflowStore";

/**
 * Canvas-level keyboard shortcuts. Mounted once on WorkflowEditorPage.
 *
 *  Cmd/Ctrl + G          → group current multi-selection
 *  Cmd/Ctrl + Shift + G  → ungroup the selected group
 *  Cmd/Ctrl + A          → select all nodes
 *
 * Delete / Backspace is handled natively by xyflow via its `deleteKeyCode`
 * prop on the canvas, so we don't need to duplicate it here.
 *
 * We guard every handler with an "is the user typing in an input?" check so
 * these never hijack form fields or code editors.
 */
function isTypingInField(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return true;
  if (target.isContentEditable) return true;
  // Monaco editor uses .monaco-editor — stay out of it.
  return !!target.closest(".monaco-editor");
}

export function useCanvasShortcuts(): void {
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (isTypingInField(e.target)) return;
      const mod = e.metaKey || e.ctrlKey;
      if (!mod) return;

      const state = useWorkflowStore.getState();

      // Cmd/Ctrl + Shift + G → ungroup
      if (e.shiftKey && e.key.toLowerCase() === "g") {
        const selected = state.selectedNodeIds;
        if (selected.length === 1) {
          const node = state.nodes.find((n) => n.id === selected[0]);
          if (node && node.type === "group") {
            e.preventDefault();
            state.ungroupNode(selected[0]);
          }
        }
        return;
      }

      // Cmd/Ctrl + G → group
      if (!e.shiftKey && e.key.toLowerCase() === "g") {
        const selected = state.selectedNodeIds;
        if (selected.length < 2) return;
        const wns = state.nodes
          .filter((n) => selected.includes(n.id))
          .map(getNodeData);
        const alreadyParented = wns.some((wn) => !!wn.parentId);
        const includesGroup = wns.some((wn) => wn.kind === "group");
        if (alreadyParented || includesGroup) return;
        e.preventDefault();
        state.groupNodes(selected);
        return;
      }

      // Cmd/Ctrl + A → select all nodes
      if (!e.shiftKey && e.key.toLowerCase() === "a") {
        e.preventDefault();
        state.selectNodes(state.nodes.map((n) => n.id));
        return;
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);
}
