# ZuzuFlow

**Visual workflow automation that teams actually want to use.**

ZuzuFlow is an open-source workflow automation platform — an alternative to n8n, Make.com, and Zapier — that lets non-engineers build durable, production-grade automations with a drag-and-drop canvas, while giving engineers a real SDK, a real API, and the ability to self-host on their own infrastructure.

Built on React, Temporal, and PostgreSQL. MIT licensed.

---

## Why ZuzuFlow

- **Durable by default.** Workflows survive crashes, restarts, and 30-day sleeps. Powered by Temporal — no custom retry logic, no orphaned runs.
- **Truly embeddable.** Ship the full editor inside your own product with `@zuzuflow/react-sdk`. One component, your auth, your domain.
- **Self-hostable.** Docker Compose for local, Kubernetes manifests for production. No cloud lock-in, no per-execution metering.
- **Developer-first.** TypeScript SDK, REST API, webhooks, and an External Trigger node for calling workflows from your own code.
- **Observable.** Every execution is inspectable in the Temporal UI — per-node logs, timings, retries, payloads.
- **Extensible.** 50+ built-in nodes (HTTP, databases, AWS, Slack, email, AI, …) plus a clear path to build your own.

---

## What it looks like

| Capability | Details |
|---|---|
| **Visual canvas** | Drag-and-drop nodes, live theming, BPMN-inspired light mode |
| **Triggers** | Webhooks, schedules (cron), manual runs, external SDK calls |
| **Subworkflows** | Reusable canvases called from other workflows, with typed I/O |
| **Credentials vault** | AES-256-GCM encrypted, per-environment scoping |
| **Variables** | Plain and secret — referenced in any node via `{{ vars.name }}` |
| **Template interpolation** | Jinja-like `{{ }}` everywhere, with full access to prior node outputs |
| **Node.js SDK** | `@zuzuflow/nodejs-sdk` — trigger workflows, manage resources, stream events |
| **React SDK** | `@zuzuflow/react-sdk` — embed the editor or the full product |

---

## Get started

### Try it locally (5 minutes)

```bash
git clone <repo-url>
cd workflow-ui
pnpm install
docker compose up -d          # Postgres + Temporal + Redis
pnpm --filter backend exec npx prisma migrate dev --schema=src/db/prisma/schema.prisma
pnpm dev                      # backend + workers + frontend
```

Open **http://localhost:3000** to start building.

### Deploy to production

Kubernetes manifests, Dockerfiles, Jenkins pipeline, and a one-shot server bootstrap script are included under [`deploy/`](./deploy/). See the **Developer Docs** for the full deployment walkthrough.

---

## Documentation

| Resource | Link |
|---|---|
| **Developer Docs** | [`apps/website → /developers`](./apps/website/src/pages/resources/DevelopersPage.tsx) — SDKs, API, webhooks, self-hosting, Kubernetes |
| **API Reference** | [`docs/openapi.yaml`](./docs/openapi.yaml) |
| **Custom Nodes** | [`docs/CUSTOM_NODES.md`](./docs/CUSTOM_NODES.md) |
| **Website** | [`apps/website`](./apps/website) — marketing site, also renders the Developer Docs |

For product-level documentation (how a non-developer uses the editor, node reference, etc.), run the website locally:

```bash
pnpm --filter website dev
```

---

## Project layout

```
workflow-ui/
├── apps/
│   ├── backend/          Express API + WebSocket gateway
│   ├── frontend/         React + xyflow editor UI
│   ├── website/          Marketing + developer documentation site
│   └── workers/          Temporal worker + node activities
├── sdk/
│   ├── nodejs-sdk/       @zuzuflow/nodejs-sdk — REST + WS client
│   └── react-sdk/        @zuzuflow/react-sdk  — embeddable UI
├── packages/
│   └── shared/           Shared TypeScript types
├── deploy/
│   ├── dockerfiles/      Per-app Dockerfiles (+ ivm-builder)
│   ├── k8s/              Kubernetes manifests
│   ├── jenkins/          CI/CD pipeline
│   ├── nginx/            Reverse proxy config
│   └── scripts/          setup-server.sh, build-ivm.sh
└── docs/
```

---

## Contributing

Contributions are welcome. See [`apps/website → /contributing`](./apps/website/src/pages/opensource/ContributingPage.tsx) for the contributor guide, code of conduct, and the list of help-wanted issues.

---

## License

MIT © ZuzuFlow — see [`apps/website → /license`](./apps/website/src/pages/opensource/LicensePage.tsx).
