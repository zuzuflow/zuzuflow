#!/bin/bash
# =============================================================================
# ZuzuFlow — Pre-build isolated-vm on the host server  [LEGACY / DEPRECATED]
#
# ┌─────────────────────────────────────────────────────────────────────────┐
# │  DEPRECATED — use deploy/scripts/build-ivm.sh instead.                  │
# │                                                                         │
# │  isolated-vm is now baked into the workers image at build time via a    │
# │  prebuilt base image (localhost:5000/ivm-prebuilt). That avoids the     │
# │  hostPath volume and its node-rotation failure mode. See:               │
# │    - deploy/dockerfiles/Dockerfile.ivm-builder                          │
# │    - deploy/scripts/build-ivm.sh                                        │
# │    - deploy/dockerfiles/Dockerfile.workers (COPY --from=ivm ...)        │
# │                                                                         │
# │  This script is kept only as a fallback for debugging on a host that    │
# │  can't run the prebuilt image. Pods no longer mount /opt/ivm-prebuilt.  │
# └─────────────────────────────────────────────────────────────────────────┘
#
# Original behavior (for reference):
#   Compiles isolated-vm on the host where full RAM is available, intended
#   to be hostPath-mounted into worker pods at /opt/ivm/node_modules.
#
# IMPORTANT: The host's Node.js major version MUST match the container's
# (currently Node 24). If you upgrade Node.js, re-run this script.
#
# Usage: sudo bash deploy/scripts/setup-ivm.sh
# =============================================================================
set -e

IVM_DIR="/opt/ivm-prebuilt"
IVM_VERSION="6.1.2"

echo "=== ZuzuFlow: Building isolated-vm v${IVM_VERSION} ==="
echo "Target directory: ${IVM_DIR}"
echo "Node version: $(node --version)"
echo ""

# Ensure build tools are present
echo "--- Installing build dependencies ---"
apt-get update -qq
apt-get install -y -qq python3 make g++ > /dev/null 2>&1 || true

# Create isolated build directory
mkdir -p "${IVM_DIR}"
cd "${IVM_DIR}"

# Initialize a minimal package.json if not present
if [ ! -f package.json ]; then
  npm init -y > /dev/null 2>&1
fi

# Compile isolated-vm with limited parallelism (JOBS=2) to prevent OOM
echo "--- Compiling isolated-vm (this may take a few minutes) ---"
JOBS=2 npm install "isolated-vm@${IVM_VERSION}" 2>&1

# Verify the binary loads correctly
echo ""
echo "--- Verifying installation ---"
node -e "
  const ivm = require('${IVM_DIR}/node_modules/isolated-vm');
  const isolate = new ivm.Isolate({ memoryLimit: 8 });
  const ctx = isolate.createContextSync();
  const result = ctx.evalSync('1 + 1');
  isolate.dispose();
  console.log('isolated-vm OK — test eval returned:', result);
"

echo ""
echo "=== Done! ==="
echo "The workers k8s deployment will mount ${IVM_DIR}/node_modules"
echo "into the container at /opt/ivm/node_modules via hostPath volume."
echo ""
echo "Next steps:"
echo "  kubectl apply -f deploy/k8s/workers.yaml"
echo "  kubectl rollout restart deployment/workers -n workflow"
