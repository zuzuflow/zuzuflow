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
- **110+ built-in nodes.** First-class natives across every major category — HTTP, all four hyperscalers (AWS, Azure, GCP, Oracle Cloud), the top SaaS (Stripe, GitHub, Salesforce, HubSpot, Notion, Slack, Discord, MS Teams, Jira, Linear, Telegram, WhatsApp, Shopify, PayPal, Square, Mailchimp, SendGrid, Resend, PagerDuty, Datadog, Sentry, Dropbox, OneDrive, Box, Google Drive, Airtable, Pipedrive, CircleCI, GitLab, Customer.io …), streaming + analytics (Kafka, NATS, Snowflake, ClickHouse, Elasticsearch), the AI ecosystem (DALL·E + Stable Diffusion, Whisper + AssemblyAI, OpenAI TTS + ElevenLabs, embeddings, Pinecone/Weaviate/Qdrant) — plus an in-app **Custom Node Builder** for the long tail (sandboxed TypeScript or parameterised HTTP, AI-assisted drafting, cross-environment git sync). See [docs/CUSTOM_NODES.md](./docs/CUSTOM_NODES.md).

---

## What it looks like

| Capability | Details |
|---|---|
| **Visual canvas** | Drag-and-drop nodes, live theming, BPMN-inspired light mode, multi-select + grouping with lockable containers ([docs/CANVAS.md](./docs/CANVAS.md)) |
| **Triggers** | Webhooks, schedules (cron), Immediate trigger with typed static payload, external SDK calls |
| **Subworkflows** | Reusable canvases called from other workflows, with typed I/O |
| **Credentials vault** | AES-256-GCM encrypted, per-environment scoping |
| **Variables** | Plain and secret — referenced in any node via `{{ vars.name }}` |
| **Template interpolation** | Jinja-like `{{ }}` everywhere, with full access to prior node outputs |
| **Node.js SDK** | `@zuzuflow/nodejs-sdk` — trigger workflows, manage resources, stream events |
| **React SDK** | `@zuzuflow/react-sdk` — embed the editor or the full product |

---

## Get started

### Option 1 — Docker (fastest, single-node self-host) ⚡

```bash
git clone <repo-url> zuzuflow && cd zuzuflow
bash install.sh
```

Done. `install.sh` generates random secrets, pulls the published images from
GHCR, brings up Postgres + Temporal + the three app services, runs migrations,
and prints the URL + initial admin password.

Open **http://localhost:3000** to start building.

Details:
- **Images:** pre-built at `ghcr.io/zuzuflow/workflow-{backend,frontend,workers}`
- **Config:** single [`.env.production.example`](./.env.production.example) → copy to `.env`
- **HTTPS:** bring your own reverse proxy (nginx, Caddy, Cloudflare Tunnel) in front; backend binds to 127.0.0.1:3001, frontend to 0.0.0.0:3000
- **Upgrade:** `docker compose -f docker-compose.prod.yml pull && docker compose -f docker-compose.prod.yml up -d`
- **External Postgres/Temporal:** set `DATABASE_URL` and `TEMPORAL_ADDRESS` in `.env`, then `docker compose -f docker-compose.prod.yml up -d migrate backend workers frontend` (omits the bundled services)

### Option 2 — Kubernetes via Helm (production)

```bash
helm install zuzuflow oci://ghcr.io/zuzuflow/charts/zuzuflow \
  --version 0.1.0 \
  --create-namespace -n zuzuflow \
  --set appUrl=https://zuzuflow.example.com \
  --set ingress.enabled=true \
  --set ingress.host=zuzuflow.example.com \
  --set ingress.tls.enabled=true \
  --set ingress.annotations."cert-manager\.io/cluster-issuer"=letsencrypt-prod
```

One command installs Postgres (StatefulSet + PVC), Temporal, Prisma migrations
(pre-install hook), and the three app services with an Ingress. Every secret
is auto-generated on first install and preserved across upgrades.

Details + `values.yaml` reference: [`charts/zuzuflow/README.md`](./charts/zuzuflow/README.md).

### Option 3 — Run from source (hacking on the code)

```bash
git clone <repo-url> zuzuflow && cd zuzuflow
pnpm install
cp .env.example .env          # local-dev config — edit as needed
docker compose up -d          # Postgres + Temporal + Redis
pnpm --filter backend exec prisma migrate dev --schema=src/db/prisma/schema.prisma
pnpm dev                      # backend + workers + frontend (hot-reload)
```

Open **http://localhost:3000**. Use this path if you want to modify ZuzuFlow
itself.

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
