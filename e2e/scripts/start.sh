#!/usr/bin/env bash
# Starts the e2e backend (compose project `twakemail-e2e`) and waits until it is usable.
#
#   E2E_APP_DIR=../apps/web/dist ./scripts/start.sh   serve a built app on 127.0.0.1:18302
#   E2E_OIDC=1 ./scripts/start.sh                     also start Dex and enable OIDC in James
#
# Variables (all optional):
#   E2E_APP_DIR        directory holding the built SPA (index.html); default: a placeholder page
#   E2E_PUBLIC_URL     browser facing origin, default http://127.0.0.1:${E2E_APP_PORT}
#   E2E_JMAP_PORT      default 18300   (127.0.0.1 only)
#   E2E_WEBADMIN_PORT  default 18301   (127.0.0.1 only)
#   E2E_APP_PORT       default 18302   (127.0.0.1 only)
#   E2E_OIDC           1 to add the `oidc` profile (Dex) and OidcAuthenticationStrategy
#   E2E_START_TIMEOUT  seconds to wait for James, default 180
set -euo pipefail

E2E_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DOCKER_DIR="$E2E_DIR/docker"
GENERATED="$DOCKER_DIR/.generated"
PROJECT=twakemail-e2e
DOMAIN=example.com

export E2E_JMAP_PORT="${E2E_JMAP_PORT:-18300}"
export E2E_WEBADMIN_PORT="${E2E_WEBADMIN_PORT:-18301}"
export E2E_APP_PORT="${E2E_APP_PORT:-18302}"
PUBLIC_URL="${E2E_PUBLIC_URL:-http://127.0.0.1:$E2E_APP_PORT}"
PUBLIC_URL="${PUBLIC_URL%/}"
WEBSOCKET_URL="${PUBLIC_URL/#http/ws}"
WEBADMIN="http://127.0.0.1:$E2E_WEBADMIN_PORT"
TIMEOUT="${E2E_START_TIMEOUT:-180}"

if [[ -n "${E2E_APP_DIR:-}" ]]; then
  [[ -f "$E2E_APP_DIR/index.html" ]] || { echo "E2E_APP_DIR=$E2E_APP_DIR has no index.html" >&2; exit 1; }
  E2E_APP_DIR="$(cd "$E2E_APP_DIR" && pwd)"
  export E2E_APP_DIR
fi

compose() {
  local profiles=()
  [[ "${E2E_OIDC:-0}" == "1" ]] && profiles=(--profile oidc)
  docker compose -p "$PROJECT" -f "$DOCKER_DIR/docker-compose.yaml" "${profiles[@]}" "$@"
}

mkdir -p "$GENERATED"

# JWT keys, same as tmail-flutter scripts/patrol-web-integration-test-with-docker.sh
if [[ ! -f "$GENERATED/jwt_privatekey" ]]; then
  echo "Generating JWT keys..."
  openssl genpkey -algorithm rsa -pkeyopt rsa_keygen_bits:4096 -out "$GENERATED/jwt_privatekey" 2>/dev/null
  openssl rsa -in "$GENERATED/jwt_privatekey" -pubout -out "$GENERATED/jwt_publickey" 2>/dev/null
  # James runs as root in the container, but keep them readable for rootless docker
  chmod 644 "$GENERATED/jwt_privatekey" "$GENERATED/jwt_publickey"
fi

STRATEGIES="BasicAuthenticationStrategy,com.linagora.tmail.james.jmap.ticket.TicketAuthenticationStrategy"
OIDC_BLOCK=""
if [[ "${E2E_OIDC:-0}" == "1" ]]; then
  STRATEGIES="$STRATEGIES,com.linagora.tmail.james.jmap.oidc.OidcAuthenticationStrategy"
  OIDC_BLOCK="$(cat "$DOCKER_DIR/james/oidc.properties.fragment")"
fi
awk -v strategies="$STRATEGIES" -v public="$PUBLIC_URL" -v ws="$WEBSOCKET_URL" -v oidc="$OIDC_BLOCK" '
  { gsub(/@AUTH_STRATEGIES@/, strategies); gsub(/@PUBLIC_URL@/, public); gsub(/@WEBSOCKET_URL@/, ws) }
  /@OIDC_BLOCK@/ { print oidc; next }
  { print }' "$DOCKER_DIR/james/jmap.properties.template" > "$GENERATED/jmap.properties"
sed "s|@PUBLIC_URL@|$PUBLIC_URL|g" "$DOCKER_DIR/dex/config.yaml" > "$GENERATED/dex-config.yaml"

echo "Starting compose project $PROJECT (public URL $PUBLIC_URL, OIDC=${E2E_OIDC:-0})..."
# --force-recreate: rendered configuration may have changed since the last run
compose up -d --force-recreate --remove-orphans

echo -n "Waiting for tmail-backend"
deadline=$((SECONDS + TIMEOUT))
until [[ "$(compose ps --format '{{.Health}}' james 2>/dev/null)" == "healthy" ]]; do
  if (( SECONDS > deadline )); then
    echo; echo "tmail-backend not healthy after ${TIMEOUT}s" >&2
    compose logs --tail 80 james >&2
    exit 1
  fi
  echo -n "."; sleep 2
done
echo " ready"

curl -fsS -o /dev/null -X PUT "$WEBADMIN/domains/$DOMAIN"
echo "Domain $DOMAIN created"

if [[ "${E2E_OIDC:-0}" == "1" ]]; then
  # James counterparts of the Dex static accounts (dex/config.yaml)
  for user in alice bob; do
    curl -fsS -o /dev/null -X PUT "$WEBADMIN/users/$user@$DOMAIN" \
      -H 'Content-Type: application/json' -d '{"password":"secret"}'
  done
  echo "OIDC accounts alice@$DOMAIN, bob@$DOMAIN created (password: secret)"
fi

# The browser facing origin must answer too (nginx + JMAP through it)
until curl -fsS -o /dev/null "$PUBLIC_URL/__e2e/health" \
  && [[ "$(curl -s -o /dev/null -w '%{http_code}' "$PUBLIC_URL/jmap/session")" == "401" ]]; do
  if (( SECONDS > deadline )); then echo "proxy $PUBLIC_URL not ready" >&2; exit 1; fi
  sleep 1
done
if [[ "${E2E_OIDC:-0}" == "1" ]]; then
  until curl -fsS -o /dev/null "$PUBLIC_URL/dex/.well-known/openid-configuration"; do
    if (( SECONDS > deadline )); then echo "Dex not ready" >&2; exit 1; fi
    sleep 1
  done
fi

cat <<INFO
e2e stack ready
  app + JMAP (browser) $PUBLIC_URL
  JMAP (direct)        http://127.0.0.1:$E2E_JMAP_PORT
  WebAdmin             $WEBADMIN
INFO
