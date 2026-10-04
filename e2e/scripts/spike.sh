#!/usr/bin/env bash
# The composer spike runs on the e2e stack (compose project `twakemail-e2e`, 127.0.0.1:18300-18302)
# with the spike overlay: DEBUG on (route /spike/composer) and tmail-web on 127.0.0.1:18503. Never
# run the spike specs without it, and stop it before running the e2e suite.
#
#   ./scripts/spike.sh start        backend + the app of ../apps/private/dist (npm run build) + tmail-web
#   ./scripts/spike.sh test [args]  npx playwright test spike/, against this stack
#   ./scripts/spike.sh stop
set -euo pipefail

E2E_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

export E2E_APP_ENV="$E2E_DIR/docker/spike/app-env.js"
export E2E_COMPOSE_EXTRA="$E2E_DIR/docker/docker-compose.spike.yaml"

case "${1:-}" in
  start)
    E2E_APP_DIR="${E2E_APP_DIR:-$E2E_DIR/../apps/private/dist}" "$E2E_DIR/scripts/start.sh"
    echo "  tmail-web (Flutter)  http://127.0.0.1:18503"
    ;;
  test) shift; cd "$E2E_DIR" && npx playwright test --config playwright.spike.config.ts "$@" ;;
  stop) "$E2E_DIR/scripts/stop.sh" ;;
  *) sed -n '2,9p' "$0"; exit 1 ;;
esac
