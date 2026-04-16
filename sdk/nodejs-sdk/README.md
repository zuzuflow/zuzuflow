# @zuzuflow/nodejs-sdk

Node.js SDK for the [ZuzuFlow](https://zuzuflow.com) API — create and run
workflows, manage tags and folders, and subscribe to live trigger events over
WebSocket.

## Install

```bash
npm install @zuzuflow/nodejs-sdk
# or
pnpm add @zuzuflow/nodejs-sdk
```

## Quick start

```ts
import { ZuzuFlow } from "@zuzuflow/nodejs-sdk";

const client = new ZuzuFlow({
  baseUrl: "https://app.zuzuflow.com",
  envSlug: "production",
  token: process.env.ZUZUFLOW_API_TOKEN!,
});

// List workflows
const workflows = await client.workflows.list({ limit: 20 });

// Run a workflow
const execution = await client.executions.create({
  workflowId: workflows.items[0].id,
  input: { hello: "world" },
});

// Stream trigger events
const stream = client.triggers.stream();
for await (const event of stream) {
  console.log(event);
}
```

## Requirements

- Node.js 18+
- A ZuzuFlow API token (generate one in your environment settings)

## License

MIT
