#!/bin/sh
# Installed as /usr/local/bin/nginx, ahead of /usr/sbin/nginx in the PATH: the
# entrypoint of the nginx image runs its /docker-entrypoint.d scripts only for
# a command that starts with `nginx`. Runs the binary chosen by
# 40-twake-mail-runtime.sh (/tmp/nginx/bin): `nginx-bind`, which has the
# capability to bind a port below 1024, only when LISTEN_PORT needs it and the
# container allows it; /usr/sbin/nginx otherwise.
set -eu
bin=/usr/sbin/nginx
if [ -r /tmp/nginx/bin ]; then
  bin=$(cat /tmp/nginx/bin)
fi
exec "$bin" "$@"
