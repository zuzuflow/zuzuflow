# ZuzuFlow Helm chart

Deploys ZuzuFlow to Kubernetes in one command. Embedded Postgres + Temporal by
default; switch to external managed services via values.

## Install

```bash
helm install zuzuflow oci://ghcr.io/zuzuflow/charts/zuzuflow \
  --version 0.1.0 \
  --create-namespace -n zuzuflow
```

First install auto-generates every secret (JWT, encryption keys, admin
password). Retrieve the admin password from the notes the installer prints,
or:

```bash
kubectl get secret zuzuflow-secrets -n zuzuflow \
  -o jsonpath='{.data.INITIAL_ADMIN_PASSWORD}' | base64 -d && echo
```

## Production install (Ingress + TLS)

```bash
helm install zuzuflow oci://ghcr.io/zuzuflow/charts/zuzuflow \
  --version 0.1.0 --create-namespace -n zuzuflow \
  --set appUrl=https://zuzuflow.example.com \
  --set ingress.enabled=true \
  --set ingress.host=zuzuflow.example.com \
  --set ingress.tls.enabled=true \
  --set ingress.annotations."cert-manager\.io/cluster-issuer"=letsencrypt-prod
```

Assumes [cert-manager](https://cert-manager.io/) + an `nginx` ingress class.
Swap `ingress.className` if you run traefik / etc.

## Bring your own Postgres / Temporal

```bash
helm install zuzuflow oci://ghcr.io/zuzuflow/charts/zuzuflow -n zuzuflow \
  --set postgres.enabled=false \
  --set externalDatabase.url='postgresql://user:pw@my-pg.example.com:5432/zuzuflow' \
  --set temporal.enabled=false \
  --set externalTemporal.address='temporal.example.com:7233'
```

The chart skips the bundled Postgres StatefulSet + Temporal Deployment and
wires the app to your external services via the generated Secret.

## Key values

| Key | Default | Purpose |
|---|---|---|
| `image.org` | `zuzuflow` | GHCR namespace for `ghcr.io/${org}/workflow-*` |
| `image.version` | `latest` | Image tag — pin this in production |
| `appUrl` | `http://localhost` | Public URL, used in email links + CORS |
| `postgres.enabled` | `true` | Embed Postgres StatefulSet |
| `postgres.persistence.size` | `10Gi` | PVC size for data |
| `temporal.enabled` | `true` | Embed Temporal Deployment |
| `temporalUi.enabled` | `false` | Embed Temporal UI (admin-only) |
| `backend.replicas` | `2` | Horizontal scale |
| `workers.replicas` | `1` | Bump for heavier workloads |
| `frontend.replicas` | `2` | SPA replicas |
| `ingress.enabled` | `false` | Single-host routing (see template) |
| `signupEnabled` | `true` | Allow self-serve signups |
| `secrets.*` | `""` | Blank → auto-generated on first install |

Full reference: [`values.yaml`](values.yaml).

## Upgrade

```bash
helm upgrade zuzuflow oci://ghcr.io/zuzuflow/charts/zuzuflow \
  --version <new-version> -n zuzuflow --reuse-values
```

Secrets, the DB, and PVCs are preserved. A pre-upgrade Helm hook runs
`prisma migrate deploy` automatically before the Deployments roll.

## Uninstall

```bash
helm uninstall zuzuflow -n zuzuflow
# PVCs are NOT removed automatically — remove them to wipe data:
kubectl delete pvc --all -n zuzuflow
```

## Chart structure

See [`templates/`](templates/). Each file is a single Kubernetes resource
or tight group; `_helpers.tpl` holds naming + image + DSN helpers shared
across them.
