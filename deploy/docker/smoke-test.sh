#!/usr/bin/env bash
# Smoke test of the Docker image, run by the CI before publishing it:
#
#   deploy/docker/smoke-test.sh twake-mail-frontend:latest
#
# Starts the image as in production (user 101, read-only root filesystem, /tmp as a tmpfs,
# no capability, a runtime configuration mounted) on a free port of 127.0.0.1 and checks
# what it serves: health endpoint, SPA fallback, cache policy, security headers, Docker
# healthcheck. Removes the container afterwards.
set -euo pipefail

IMAGE="${1:?usage: $0 <image>}"
NAME="twake-mail-smoke-$$"
CONFIG_DIR="$(mktemp -d)"
trap 'docker rm -f "$NAME" >/dev/null 2>&1 || true; rm -rf "$CONFIG_DIR"' EXIT

cat >"$CONFIG_DIR/.env.js" <<'EOF'
var JMAP_SESSION_URL = 'https://jmap.example.com/jmap/session'
var AUTH_MODE = 'basic'
EOF
echo 'var appList = []' >"$CONFIG_DIR/appList.js"
chmod 644 "$CONFIG_DIR"/*.js

docker run -d --name "$NAME" \
  --read-only --tmpfs /tmp --user 101 --cap-drop ALL --security-opt no-new-privileges \
  -p 127.0.0.1::8080 \
  -v "$CONFIG_DIR/.env.js:/usr/share/nginx/html/.env.js:ro" \
  -v "$CONFIG_DIR/appList.js:/usr/share/nginx/html/appList.js:ro" \
  -e CSP_CONNECT_SRC='https://jmap.example.com wss://jmap.example.com' \
  -e CSP_FRAME_ANCESTORS="'self' https://workplace.example.com" \
  "$IMAGE" >/dev/null
BASE="http://$(docker port "$NAME" 8080/tcp | head -1)"

failures=0
# expect <description> <value> <glob pattern>
expect() {
  # shellcheck disable=SC2053 # $3 is a pattern
  if [[ "$2" == $3 ]]; then
    echo "ok   $1"
  else
    echo "FAIL $1: got '$2'"
    failures=$((failures + 1))
  fi
}
body() { curl -fsS "$@" 2>&1 || true; }
# header <path> <name> [curl options]: the value of a response header
header() {
  local path=$1 name=$2
  shift 2
  curl -fsS -o /dev/null -D - "$@" "$BASE$path" | tr -d '\r' |
    awk -v name="${name,,}" 'tolower($0) ~ "^" name ": " { sub(/^[^:]*: /, ""); print }'
}

for _ in $(seq 1 30); do
  curl -fsS -o /dev/null "$BASE/healthz" 2>/dev/null && break
  sleep 1
done

expect '/healthz answers ok' "$(body "$BASE/healthz")" 'ok'
expect 'nginx master runs as uid 101' \
  "$(docker exec "$NAME" sh -c 'stat -c %u /proc/1')" '101'
expect '/ serves index.html' "$(body "$BASE/")" '*<div id="root"*'
expect 'unknown routes fall back to index.html' "$(body "$BASE/mailbox/inbox")" '*<div id="root"*'
expect 'index.html is never cached' "$(header / Cache-Control)" 'no-store*'
expect '/.env.js is the mounted one' "$(body "$BASE/.env.js")" '*jmap.example.com*'
expect '/.env.js is never cached' "$(header /.env.js Cache-Control)" 'no-store*'
expect '/version.js is written by the build' "$(body "$BASE/version.js")" 'var APP_VERSION = *'
script="$(body "$BASE/" | grep -o 'src="/static/js/index[^"]*"' | head -1 | cut -d'"' -f2)"
expect 'hashed assets are cached for a year' "$(header "$script" Cache-Control)" '*immutable*'
expect 'assets are served pre-compressed' \
  "$(header "$script" Content-Encoding -H 'Accept-Encoding: gzip')" 'gzip'
csp="$(header / Content-Security-Policy)"
expect 'Content-Security-Policy sent' "$csp" "default-src 'self';*"
expect 'CSP: inline script allowed by its hash' "$csp" "*script-src 'self' 'sha256-*"
expect 'CSP: CSP_CONNECT_SRC appended' "$csp" '*connect-src *wss://jmap.example.com;*'
expect 'CSP: CSP_FRAME_ANCESTORS used' "$csp" "*frame-ancestors 'self' https://workplace.example.com;*"
expect 'CSP on the SPA fallback too' "$(header /mailbox/inbox Content-Security-Policy)" "$csp"
expect 'X-Content-Type-Options' "$(header / X-Content-Type-Options)" 'nosniff'
expect 'Referrer-Policy' "$(header / Referrer-Policy)" 'same-origin'
expect 'Permissions-Policy' "$(header / Permissions-Policy)" '*camera=()*'
expect 'no nginx version disclosed' "$(header / Server)" 'nginx'

echo -n "waiting for the Docker healthcheck"
health=starting
for _ in $(seq 1 45); do
  health="$(docker inspect -f '{{.State.Health.Status}}' "$NAME")"
  [[ "$health" != starting ]] && break
  echo -n .
  sleep 2
done
echo
expect 'Docker healthcheck' "$health" 'healthy'

if ((failures > 0)); then
  echo "$failures check(s) failed; container logs:"
  docker logs "$NAME" 2>&1 | tail -40
  exit 1
fi
echo "all checks passed"
