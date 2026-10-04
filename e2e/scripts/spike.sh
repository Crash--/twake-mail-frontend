#!/usr/bin/env bash
# The composer spike stack: compose project `twakemail-spike` on 127.0.0.1:18500-18503,
# side by side with the e2e one (18300-18302). Never run the spike specs without it: the
# Playwright defaults point at the e2e stack.
#
#   ./scripts/spike.sh start        backend + the app of /tmp/twakemail-spike-app + tmail-web
#   ./scripts/spike.sh sync-app     copy ../apps/private/dist to the served directory
#   ./scripts/spike.sh test [args]  npx playwright test tests/spike, against this stack
#   ./scripts/spike.sh stop
set -euo pipefail

E2E_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
APP_DIR=/tmp/twakemail-spike-app

export E2E_PROJECT=twakemail-spike
export E2E_JMAP_PORT=18500 E2E_WEBADMIN_PORT=18501 E2E_APP_PORT=18502
export E2E_APP_ENV="$E2E_DIR/docker/spike/app-env.js"
export E2E_COMPOSE_EXTRA="$E2E_DIR/docker/docker-compose.spike.yaml"
export E2E_BASE_URL=http://127.0.0.1:18502
export E2E_JMAP_URL=http://127.0.0.1:18500
export E2E_WEBADMIN_URL=http://127.0.0.1:18501

sync_app() {
  mkdir -p "$APP_DIR"
  rsync -a --delete "$E2E_DIR/../apps/private/dist/" "$APP_DIR/"
}

case "${1:-}" in
  start)
    [[ -f "$APP_DIR/index.html" ]] || sync_app
    E2E_APP_DIR="$APP_DIR" "$E2E_DIR/scripts/start.sh"
    echo "  tmail-web (Flutter)  http://127.0.0.1:18503"
    ;;
  sync-app) sync_app ;;
  test) shift; cd "$E2E_DIR" && npx playwright test --config playwright.spike.config.ts "$@" ;;
  stop) "$E2E_DIR/scripts/stop.sh" ;;
  *) sed -n '2,10p' "$0"; exit 1 ;;
esac
