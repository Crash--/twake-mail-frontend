#!/bin/bash
#
# Starts a long lived app + tmail-backend stack for manual or agent driven exploratory QA.
#
# The stack of the e2e suite (e2e/docker/, started by e2e/scripts/start.sh) with the production
# image of the app built by build.sh, under its own compose project and ports, kept up until
# stop.sh is called, and with fixed accounts holding some mail (seed.py).
#
#   scripts/qa-environment/build.sh    # once, and whenever the code under test changes
#   scripts/qa-environment/start.sh
#   QA_USERS="frank grace" scripts/qa-environment/start.sh   # extra accounts
#
# Accounts are <uid>@example.com, the password is the uid: alice, bob (with mail, a quota and
# the bob-guests team mailbox shared with alice), brian, charlotte, david, emma, plus QA_USERS.
#
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_DIR="$(cd "$SCRIPT_DIR/../.." && pwd)"

QA_PROJECT="${QA_PROJECT:-twake-mail-qa}"
QA_USERS="${QA_USERS:-}"
# Published on 127.0.0.1 only, away from the ports of the e2e suite (18300-18302)
QA_APP_PORT="${QA_APP_PORT:-18402}"
QA_JMAP_PORT="${QA_JMAP_PORT:-18400}"
QA_WEBADMIN_PORT="${QA_WEBADMIN_PORT:-18401}"
APP_IMAGE="twake-mail-frontend:qa"
# `localhost` rather than 127.0.0.1: a browser in a container maps it to the proxy
PUBLIC_URL="http://localhost:$QA_APP_PORT"

if ! docker image inspect "$APP_IMAGE" >/dev/null 2>&1; then
  echo "The $APP_IMAGE image is missing, build it first: scripts/qa-environment/build.sh" >&2
  exit 1
fi

echo "==> Starting the stack as compose project '$QA_PROJECT'"
E2E_PROJECT="$QA_PROJECT" \
  E2E_APP_IMAGE="$APP_IMAGE" \
  E2E_APP_ENV="$SCRIPT_DIR/app-env.js" \
  E2E_PUBLIC_URL="$PUBLIC_URL" \
  E2E_APP_PORT="$QA_APP_PORT" \
  E2E_JMAP_PORT="$QA_JMAP_PORT" \
  E2E_WEBADMIN_PORT="$QA_WEBADMIN_PORT" \
  E2E_START_TIMEOUT="${QA_START_TIMEOUT:-600}" \
  "$REPO_DIR/e2e/scripts/start.sh"

echo "==> Creating the QA accounts"
python3 -I "$SCRIPT_DIR/seed.py" \
  --webadmin "http://127.0.0.1:$QA_WEBADMIN_PORT" \
  --jmap "http://127.0.0.1:$QA_APP_PORT" \
  --eml-dir "$REPO_DIR/e2e/fixtures/eml" \
  alice bob brian charlotte david emma $QA_USERS

cat <<INFO

==> The QA environment is up

  App:      $PUBLIC_URL  (basic authentication, no SSO)
  JMAP:     $PUBLIC_URL/jmap/session
  WebAdmin: http://127.0.0.1:$QA_WEBADMIN_PORT

From a container (e.g. Playwright), join the network '${QA_PROJECT}_default' and use:
  --host-resolver-rules="MAP localhost:$QA_APP_PORT proxy:80"
WebAdmin is then http://james:8000.

Stop it with: scripts/qa-environment/stop.sh
INFO
