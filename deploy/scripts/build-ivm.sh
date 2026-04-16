#!/bin/bash
# =============================================================================
# Build + push the prebuilt isolated-vm base image to the local registry.
#
# Referenced at build-time by deploy/dockerfiles/Dockerfile.workers via:
#   FROM localhost:5000/ivm-prebuilt:node24-ivm6.1.2 AS ivm
#
# Run this:
#   - Once on initial cluster setup
#   - After bumping Node major version (must match workers' runtime)
#   - After bumping isolated-vm version in apps/workers/package.json
#
# Usage:
#   bash deploy/scripts/build-ivm.sh
#   IVM_VERSION=6.1.3 NODE_MAJOR=24 bash deploy/scripts/build-ivm.sh
# =============================================================================
set -euo pipefail

REGISTRY="${REGISTRY:-localhost:5000}"
IVM_VERSION="${IVM_VERSION:-6.1.2}"
NODE_MAJOR="${NODE_MAJOR:-24}"

VERSIONED_TAG="${REGISTRY}/ivm-prebuilt:node${NODE_MAJOR}-ivm${IVM_VERSION}"
LATEST_TAG="${REGISTRY}/ivm-prebuilt:latest"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"

echo "=== ivm-prebuilt: building ==="
echo "  Node major:     ${NODE_MAJOR}"
echo "  isolated-vm:    ${IVM_VERSION}"
echo "  Registry:       ${REGISTRY}"
echo "  Versioned tag:  ${VERSIONED_TAG}"
echo ""

cd "${REPO_ROOT}"

docker build \
  --build-arg IVM_VERSION="${IVM_VERSION}" \
  -t "${VERSIONED_TAG}" \
  -t "${LATEST_TAG}" \
  -f deploy/dockerfiles/Dockerfile.ivm-builder \
  .

echo ""
echo "=== ivm-prebuilt: pushing ==="
docker push "${VERSIONED_TAG}"
docker push "${LATEST_TAG}"

echo ""
echo "=== Done ==="
echo "Dockerfile.workers references this as:"
echo "  FROM ${VERSIONED_TAG} AS ivm"
