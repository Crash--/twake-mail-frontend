#!/usr/bin/env bash
# Tests that the image of this repository runs under the Helm chart of Linagora's
# tmail-frontend, the one that deploys tmail-flutter's linagora/tmail-web image in Twake
# Workplace:
#
#   deploy/helm/linagora-tmail-frontend/test.sh <image> [--kind]
#
# 1. Pulls the chart (version CHART_VERSION, default 1.0.12, from CHART_REPOSITORY), renders
#    it with workplace-values.yaml and the image, and checks what it imposes on the image:
#    port 80, probes on / , env.file and app_dashboard.json mounted at the paths the image
#    reads.
# 2. With --kind, in the current kubectl context (a kind cluster, see KIND_CLUSTER): loads
#    the image, installs the chart with its default security context, then with
#    hardened-values.yaml, and checks what the pods serve. A stub JMAP server answers the
#    WebFinger request of the image.
#
# Fails when the chart cannot be pulled: it is never skipped silently.
set -euo pipefail

IMAGE="${1:?usage: $0 <image> [--kind]}"
MODE="${2:-}"
CHART_VERSION="${CHART_VERSION:-1.0.12}"
CHART_REPOSITORY="${CHART_REPOSITORY:-https://docker-registry.linagora.com:5000/chartrepo/helm-repository}"
KIND_CLUSTER="${KIND_CLUSTER:-twake-mail}"
DIR="$(cd "$(dirname "$0")" && pwd)"
WORK="$(mktemp -d)"
NAMESPACE=tmail-frontend-compat
PORT_FORWARD_PID=''
cleanup() {
  [[ -z "$PORT_FORWARD_PID" ]] || kill "$PORT_FORWARD_PID" 2>/dev/null || true
  if [[ "$MODE" == --kind ]]; then
    helm uninstall compat --namespace "$NAMESPACE" >/dev/null 2>&1 || true
    kubectl delete namespace "$NAMESPACE" --wait --timeout=120s >/dev/null 2>&1 || true
  fi
  rm -rf "$WORK"
}
trap cleanup EXIT

REPOSITORY="${IMAGE%:*}"
TAG="${IMAGE##*:}"
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

helm pull tmail-frontend --version "$CHART_VERSION" --repo "$CHART_REPOSITORY" \
  --untar --untardir "$WORK" ||
  { echo "FAIL cannot pull tmail-frontend $CHART_VERSION from $CHART_REPOSITORY" >&2; exit 1; }
CHART="$WORK/tmail-frontend"
IMAGE_SETTINGS=(--set "image.repository=$REPOSITORY" --set "image.tag=$TAG" --set image.pullPolicy=IfNotPresent)

# --- The chart as rendered ---------------------------------------------------------------
rendered="$(helm template compat "$CHART" -f "$DIR/workplace-values.yaml" "${IMAGE_SETTINGS[@]}")"
expect 'chart: our image is the one deployed' "$rendered" "*image: *$IMAGE*"
expect 'chart: containerPort 80' "$rendered" '*containerPort: 80*'
expect 'chart: probes on / port 80' "$rendered" '*path: /
            port: 80*'
expect 'chart: env.file mounted where the image reads it' "$rendered" \
  '*mountPath: /usr/share/nginx/html/assets/env.file*subPath: env.file*'
expect 'chart: app_dashboard.json mounted where the image reads it' "$rendered" \
  '*mountPath: /usr/share/nginx/html/assets/configurations/app_dashboard.json*subPath: app_dashboard.json*'
expect 'chart: COZY_INTEGRATION in env.file' "$rendered" '*COZY_INTEGRATION=true*'
expect 'chart: no securityContext by default' "$(helm template compat "$CHART" "${IMAGE_SETTINGS[@]}")" \
  '*securityContext:
          {}*'
hardened="$(helm template compat "$CHART" -f "$DIR/workplace-values.yaml" -f "$DIR/hardened-values.yaml" "${IMAGE_SETTINGS[@]}")"
expect 'chart: the hardened values set the read-only root and /tmp' "$hardened" \
  '*readOnlyRootFilesystem: true*mountPath: /tmp*'
expect 'chart: the hardened values set the sysctl' "$hardened" \
  '*net.ipv4.ip_unprivileged_port_start*'

# --- In a cluster ------------------------------------------------------------------------
check_pods() {
  local label=$1 base=http://127.0.0.1:18090
  kubectl --namespace "$NAMESPACE" port-forward --address 127.0.0.1 service/compat-tmail-frontend 18090:80 \
    >/dev/null &
  PORT_FORWARD_PID=$!
  for _ in $(seq 1 30); do curl -fsS -o /dev/null "$base/" 2>/dev/null && break; sleep 1; done
  expect "$label: / answers (the probes pass)" "$(curl -s -o /dev/null -w '%{http_code}' "$base/")" '200'
  expect "$label: env.file served as /.env.js" "$(curl -fsS "$base/.env.js")" "*var COZY_INTEGRATION = 'true';*"
  expect "$label: app_dashboard.json served" \
    "$(curl -fsS "$base/assets/configurations/app_dashboard.json")" '*ic_tdrive_app.svg*'
  local csp
  csp="$(curl -fsS -o /dev/null -D - "$base/" | tr -d '\r' | grep -i '^content-security-policy:' || true)"
  expect "$label CSP: JMAP server and WebSocket" "$csp" '*http://jmap-stub:8000 ws://jmap-stub:8000*'
  expect "$label CSP: SSO found by WebFinger" "$csp" '*https://sso.example.org*'
  expect "$label CSP: Sentry" "$csp" '*https://sentry.example.com*'
  expect "$label CSP: Workplace allowed to frame" "$csp" "*frame-ancestors 'self' https://*.example.com;*"
  kill "$PORT_FORWARD_PID" 2>/dev/null || true
  PORT_FORWARD_PID=''
}

if [[ "$MODE" == --kind ]]; then
  kind load docker-image "$IMAGE" --name "$KIND_CLUSTER"
  kubectl create namespace "$NAMESPACE"
  kubectl --namespace "$NAMESPACE" create configmap jmap-stub --from-file="$DIR/../../docker/webfinger-stub.py"
  kubectl --namespace "$NAMESPACE" apply -f - <<STUB
apiVersion: v1
kind: Pod
metadata:
  name: jmap-stub
  labels: {app: jmap-stub}
spec:
  containers:
    - name: stub
      image: python:3-alpine
      command: [python, /stub/webfinger-stub.py, "8000", /dev/null]
      ports: [{containerPort: 8000}]
      volumeMounts: [{name: stub, mountPath: /stub}]
  volumes: [{name: stub, configMap: {name: jmap-stub}}]
---
apiVersion: v1
kind: Service
metadata:
  name: jmap-stub
spec:
  selector: {app: jmap-stub}
  ports: [{port: 8000}]
STUB
  kubectl --namespace "$NAMESPACE" wait --for=condition=Ready pod/jmap-stub --timeout=180s
  VALUES=(-f "$DIR/workplace-values.yaml" --set config.serverUrl=http://jmap-stub:8000
    --set 'extraEnv[0].name=CSP_FRAME_ANCESTORS' --set "extraEnv[0].value='self' https://*.example.com")
  # extraEnv is a list of maps: --set cannot hold the quotes of the value, use a file
  cat >"$WORK/frame-ancestors.yaml" <<'VALUES'
extraEnv:
  - name: CSP_FRAME_ANCESTORS
    value: "'self' https://*.example.com"
VALUES
  VALUES=(-f "$DIR/workplace-values.yaml" -f "$WORK/frame-ancestors.yaml" --set config.serverUrl=http://jmap-stub:8000)

  # What Linagora deploys: the chart's default security context
  helm install compat "$CHART" --namespace "$NAMESPACE" "${VALUES[@]}" "${IMAGE_SETTINGS[@]}" \
    --set image.pullPolicy=Never --wait --timeout 3m ||
    { kubectl --namespace "$NAMESPACE" describe pods; kubectl --namespace "$NAMESPACE" logs -l app.kubernetes.io/name=tmail-frontend --tail 30; exit 1; }
  check_pods 'kind, chart defaults'

  # A runtime that keeps the kernel's default for the unprivileged ports (1024): the
  # capability of nginx-bind binds port 80
  helm upgrade compat "$CHART" --namespace "$NAMESPACE" "${VALUES[@]}" "${IMAGE_SETTINGS[@]}" \
    --set image.pullPolicy=Never --set 'podSecurityContext.sysctls[0].name=net.ipv4.ip_unprivileged_port_start' \
    --set-string 'podSecurityContext.sysctls[0].value=1024' --wait --timeout 3m ||
    { kubectl --namespace "$NAMESPACE" describe pods; kubectl --namespace "$NAMESPACE" logs -l app.kubernetes.io/name=tmail-frontend --tail 30; exit 1; }
  expect 'kind, sysctl 1024: nginx-bind is used' \
    "$(kubectl --namespace "$NAMESPACE" logs -l app.kubernetes.io/name=tmail-frontend --tail 100)" \
    '*binding it with the capability of nginx-bind*'
  check_pods 'kind, sysctl 1024'

  # A restricted security context
  helm upgrade compat "$CHART" --namespace "$NAMESPACE" "${VALUES[@]}" -f "$DIR/hardened-values.yaml" \
    "${IMAGE_SETTINGS[@]}" --set image.pullPolicy=Never --wait --timeout 3m ||
    { kubectl --namespace "$NAMESPACE" describe pods; kubectl --namespace "$NAMESPACE" logs -l app.kubernetes.io/name=tmail-frontend --tail 30; exit 1; }
  check_pods 'kind, hardened'
fi

if ((failures > 0)); then
  echo "$failures check(s) failed"
  exit 1
fi
echo "all checks passed"
