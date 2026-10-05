#!/bin/sh
# Run by the entrypoint of the nginx image before nginx starts. Writes the
# runtime configuration of nginx under /tmp/nginx/conf.d (the root filesystem
# may be read-only), included by /etc/nginx/nginx.conf:
#
#   cache_env.conf          browser caching, disabled when .env.js has DEBUG = true
#   security_headers.conf   the values of the security headers, from the
#                           environment (see docs/deployment.md):
#
#   CSP_CONNECT_SRC          extra sources of connect-src: the JMAP server and
#                            its WebSocket when not on the origin of the app,
#                            the SSO, the Sentry ingest host
#   CSP_FRAME_SRC            extra sources of frame-src (e.g. Twake Drive intents)
#   CSP_FRAME_ANCESTORS      who may embed the app in a frame, default 'self'
#   CSP_REPORT_URI           where browsers report violations (report-uri)
#   CSP_REPORT_ONLY          true: send Content-Security-Policy-Report-Only
#                            instead of Content-Security-Policy
#   CONTENT_SECURITY_POLICY  replaces the whole policy built from the above
#   REFERRER_POLICY          default same-origin
#   PERMISSIONS_POLICY       default: no camera, microphone, geolocation...
set -eu

ME=$(basename "$0")
HTML_DIR=/usr/share/nginx/html
CONF_DIR=/tmp/nginx/conf.d
SCRIPT_HASHES_FILE=/etc/nginx/twake-mail/csp-script-hashes

log() {
  if [ -z "${NGINX_ENTRYPOINT_QUIET_LOGS:-}" ]; then
    echo "$ME: $*"
  fi
}

fail() {
  echo "$ME: error: $*" >&2
  exit 1
}

# The values end up between double quotes in the nginx configuration.
# check_value <name> <value> <forbidden characters> <their description>
check_value() {
  name=$1
  value=$2
  forbidden=$3
  case "$value" in
    *[$forbidden]*) fail "$name must not contain $4" ;;
  esac
  case "$value" in
    *"
"*) fail "$name must hold on one line" ;;
  esac
}

# A list of CSP sources: a directive separator would let it add directives
check_sources() {
  check_value "$1" "$2" '"\\$;,' \
    'double quotes, backslashes, dollar signs, semicolons nor commas'
}

mkdir -p "$CONF_DIR"

# --- Browser caching -------------------------------------------------------
if [ -f "$HTML_DIR/.env.js" ] &&
  grep -qE 'DEBUG[[:space:]]*=[[:space:]]*true' "$HTML_DIR/.env.js"; then
  static_cache='no-cache'
  html_cache='no-cache'
  log "DEBUG = true in .env.js: browser caching disabled"
else
  static_cache='public, max-age=31536000, immutable'
  html_cache='no-store, no-cache, must-revalidate, proxy-revalidate'
  log "browser caching of the hashed assets enabled"
fi
cat >"$CONF_DIR/cache_env.conf" <<EOF
map \$uri \$static_cache_control { default "$static_cache"; }
map \$uri \$html_cache_control { default "$html_cache"; }
EOF

# --- Security headers ------------------------------------------------------
connect_src=${CSP_CONNECT_SRC:-}
frame_src=${CSP_FRAME_SRC:-}
frame_ancestors=${CSP_FRAME_ANCESTORS:-"'self'"}
report_uri=${CSP_REPORT_URI:-}
check_sources CSP_CONNECT_SRC "$connect_src"
check_sources CSP_FRAME_SRC "$frame_src"
check_sources CSP_FRAME_ANCESTORS "$frame_ancestors"
check_sources CSP_REPORT_URI "$report_uri"

script_hashes=''
if [ -f "$SCRIPT_HASHES_FILE" ]; then
  script_hashes=$(cat "$SCRIPT_HASHES_FILE")
fi

if [ -n "${CONTENT_SECURITY_POLICY:-}" ]; then
  csp=$CONTENT_SECURITY_POLICY
  check_value CONTENT_SECURITY_POLICY "$csp" '"\\$' \
    'double quotes, backslashes nor dollar signs'
  log "Content-Security-Policy replaced by CONTENT_SECURITY_POLICY"
else
  # - script-src: the bundle, and the inline script of index.html by its hash
  # - style-src 'unsafe-inline': the styles MUI (emotion) injects at runtime
  # - img-src, font-src: the email body frames are blob: documents, which
  #   inherit this policy; their own policy (emailBody.ts) allows remote
  #   images and fonts once the user unblocks them. cid:: the composer keeps
  #   the inline images of a quote as cid: URLs, which never load anyway
  # - connect-src: JMAP, its push WebSocket and the SSO when on this origin
  #   ($http_host: 'self' does not cover ws:/wss: in every browser); data:
  #   and blob:, read with fetch() by the composer (pasted and quoted images)
  # - frame-src blob:: the email body and HTML block frames
  csp="default-src 'self'"
  csp="$csp; script-src 'self'${script_hashes:+ $script_hashes}"
  csp="$csp; style-src 'self' 'unsafe-inline'"
  csp="$csp; img-src 'self' data: blob: cid: https: http:"
  csp="$csp; font-src 'self' data: https: http:"
  csp="$csp; connect-src 'self' data: blob: ws://\$http_host wss://\$http_host${connect_src:+ $connect_src}"
  csp="$csp; frame-src 'self' blob:${frame_src:+ $frame_src}"
  csp="$csp; frame-ancestors $frame_ancestors"
  csp="$csp; object-src 'none'; base-uri 'self'; form-action 'self'"
  if [ -n "$report_uri" ]; then
    csp="$csp; report-uri $report_uri"
  fi
fi

case "${CSP_REPORT_ONLY:-false}" in
  true | 1 | yes)
    csp_enforced=''
    csp_report_only=$csp
    log "Content-Security-Policy in report-only mode"
    ;;
  false | 0 | no | '')
    csp_enforced=$csp
    csp_report_only=''
    ;;
  *) fail "CSP_REPORT_ONLY must be true or false" ;;
esac

referrer_policy=${REFERRER_POLICY:-same-origin}
permissions_policy=${PERMISSIONS_POLICY:-'accelerometer=(), camera=(), geolocation=(), gyroscope=(), magnetometer=(), microphone=(), payment=(), usb=()'}
check_value REFERRER_POLICY "$referrer_policy" '"\\$;' \
  'double quotes, backslashes, dollar signs nor semicolons'
check_value PERMISSIONS_POLICY "$permissions_policy" '"\\$;' \
  'double quotes, backslashes, dollar signs nor semicolons'

cat >"$CONF_DIR/security_headers.conf" <<EOF
map \$uri \$twake_mail_csp { default "$csp_enforced"; }
map \$uri \$twake_mail_csp_report_only { default "$csp_report_only"; }
map \$uri \$twake_mail_referrer_policy { default "$referrer_policy"; }
map \$uri \$twake_mail_permissions_policy { default "$permissions_policy"; }
EOF
log "security headers written to $CONF_DIR/security_headers.conf"
