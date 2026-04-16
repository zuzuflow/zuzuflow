# @zuzuflow/react-sdk

Embeddable React UI components for [ZuzuFlow](https://zuzuflow.com) — drop a
full workflow editor or runtime app shell into your own React application.

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

## Quick start

```tsx
import { WorkflowApp } from "@zuzuflow/react-sdk";
import "@xyflow/react/dist/style.css";

export function App() {
  return (
    <WorkflowApp
      apiBaseUrl="https://app.zuzuflow.com"
      envSlug="production"
      token={process.env.NEXT_PUBLIC_ZUZUFLOW_TOKEN!}
    />
  );
}
```

### Just the editor

```tsx
import { WorkflowEditor, ApiProvider } from "@zuzuflow/react-sdk";
import "@xyflow/react/dist/style.css";

export function MyEditor({ workflowId }: { workflowId: string }) {
  return (
    <ApiProvider apiBaseUrl="…" envSlug="…" token="…">
      <WorkflowEditor workflowId={workflowId} />
    </ApiProvider>
  );
}
```

## Exports

- `WorkflowApp` — full runtime app (routes + pages)
- `WorkflowEditor` — standalone editor component
- `ApiProvider` — configures the API client context

## License

MIT
