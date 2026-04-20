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
  GroupConfig,
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
  /** Multi-select: empty = none, length 1 = single node, 2+ = multi. */
  selectedNodeIds: string[];
  selectedEdgeIds: string[];
  /**
   * Back-compat derived value — first (and only) selection if exactly one
   * node is selected; null otherwise. Existing call sites read this.
   */
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
  /** Replace the node selection with `ids`; clears edge selection. */
  selectNodes: (ids: string[]) => void;
  /** Replace the edge selection with `ids`; clears node selection. */
  selectEdges: (ids: string[]) => void;

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
  /**
   * Batch delete. Cascades edges; if a deleted node is a group, its children
   * are re-parented to null (world-relative positions preserved) — the group
   * just vanishes.
   */
  removeNodes: (ids: string[]) => void;

  // Grouping
  /**
   * Wrap the given node ids in a new "group" node. Returns the new group id,
   * or null if the operation was rejected (e.g. any child already belongs to
   * a different group — nested groups are not supported in v1).
   */
  groupNodes: (ids: string[], opts?: { locked?: boolean }) => string | null;
  /** Dissolve a group — children keep their world positions, group is removed. */
  ungroupNode: (groupId: string) => void;

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
  selectedNodeIds: [],
  selectedEdgeIds: [],
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

  selectNode: (id) =>
    set({
      selectedNodeIds: id ? [id] : [],
      selectedEdgeIds: [],
      selectedNodeId: id,
      selectedEdgeId: null,
    }),

  selectEdge: (id) =>
    set({
      selectedEdgeIds: id ? [id] : [],
      selectedNodeIds: [],
      selectedEdgeId: id,
      selectedNodeId: null,
    }),

  selectNodes: (ids) =>
    set({
      selectedNodeIds: ids,
      selectedEdgeIds: [],
      selectedNodeId: ids.length === 1 ? ids[0] : null,
      selectedEdgeId: null,
    }),

  selectEdges: (ids) =>
    set({
      selectedEdgeIds: ids,
      selectedNodeIds: [],
      selectedEdgeId: ids.length === 1 ? ids[0] : null,
      selectedNodeId: null,
    }),

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
    get().removeNodes([nodeId]);
  },

  removeNodes: (ids) => {
    if (ids.length === 0) return;
    const idSet = new Set(ids);
    set((state) => {
      // When a group is deleted, its children are orphaned — keep them on the
      // canvas with their world-space position restored.
      const deletedGroups = state.nodes.filter(
        (n) => idSet.has(n.id) && n.type === "group",
      );
      const groupPosById = new Map(
        deletedGroups.map((g) => [g.id, g.position]),
      );

      const nextNodes: FlowNode[] = [];
      for (const n of state.nodes) {
        if (idSet.has(n.id)) continue;
        const parentId = (n as FlowNode & { parentId?: string }).parentId;
        if (parentId && groupPosById.has(parentId)) {
          const gp = groupPosById.get(parentId)!;
          const wn = getNodeData(n);
          const worldPos = {
            x: (wn.position?.x ?? 0) + gp.x,
            y: (wn.position?.y ?? 0) + gp.y,
          };
          nextNodes.push({
            ...n,
            position: { x: n.position.x + gp.x, y: n.position.y + gp.y },
            parentId: undefined,
            extent: undefined,
            data: asData({ ...wn, parentId: undefined, position: worldPos }),
          });
        } else {
          nextNodes.push(n);
        }
      }
      const nextEdges = state.edges.filter(
        (e) => !idSet.has(e.source) && !idSet.has(e.target),
      );
      const nextSelected = state.selectedNodeIds.filter((id) => !idSet.has(id));
      return {
        nodes: nextNodes,
        edges: nextEdges,
        selectedNodeIds: nextSelected,
        selectedNodeId: nextSelected.length === 1 ? nextSelected[0] : null,
        isDirty: true,
      };
    });
  },

  groupNodes: (ids, opts) => {
    if (ids.length < 2) return null;
    const state = get();
    const selected = state.nodes.filter((n) => ids.includes(n.id));
    if (selected.length !== ids.length) return null;
    // Reject if any selected node is a group, or already belongs to a group.
    for (const n of selected) {
      if (n.type === "group") return null;
      if ((n as FlowNode & { parentId?: string }).parentId) return null;
    }

    const PADDING = 40;
    const HEADER = 28; // extra top padding for the label chip

    // Resolve each node's size in FLOW-COORDINATE space. xyflow v12's
    // `node.measured` + top-level `node.width/height` are both stored in
    // flow coords (scaled independently of zoom). We deliberately do NOT
    // fall back to `getBoundingClientRect()` here — that returns screen
    // pixels, and mixing them with `n.position` (flow coords) blew the
    // bounding box out of proportion on zoomed-in canvases. If xyflow
    // hasn't measured a node yet we just use a modest default; the
    // resulting group can be nudged via the Width / Height inputs.
    //
    // The per-node cap protects against stale / oversized measurements
    // (e.g. a node that briefly rendered wider due to a long inline preview):
    // no single child should force the group wider than NODE_MAX_W even if
    // xyflow reports a huge measurement.
    const NODE_MAX_W = 520;
    const NODE_MAX_H = 260;
    const measure = (n: FlowNode): { w: number; h: number } => {
      type Measurable = FlowNode & {
        measured?: { width?: number; height?: number };
      };
      const m = (n as Measurable).measured;
      let w: number | undefined;
      let h: number | undefined;
      if (m?.width && m?.height) {
        w = m.width;
        h = m.height;
      } else if (n.width && n.height) {
        w = n.width;
        h = n.height;
      }
      return {
        w: Math.min(NODE_MAX_W, Math.max(1, w ?? 260)),
        h: Math.min(NODE_MAX_H, Math.max(1, h ?? 100)),
      };
    };

    let minX = Infinity,
      minY = Infinity,
      maxX = -Infinity,
      maxY = -Infinity;
    for (const n of selected) {
      const { w, h } = measure(n);
      minX = Math.min(minX, n.position.x);
      minY = Math.min(minY, n.position.y);
      maxX = Math.max(maxX, n.position.x + w);
      maxY = Math.max(maxY, n.position.y + h);
    }
    const groupPos = { x: minX - PADDING, y: minY - PADDING - HEADER };
    const width = maxX - minX + PADDING * 2;
    const height = maxY - minY + PADDING * 2 + HEADER;

    const groupId = uuidv4();
    const cfg: GroupConfig = {
      label: "Group",
      color: "#64748b",
      locked: opts?.locked ?? true,
      width,
      height,
    };
    const groupWn: WorkflowNode = {
      id: groupId,
      kind: "group",
      label: "Group",
      config: cfg,
      position: groupPos,
    };
    const groupFlowNode: FlowNode = {
      id: groupId,
      type: "group",
      position: groupPos,
      data: asData(groupWn),
      // Make sure the group paints BEHIND its children.
      zIndex: -1,
    };

    const idSet = new Set(ids);
    const updatedChildren = state.nodes.map((n) => {
      if (!idSet.has(n.id)) return n;
      const wn = getNodeData(n);
      const relPos = {
        x: n.position.x - groupPos.x,
        y: n.position.y - groupPos.y,
      };
      return {
        ...n,
        position: relPos,
        parentId: groupId,
        extent: "parent" as const,
        data: asData({ ...wn, parentId: groupId, position: relPos }),
      };
    });

    // xyflow requires the parent to appear before its children in the array.
    set({
      nodes: [groupFlowNode, ...updatedChildren],
      selectedNodeIds: [groupId],
      selectedNodeId: groupId,
      selectedEdgeIds: [],
      selectedEdgeId: null,
      isDirty: true,
    });
    return groupId;
  },

  ungroupNode: (groupId) => {
    set((state) => {
      const group = state.nodes.find(
        (n) => n.id === groupId && n.type === "group",
      );
      if (!group) return state;
      const gp = group.position;
      const nextNodes: FlowNode[] = [];
      for (const n of state.nodes) {
        if (n.id === groupId) continue;
        const parentId = (n as FlowNode & { parentId?: string }).parentId;
        if (parentId === groupId) {
          const wn = getNodeData(n);
          const worldPos = { x: n.position.x + gp.x, y: n.position.y + gp.y };
          nextNodes.push({
            ...n,
            position: worldPos,
            parentId: undefined,
            extent: undefined,
            data: asData({ ...wn, parentId: undefined, position: worldPos }),
          });
        } else {
          nextNodes.push(n);
        }
      }
      return {
        nodes: nextNodes,
        selectedNodeIds: [],
        selectedNodeId: null,
        selectedEdgeIds: [],
        selectedEdgeId: null,
        isDirty: true,
      };
    });
  },

  loadTemplate: (template, workflowId, name, status, tags, workflowKey) => {
    // xyflow requires parent nodes to appear before their children in the
    // array, or they won't render. Sort groups first, everything else after.
    const sortedTemplateNodes = [...template.nodes].sort((a, b) => {
      if (a.kind === "group" && b.kind !== "group") return -1;
      if (b.kind === "group" && a.kind !== "group") return 1;
      return 0;
    });
    const nodes: FlowNode[] = sortedTemplateNodes.map((wn) => {
      const base: FlowNode = {
        id: wn.id,
        type: wn.kind,
        position: wn.position ?? { x: 0, y: 0 },
        data: asData(wn),
      };
      if (wn.parentId) {
        return {
          ...base,
          parentId: wn.parentId,
          extent: "parent" as const,
        };
      }
      if (wn.kind === "group") {
        return { ...base, zIndex: -1 };
      }
      return base;
    });

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
      selectedNodeIds: [],
      selectedEdgeIds: [],
      selectedNodeId: null,
      selectedEdgeId: null,
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
      selectedNodeIds: [],
      selectedEdgeIds: [],
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
