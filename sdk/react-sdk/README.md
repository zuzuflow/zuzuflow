# @zuzuflow/react-sdk

Embeddable React **screen components** for [ZuzuFlow](https://zuzuflow.com).
Drop the workflow Designer or the workflow Logs viewer into any React app —
no routing, no app shell, no opinions about your sidebar.

## What you get

| Component | What it renders |
|---|---|
| `<WorkflowDesigner />` | Drag-and-drop canvas + node palette + properties panel + execution log. The full editor experience as a single embeddable surface. |
| `<WorkflowLogs />` | Grafana-style log search across every execution + an Executions tab for browsing run history. |

That's the whole public API. The SDK does **not** ship the credentials manager,
the workflow list, the settings page, or any of the CRUD-style pages — those
belong to your host app, not an embeddable widget.

## Install

```bash
npm install @zuzuflow/react-sdk react react-dom @xyflow/react react-router-dom zustand @monaco-editor/react
```

Peer-level deps: `react ^18`, `react-dom ^18`. The SDK keeps React-ecosystem
libraries (`@xyflow/react`, `react-router-dom`, `zustand`, `@monaco-editor/react`)
external so your app uses a single instance — install them alongside.

You also need to import xyflow's styles once:

```ts
import "@xyflow/react/dist/style.css";
```

The SDK components use Tailwind utility classes — ensure your app has Tailwind
configured, or provide equivalent styles.

## Quick start — Workflow Designer

```tsx
import { WorkflowDesigner } from "@zuzuflow/react-sdk";
import "@xyflow/react/dist/style.css";

export function MyDesignerPage({ workflowId }: { workflowId: string }) {
  return (
    <div style={{ height: "100vh" }}>
      <WorkflowDesigner
        apiUrl="https://app.zuzuflow.com/api"
        token={jwt}
        envSlug="production"
        workflowId={workflowId}
      />
    </div>
  );
}
```

Pass `workflowId="new"` (or omit it) to start with an empty canvas.

## Quick start — Workflow Logs

```tsx
import { WorkflowLogs } from "@zuzuflow/react-sdk";

export function MyLogsPage() {
  return (
    <div style={{ height: "100vh" }}>
      <WorkflowLogs
        apiUrl="https://app.zuzuflow.com/api"
        token={jwt}
        envSlug="production"
      />
    </div>
  );
}
```

## Mounting both screens under one auth context

`<ApiProvider />` is exported for advanced cases where you want to mount
multiple screens under a single auth context so the bearer token is set
once. The screen components above already wrap themselves in `<ApiProvider />`
— using it directly is optional.

```tsx
import { ApiProvider, WorkflowDesigner, WorkflowLogs } from "@zuzuflow/react-sdk";
import "@xyflow/react/dist/style.css";

export function MyEmbed({ workflowId }: { workflowId?: string }) {
  return (
    <ApiProvider
      apiUrl="https://app.zuzuflow.com/api"
      token={jwt}
      envSlug="production"
    >
      {/* Switch screens with your own routing / tabs */}
      {workflowId
        ? <WorkflowDesigner workflowId={workflowId} />
        : <WorkflowLogs />}
    </ApiProvider>
  );
}
```

## Props

### `WorkflowDesigner`

| Prop | Type | Notes |
|---|---|---|
| `apiUrl` | `string?` | Defaults to `/api` (build-time `VITE_API_URL` overrides). |
| `token` | `string` | Bearer JWT or master API token from your backend. |
| `envSlug` | `string?` | Environment slug to scope every request. Strongly recommended. |
| `workflowId` | `string?` | Existing workflow ID to load, or `"new"` / omitted for a blank canvas. |
| `onSave` | `(id: string) => void?` | Optional callback fired after a save. |

### `WorkflowLogs`

| Prop | Type | Notes |
|---|---|---|
| `apiUrl` | `string?` | Same as Designer. |
| `token` | `string` | Same as Designer. |
| `envSlug` | `string?` | Same as Designer. |
| `className` | `string?` | Override the outer container className. Default fills parent (`h-full w-full bg-background text-foreground`). |

## What's deliberately not exposed

- ❌ A `<WorkflowApp />` shell with routes — you bring your own router.
- ❌ A workflow list page — fetch + render with your own UI.
- ❌ A credentials manager / settings page — these belong in your admin UI.
- ❌ A login page — your host app handles auth and passes the JWT in.

The SDK exists to plug the *editor* and *logs* surfaces into your product's
chrome. Anything else stays a REST call you make yourself.

## License

MIT
