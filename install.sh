#!/usr/bin/env bash
#
# ZuzuFlow — one-command self-host bootstrapper.
#
# Generates .env with random secrets (idempotent — won't clobber an existing
# .env), runs docker compose with docker-compose.prod.yml, then prints the URL
# and initial admin credentials.
#
# Usage:
#   bash install.sh
#
# Flags:
#   --pull          Always pull the newest images even if already present.
#   --reset         Destroy existing .env + all data volumes. (DANGEROUS.)
#
set -euo pipefail

COMPOSE_FILE="docker-compose.prod.yml"
ENV_FILE=".env"
ENV_TEMPLATE=".env.production.example"

PULL=false
RESET=false
for arg in "$@"; do
  case "$arg" in
    --pull)  PULL=true ;;
    --reset) RESET=true ;;
    *) echo "Unknown flag: $arg" >&2; exit 1 ;;
  esac
done

bold()  { printf '\033[1m%s\033[0m\n' "$*"; }
green() { printf '\033[32m%s\033[0m\n' "$*"; }
red()   { printf '\033[31m%s\033[0m\n' "$*" >&2; }

# ── Preflight ──────────────────────────────────────────────────────────────
if ! command -v docker >/dev/null 2>&1; then
  red "Docker is not installed. Install it from https://docs.docker.com/engine/install/"
  exit 1
fi
if ! docker compose version >/dev/null 2>&1; then
  red "Docker Compose v2 is required. Install: https://docs.docker.com/compose/install/"
  exit 1
fi
if ! command -v openssl >/dev/null 2>&1; then
  red "openssl is required to generate secrets. Install with your OS package manager."
  exit 1
fi
if [ ! -f "$COMPOSE_FILE" ]; then
  red "Can't find $COMPOSE_FILE in the current directory."
  red "Run install.sh from the repo root (where $COMPOSE_FILE lives)."
  exit 1
fi
if [ ! -f "$ENV_TEMPLATE" ]; then
  red "Can't find $ENV_TEMPLATE in the current directory."
  exit 1
fi

# ── Reset (destructive — ask twice) ────────────────────────────────────────
if [ "$RESET" = true ]; then
  bold "This will DELETE your .env and all Docker volumes (postgres data, git state)."
  read -r -p "Are you sure? Type 'yes' to continue: " confirm
  if [ "$confirm" != "yes" ]; then
    echo "Aborted."; exit 0
  fi
  docker compose -f "$COMPOSE_FILE" down -v || true
  rm -f "$ENV_FILE"
  echo "Reset done."
fi

# ── Generate .env if missing ───────────────────────────────────────────────
INITIAL_ADMIN_PW=""
if [ ! -f "$ENV_FILE" ]; then
  bold "Generating $ENV_FILE with fresh random secrets..."
  cp "$ENV_TEMPLATE" "$ENV_FILE"

  JWT_SECRET=$(openssl rand -hex 32)
  API_TOKEN=$(openssl rand -hex 32)
  ENCRYPTION_KEY=$(openssl rand -hex 32)
  MFA_ENCRYPTION_KEY=$(openssl rand -hex 32)
  WEBHOOK_SECRET=$(openssl rand -hex 32)
  POSTGRES_PASSWORD=$(openssl rand -hex 16)
  INITIAL_ADMIN_PW=$(openssl rand -hex 12)

  # macOS sed and GNU sed differ on -i; use a portable form
  portable_sed() {
    if sed --version >/dev/null 2>&1; then
      sed -i "$@"            # GNU
    else
      sed -i '' "$@"         # BSD / macOS
    fi
  }

  portable_sed "s|^JWT_SECRET=.*|JWT_SECRET=${JWT_SECRET}|" "$ENV_FILE"
  portable_sed "s|^API_TOKEN=.*|API_TOKEN=${API_TOKEN}|" "$ENV_FILE"
  portable_sed "s|^ENCRYPTION_KEY=.*|ENCRYPTION_KEY=${ENCRYPTION_KEY}|" "$ENV_FILE"
  portable_sed "s|^MFA_ENCRYPTION_KEY=.*|MFA_ENCRYPTION_KEY=${MFA_ENCRYPTION_KEY}|" "$ENV_FILE"
  portable_sed "s|^WEBHOOK_SECRET=.*|WEBHOOK_SECRET=${WEBHOOK_SECRET}|" "$ENV_FILE"
  portable_sed "s|^POSTGRES_PASSWORD=.*|POSTGRES_PASSWORD=${POSTGRES_PASSWORD}|" "$ENV_FILE"
  portable_sed "s|^INITIAL_ADMIN_PASSWORD=.*|INITIAL_ADMIN_PASSWORD=${INITIAL_ADMIN_PW}|" "$ENV_FILE"

  green "Secrets generated. Edit $ENV_FILE to customize (image source, domain, SMTP)."
else
  bold "$ENV_FILE already exists — using existing values."
fi

# ── Pull latest images ─────────────────────────────────────────────────────
if [ "$PULL" = true ]; then
  bold "Pulling latest images..."
  docker compose -f "$COMPOSE_FILE" pull
fi

# ── Bring up the stack ─────────────────────────────────────────────────────
bold "Starting ZuzuFlow..."
docker compose -f "$COMPOSE_FILE" up -d

# ── Wait for backend to be healthy ─────────────────────────────────────────
BACKEND_PORT=$(grep -E "^BACKEND_PORT=" "$ENV_FILE" | cut -d= -f2 || echo 3001)
FRONTEND_PORT=$(grep -E "^FRONTEND_PORT=" "$ENV_FILE" | cut -d= -f2 || echo 3000)
APP_URL=$(grep -E "^APP_URL=" "$ENV_FILE" | cut -d= -f2 || echo "http://localhost:${FRONTEND_PORT}")

echo
bold "Waiting for backend to become healthy (up to 2 minutes)..."
for _ in $(seq 1 60); do
  if curl -sfo /dev/null "http://localhost:${BACKEND_PORT}/health"; then
    green "  ✔ Backend is up."
    break
  fi
  sleep 2
done

# ── Summary ────────────────────────────────────────────────────────────────
echo
green "────────────────────────────────────────────────────────────"
green "  ZuzuFlow is up"
green "────────────────────────────────────────────────────────────"
echo
echo "  Open the app:   ${APP_URL}"
echo "  (or locally:    http://localhost:${FRONTEND_PORT})"
echo
if [ -n "$INITIAL_ADMIN_PW" ]; then
  ADMIN_USER=$(grep -E "^INITIAL_ADMIN_USERNAME=" "$ENV_FILE" | cut -d= -f2 || echo admin)
  echo "  Initial admin login:"
  echo "    username:  ${ADMIN_USER}"
  echo "    password:  ${INITIAL_ADMIN_PW}"
  echo
  red   "  ⚠ Save this password now — it won't be shown again."
  echo
fi
echo "  Stop:   docker compose -f ${COMPOSE_FILE} down"
echo "  Logs:   docker compose -f ${COMPOSE_FILE} logs -f"
echo "  Update: docker compose -f ${COMPOSE_FILE} pull && docker compose -f ${COMPOSE_FILE} up -d"
echo
