import { create } from "zustand";
import {
  applyNodeChanges,
  applyEdgeChanges,
  type Node,
  type Edge,
  type NodeChange,
  type EdgeChange,
  type Connection,
} from "@xyflow/react";
import { v4 as uuidv4 } from "uuid";
import type {
  NodeKind,
  NodeConfig,
  WorkflowTemplate,
  WorkflowNode,
  NodeStyle,
  EdgeStyle,
  WorkflowSettings,
} from "@workflow/shared";
import { nodeRegistry } from "../lib/nodeRegistry";

// xyflow v12 requires Record<string, unknown> for node/edge data generics.
// We store WorkflowNode in data but declare the generic as Record<string, unknown>.
export type FlowNode = Node<Record<string, unknown>>;
export type FlowEdge = Edge<Record<string, unknown>>;

/** Read typed WorkflowNode from a FlowNode's data field */
export function getNodeData(n: FlowNode): WorkflowNode {
  return n.data as unknown as WorkflowNode;
}

/** Cast a WorkflowNode to the Record type xyflow expects */
function asData(wn: WorkflowNode): Record<string, unknown> {
  return wn as unknown as Record<string, unknown>;
}

/** Cast an EdgeStyle to the Record type xyflow expects */
function asEdgeData(es: EdgeStyle): Record<string, unknown> {
  return es as unknown as Record<string, unknown>;
}

interface WorkflowState {
  nodes: FlowNode[];
  edges: FlowEdge[];
  selectedNodeId: string | null;
  selectedEdgeId: string | null;
  workflowId: string | null;
  /** Stable export/import-safe key surfaced alongside the DB id (e.g. "wf_a7b3k2m9pq"). */
  workflowKey: string | null;
  workflowName: string;
  workflowStatus: string | null; // "draft" | "active" | "inactive" | "archived"
  settings: WorkflowSettings;
  tags: string[];
  isDirty: boolean;

  // xyflow callbacks
  setNodes: (nodes: FlowNode[]) => void;
  setEdges: (edges: FlowEdge[]) => void;
  onNodesChange: (changes: NodeChange[]) => void;
  onEdgesChange: (changes: EdgeChange[]) => void;
  onConnect: (connection: Connection) => void;

  // Selection
  selectNode: (id: string | null) => void;
  selectEdge: (id: string | null) => void;

  // Node mutations
  updateNodeConfig: (nodeId: string, config: Partial<NodeConfig>) => void;
  updateNodeLabel: (nodeId: string, label: string) => void;
  updateNodeStyle: (nodeId: string, style: NodeStyle) => void;
  addNode: (
    kind: NodeKind,
    position: { x: number; y: number },
    configOverride?: Partial<NodeConfig>,
  ) => void;
  removeNode: (nodeId: string) => void;

  // Edge mutations
  updateEdgeStyle: (edgeId: string, style: EdgeStyle) => void;

  // Serialization
  loadTemplate: (
    template: WorkflowTemplate,
    workflowId?: string,
    name?: string,
    status?: string,
    tags?: string[],
    workflowKey?: string,
  ) => void;
  toTemplate: () => WorkflowTemplate;

  // Tags
  setTags: (tags: string[]) => void;

  // Validation
  validateWorkflow: () => string[];

  // Settings
  setSettings: (settings: WorkflowSettings) => void;

  // Meta
  setWorkflowName: (name: string) => void;
  markSaved: (
    workflowId: string,
    status?: string,
    workflowKey?: string,
  ) => void;
  setWorkflowStatus: (status: string) => void;
  resetWorkflow: () => void;
}

export const useWorkflowStore = create<WorkflowState>((set, get) => ({
  nodes: [],
  edges: [],
  selectedNodeId: null,
  selectedEdgeId: null,
  workflowId: null,
  workflowKey: null,
  workflowName: "Untitled Workflow",
  workflowStatus: null,
  settings: {},
  tags: [],
  isDirty: false,

  setNodes: (nodes) => set({ nodes, isDirty: true }),

  setEdges: (edges) => set({ edges, isDirty: true }),

  onNodesChange: (changes) => {
    set((state) => ({
      nodes: applyNodeChanges(changes, state.nodes) as FlowNode[],
      isDirty: true,
    }));
  },

  onEdgesChange: (changes) => {
    set((state) => ({
      edges: applyEdgeChanges(changes, state.edges) as FlowEdge[],
      isDirty: true,
    }));
  },

  onConnect: (connection) => {
    const newEdge: FlowEdge = {
      id: uuidv4(),
      source: connection.source ?? "",
      target: connection.target ?? "",
      sourceHandle: connection.sourceHandle ?? undefined,
      targetHandle: connection.targetHandle ?? undefined,
      label: connection.sourceHandle ?? undefined,
      type: "animated",
    };
    set((state) => ({
      edges: [...state.edges, newEdge],
      isDirty: true,
    }));
  },

  selectNode: (id) => set({ selectedNodeId: id, selectedEdgeId: null }),

  selectEdge: (id) => set({ selectedEdgeId: id, selectedNodeId: null }),

  updateNodeConfig: (nodeId, configPatch) => {
    set((state) => ({
      nodes: state.nodes.map((n) => {
        if (n.id !== nodeId) return n;
        const wn = getNodeData(n);
        return {
          ...n,
          data: asData({
            ...wn,
            config: { ...wn.config, ...configPatch } as NodeConfig,
          }),
        };
      }),
      isDirty: true,
    }));
  },

  updateNodeLabel: (nodeId, label) => {
    set((state) => ({
      nodes: state.nodes.map((n) => {
        if (n.id !== nodeId) return n;
        const wn = getNodeData(n);
        return { ...n, data: asData({ ...wn, label }) };
      }),
      isDirty: true,
    }));
  },

  updateNodeStyle: (nodeId, style) => {
    set((state) => ({
      nodes: state.nodes.map((n) => {
        if (n.id !== nodeId) return n;
        const wn = getNodeData(n);
        return {
          ...n,
          data: asData({ ...wn, style: { ...wn.style, ...style } }),
        };
      }),
      isDirty: true,
    }));
  },

  updateEdgeStyle: (edgeId, style) => {
    set((state) => ({
      edges: state.edges.map((e) => {
        if (e.id !== edgeId) return e;
        const existing = (e.data ?? {}) as Record<string, unknown>;
        return { ...e, data: { ...existing, ...style } };
      }),
      isDirty: true,
    }));
  },

  addNode: (kind, position, configOverride) => {
    const entry = nodeRegistry[kind];
    const id = uuidv4();
    const workflowNode: WorkflowNode = {
      id,
      kind,
      label: entry.defaultLabel,
      config: configOverride
        ? ({ ...entry.defaultConfig, ...configOverride } as NodeConfig)
        : { ...entry.defaultConfig },
      position,
    };
    const flowNode: FlowNode = {
      id,
      type: kind,
      position,
      data: asData(workflowNode),
    };
    set((state) => ({
      nodes: [...state.nodes, flowNode],
      isDirty: true,
    }));
  },

  removeNode: (nodeId) => {
    set((state) => ({
      nodes: state.nodes.filter((n) => n.id !== nodeId),
      edges: state.edges.filter(
        (e) => e.source !== nodeId && e.target !== nodeId,
      ),
      selectedNodeId:
        state.selectedNodeId === nodeId ? null : state.selectedNodeId,
      isDirty: true,
    }));
  },

  loadTemplate: (template, workflowId, name, status, tags, workflowKey) => {
    const nodes: FlowNode[] = template.nodes.map((wn) => ({
      id: wn.id,
      type: wn.kind,
      position: wn.position ?? { x: 0, y: 0 },
      data: asData(wn),
    }));

    const edges: FlowEdge[] = template.edges.map((we) => ({
      id: we.id,
      source: we.source,
      target: we.target,
      sourceHandle: we.sourceHandle ?? "out",
      targetHandle: (we as any).targetHandle ?? "in",
      label: we.label,
      type: "animated",
      data: we.style ? asEdgeData(we.style) : undefined,
    }));

    set({
      nodes,
      edges,
      settings: template.settings ?? {},
      workflowId: workflowId ?? get().workflowId,
      workflowKey: workflowKey ?? get().workflowKey,
      workflowName: name ?? get().workflowName,
      workflowStatus: status ?? get().workflowStatus,
      tags: tags ?? [],
      selectedNodeId: null,
      isDirty: false,
    });
  },

  setTags: (tags) => set({ tags, isDirty: true }),

  toTemplate: (): WorkflowTemplate => {
    const { nodes, edges, settings } = get();
    const hasSettings = Object.keys(settings).length > 0;
    return {
      version: "1.0",
      nodes: nodes.map((n) => {
        const wn = getNodeData(n);
        return {
          ...wn,
          position: { x: n.position.x, y: n.position.y },
        };
      }),
      edges: edges.map((e) => ({
        id: e.id,
        source: e.source,
        target: e.target,
        sourceHandle: e.sourceHandle ?? undefined,
        label: typeof e.label === "string" ? e.label : undefined,
        style:
          e.data && Object.keys(e.data).length > 0
            ? (e.data as EdgeStyle)
            : undefined,
      })),
      ...(hasSettings ? { settings } : {}),
    };
  },

  validateWorkflow: (): string[] => {
    const errors: string[] = [];
    const { nodes } = get();
    const externalTriggerCount = nodes.filter(
      (n) => getNodeData(n).kind === "external_trigger",
    ).length;
    if (externalTriggerCount > 1) {
      errors.push("Only one External Trigger node is allowed per workflow.");
    }
    return errors;
  },

  setSettings: (settings) => set({ settings, isDirty: true }),

  setWorkflowName: (name) => set({ workflowName: name, isDirty: true }),

  markSaved: (workflowId, status, workflowKey) =>
    set({
      workflowId,
      isDirty: false,
      ...(status !== undefined ? { workflowStatus: status } : {}),
      ...(workflowKey !== undefined ? { workflowKey } : {}),
    }),

  setWorkflowStatus: (status) => set({ workflowStatus: status }),

  resetWorkflow: () =>
    set({
      nodes: [],
      edges: [],
      selectedNodeId: null,
      selectedEdgeId: null,
      workflowId: null,
      workflowKey: null,
      workflowName: "Untitled Workflow",
      workflowStatus: null,
      settings: {},
      tags: [],
      isDirty: false,
    }),
}));
