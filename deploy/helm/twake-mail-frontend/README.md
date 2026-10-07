# twake-mail-frontend

Helm chart for Twake Mail, the React webmail of Twake Workplace: the Docker
image of the app (an unprivileged nginx serving the SPA), its runtime
configuration rendered from typed values, and the Content-Security-Policy
origins derived from them. The layout of the values follows Linagora's Twake
Workplace charts (`deployment.*`, `config.*`, `ingress.*`).

JMAP (tmail-backend) and the SSO are not part of the chart.

## Install

```bash
helm install twake-mail deploy/helm/twake-mail-frontend \
  --namespace twake-mail --create-namespace \
  -f my-values.yaml
```

The chart is also published as an OCI artifact by the CI of the repository
when its owner can publish packages (see `docs/deployment.md`):

```bash
helm install twake-mail oci://ghcr.io/<owner>/charts/twake-mail-frontend --version 0.2.0 -f my-values.yaml
```

Minimal values, JMAP and the SSO on their own hosts:

```yaml
deployment:
  image:
    repository: registry.example.com/twake-mail-frontend
    tag: main
config:
  serverUrl: https://jmap.example.com
  authMode: oidc
  sso:
    baseUrl: https://sso.example.com
    clientId: twake-mail
ingress:
  enabled: true
  className: traefik
  annotations:
    cert-manager.io/cluster-issuer: letsencrypt
  hosts:
    - host: mail.example.com
  tls:
    enabled: true
```

## What it deploys

| Resource | |
|---|---|
| `Deployment` | 2 replicas, user 101, read-only root filesystem, no capability, `RuntimeDefault` seccomp, no service account token; `/tmp` is an `emptyDir`; probes on `/healthz` |
| `ConfigMap` | `.env.js`, rendered from `config.*`, mounted next to `index.html` (`subPath`); a checksum annotation rolls the pods when it changes |
| `Service` | `ClusterIP`, port 8080 |
| `Ingress` | optional; can route the JMAP paths to tmail-backend (`ingress.jmap`) |
| `PodDisruptionBudget` | on by default (`maxUnavailable: 1`) |
| `HorizontalPodAutoscaler` | optional (`autoscaling.enabled`) |
| test `Pod` | `helm test`: `/healthz` and `/.env.js` through the service |

## Content-Security-Policy

The image sends a Content-Security-Policy that only allows the origin of the
app ([details](../../../docs/deployment.md#content-security-policy)). With
`csp.autoConnectSrc` (default), the chart adds to `connect-src` the origins
the configuration points to:

- `config.serverUrl` and its WebSocket origin (`wss://` for `https://`),
  unless it is a path (JMAP on the origin of the app);
- `config.sso.baseUrl` with `authMode: oidc`;
- `config.sentry.dsn`;
- `config.tdrive.intentUrl` when it is a fixed URL. The Drive of each user
  usually has its own host (a URI template): list the Drive hosts in
  `csp.connectSrc` (its API) and `csp.frameSrc` (the picker), with a wildcard
  such as `https://*.workplace.example.com`.

Add other origins with `csp.connectSrc`, and the origins allowed to frame the
app (Twake Workplace, with `config.workplaceEmbedding: true`) with
`csp.frameAncestors`. `csp.reportOnly: true` reports violations without
blocking anything, for a progressive rollout.

## JMAP on the origin of the app

With `ingress.jmap.enabled`, the ingress routes `/jmap`, `/upload`,
`/download`, `/eventSource` and `/.well-known/jmap` of the hosts to the
tmail-backend service `ingress.jmap.service`. Set `config.serverUrl: /`, and make tmail-backend advertise URLs of the host of the app
in its JMAP session (`url.prefix=https://mail.example.com` and
`websocket.url.prefix=wss://mail.example.com` in `jmap.properties`). The
ingress controller must pass WebSocket upgrades through (Traefik and
ingress-nginx do).

## Values

| Key | Default | Description |
|---|---|---|
| `imagePullSecrets` | `[]` | |
| `nameOverride`, `fullnameOverride` | `""` | |
| `deployment.replicaCount` | `2` | Ignored with `autoscaling.enabled` |
| `deployment.image.repository` | `linagora/twake-mail-frontend` | Not published yet: build `apps/private/Dockerfile` and push it to your registry |
| `deployment.image.tag` | `""` | Defaults to the chart `appVersion` |
| `deployment.image.digest` | `""` | Pins the image, the tag is then ignored |
| `deployment.image.pullPolicy` | `IfNotPresent` | `Always` for a floating tag such as `main` |
| `deployment.podAnnotations`, `deployment.podLabels` | `{}` | |
| `deployment.livenessProbe`, `deployment.readinessProbe` | `GET /healthz` | |
| `deployment.podSecurityContext` | non-root 101, `RuntimeDefault` | `enabled: false` leaves it out |
| `deployment.containerSecurityContext` | read-only root filesystem, no privilege escalation, `drop: [ALL]` | `enabled: false` leaves it out |
| `deployment.resources` | requests `10m` / `32Mi`, limit `128Mi` | |
| `deployment.tmpSizeLimit` | `64Mi` | Size limit of the `/tmp` `emptyDir` |
| `deployment.extraEnv` | `[]` | |
| `deployment.nodeSelector`, `tolerations`, `affinity`, `topologySpreadConstraints`, `priorityClassName` | | |
| `service.type`, `service.port` | `ClusterIP`, `8080` | |
| `config.serverUrl` | `https://jmap.example.com` | `SERVER_URL`: base URL of the JMAP server, the session is `<serverUrl>/.well-known/jmap`; a path (`/`) is resolved on the origin of the app |
| `config.jmapSessionUrl` | `""` | Deprecated, use `serverUrl` (rendered as `JMAP_SESSION_URL`) |
| `config.authMode` | `oidc` | `oidc` or `basic` |
| `config.sso.baseUrl` | | OIDC issuer (`SSO_BASE_URL`, not in tmail-flutter) |
| `config.sso.clientId`, `scope` | | `WEB_OIDC_CLIENT_ID` and `OIDC_SCOPES` (commas or spaces; keep `offline_access`) |
| `config.domainRedirectUrl` | `""` | `DOMAIN_REDIRECT_URL`: the redirect URIs are `<it>/login-callback.html` and `<it>/logout-callback.html`; without it `<origin>/callback` and `<origin>/` |
| `config.sso.redirectUri`, `postLogoutRedirect` | `""` | Replace the URIs built from `domainRedirectUrl` |
| `config.sentry.enabled`, `dsn`, `environment` | `true`, `""`, `""` | `SENTRY_ENABLED` (true with a DSN), `SENTRY_DSN`, `SENTRY_ENVIRONMENT`; none of them is written without a DSN (unless `enabled` is false), which leaves the configuration to the ecosystem of the server |
| `config.sentry.feedbackEnabled` | `false` | `SENTRY_FEEDBACK_ENABLED`: the feedback widget, offered to the users who opted in to error reporting (Sentry 24.4.2 or later). Written only when `true`; independent of where the DSN comes from |
| `config.sentryDsn` | `""` | Deprecated, use `sentry.dsn` |
| `config.debug` | `false` | TanStack Query devtools, nginx cache disabled |
| `config.lang` | `en` | Default UI language: `en`, `fr`, `ru`, `vi` |
| `config.calendarSpaUrl`, `config.chatSpaUrl` | `""` | URI templates of the other Twake apps |
| `config.workplaceFqdnFallback` | `""` | The Workplace of the user when the SSO has no `workplaceFqdn` claim (`{localpart}`), where the platform top bar exchanges the ID token; allow the Workplace hosts in `csp.connectSrc` |
| `config.workplaceEmbedding` | `false` | Inside an iframe of Twake Workplace, leave the platform top bar to the container |
| `config.twakeSpaceUrl` | `""` | `TWAKE_SPACE_URL`: no longer read by the app, which learns where TwakeSpace is from its greeting; only serves `frame-ancestors`: allow TwakeSpace in `csp.frameAncestors` |
| `config.forwardWarningMessage` | `""` | |
| `config.tdrive.enabled`, `config.tdrive.intentUrl` | `false`, `""` | Twake Drive picker of the composer (OIDC only); `intentUrl` is the Drive (cozy-stack) of the user, a URI template |
| `config.extraEnvJs` | `""` | JavaScript appended to `.env.js` as is |
| `csp.autoConnectSrc` | `true` | See above |
| `csp.connectSrc`, `csp.frameSrc` | `[]` | Extra sources |
| `csp.frameAncestors` | `["'self'"]` | Who may frame the app |
| `csp.reportUri` | `""` | |
| `csp.reportOnly` | `false` | |
| `csp.policy` | `""` | Replaces the whole policy |
| `referrerPolicy`, `permissionsPolicy` | `""` | Empty keeps the defaults of the image |
| `ingress.enabled`, `className`, `annotations` | `false`, `""`, `{}` | |
| `ingress.hosts[].host` | `mail.example.com` | |
| `ingress.tls.enabled`, `ingress.tls.secretName` | `false`, `twake-mail-frontend-tls` | |
| `ingress.jmap.enabled`, `service.name`, `service.port`, `paths` | `false`, `tmail-backend-jmap`, `80`, the JMAP paths | |
| `autoscaling.enabled`, `minReplicas`, `maxReplicas`, `targetCPUUtilizationPercentage` | `false`, `2`, `5`, `80` | |
| `podDisruptionBudget.enabled`, `maxUnavailable`, `minAvailable` | `true`, `1`, | `minAvailable` wins when set |

## Development

```bash
helm lint deploy/helm/twake-mail-frontend -f deploy/helm/twake-mail-frontend/ci/full-values.yaml
helm template t deploy/helm/twake-mail-frontend -f deploy/helm/twake-mail-frontend/ci/full-values.yaml \
  | kubeconform -strict -summary -
```

The CI (`.github/workflows/helm.yml`) also installs the chart in a kind
cluster with the image built from the same commit, and runs `helm test`.
