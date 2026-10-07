#!/bin/bash
#
# Stops the QA environment started by start.sh. The backend stores everything in memory: its data
# is gone once stopped.
#
#   scripts/qa-environment/stop.sh
#
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_DIR="$(cd "$SCRIPT_DIR/../.." && pwd)"

E2E_PROJECT="${QA_PROJECT:-twake-mail-qa}" "$REPO_DIR/e2e/scripts/stop.sh"
echo "==> QA environment '${QA_PROJECT:-twake-mail-qa}' stopped"
