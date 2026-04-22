# Canvas Interactions

How users select, move, delete, and group nodes on the workflow canvas — and
how the **Immediate** trigger lets them ship a typed static payload into a
run without any external call.

This is the developer-facing reference for the behaviour. Source of truth
for selection state lives in
[`apps/frontend/src/store/workflowStore.ts`](../apps/frontend/src/store/workflowStore.ts);
canvas wiring in
[`apps/frontend/src/components/canvas/WorkflowCanvas.tsx`](../apps/frontend/src/components/canvas/WorkflowCanvas.tsx);
keyboard shortcuts in
[`apps/frontend/src/hooks/useCanvasShortcuts.ts`](../apps/frontend/src/hooks/useCanvasShortcuts.ts).

---

## Selecting nodes

| Gesture | Result |
|---|---|
| Click a node | Single-select (Properties panel opens) |
| Shift-click nodes | Toggle each node in/out of the selection |
| **Shift-drag** on empty canvas | Rectangle-select — every node under the box joins the selection |
| Plain drag on empty canvas | Pan (unchanged) |
| `Cmd/Ctrl + A` | Select every node on the canvas |
| Click empty canvas | Deselect everything |

xyflow v12 does the heavy lifting: `selectionKeyCode="Shift"` enables box
select, `multiSelectionKeyCode="Shift"` enables additive click. The
`onSelectionChange` callback mirrors the xyflow selection set into the
Zustand store as `selectedNodeIds: string[]`. The floating **Selection
pill** at the top of the canvas appears whenever 2+ nodes or a single
group is selected.

### What the store tracks

```ts
selectedNodeIds: string[];  // empty | single | multi
selectedEdgeIds: string[];
// Back-compat getter — first (and only) id when length === 1, else null.
selectedNodeId: string | null;
```

The Properties panel checks `selectedNodeIds.length > 1` first and renders
a multi-select summary; otherwise falls through to the per-node form.

## Moving a multi-selection

Drag any selected node — all selected nodes translate by the same delta.
xyflow handles this natively once the selection is in sync.

## Deleting

`Delete` / `Backspace` removes every selected node at once. Edges touching
any removed node are cascaded. If a **group** is deleted, its children
are left on the canvas at their restored world-space positions — the
dotted container disappears, not the work inside it.

## Grouping

Grouping turns an ad-hoc multi-selection into a named container with a
dotted border. The group moves as one unit; children are **frozen** by
default (not individually draggable or deletable) until the group is
unlocked or ungrouped.

| Action | Shortcut | Toolbar |
|---|---|---|
| Group current multi-selection | `Cmd/Ctrl + G` | Selection pill → "Group" |
| Ungroup (selected group → loose nodes) | `Cmd/Ctrl + Shift + G` | Selection pill → "Ungroup" |

Internally, grouping uses xyflow v12's parent-child model:

- A new `"group"` node is inserted with the bounding box of the selection
  (plus padding for a label chip).
- Each selected child's `parentId` is set to the new group's id.
- Each child's `position` is rewritten as **parent-relative** (xyflow
  requires this for parent-child rendering).
- Ungrouping reverses all three steps: `parentId` is cleared, positions
  are added back to the group's world position.

The `group` kind has **no execution semantics**. It carries no handles,
emits nothing, and the GraphInterpreter no-ops the case defensively.
Edges between children remain attached by id and flow normally.

### Locked vs. unlocked

Every group's config has a `locked: boolean`. When `true`:

- The canvas sets `draggable: false, deletable: false` on every child node.
- The Properties panel's delete button on a child is disabled.
- The group's header chip shows a **lock icon** in amber.

When `false`:

- Children can be individually moved inside the group and deleted.
- The group's header chip shows an unlock icon.

Toggle with the **Lock / Unlock** button in the Group form. The default
on group creation is `locked: true` — matching the "grouped = frozen"
mental model.

### Constraints (v1)

- No nested groups — `groupNodes` rejects selections that already contain
  a child-of-group or a group itself.
- Groups are not in the palette. They can only be created from a
  selection; the registry entry has `hidden: true`.
- A single node can't be "grouped" alone — minimum selection size is 2.

### Template shape

```ts
// packages/shared/src/types/workflow.ts
export interface GroupConfig {
  label?: string;
  color?: string;
  locked: boolean;
  width: number;
  height: number;
}

export interface WorkflowNode {
  // ... existing fields
  parentId?: string;   // points at a "group" node
}
```

Templates serialise `parentId` through `useWorkflowSerializer` → backend
Zod → git sync without any extra code paths — the serializer already
forwards `WorkflowNode` verbatim.

---

## Immediate trigger (renamed from "Manual Trigger")

The `kind: "manual"` trigger used to be called "Manual Trigger" in the
palette and emitted whatever the caller sent as `triggerPayload`. It's
been renamed to **Immediate** and now accepts a typed static payload
configured directly on the node:

```ts
interface ManualTriggerConfig {
  value?: string;
  valueType?: "string" | "number" | "boolean" | "json";
}
```

The builder form lets users pick one of four types:

| Type | Input | Coerced at runtime to |
|---|---|---|
| `json` (default) | textarea | `JSON.parse(value)`; falls back to the raw string on parse failure |
| `string` | single-line input | the raw string |
| `number` | numeric input | `Number(value)` (NaN falls back to the string) |
| `boolean` | true/false toggle | `true` iff the value is `"true"` (case-insensitive) |

### Precedence rule

The GraphInterpreter's `case "manual"`:

```text
if triggerPayload is a non-empty object → nodeOutput = triggerPayload
else if config.value is set           → nodeOutput = coerce(value, valueType)
else                                   → nodeOutput = triggerPayload ({})
```

In plain English: an explicit payload on `POST /executions/start` always
wins — SDK callers retain full control. The node's configured `value` is
a default / parameterisation for "Run" from the UI and for scheduled or
scripted runs that don't care to pass anything.

### When to use which

- **Configured `value` on the node** — when the workflow is a "recipe"
  that always starts with the same input (a test harness, a demo, a
  parameterised playground).
- **Explicit `triggerPayload` on the API call** — when the workflow is a
  reusable template invoked from code with fresh data each run.

Either way, the trigger's output shape is whatever you passed — downstream
nodes see the live coerced object (not a JSON string).
