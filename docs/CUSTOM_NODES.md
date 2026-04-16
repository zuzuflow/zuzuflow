# Building Custom Nodes

This guide explains how to add a new node kind to ZuzuFlow end-to-end: shared types → backend validation → worker activity → frontend node component → properties form.

---

## Architecture overview

```
packages/shared/src/types/workflow.ts   ← NodeKind union + config interface
apps/backend/src/services/WorkflowService.ts  ← Zod validation schema
apps/workers/src/activities/           ← Activity (what the node actually does)
apps/workers/src/workflows/GraphInterpreter.ts ← Routes node to activity
apps/frontend/src/components/nodes/    ← Visual node component
apps/frontend/src/components/panels/forms/ ← Properties panel form
apps/frontend/src/lib/nodeRegistry.ts  ← Metadata (label, icon, defaults)
```

---

## Step 1 — Define the NodeKind and config type (shared)

**File:** `packages/shared/src/types/workflow.ts`

Add your new kind to the `NodeKind` union and define a config interface:

```typescript
// 1a. Add to the NodeKind union
export type NodeKind =
  | "manual"
  | "webhook"
  | "cron"
  // ... existing kinds ...
  | "slack_message";   // ← your new kind

// 1b. Define a typed config interface
export interface SlackMessageConfig {
  webhookUrl?: string;
  credentialId?: string;  // reference to a stored credential
  channel: string;
  message: string;
}

// 1c. Add to the NodeConfig union
export type NodeConfig =
  | WebhookConfig
  // ... existing configs ...
  | SlackMessageConfig;
```

> **Tip:** If your node needs secrets (API keys, passwords), add a `credentialId?: string` field and create a matching credential kind in `CredentialService.ts`.

---

## Step 2 — Add Zod validation (backend)

**File:** `apps/backend/src/services/WorkflowService.ts`

Find `nodeKindSchema` and add your kind:

```typescript
const nodeKindSchema = z.enum([
  "manual", "webhook", "cron",
  // ... existing ...
  "slack_message",   // ← add here
]);
```

The backend validates every saved workflow template — missing this step causes a 422 on save.

---

## Step 3 — Write the activity (worker)

Create a new file `apps/workers/src/activities/slack.ts`:

```typescript
import { ApplicationFailure } from "@temporalio/activity";
import axios from "axios";
import type { SlackMessageConfig } from "@workflow/shared";

export interface SlackActivityInput {
  config: SlackMessageConfig;
  context: Record<string, unknown>;
  resolvedWebhookUrl?: string;  // from credential resolution
}

export interface SlackActivityOutput {
  ok: boolean;
}

export async function sendSlackMessageActivity(
  input: SlackActivityInput
): Promise<SlackActivityOutput> {
  const { config, context, resolvedWebhookUrl } = input;

  const webhookUrl = resolvedWebhookUrl ?? config.webhookUrl;
  if (!webhookUrl) {
    throw ApplicationFailure.create({
      message: "No Slack webhook URL configured",
      type: "SLACK_CONFIGURATION_ERROR",
      nonRetryable: true,
    });
  }

  // Interpolate template variables like {{$.nodeId.field}}
  const { interpolateTemplate } = await import("@workflow/shared");
  const message = interpolateTemplate(config.message, context);

  await axios.post(webhookUrl, {
    channel: config.channel,
    text: message,
  });

  return { ok: true };
}
```

**Export from the activities barrel** (`apps/workers/src/activities/index.ts`):

```typescript
export { sendSlackMessageActivity } from "./slack";
export type { SlackActivityInput, SlackActivityOutput } from "./slack";
```

---

## Step 4 — Register the activity proxy and handle the case (GraphInterpreter)

**File:** `apps/workers/src/workflows/GraphInterpreter.ts`

```typescript
// 4a. Add type-only import
import type { SlackActivityInput } from "../activities/slack";

// 4b. Add to the proxyActivities call
const {
  // ... existing ...
  sendSlackMessageActivity,
} = proxyActivities<{
  // ... existing ...
  sendSlackMessageActivity(input: SlackActivityInput): Promise<unknown>;
}>({ startToCloseTimeout: "5 minutes", /* ... */ });

// 4c. Add a case to the switch statement inside graphInterpreterWorkflow
case "slack_message": {
  const cfg = node.config as SlackMessageConfig;
  let resolvedWebhookUrl: string | undefined;
  if (cfg.credentialId) {
    const cred = await resolveCredentialActivity(cfg.credentialId);
    resolvedWebhookUrl = cred.webhookUrl;
  }
  nodeOutput = await sendSlackMessageActivity({
    config: cfg,
    context: nodeOutputs,
    resolvedWebhookUrl,
  });
  outgoingHandles = [""];
  break;
}
```

> **Important:** All I/O (HTTP calls, database, sleep) must happen inside **activities**, not directly in the workflow function. Temporal requires the workflow to be deterministic.

---

## Step 5 — Create the visual node component (frontend)

Create `apps/frontend/src/components/nodes/SlackNode.tsx`:

```tsx
import React from "react";
import type { NodeProps } from "@xyflow/react";
import type { WorkflowNode } from "@workflow/shared";
import { NodeWrapper } from "../canvas/NodeWrapper";

export function SlackNode({ id, data, selected }: NodeProps<WorkflowNode>): React.ReactElement {
  const cfg = data.config as { channel?: string };

  return (
    <NodeWrapper nodeId={id} data={data} selected={selected}>
      {cfg.channel && (
        <p className="text-[10px] text-slate-400 truncate">#{cfg.channel}</p>
      )}
    </NodeWrapper>
  );
}
```

`NodeWrapper` renders the node chrome (icon, label, delete button, status badge) — you only provide the inner content. It automatically gets:
- The icon from `nodeRegistry`
- Status highlight when the node is running/completed/failed
- A trash button to delete the node

---

## Step 6 — Register in nodeRegistry (frontend)

**File:** `apps/frontend/src/lib/nodeRegistry.ts`

```typescript
import type { SlackMessageConfig } from "@workflow/shared";

// Add to the registry object
slack_message: {
  category: "action",
  defaultLabel: "Slack Message",
  icon: "MessageSquare",   // any lucide-react icon name
  color: "bg-green-600",
  description: "Send a message to a Slack channel",
  defaultConfig: {
    channel: "#general",
    message: "Hello from the workflow!",
  } satisfies SlackMessageConfig,
},
```

The `icon` field maps to any icon name from [lucide.dev](https://lucide.dev/icons/).

---

## Step 7 — Create the properties form (frontend)

Create `apps/frontend/src/components/panels/forms/SlackForm.tsx`:

```tsx
import React from "react";
import type { SlackMessageConfig } from "@workflow/shared";
import { CredentialSelector } from "../CredentialSelector";

interface SlackFormProps {
  config: SlackMessageConfig;
  onChange: (patch: Partial<SlackMessageConfig>) => void;
}

const inputClass =
  "w-full px-3 py-1.5 text-sm bg-slate-800 border border-slate-600 rounded-md text-slate-200 placeholder-slate-500 focus:outline-none focus:border-indigo-500";

export function SlackForm({ config, onChange }: SlackFormProps): React.ReactElement {
  return (
    <div className="space-y-4">
      <CredentialSelector
        kinds={["generic"]}
        value={config.credentialId}
        onChange={(id) => onChange({ credentialId: id })}
        label="Slack Credential (optional)"
        placeholder="— Use inline webhook URL —"
      />

      {!config.credentialId && (
        <div>
          <label className="block text-xs font-medium text-slate-400 mb-1">Webhook URL</label>
          <input
            type="password"
            className={inputClass}
            value={config.webhookUrl ?? ""}
            onChange={(e) => onChange({ webhookUrl: e.target.value || undefined })}
            placeholder="https://hooks.slack.com/services/..."
          />
        </div>
      )}

      <div>
        <label className="block text-xs font-medium text-slate-400 mb-1">Channel</label>
        <input
          className={inputClass}
          value={config.channel}
          onChange={(e) => onChange({ channel: e.target.value })}
          placeholder="#general"
        />
      </div>

      <div>
        <label className="block text-xs font-medium text-slate-400 mb-1">Message</label>
        <textarea
          className={inputClass + " min-h-[80px] resize-y"}
          value={config.message}
          onChange={(e) => onChange({ message: e.target.value })}
          placeholder="Hello {{$.trigger.user}}!"
        />
        <p className="text-[10px] text-slate-500 mt-0.5">
          Use <code>{"{{$.nodeId.field}}"}</code> to reference outputs from previous nodes.
        </p>
      </div>
    </div>
  );
}
```

**Wire the form into PropertiesPanel** (`apps/frontend/src/components/panels/PropertiesPanel.tsx`):

```tsx
import { SlackForm } from "./forms/SlackForm";
// ...
case "slack_message":
  return <SlackForm config={node.config as SlackMessageConfig} onChange={onChange} />;
```

---

## Step 8 — Register the node component in WorkflowCanvas

**File:** `apps/frontend/src/components/canvas/WorkflowCanvas.tsx`

```tsx
import { SlackNode } from "../nodes/SlackNode";

const nodeTypes = {
  // ... existing ...
  slack_message: SlackNode,
};
```

---

## Checklist

| Step | File | What |
|------|------|------|
| 1 | `packages/shared/src/types/workflow.ts` | Add `NodeKind` + config interface |
| 2 | `apps/backend/src/services/WorkflowService.ts` | Add to `nodeKindSchema` |
| 3 | `apps/workers/src/activities/yourNode.ts` | Write the activity function |
| 4 | `apps/workers/src/activities/index.ts` | Export the activity |
| 5 | `apps/workers/src/workflows/GraphInterpreter.ts` | Proxy + switch case |
| 6 | `apps/frontend/src/components/nodes/YourNode.tsx` | Visual component |
| 7 | `apps/frontend/src/lib/nodeRegistry.ts` | Metadata + defaults |
| 8 | `apps/frontend/src/components/panels/forms/YourForm.tsx` | Config form |
| 9 | `apps/frontend/src/components/panels/PropertiesPanel.tsx` | Wire form |
| 10 | `apps/frontend/src/components/canvas/WorkflowCanvas.tsx` | Register nodeType |

---

## Template interpolation

All string fields in node configs support `{{$.nodeId.field}}` syntax. Use `interpolateTemplate` from `@workflow/shared` in your activity:

```typescript
import { interpolateTemplate } from "@workflow/shared";

const message = interpolateTemplate(config.message, context);
// context = { nodeId: { field: "value" }, ... }
```

The `context` parameter received by your activity is `nodeOutputs` — a map of each preceding node's output keyed by node ID.

---

## Credential kinds

When your node needs secrets, register a credential kind in `apps/backend/src/services/CredentialService.ts`:

```typescript
export const CREDENTIAL_KINDS = [
  // ... existing ...
  "slack_webhook",   // ← add here
] as const;
```

Add field definitions for the UI in `apps/frontend/src/pages/CredentialsPage.tsx`:

```typescript
const KIND_DEFS: Record<CredentialKind, ...> = {
  // ... existing ...
  slack_webhook: {
    label: "Slack Webhook",
    description: "Slack incoming webhook URL",
    fields: [
      { key: "webhookUrl", label: "Webhook URL", secret: true },
    ],
  },
};
```

Then resolve it in the GraphInterpreter:

```typescript
case "slack_message": {
  const cfg = node.config as SlackMessageConfig;
  const cred = cfg.credentialId
    ? await resolveCredentialActivity(cfg.credentialId)
    : {};
  nodeOutput = await sendSlackMessageActivity({
    config: cfg,
    context: nodeOutputs,
    resolvedWebhookUrl: cred.webhookUrl,
  });
  break;
}
```
