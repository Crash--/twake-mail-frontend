#!/usr/bin/env bash
# Stops the e2e backend and removes its containers, network and volumes. Only touches the
# compose project `${E2E_PROJECT:-twakemail-e2e}`.
set -euo pipefail

E2E_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
files=(-f "$E2E_DIR/docker/docker-compose.yaml")
[[ -n "${E2E_COMPOSE_EXTRA:-}" ]] && files+=(-f "$E2E_COMPOSE_EXTRA")
docker compose -p "${E2E_PROJECT:-twakemail-e2e}" "${files[@]}" --profile oidc \
  down --volumes --remove-orphans
