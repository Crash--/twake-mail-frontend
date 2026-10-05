#!/usr/bin/env bash
# Starts the e2e backend with the app under test being its Docker image started as the Helm
# chart of Linagora's tmail-frontend starts tmail-flutter's (see docker/docker-compose.chart.yaml):
#
#   E2E_CHART_IMAGE=twake-mail-frontend:e2e ./scripts/start-chart.sh
#   E2E_OIDC=1 E2E_CHART_IMAGE=... ./scripts/start-chart.sh      WebFinger answers with Dex
#   E2E_CHART_WEBFINGER=off E2E_CHART_IMAGE=... ./scripts/start-chart.sh   no SSO: the Basic form
#
# Variables, besides those of start.sh:
#   E2E_CHART_IMAGE        the image (required)
#   E2E_CHART_SERVER_URL   SERVER_URL of the env.file, default http://localhost:<E2E_APP_PORT>:
#                          another origin than the app (127.0.0.1), as in Twake Workplace
#   E2E_CHART_WEBFINGER    on (default when E2E_OIDC=1) or off (default otherwise)
# Stop it with `E2E_PROJECT=<project> ./scripts/stop.sh`.
set -euo pipefail

E2E_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
GENERATED="$E2E_DIR/docker/.generated"
: "${E2E_CHART_IMAGE:?set E2E_CHART_IMAGE to the image of the app}"
export E2E_CHART_IMAGE
APP_PORT="${E2E_APP_PORT:-18302}"
PUBLIC_URL="${E2E_PUBLIC_URL:-http://127.0.0.1:$APP_PORT}"
PUBLIC_URL="${PUBLIC_URL%/}"
SERVER_URL="${E2E_CHART_SERVER_URL:-http://localhost:$APP_PORT}"
WEBFINGER="${E2E_CHART_WEBFINGER:-$([[ "${E2E_OIDC:-0}" == 1 ]] && echo on || echo off)}"

mkdir -p "$GENERATED"
# Read by the image as the ConfigMap of the chart gives it (config.* of its values)
cat >"$GENERATED/chart-env.file" <<ENVFILE
SERVER_URL=$SERVER_URL
DOMAIN_REDIRECT_URL=$PUBLIC_URL
WEB_OIDC_CLIENT_ID=twake-mail
OIDC_SCOPES=openid,profile,email,offline_access
APP_GRID_AVAILABLE=supported
FCM_AVAILABLE=supported
IOS_FCM=supported
PLATFORM=saas
COZY_INTEGRATION=true
FORCE_EMAIL_QUERY=true
ENVFILE
if [[ "$WEBFINGER" == on ]]; then
  cat >"$GENERATED/chart-webfinger.conf" <<WEBFINGER_CONF
add_header Access-Control-Allow-Origin * always;
default_type application/jrd+json;
return 200 '{"subject":"\$arg_resource","links":[{"rel":"http://openid.net/specs/connect/1.0/issuer","href":"$PUBLIC_URL/dex"}]}';
WEBFINGER_CONF
else
  cat >"$GENERATED/chart-webfinger.conf" <<'WEBFINGER_CONF'
add_header Access-Control-Allow-Origin * always;
return 404;
WEBFINGER_CONF
fi
chmod 644 "$GENERATED"/chart-env.file "$GENERATED"/chart-webfinger.conf

export E2E_COMPOSE_EXTRA="$E2E_DIR/docker/docker-compose.chart.yaml"
"$E2E_DIR/scripts/start.sh"
echo "App image $E2E_CHART_IMAGE started as the chart does (SERVER_URL $SERVER_URL, WebFinger $WEBFINGER)"
