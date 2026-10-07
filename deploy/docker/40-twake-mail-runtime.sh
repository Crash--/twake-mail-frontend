#!/bin/sh
# Run by the entrypoint of the nginx image before nginx starts. Writes the
# runtime configuration of nginx under /tmp/nginx (the root filesystem may be
# read-only), included by /etc/nginx/nginx.conf:
#
#   server.d/listen.conf    the port, LISTEN_PORT (default 80, as the
#                           linagora/tmail-frontend chart expects). A port below
#                           1024 as a non-root user needs the sysctl
#                           net.ipv4.ip_unprivileged_port_start (Docker lowers
#                           it to 0) or CAP_NET_BIND_SERVICE: the start
#                           wrapper then runs nginx-bind, which has it as a file
#                           capability. This script stops with a message when
#                           neither is possible
#   cache_env.conf          browser caching, disabled when .env.js has DEBUG = true
#   server.d/env.conf       with an env.file of tmail-flutter mounted (see below):
#                           serves /.env.js from the one generated in /tmp/nginx
#   security_headers.conf   the values of the security headers, from the
#                           environment (see docs/deployment.md):
#
#   CSP_CONNECT_SRC          extra sources of connect-src, added to those this
#                            script derives from the configuration: SERVER_URL
#                            (the JMAP server) and its ws:/wss: counterpart,
#                            SSO_BASE_URL, the SSO that a WebFinger request on
#                            SERVER_URL answers at startup (see below), and the
#                            Sentry ingest origin of SENTRY_DSN when
#                            SENTRY_ENABLED is true
#   CSP_WEBFINGER_DISCOVERY  false: no WebFinger request at startup
#   CSP_WEBFINGER_TIMEOUT    seconds of each of its two attempts, default 3
#   CSP_FRAME_SRC            extra sources of frame-src (e.g. Twake Drive intents)
#   CSP_FRAME_ANCESTORS      who may embed the app in a frame, default 'self'
#                            (COZY_INTEGRATION on without it logs a warning)
#   CSP_REPORT_URI           where browsers report violations (report-uri)
#   CSP_REPORT_ONLY          true: send Content-Security-Policy-Report-Only
#                            instead of Content-Security-Policy
#   CONTENT_SECURITY_POLICY  replaces the whole policy built from the above
#   REFERRER_POLICY          default same-origin
#   PERMISSIONS_POLICY       default: no camera, microphone, geolocation...
#
# The runtime configuration is the mounted /usr/share/nginx/html/.env.js. As
# in the image of tmail-flutter, an env.file mounted at
# /usr/share/nginx/html/assets/env.file works too (same keys, same format):
# when no .env.js is mounted, it is converted into a /.env.js served by nginx.
# SENTRY_FEEDBACK_ENABLED (true or false) in the environment is added to it
# when the env.file has no such key.
set -eu

ME=$(basename "$0")
HTML_DIR=/usr/share/nginx/html
CONF_DIR=/tmp/nginx/conf.d
SERVER_CONF_DIR=/tmp/nginx/server.d
ENV_FILE=$HTML_DIR/assets/env.file
GENERATED_ENV_JS=/tmp/nginx/env.js
NGINX_BIN_FILE=/tmp/nginx/bin
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

mkdir -p "$CONF_DIR" "$SERVER_CONF_DIR"

# --- Port ------------------------------------------------------------------
listen_port=${LISTEN_PORT:-80}
case "$listen_port" in
  '' | *[!0-9]*) fail "LISTEN_PORT must be a port number, got '$listen_port'" ;;
esac
if [ "$listen_port" -lt 1 ] || [ "$listen_port" -gt 65535 ]; then
  fail "LISTEN_PORT must be between 1 and 65535, got '$listen_port'"
fi
printf 'listen %s;\n' "$listen_port" >"$SERVER_CONF_DIR/listen.conf"
rm -f "$NGINX_BIN_FILE"
unprivileged_start=$(cat /proc/sys/net/ipv4/ip_unprivileged_port_start 2>/dev/null || echo 1024)
if [ "$(id -u)" != 0 ] && [ "$listen_port" -lt "$unprivileged_start" ]; then
  # The bounding set must hold CAP_NET_BIND_SERVICE (bit 10) and no_new_privs
  # must be off, or the kernel ignores the file capability of nginx-bind
  cap_bnd=$(awk '/^CapBnd:/ { print $2 }' /proc/self/status 2>/dev/null || true)
  no_new_privs=$(awk '/^NoNewPrivs:/ { print $2 }' /proc/self/status 2>/dev/null || true)
  if [ -n "$cap_bnd" ] && [ $(((0x$cap_bnd >> 10) & 1)) = 1 ] &&
    [ "${no_new_privs:-0}" = 0 ] && [ -x /usr/sbin/nginx-bind ]; then
    echo /usr/sbin/nginx-bind >"$NGINX_BIN_FILE"
    log "port $listen_port: binding it with the capability of nginx-bind"
  else
    fail "cannot bind port $listen_port as uid $(id -u): net.ipv4.ip_unprivileged_port_start is $unprivileged_start and CAP_NET_BIND_SERVICE is not usable. Set the sysctl net.ipv4.ip_unprivileged_port_start=0 (Kubernetes: podSecurityContext.sysctls) or LISTEN_PORT=8080"
  fi
fi

# --- env.file of tmail-flutter ---------------------------------------------
# KEY=VALUE lines (comments, blank lines, `export`, one layer of quotes and
# the trailing ` # comment` of unquoted values understood) become
# `var KEY = 'VALUE';`. The values stay strings, as in the env.file; the keys
# must be identifiers. Nothing else of the file reaches the script.
env_js=$HTML_DIR/.env.js
rm -f "$SERVER_CONF_DIR/env.conf" "$GENERATED_ENV_JS"
if [ ! -f "$HTML_DIR/.env.js" ] && [ -f "$ENV_FILE" ]; then
  tr -d '\r' <"$ENV_FILE" | awk '
    { sub(/^[ \t]+/, "") }
    /^#/ || /^$/ { next }
    { sub(/^export[ \t]+/, "") }
    !/^[A-Za-z_][A-Za-z0-9_]*[ \t]*=/ { next }
    {
      i = index($0, "=")
      key = substr($0, 1, i - 1)
      sub(/[ \t]+$/, "", key)
      value = substr($0, i + 1)
      sub(/^[ \t]+/, "", value)
      sub(/[ \t]+$/, "", value)
      first = substr(value, 1, 1)
      if (length(value) >= 2 && (first == "\"" || first == "\047") &&
          substr(value, length(value), 1) == first) {
        value = substr(value, 2, length(value) - 2)
      } else {
        sub(/[ \t]+#.*$/, "", value)
      }
      # Escaped character by character: gsub() replacements differ between awks
      escaped = ""
      for (n = 1; n <= length(value); n++) {
        c = substr(value, n, 1)
        if (c == "\\" || c == "\047") escaped = escaped "\\"
        escaped = escaped c
      }
      printf "var %s = \047%s\047;\n", key, escaped
    }' >"$GENERATED_ENV_JS"
  # Keys of this app that tmail-flutter's env.file, and so the chart that
  # writes it, does not know: taken from the environment (the chart's
  # extraEnv) when the env.file does not set them
  for key in TWAKE_SPACE_URL; do
    value=$(printenv "$key" || true)
    [ -n "$value" ] || continue
    grep -qE "^var $key = " "$GENERATED_ENV_JS" && continue
    escaped=$(printf '%s' "$value" | sed -e "s/\\\\/\\\\\\\\/g" -e "s/'/\\\\'/g")
    printf "var %s = '%s';\n" "$key" "$escaped" >>"$GENERATED_ENV_JS"
  done
  # The env.file of the linagora/tmail-frontend chart has no key of its own
  # for the feedback widget: the environment of the container gives it
  case "${SENTRY_FEEDBACK_ENABLED:-}" in
    '') ;;
    true | false)
      if ! grep -qE '^var SENTRY_FEEDBACK_ENABLED ' "$GENERATED_ENV_JS"; then
        printf "var SENTRY_FEEDBACK_ENABLED = '%s';\n" "$SENTRY_FEEDBACK_ENABLED" >>"$GENERATED_ENV_JS"
      fi
      ;;
    *) fail "SENTRY_FEEDBACK_ENABLED must be true or false, not '$SENTRY_FEEDBACK_ENABLED'" ;;
  esac
  cat >"$SERVER_CONF_DIR/env.conf" <<EOF
location = /.env.js {
  alias $GENERATED_ENV_JS;
  default_type application/javascript;
  expires off;
  add_header Cache-Control "no-store, no-cache, must-revalidate, proxy-revalidate" always;
  include /etc/nginx/twake-mail/security-headers.conf;
}
EOF
  env_js=$GENERATED_ENV_JS
  log "$ENV_FILE converted into /.env.js"
fi

# --- Browser caching -------------------------------------------------------
if [ -f "$env_js" ] &&
  grep -qE 'DEBUG[[:space:]]*=[[:space:]]*.?true' "$env_js"; then
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

# The ingest origin of the Sentry DSN of the configuration, when error
# reporting is on: nothing else is allowed to receive reports. A DSN given by
# the ecosystem of the server is not known here: add its origin to
# CSP_CONNECT_SRC.
# env_js_value <KEY>: the value of `var KEY = '…';` (or `window.KEY = …`)
env_js_value() {
  [ -f "$env_js" ] || return 0
  grep -vE '^[[:space:]]*//' "$env_js" | grep -E "(^|[[:space:];.])$1[[:space:]]*=" | head -1 |
    sed -E "s/^.*$1[[:space:]]*=[[:space:]]*//; s/[;[:space:]]*\$//; s/^['\"\`]//; s/['\"\`]\$//"
}
# add_connect_src <source>: appended to connect_src unless already listed
add_connect_src() {
  case " $connect_src " in
    *" $1 "*) return 0 ;;
  esac
  connect_src="${connect_src:+$connect_src }$1"
}

# origin_of <url>: scheme://host[:port] of an http(s) URL, nothing otherwise
origin_of() {
  printf '%s' "$1" |
    sed -nE 's|^(https?://[][A-Za-z0-9._:-]+)([/?#].*)?$|\1|p'
}

# add_origin_with_websocket <url>: the origin of a server, and its ws:/wss:
# counterpart (the push channel)
add_origin_with_websocket() {
  origin=$(origin_of "$1")
  [ -n "$origin" ] || return 0
  add_connect_src "$origin"
  case "$origin" in
    https://*) add_connect_src "wss://${origin#https://}" ;;
    http://*) add_connect_src "ws://${origin#http://}" ;;
  esac
}

# The JMAP server (SERVER_URL), usually on another origin than the app: with
# its WebSocket, as the env.file of the linagora/tmail-frontend chart gives it
server_url=$(env_js_value SERVER_URL)
if [ -n "$server_url" ]; then
  if [ -z "$(origin_of "$server_url")" ]; then
    log "SERVER_URL is not a fixed http(s) URL, left out of connect-src"
  else
    add_origin_with_websocket "$server_url"
    log "SERVER_URL origin added to connect-src"
  fi
fi

# The SSO given by the configuration
sso_base_url=$(env_js_value SSO_BASE_URL)
if [ -n "$sso_base_url" ]; then
  origin=$(origin_of "$sso_base_url")
  [ -z "$origin" ] || add_connect_src "$origin"
fi

# Without SSO_BASE_URL (and unless AUTH_MODE is basic), the app finds the SSO
# at runtime: WebFinger on SERVER_URL, as tmail-flutter does. Its origin must
# be in connect-src, and the browser cannot add it itself: ask the same
# question once at startup. Bounded (CSP_WEBFINGER_TIMEOUT seconds, two
# attempts), never fatal; CSP_WEBFINGER_DISCOVERY=false turns it off. The
# answer is the state of the SSO now: after a change of it, restart the
# container, or give its origin in CSP_CONNECT_SRC.
auth_mode=$(env_js_value AUTH_MODE)
server_origin=$(origin_of "$server_url")
if [ -n "$server_origin" ] && [ -z "$sso_base_url" ] && [ "$auth_mode" != basic ] &&
  [ "${CSP_WEBFINGER_DISCOVERY:-true}" != false ]; then
  timeout=${CSP_WEBFINGER_TIMEOUT:-3}
  case "$timeout" in
    '' | *[!0-9]*) fail "CSP_WEBFINGER_TIMEOUT must be a number of seconds" ;;
  esac
  issuer=''
  for attempt in 1 2; do
    # No redirection followed, no credentials, http(s) only, small answer
    answer=$(curl -s --proto '=http,https' --connect-timeout "$timeout" \
      --max-time "$timeout" --max-filesize 65536 -G \
      --data-urlencode "resource=$server_origin" \
      --data-urlencode 'rel=http://openid.net/specs/connect/1.0/issuer' \
      -H 'Accept: application/jrd+json, application/json' \
      "$(printf '%s' "$server_url" | sed -E 's#/+$##')/.well-known/webfinger" 2>/dev/null |
      tr -d '\r\n' || true)
    # The link of the issuer relation, else the first link (tmail-flutter)
    link=$(printf '%s' "$answer" |
      grep -oE '\{[^{}]*"http://openid.net/specs/connect/1.0/issuer"[^{}]*\}' | head -1 || true)
    [ -n "$link" ] || link=$answer
    issuer=$(printf '%s' "$link" |
      sed -nE 's#.*"href"[[:space:]]*:[[:space:]]*"([^"]*)".*#\1#p' | head -1)
    [ -z "$(origin_of "$issuer")" ] || break
    issuer=''
    [ "$attempt" = 2 ] || sleep 1
  done
  if [ -n "$issuer" ]; then
    add_connect_src "$(origin_of "$issuer")"
    log "SSO origin $(origin_of "$issuer") found by WebFinger, added to connect-src"
  else
    log "warning: no SSO found by WebFinger on $server_origin: if the app signs in with an SSO, add its origin to CSP_CONNECT_SRC"
  fi
fi

sentry_enabled=$(env_js_value SENTRY_ENABLED)
sentry_dsn=$(env_js_value SENTRY_DSN)
# Without SENTRY_ENABLED, a DSN alone starts the reporting (deprecated)
case "$sentry_enabled" in
  true | '')
    sentry_origin=$(printf '%s' "$sentry_dsn" |
      sed -nE 's#^(https?://)[^@/[:space:]]+@([^/?\#[:space:]]+)/.*$#\1\2#p')
    if [ -n "$sentry_origin" ]; then
      add_connect_src "$sentry_origin"
      log "Sentry ingest origin $sentry_origin added to connect-src"
    fi
    ;;
esac

frame_src=${CSP_FRAME_SRC:-}
frame_ancestors=${CSP_FRAME_ANCESTORS:-"'self'"}
# COZY_INTEGRATION / WORKPLACE_EMBEDDING: the app is framed by Twake Workplace,
# at an address this image cannot guess (one per user)
if [ -z "${CSP_FRAME_ANCESTORS:-}" ]; then
  case "$(env_js_value COZY_INTEGRATION)$(env_js_value WORKPLACE_EMBEDDING)" in
    *true*) log "warning: COZY_INTEGRATION is on but CSP_FRAME_ANCESTORS is not set: browsers will refuse to show the app in the frame of Twake Workplace. Set it to the origins of the Workplace, e.g. \"'self' https://*.example.com\"" ;;
  esac
fi
report_uri=${CSP_REPORT_URI:-}
check_sources CSP_CONNECT_SRC "$connect_src"
check_sources CSP_FRAME_SRC "$frame_src"
check_sources CSP_FRAME_ANCESTORS "$frame_ancestors"
check_sources CSP_REPORT_URI "$report_uri"

script_hashes=''
if [ -f "$SCRIPT_HASHES_FILE" ]; then
  script_hashes=$(cat "$SCRIPT_HASHES_FILE")
fi

# The policy, with the given frame-ancestors
make_csp() {
  policy="default-src 'self'"
  policy="$policy; script-src 'self'${script_hashes:+ $script_hashes}"
  policy="$policy; style-src 'self' 'unsafe-inline'"
  policy="$policy; img-src 'self' data: blob: cid: https: http:"
  policy="$policy; font-src 'self' data: https: http:"
  policy="$policy; connect-src 'self' data: blob: ws://\$http_host wss://\$http_host${connect_src:+ $connect_src}"
  policy="$policy; frame-src 'self' blob:${frame_src:+ $frame_src}"
  policy="$policy; frame-ancestors $1"
  policy="$policy; object-src 'none'; base-uri 'self'; form-action 'self'"
  if [ -n "$report_uri" ]; then
    policy="$policy; report-uri $report_uri"
  fi
  printf '%s' "$policy"
}

if [ -n "${CONTENT_SECURITY_POLICY:-}" ]; then
  csp=$CONTENT_SECURITY_POLICY
  check_value CONTENT_SECURITY_POLICY "$csp" '"\\$' \
    'double quotes, backslashes nor dollar signs'
  log "Content-Security-Policy replaced by CONTENT_SECURITY_POLICY"
  intents_csp=$csp
  log "warning: the intents page (/intents) gets CONTENT_SECURITY_POLICY too: other apps can open the composer only if its frame-ancestors lets them (docs/cozy-intents.md)"
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
  csp=$(make_csp "$frame_ancestors")
  # The intents page (/intents) is framed by the app that starts a
  # cozy-stack intent, whichever it is: the handshake of cozy-interapp with
  # the origin the stack gives, and its frameAncestors, guard it
  # (docs/cozy-intents.md)
  intents_csp=$(make_csp '*')
fi

case "${CSP_REPORT_ONLY:-false}" in
  true | 1 | yes)
    csp_enforced=''
    csp_report_only=$csp
    intents_csp_enforced=''
    intents_csp_report_only=$intents_csp
    log "Content-Security-Policy in report-only mode"
    ;;
  false | 0 | no | '')
    csp_enforced=$csp
    csp_report_only=''
    intents_csp_enforced=$intents_csp
    intents_csp_report_only=''
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
map \$request_uri \$twake_mail_csp {
  default "$csp_enforced";
  "~*^/intents(/callback)?/?(\\?|\$)" "$intents_csp_enforced";
}
map \$request_uri \$twake_mail_csp_report_only {
  default "$csp_report_only";
  "~*^/intents(/callback)?/?(\\?|\$)" "$intents_csp_report_only";
}
map \$uri \$twake_mail_referrer_policy { default "$referrer_policy"; }
map \$uri \$twake_mail_permissions_policy { default "$permissions_policy"; }
EOF
log "security headers written to $CONF_DIR/security_headers.conf"
