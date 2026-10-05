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
ENV_FILE_NAME="twake-mail-smoke-envfile-$$"
CONFIG_DIR="$(mktemp -d)"
trap 'docker rm -f "$NAME" "$ENV_FILE_NAME" >/dev/null 2>&1 || true; rm -rf "$CONFIG_DIR"' EXIT

cat >"$CONFIG_DIR/.env.js" <<'EOF'
var SERVER_URL = 'https://jmap.example.com'
var AUTH_MODE = 'basic'
var SENTRY_ENABLED = 'true'
var SENTRY_DSN = 'https://publickey@sentry.example.com/42'
var SENTRY_ENVIRONMENT = 'smoke'
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
  -p 127.0.0.1::8080 \
  -v "$CONFIG_DIR/env.file:/usr/share/nginx/html/assets/env.file:ro" \
  "$IMAGE" >/dev/null
ENV_FILE_BASE="http://$(docker port "$ENV_FILE_NAME" 8080/tcp | head -1)"
for _ in $(seq 1 30); do
  curl -fsS -o /dev/null "$ENV_FILE_BASE/healthz" 2>/dev/null && break
  sleep 1
done
env_js="$(body "$ENV_FILE_BASE/.env.js")"
expect 'env.file: /.env.js generated' "$env_js" "*var SERVER_URL = 'https://jmap.example.com/';*"
expect 'env.file: quotes removed' "$env_js" "*var WEB_OIDC_CLIENT_ID = 'teammail-web';*"
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
