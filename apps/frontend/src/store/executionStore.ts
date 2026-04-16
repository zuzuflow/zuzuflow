import { create } from "zustand";
import type { ExecutionStatus, LogLevel } from "@workflow/shared";

export interface LogEntry {
  nodeId: string;
  nodeKind: string;
  level: LogLevel;
  message: string;
  data?: unknown;
  timestamp: string;
}

export type NodeRunStatus = "running" | "completed" | "failed" | "skipped";

interface ExecutionState {
  executionId: string | null;
  status: ExecutionStatus | null;
  logs: LogEntry[];
  nodeStatuses: Record<string, NodeRunStatus>;
  nodeOutputs: Record<string, unknown>;
  isDrawerOpen: boolean;

  startExecution: (executionId: string) => void;
  setStatus: (status: ExecutionStatus) => void;
  appendLog: (entry: LogEntry) => void;
  setNodeStatus: (nodeId: string, status: NodeRunStatus) => void;
  setNodeOutput: (nodeId: string, output: unknown) => void;
  clearExecution: () => void;
  openDrawer: () => void;
  closeDrawer: () => void;
}

export const useExecutionStore = create<ExecutionState>((set) => ({
  executionId: null,
  status: null,
  logs: [],
  nodeStatuses: {},
  nodeOutputs: {},
  isDrawerOpen: false,

  startExecution: (executionId) =>
    set({
      executionId,
      status: "pending",
      logs: [],
      nodeStatuses: {},
      nodeOutputs: {},
      isDrawerOpen: true,
    }),

  setStatus: (status) => set({ status }),

  appendLog: (entry) =>
    set((state) => ({ logs: [...state.logs, entry] })),

  setNodeStatus: (nodeId, status) =>
    set((state) => ({
      nodeStatuses: { ...state.nodeStatuses, [nodeId]: status },
    })),

  setNodeOutput: (nodeId, output) =>
    set((state) => ({
      nodeOutputs: { ...state.nodeOutputs, [nodeId]: output },
    })),

  clearExecution: () =>
    set({
      executionId: null,
      status: null,
      logs: [],
      nodeStatuses: {},
      nodeOutputs: {},
    }),

  openDrawer: () => set({ isDrawerOpen: true }),
  closeDrawer: () => set({ isDrawerOpen: false }),
}));
