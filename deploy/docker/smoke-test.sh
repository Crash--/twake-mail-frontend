#!/usr/bin/env bash
# Smoke test of the Docker image, run by the CI before publishing it:
#
#   deploy/docker/smoke-test.sh twake-mail-frontend:latest
#
# Starts the image as in production (user 101, read-only root filesystem, /tmp as a tmpfs,
# no capability, a runtime configuration mounted) on a free port of 127.0.0.1 and checks
# what it serves: health endpoint, SPA fallback, cache policy, security headers, Docker
# healthcheck. Then starts it as the linagora/tmail-frontend Helm chart does (port 80,
# env.file and app_dashboard.json mounted at the paths of the chart, a WebFinger stub as
# SERVER_URL) in the security contexts a cluster may impose. Removes the containers
# afterwards.
set -euo pipefail

IMAGE="${1:?usage: $0 <image>}"
NAME="twake-mail-smoke-$$"
ENV_FILE_NAME="twake-mail-smoke-envfile-$$"
CHART_NAME="twake-mail-smoke-chart-$$"
HARDENED_NAME="twake-mail-smoke-hardened-$$"
BLOCKED_NAME="twake-mail-smoke-blocked-$$"
CONFIG_DIR="$(mktemp -d)"
NETWORK="twake-mail-smoke-net-$$"
STUB_NAME="twake-mail-smoke-stub-$$"
cleanup() {
  docker rm -f "$NAME" "$ENV_FILE_NAME" "$CHART_NAME" "$HARDENED_NAME" "$BLOCKED_NAME" "$STUB_NAME" >/dev/null 2>&1 || true
  docker network rm "$NETWORK" >/dev/null 2>&1 || true
  rm -rf "$CONFIG_DIR"
}
trap cleanup EXIT

cat >"$CONFIG_DIR/.env.js" <<'EOF'
var SERVER_URL = 'https://jmap.example.com'
var AUTH_MODE = 'basic'
var SENTRY_ENABLED = 'true'
var SENTRY_DSN = 'https://publickey@sentry.example.com/42'
var SENTRY_ENVIRONMENT = 'smoke'
var SENTRY_FEEDBACK_ENABLED = 'true'
EOF
echo 'var appList = []' >"$CONFIG_DIR/appList.js"
chmod 644 "$CONFIG_DIR"/*.js

docker run -d --name "$NAME" \
  --read-only --tmpfs /tmp --user 101 --cap-drop ALL --security-opt no-new-privileges \
  -p 127.0.0.1::8080 -e LISTEN_PORT=8080 \
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
  local path=$1 name=$2 base=$BASE
  shift 2
  # an optional third argument starting with http: the base URL
  if [[ "${1:-}" == http* ]]; then
    base=$1
    shift
  fi
  curl -fsS -o /dev/null -D - "$@" "$base$path" | tr -d '\r' |
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
worker="$(docker exec "$NAME" sh -c 'cd /usr/share/nginx/html && ls static/assets/pdf.worker*.mjs | head -1')"
expect 'the PDF worker is served as JavaScript' \
  "$(header "/$worker" Content-Type)" 'text/javascript*'
expect 'the PDF worker is cached like the other assets' \
  "$(header "/$worker" Cache-Control)" '*immutable*'
expect 'the PDF worker carries the CSP (a worker takes its own)' \
  "$(header "/$worker" Content-Security-Policy)" "default-src 'self';*"
expect 'the PDF worker carries nosniff' "$(header "/$worker" X-Content-Type-Options)" 'nosniff'
expect 'the PDF worker carries the Referrer-Policy' "$(header "/$worker" Referrer-Policy)" 'same-origin'
expect 'assets are served pre-compressed' \
  "$(header "$script" Content-Encoding -H 'Accept-Encoding: gzip')" 'gzip'
csp="$(header / Content-Security-Policy)"
expect 'Content-Security-Policy sent' "$csp" "default-src 'self';*"
expect 'CSP: inline script allowed by its hash' "$csp" "*script-src 'self' 'sha256-*"
expect 'CSP: CSP_CONNECT_SRC appended' "$csp" '*connect-src *wss://jmap.example.com *;*'
expect 'CSP: the Sentry ingest origin of the DSN allowed' "$csp" \
  '*connect-src *https://sentry.example.com;*'
expect 'source maps are not served' \
  "$(curl -s -o /dev/null -w '%{http_code}' "$BASE${script}.map")" '404'
expect 'CSP: CSP_FRAME_ANCESTORS used' "$csp" "*frame-ancestors 'self' https://workplace.example.com;*"
expect 'CSP: no worker-src, no eval, no WebAssembly' \
  "$(printf '%s' "$csp" | grep -qE 'worker-src|unsafe-eval' && echo forbidden || echo ok)" 'ok'
expect 'CSP: script-src has no blob:' \
  "$(printf '%s' "$csp" | grep -o "script-src[^;]*" | grep -q 'blob:' && echo forbidden || echo ok)" 'ok'
expect 'CSP on the SPA fallback too' "$(header /mailbox/inbox Content-Security-Policy)" "$csp"
expect 'X-Content-Type-Options' "$(header / X-Content-Type-Options)" 'nosniff'
expect 'Referrer-Policy' "$(header / Referrer-Policy)" 'same-origin'
expect 'Permissions-Policy' "$(header / Permissions-Policy)" '*camera=()*'
expect 'no nginx version disclosed' "$(header / Server)" 'nginx'

# An env.file of tmail-flutter, mounted where its image reads it, instead of .env.js
cat >"$CONFIG_DIR/env.file" <<'ENVFILE'
# comment
SERVER_URL=https://jmap.example.com/
WEB_OIDC_CLIENT_ID="teammail-web"
OIDC_SCOPES=openid,profile,email,offline_access # trailing comment
FORWARD_WARNING_MESSAGE=It's a \ test
SENTRY_ENABLED=false
SENTRY_DSN=https://publickey@ingest-off.example.com/1
ENVFILE
chmod 644 "$CONFIG_DIR/env.file"
docker run -d --name "$ENV_FILE_NAME" \
  --read-only --tmpfs /tmp --user 101 --cap-drop ALL --security-opt no-new-privileges \
  -p 127.0.0.1::80 -e CSP_WEBFINGER_DISCOVERY=false \
  -e "TWAKE_SPACE_URL=https://space.example.com/it's" \
  -v "$CONFIG_DIR/env.file:/usr/share/nginx/html/assets/env.file:ro" \
  "$IMAGE" >/dev/null
ENV_FILE_BASE="http://$(docker port "$ENV_FILE_NAME" 80/tcp | head -1)"
for _ in $(seq 1 30); do
  curl -fsS -o /dev/null "$ENV_FILE_BASE/healthz" 2>/dev/null && break
  sleep 1
done
env_js="$(body "$ENV_FILE_BASE/.env.js")"
expect 'env.file: /.env.js generated' "$env_js" "*var SERVER_URL = 'https://jmap.example.com/';*"
expect 'env.file: quotes removed' "$env_js" "*var WEB_OIDC_CLIENT_ID = 'teammail-web';*"
expect 'env.file: TWAKE_SPACE_URL from the environment' "$env_js" "*var TWAKE_SPACE_URL = 'https://space.example.com/it\\\\'s';*"
expect 'env.file: trailing comment removed' "$env_js" "*var OIDC_SCOPES = 'openid,profile,email,offline_access';*"
forward_line="$(grep '^var FORWARD_WARNING_MESSAGE' <<<"$env_js" || true)"
expected_line='var FORWARD_WARNING_MESSAGE = '"'It\\'s a \\\\ test';"
if [[ "$forward_line" == "$expected_line" ]]; then
  echo 'ok   env.file: quote and backslash escaped'
else
  echo "FAIL env.file: quote and backslash escaped: got '$forward_line'"
  failures=$((failures + 1))
fi
expect 'env.file: values stay strings' "$env_js" "*var SENTRY_ENABLED = 'false';*"
expect 'env.file: comments left out' "$env_js" "var SERVER_URL*"
env_file_csp="$(curl -fsS -o /dev/null -D - "$ENV_FILE_BASE/" | tr -d '\r')"
if [[ "$env_file_csp" == *ingest-off.example.com* ]]; then
  echo 'FAIL CSP: the DSN of a disabled Sentry must not be allowed'
  failures=$((failures + 1))
else
  echo 'ok   CSP: the DSN of a disabled Sentry is not allowed'
fi
env_js_headers="$(curl -fsS -o /dev/null -D - "$ENV_FILE_BASE/.env.js" | tr -d '\r')"
expect 'env.file: /.env.js is never cached' "$env_js_headers" '*no-store*'
expect 'env.file: /.env.js is JavaScript' "$env_js_headers" '*application/javascript*'

# --- As the linagora/tmail-frontend Helm chart (1.0.12) runs it ----------------
# Port 80, probes on /, env.file and app_dashboard.json mounted at the paths of the
# chart, the JMAP server on another origin than the app (here a WebFinger stub that
# points to an SSO of a third origin). No LISTEN_PORT, no .env.js.
docker network create "$NETWORK" >/dev/null
touch "$CONFIG_DIR/stub-requests"
chmod 666 "$CONFIG_DIR/stub-requests"
docker run -d --name "$STUB_NAME" --network "$NETWORK" --network-alias jmap-stub \
  -v "$(cd "$(dirname "$0")" && pwd)/webfinger-stub.py:/webfinger-stub.py:ro" \
  -v "$CONFIG_DIR/stub-requests:/stub-requests" \
  python:3-alpine python /webfinger-stub.py 8000 /stub-requests >/dev/null
cat >"$CONFIG_DIR/chart.env.file" <<CHARTENV
SERVER_URL=http://jmap-stub:8000
DOMAIN_REDIRECT_URL=https://mail.example.com
WEB_OIDC_CLIENT_ID=example-client
OIDC_SCOPES=openid,profile,email
APP_GRID_AVAILABLE=supported
FCM_AVAILABLE=supported
IOS_FCM=supported
PLATFORM=saas
COZY_INTEGRATION=true
SENTRY_ENABLED=true
SENTRY_DSN=https://publickey@sentry.example.com/42
SENTRY_ENVIRONMENT=smoke
FORCE_EMAIL_QUERY=true
CHARTENV
cat >"$CONFIG_DIR/app_dashboard.json" <<'DASHBOARD'
{
  "apps": [
    { "appName": "Chat", "appLink": "https://chat.example.com", "icon": "ic_twake_app.svg" },
    { "appName": "Drive", "appLink": "https://drive.example.com", "icon": "ic_tdrive_app.svg" }
  ]
}
DASHBOARD
chmod 644 "$CONFIG_DIR/chart.env.file" "$CONFIG_DIR/app_dashboard.json"
CHART_MOUNTS=(
  -v "$CONFIG_DIR/chart.env.file:/usr/share/nginx/html/assets/env.file:ro"
  -v "$CONFIG_DIR/app_dashboard.json:/usr/share/nginx/html/assets/configurations/app_dashboard.json:ro"
)

# The chart's defaults: writable root filesystem, no securityContext; the sysctl is
# Docker's default (0), so a cluster runtime that keeps 1024 is simulated by setting it
docker run -d --name "$CHART_NAME" --network "$NETWORK" --sysctl net.ipv4.ip_unprivileged_port_start=1024 \
  -p 127.0.0.1::80 "${CHART_MOUNTS[@]}" "$IMAGE" >/dev/null
CHART_BASE="http://$(docker port "$CHART_NAME" 80/tcp | head -1)"
for _ in $(seq 1 30); do
  curl -fsS -o /dev/null "$CHART_BASE/" 2>/dev/null && break
  sleep 1
done
expect 'chart: / answers on port 80 (the probes)' \
  "$(curl -s -o /dev/null -w '%{http_code}' "$CHART_BASE/")" '200'
expect 'chart: the image runs as uid 101 on port 80 (nginx-bind)' \
  "$(docker exec "$CHART_NAME" sh -c 'stat -c %u /proc/1')" '101'
chart_env_js="$(body "$CHART_BASE/.env.js")"
expect 'chart: env.file converted' "$chart_env_js" "*var WEB_OIDC_CLIENT_ID = 'example-client';*"
expect 'chart: COZY_INTEGRATION reaches the app' "$chart_env_js" "*var COZY_INTEGRATION = 'true';*"
dashboard="$(body "$CHART_BASE/assets/configurations/app_dashboard.json")"
expect 'chart: app_dashboard.json served from the mount' "$dashboard" '*ic_tdrive_app.svg*'
expect 'chart: app icons shipped' \
  "$(curl -s -o /dev/null -w '%{http_code}' "$CHART_BASE/assets/images/svg/app-generic.svg")" '200'
chart_csp="$(header / Content-Security-Policy "$CHART_BASE")"
expect 'chart CSP: SERVER_URL allowed' "$chart_csp" "*connect-src *http://jmap-stub:8000 *"
expect 'chart CSP: its WebSocket allowed' "$chart_csp" "*ws://jmap-stub:8000*"
expect 'chart CSP: the SSO found by WebFinger allowed' "$chart_csp" '*https://sso.example.org*'
expect 'chart CSP: the Sentry origin allowed' "$chart_csp" '*https://sentry.example.com*'
expect 'chart CSP: frames only from the app by default' "$chart_csp" "*frame-ancestors 'self';*"
expect 'chart: the WebFinger question is the one of tmail-flutter' \
  "$(head -1 "$CONFIG_DIR/stub-requests")" \
  '/.well-known/webfinger?resource=http%3A%2F%2Fjmap-stub%3A8000&rel=http%3A%2F%2Fopenid.net%2Fspecs%2Fconnect%2F1.0%2Fissuer'
expect 'chart: a COZY_INTEGRATION without CSP_FRAME_ANCESTORS is reported' \
  "$(docker logs "$CHART_NAME" 2>&1)" '*CSP_FRAME_ANCESTORS is not set*'
docker rm -f "$CHART_NAME" >/dev/null

# Hardened as can be: read-only root filesystem, all capabilities dropped, no new
# privileges, the sysctl set for the pod (podSecurityContext.sysctls), /tmp an emptyDir
docker run -d --name "$HARDENED_NAME" --network "$NETWORK" --sysctl net.ipv4.ip_unprivileged_port_start=0 \
  --read-only --tmpfs /tmp --cap-drop ALL --security-opt no-new-privileges \
  -e CSP_WEBFINGER_DISCOVERY=false \
  -e CSP_FRAME_ANCESTORS="'self' https://*.example.com" \
  -p 127.0.0.1::80 "${CHART_MOUNTS[@]}" "$IMAGE" >/dev/null
HARDENED_BASE="http://$(docker port "$HARDENED_NAME" 80/tcp | head -1)"
for _ in $(seq 1 30); do
  curl -fsS -o /dev/null "$HARDENED_BASE/" 2>/dev/null && break
  sleep 1
done
expect 'hardened: / answers on port 80' \
  "$(curl -s -o /dev/null -w '%{http_code}' "$HARDENED_BASE/")" '200'
hardened_csp="$(header / Content-Security-Policy "$HARDENED_BASE")"
expect 'hardened CSP: CSP_FRAME_ANCESTORS for the Workplace' "$hardened_csp" \
  "*frame-ancestors 'self' https://*.example.com;*"
expect 'hardened CSP: no WebFinger asked when turned off' "$hardened_csp" \
  '!(*sso.example.org*)'
docker rm -f "$HARDENED_NAME" >/dev/null

# Nothing allows port 80 to a non-root user: the container says why instead of crashing
docker run -d --name "$BLOCKED_NAME" --sysctl net.ipv4.ip_unprivileged_port_start=1024 \
  --cap-drop ALL "$IMAGE" >/dev/null
for _ in $(seq 1 20); do
  [[ "$(docker inspect -f '{{.State.Running}}' "$BLOCKED_NAME")" == false ]] && break
  sleep 0.5
done
expect 'blocked: the container stops when port 80 cannot be bound' \
  "$(docker inspect -f '{{.State.Running}}' "$BLOCKED_NAME")" 'false'
expect 'blocked: it explains the sysctl' "$(docker logs "$BLOCKED_NAME" 2>&1)" \
  '*net.ipv4.ip_unprivileged_port_start=0*'
docker rm -f "$BLOCKED_NAME" >/dev/null

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
