#!/usr/bin/env bash
# Stops the e2e backend and removes its containers, network and volumes. Only touches the
# compose project `twakemail-e2e`.
set -euo pipefail

E2E_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
docker compose -p twakemail-e2e -f "$E2E_DIR/docker/docker-compose.yaml" --profile oidc \
  down --volumes --remove-orphans
