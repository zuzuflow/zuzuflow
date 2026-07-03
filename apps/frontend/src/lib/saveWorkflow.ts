import { useWorkflowStore } from "../store/workflowStore";
import { getSdkHost } from "../store/sdkHostStore";
import * as api from "./api";

export type SaveWorkflowResult =
  | { ok: true; workflowId: string }
  | { ok: false; error: string };

/**
 * Save the workflow currently loaded in the Zustand store.
 *
 * Single source of truth for the save contract — the Toolbar's Save button
 * and the UnsavedChangesGuard's "Save & leave" button both call this so a
 * future change (validation, analytics, retry policy) lands in one place.
 *
 * Returns a discriminated union instead of throwing so the caller can render
 * the error inline (the guard's dialog) without wrapping in try/catch.
 *
 * Note on tags: UpdateWorkflowInput treats `tags: undefined` as "no change"
 * and `tags: []` as "clear all tags". We always read from the store, which
 * stores `tags` as a string[] that defaults to []. Passing [] preserves the
 * same behaviour the current handleSave uses.
 */
export async function saveCurrentWorkflow(): Promise<SaveWorkflowResult> {
  const state = useWorkflowStore.getState();

  // Match the Toolbar's guard against saving an invalid workflow.
  const errors = state.validateWorkflow();
  if (errors.length > 0) {
    return { ok: false, error: errors.join("\n") };
  }

  const template = state.toTemplate();
  const workflowId = state.workflowId;
  const workflowName = state.workflowName;
  const tags = state.tags;

  // Host beforeSave hook — lets an embedding app veto the save (e.g. require a
  // specific trigger node). Runs after the built-in validation, before persist.
  const host = getSdkHost();
  if (host.beforeSave) {
    const verdict = await host.beforeSave({
      id: workflowId,
      key: state.workflowKey,
      name: workflowName,
      status: state.workflowStatus,
      template,
    });
    if (verdict === false) return { ok: false, error: "Save cancelled." };
    if (typeof verdict === "string") return { ok: false, error: verdict };
  }

  try {
    if (workflowId) {
      const updated = await api.updateWorkflow(workflowId, {
        name: workflowName,
        template,
        tags,
      });
      state.markSaved(workflowId, updated.status, updated.key);
      return { ok: true, workflowId };
    }

    // New workflow — inherit the subworkflow flag from the URL query the
    // editor stores in the route. We can't read window.location here without
    // coupling to the DOM, so instead derive from the template itself: a
    // workflow with a subflow_input or subflow_output node is a subworkflow.
    const isSubworkflow = template.nodes.some(
      (n) => n.kind === "subflow_input" || n.kind === "subflow_output",
    );
    const created = await api.createWorkflow({
      name: workflowName,
      template,
      isSubworkflow: isSubworkflow || undefined,
      tags,
    });
    state.markSaved(created.id, created.status, created.key);
    return { ok: true, workflowId: created.id };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { ok: false, error: message };
  }
}
