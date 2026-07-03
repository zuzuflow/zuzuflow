import { create } from "zustand";
import type { WorkflowTemplate } from "@workflow/shared";

// =============================================================================
// sdkHostStore — bridges callbacks supplied by an embedding host app (via the
// @zuzuflow/react-sdk <WorkflowDesigner> props) down to the deeply-nested
// Toolbar / serializer that actually produce workflow JSON.
//
// Empty by default so the standalone frontend app behaves exactly as before
// (Save hits the API, Export downloads a file). When a host registers
// callbacks, the SDK emits the workflow JSON to the host instead / in addition.
// =============================================================================

/** Full workflow payload emitted to the host after a successful save. */
export interface EmittedWorkflow {
  /** Backend workflow id. */
  id: string;
  /** Stable export/import-safe key (e.g. "wf_a7b3k2m9pq"), if assigned. */
  key: string | null;
  name: string;
  /** "draft" | "active" | "inactive" | "archived" */
  status: string | null;
  /** The workflow definition JSON (nodes, edges, settings). */
  template: WorkflowTemplate;
}

/** Draft passed to a host beforeSave hook — id is null for unsaved workflows. */
export interface WorkflowDraft {
  id: string | null;
  key: string | null;
  name: string;
  status: string | null;
  template: WorkflowTemplate;
}

/**
 * Host beforeSave hook. Runs before the workflow is persisted. Return:
 *   - nothing / true  → proceed with save
 *   - false           → cancel silently
 *   - a string        → cancel and surface the string as an error toast
 * May be async.
 */
export type BeforeSaveHook = (
  draft: WorkflowDraft,
) => boolean | string | void | Promise<boolean | string | void>;

export interface SdkHostConfig {
  /** Called after a successful save with the full workflow JSON payload. */
  onSave?: (wf: EmittedWorkflow) => void;
  /**
   * Called when the user exports. Receives the serialized content, a
   * suggested filename, and the format. When set, the SDK does NOT trigger a
   * browser download — the host decides what to do with the file.
   */
  onExport?: (content: string, filename: string, format: "json" | "yaml") => void;
  /** Validate / veto a save before it is persisted. */
  beforeSave?: BeforeSaveHook;
  /**
   * Allow-list of node kinds shown in the palette. When set, ONLY these kinds
   * are visible (takes precedence over hiddenNodeKinds).
   */
  allowedNodeKinds?: string[];
  /** Deny-list of node kinds to hide from the palette. */
  hiddenNodeKinds?: string[];
}

interface SdkHostState extends SdkHostConfig {
  setHost: (partial: SdkHostConfig) => void;
}

export const useSdkHostStore = create<SdkHostState>((set) => ({
  onSave: undefined,
  onExport: undefined,
  beforeSave: undefined,
  allowedNodeKinds: undefined,
  hiddenNodeKinds: undefined,
  setHost: (partial) =>
    set({
      onSave: partial.onSave,
      onExport: partial.onExport,
      beforeSave: partial.beforeSave,
      allowedNodeKinds: partial.allowedNodeKinds,
      hiddenNodeKinds: partial.hiddenNodeKinds,
    }),
}));

/** Non-hook accessor for use outside React (Toolbar handlers, serializer). */
export const getSdkHost = () => useSdkHostStore.getState();

/**
 * Whether a node kind should be visible in the palette given the host's
 * allow/deny config. allowedNodeKinds wins when both are set.
 */
export function isNodeKindVisible(
  kind: string,
  cfg: Pick<SdkHostConfig, "allowedNodeKinds" | "hiddenNodeKinds">,
): boolean {
  if (cfg.allowedNodeKinds && cfg.allowedNodeKinds.length > 0) {
    return cfg.allowedNodeKinds.includes(kind);
  }
  if (cfg.hiddenNodeKinds && cfg.hiddenNodeKinds.length > 0) {
    return !cfg.hiddenNodeKinds.includes(kind);
  }
  return true;
}
