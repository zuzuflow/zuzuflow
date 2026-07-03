// =============================================================================
// Public API of @zuzuflow/react-sdk
//
// The SDK ships embeddable SCREEN components only — never the full app shell
// or any router. Each screen takes its own auth + environment props, mounts
// inside any container with a defined height, and is decoupled from the host
// app's routing.
//
// Available screens:
//   - <WorkflowDesigner /> — drag-and-drop canvas + palette + properties + log
//   - <WorkflowLogs />     — Grafana-style log search + execution history
//
// <ApiProvider /> is exported for advanced cases where you want to mount
// multiple screens under a single auth context. The screen components above
// already wrap themselves in <ApiProvider /> — using it directly is optional.
// =============================================================================

export { WorkflowDesigner } from "./WorkflowDesigner";
export type { WorkflowDesignerProps, WorkflowDesignerTheme } from "./WorkflowDesigner";
export type { EmittedWorkflow, WorkflowDraft, BeforeSaveHook } from "../../../apps/frontend/src/store/sdkHostStore";

export { WorkflowLogs } from "./WorkflowLogs";
export type { WorkflowLogsProps } from "./WorkflowLogs";

export { ApiProvider } from "./ApiProvider";
export type { ApiProviderProps } from "./ApiProvider";
