#!/bin/bash
#
# Builds the production image of the app that start.sh runs, from the working tree. The backend
# images are pulled by start.sh.
#
#   scripts/qa-environment/build.sh    # once, and whenever the code under test changes
#
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_DIR="$(cd "$SCRIPT_DIR/../.." && pwd)"

docker build -f "$REPO_DIR/apps/private/Dockerfile" \
  --build-arg BUILD_VERSION="qa-$(git -C "$REPO_DIR" rev-parse --short HEAD 2>/dev/null || echo dev)" \
  -t twake-mail-frontend:qa "$REPO_DIR"
