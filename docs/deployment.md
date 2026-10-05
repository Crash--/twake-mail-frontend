# Deploying Twake Mail

Twake Mail is a static single page application: one Docker image serves every
deployment, configured at runtime. It talks JMAP to
[tmail-backend](https://github.com/linagora/tmail-backend) (or any JMAP
server) and signs users in through an OpenID Connect provider (or HTTP Basic
against the JMAP server).

- [The Docker image](#the-docker-image)
- [Published images](#published-images)
- [Runtime configuration](#runtime-configuration)
- [Same configuration as tmail-flutter](#same-configuration-as-tmail-flutter)
- [Docker Compose](#docker-compose)
- [Kubernetes (Helm)](#kubernetes-helm)
- [Deploy with linagora/tmail-frontend](#deploy-with-linagoratmail-frontend)
- [Security headers](#security-headers)
- [Reverse proxy, JMAP on the same origin or not](#reverse-proxy-jmap-on-the-same-origin-or-not)
- [Embedding in Twake Workplace (iframe)](#embedding-in-twake-workplace-iframe)
- [Twake Drive picker](#twake-drive-picker)
- [SSO client](#sso-client)

## The Docker image

`apps/private/Dockerfile` builds the app (Node 24) and serves it with
[`nginxinc/nginx-unprivileged`](https://hub.docker.com/r/nginxinc/nginx-unprivileged):

| | |
|---|---|
| Port | `80`, or `LISTEN_PORT` (the Compose files and the chart of this repository use `8080`) |
| User | `101` (`nginx`), never root; port 80 needs a [sysctl or a capability](#port-80-as-a-non-root-user) |
| Root filesystem | can be read-only: nginx writes only under `/tmp` (tmpfs, `emptyDir`) |
| Health endpoint | `GET /healthz` → `200 ok`, used by the Docker `HEALTHCHECK` |
| Runtime configuration | `/usr/share/nginx/html/.env.js` and `/usr/share/nginx/html/appList.js`, mounted |
| Logs | stdout / stderr; OIDC codes, states, tokens and tickets masked |

```bash
docker build -f apps/private/Dockerfile --build-arg BUILD_VERSION=1.2.3 -t twake-mail-frontend .

docker run --rm -p 127.0.0.1:8080:80 \
  --read-only --tmpfs /tmp --user 101 --cap-drop ALL \
  -v $PWD/my.env.js:/usr/share/nginx/html/.env.js:ro \
  -v $PWD/my.appList.js:/usr/share/nginx/html/appList.js:ro \
  -e CSP_CONNECT_SRC="https://jmap.example.com wss://jmap.example.com https://sso.example.com" \
  twake-mail-frontend
```

The image starts through the entrypoint of the nginx image, which runs the
scripts of `/docker-entrypoint.d/`. `40-twake-mail-runtime.sh`
([source](../deploy/docker/40-twake-mail-runtime.sh)) writes the runtime
nginx configuration into `/tmp/nginx/conf.d/`:

- browser caching: hashed assets cached for a year, `index.html` never;
  everything `no-cache` when `.env.js` sets `DEBUG = true`;
- the [security headers](#security-headers), from the environment.

`.env.js`, `appList.js` and `version.js` are never cached, so a configuration
change is picked up on the next page load (no restart needed, except for the
`DEBUG` cache switch and the security headers, read at startup).

Build arguments:

| Argument | Default | |
|---|---|---|
| `BUILD_VERSION` | `dev` | written to `version.js` (`APP_VERSION`), the Sentry release |
| `SENTRY_URL`, `SENTRY_ORG`, `SENTRY_PROJECT` | | with the build secret `sentry_auth_token`: source maps uploaded to Sentry, then removed from the image |

```bash
SENTRY_AUTH_TOKEN=... docker build -f apps/private/Dockerfile \
  --secret id=sentry_auth_token,env=SENTRY_AUTH_TOKEN \
  --build-arg SENTRY_URL=https://sentry.example.com --build-arg SENTRY_ORG=example \
  --build-arg SENTRY_PROJECT=twake-mail --build-arg BUILD_VERSION=1.2.3 .
```

## Published images

The `Docker image` workflow (`.github/workflows/docker.yml`) builds the image
on every pull request (`linux/amd64` and `linux/arm64`, never pushed) and
publishes it on a push to `main` and on a version tag:

| Event | Tags |
|---|---|
| push to `main` | `main`, `sha-<short sha>` |
| tag `v1.2.3` | `1.2.3`, `1.2`, `1`, `latest`, `sha-<short sha>` (no `1` nor `latest` for `0.x`) |

Before publishing, it runs [`deploy/docker/smoke-test.sh`](../deploy/docker/smoke-test.sh)
on the image (non-root, read-only root filesystem, health endpoint, cache
policy, security headers, Docker healthcheck) and a Trivy scan (report only).
The image carries OCI labels, an SBOM and a provenance attestation.

The image goes to `ghcr.io/<owner>/twake-mail-frontend`, or to the repository
variable `IMAGE_REPOSITORY` (a full name with its registry, e.g.
`docker.io/example/twake-mail-frontend`, with the secrets `REGISTRY_USERNAME`
and `REGISTRY_PASSWORD`). A GitHub owner whose name is not a valid image path
component (`name--`) cannot own a GHCR image: the workflow then builds without
pushing until `IMAGE_REPOSITORY` is set.

`version.js` holds the version (`1.2.3` on a tag, `main-<sha>` otherwise),
also the Sentry release.

## Runtime configuration

Two files, mounted next to `index.html`:

- `.env.js`: the settings, documented in
  [`public/.env.example.js`](../public/.env.example.js) and
  [`upgrade-instructions/0.1.0.md`](../upgrade-instructions/0.1.0.md),
  validated at startup (an invalid configuration shows a screen listing the
  problems);
- `appList.js`: the applications of the app grid
  ([example](../public/appList.example.js)).

Without `.env.js` (nor an `env.file`, see below) the app shows its "refresh"
fallback page: the configuration is required. `appList.js` is optional (no
app grid).

## Same configuration as tmail-flutter

The keys of `.env.js` that exist in the
[`env.file`](https://github.com/linagora/tmail-flutter/blob/master/env.file)
of tmail-flutter have its names and its value formats, so that one deployment
configuration serves both apps. The values of an `env.file` are strings
(`'true'`, not `true`): both forms work here.

| tmail-flutter key | Meaning there | Here |
|---|---|---|
| `SERVER_URL` | Base URL of the JMAP server; the session is read from `<SERVER_URL>/.well-known/jmap`; also where it looks for the OIDC provider (WebFinger) | Same for the session (trailing slashes ignored, a path prefix is kept). Without `SSO_BASE_URL`, the SSO is found by [WebFinger](#finding-the-sso-webfinger) on it, as in tmail-flutter. The image adds its origin and its WebSocket to the CSP. Former `JMAP_SESSION_URL` (full URL) still read |
| `DOMAIN_REDIRECT_URL` | URL of the web app; OIDC redirect `<it>/login-callback.html`, post-logout `<it>/logout-callback.html` | Same, the two routes are served by the app. `SSO_REDIRECT_URI` and `SSO_POST_LOGOUT_REDIRECT` override them. Without any of them `<origin>/callback` and `<origin>/` |
| `WEB_OIDC_CLIENT_ID` | OIDC public client of the web app | Same. Former `SSO_CLIENT_ID` still read |
| `OIDC_SCOPES` | Scopes separated by commas, default `openid,profile,email,offline_access` | Same; spaces work too. Former `SSO_SCOPE` (spaces) still read |
| `APP_GRID_AVAILABLE` | `supported` loads `configurations/app_dashboard.json` into the app grid, anything else hides it | `supported` shows the grid of `appList.js`, or else of `/assets/configurations/app_dashboard.json` (see [below](#app-grid-app_dashboardjson)); anything else hides it. Unset: shown when `appList.js` has apps |
| `FORWARD_WARNING_MESSAGE` | Warning of Settings > Forwarding | Same |
| `SENTRY_ENABLED`, `SENTRY_DSN`, `SENTRY_ENVIRONMENT` | Sentry starts with `SENTRY_ENABLED=true` and a DSN and an environment; a reporting preference, and the ecosystem as a fallback | Same sources: one filled key makes the configuration come from the environment (even off), none leaves it to the ecosystem of the server. Starts with `SENTRY_ENABLED=true` and a DSN, and **never before the user opted in** (Settings > Preferences, stored in the account). Without `SENTRY_ENABLED` a DSN alone still starts it, with a console warning. See [sentry.md](sentry.md) |
| `FCM_AVAILABLE`, `IOS_FCM`, `FIREBASE_*` | Push notifications of the mobile apps | Ignored |
| `PLATFORM` | `saas` enables the sign-up flow of the mobile app | Ignored |
| `WS_ECHO_PING` | Sends an echo ping on the push WebSocket | Not supported |
| `FORCE_EMAIL_QUERY` | Refreshes the list with `Email/query` instead of `Email/changes` | Not supported (the list is a TanStack Query cache, refetched on push) |
| `COZY_INTEGRATION` | Loads the cozy-external-bridge script in a Cozy | Same as `WORKPLACE_EMBEDDING`: the bridge is bundled, no script is loaded. Inside an iframe of the Workplace the top bar leaves the logotype and the app grid to the container. The image logs a warning without `CSP_FRAME_ANCESTORS` |
| `COZY_EXTERNAL_BRIDGE_VERSION` | Version of the bridge script it loads | Ignored (the bridge is bundled) |

Keys that only this app has: `AUTH_MODE` (`oidc` or `basic`; unset, the SSO is
looked for and the credentials form shows when there is none, as in
tmail-flutter), `SSO_BASE_URL` (the issuer; overrides the WebFinger lookup), `SSO_REDIRECT_URI`,
`SSO_POST_LOGOUT_REDIRECT`, `DEBUG`, `LANG`, `CALENDAR_SPA_URL`,
`CHAT_SPA_URL`, `WORKPLACE_FQDN_FALLBACK`, `WORKPLACE_EMBEDDING`,
`TDRIVE_ENABLED`, `TDRIVE_INTENT_URL`. tmail-flutter takes the calendar and
the Workplace host from the `.well-known/linagora-ecosystem` document of the
server; this app reads that document only for error reporting and the storage
upgrade (below), not for the calendar nor the Workplace host of the app grid.

### Storage upgrade (paywall)

As in tmail-flutter, a link to buy more storage (quota banner, sidebar footer,
Settings > Storage, composer error) is shown only when the JMAP session has
the capability `com:linagora:params:saas` with `canUpgrade` (and not already
`isPaying` on the highest plan), the app runs inside Twake Workplace
(`WORKPLACE_EMBEDDING` in an iframe), and a safe `https` URL is found: the
Workplace of the user (`workplaceFqdn` claim, else `WORKPLACE_FQDN_FALLBACK`,
else `workplaceFqdnFallback` of the ecosystem) plus `/settings/premium`, else
the `paywallUrlTemplate` of the ecosystem (`{localPart}`, `{domainName}`,
`{domainPart}`). The ecosystem document is requested only when nothing else
gives the URL; the server must allow it (same origin as `SERVER_URL`).

A former name is read when the new one is absent or blank, and logged once as
a warning in the console (`[config] JMAP_SESSION_URL is deprecated, use
SERVER_URL ...`).

### Mounting an `env.file`

Like the image of tmail-flutter, the image accepts an `env.file` mounted at
`/usr/share/nginx/html/assets/env.file`:

```bash
docker run --rm -p 127.0.0.1:8080:80 --read-only --tmpfs /tmp \
  -v $PWD/env.file:/usr/share/nginx/html/assets/env.file:ro \
  twake-mail-frontend
```

When no `.env.js` is mounted, the entrypoint converts the `env.file`
(`KEY=VALUE` lines; comments, blank lines, `export`, quotes and ` # comment`
understood) into a `/.env.js` served by nginx, written under `/tmp` only. A
mounted `.env.js` takes precedence. An `env.file` alone is enough: without
`SSO_BASE_URL` the SSO is [found by WebFinger](#finding-the-sso-webfinger),
as in tmail-flutter (`SSO_BASE_URL` and `AUTH_MODE` override that).

## Docker Compose

Two examples in [`deploy/docker-compose/`](../deploy/docker-compose/), both
building the image from the repository (set `TWAKE_MAIL_IMAGE` to use a
published one) and running it as in production (user 101, read-only root
filesystem, `/tmp` tmpfs, no capability).

**The app alone**, in front of an existing JMAP server and SSO:

```bash
cd deploy/docker-compose
cp config/.env.example.js config/.env.js          # set SERVER_URL, SSO_*, WEB_OIDC_CLIENT_ID
cp config/appList.example.js config/appList.js
CSP_CONNECT_SRC="https://jmap.example.com wss://jmap.example.com https://sso.example.com" \
  docker compose up -d --build
```

The app answers on `http://127.0.0.1:8080` (`TWAKE_MAIL_PORT`): put the TLS
reverse proxy in front of it. `CSP_FRAME_ANCESTORS` and `CSP_REPORT_ONLY` are
passed through too. Create both files before `up`: Docker would mount empty
directories in their place.

**A demo** with tmail-backend (memory image: nothing is kept), basic
authentication, and an nginx putting the app and JMAP on one origin:

```bash
cd deploy/docker-compose/demo
docker compose up -d --build
# http://localhost:8080, alice@example.com / alice (or bob@example.com / bob)
docker compose down -v
```

tmail-backend builds the URLs of its JMAP session from the
`X-JMAP-PREFIX` / `X-JMAP-WEBSOCKET-PREFIX` headers of the proxy
(`dynamic.jmap.prefix.resolution.enabled`), so the demo works on any host
name and port. Not meant for production: no TLS, no SSO, no persistence.

## Kubernetes (Helm)

The chart [`deploy/helm/twake-mail-frontend`](../deploy/helm/twake-mail-frontend/README.md)
follows Linagora's Twake Workplace deployment conventions (values under
`deployment.*`, `config.*`, `ingress.*`):

- a `Deployment` (2 replicas) running the image as user 101 with a read-only
  root filesystem, no capability, `RuntimeDefault` seccomp, `/tmp` as an
  `emptyDir`, probes on `/healthz`;
- a `ConfigMap` rendering `.env.js` and `appList.js` from typed values
  (`config.serverUrl`, `config.authMode`, `config.sso.*`,
  `config.appList`...), mounted next to `index.html`; a checksum annotation
  rolls the pods when it changes;
- the Content-Security-Policy origins derived from the configuration (JMAP
  and its WebSocket, SSO, Sentry), plus `csp.*`;
- a `Service`, an optional `Ingress` (which can route the JMAP paths to
  tmail-backend for a same-origin setup), a `PodDisruptionBudget`, an optional
  `HorizontalPodAutoscaler`, and a `helm test`.

```bash
helm install twake-mail deploy/helm/twake-mail-frontend \
  --namespace twake-mail --create-namespace -f my-values.yaml
```

The `Helm chart` workflow lints it, validates the rendered manifests with
kubeconform, installs it in a kind cluster with the image of the same commit
(`helm test`), and publishes it as an OCI artifact on a push to `main`
(`oci://ghcr.io/<owner>/charts`, or the repository variable
`CHART_REPOSITORY`; same restriction on the owner name as the image).

## Deploy with linagora/tmail-frontend

Linagora deploys tmail-flutter's web image (`linagora/tmail-web`) with the
Helm chart `linagora/tmail-frontend` (1.0.12 tested). The image of this
repository is a drop-in replacement under the same chart, the same values and
the same ConfigMap: only the image changes.

What the chart imposes, and how the image answers:

| The chart | The image |
|---|---|
| `containerPort: 80`, probes `GET /` on port 80 | Listens on port 80 by default; `/` answers `200` |
| `env.file` rendered from `config.*`, mounted at `/usr/share/nginx/html/assets/env.file` | Converted into `/.env.js` at startup (keys [above](#same-configuration-as-tmail-flutter)) |
| `config.appGrid` rendered to `/usr/share/nginx/html/assets/configurations/app_dashboard.json`, icons named by files of the Flutter bundle (`ic_twake_app.svg`...) | Read by the app, the icons [mapped](#app-grid-app_dashboardjson) to those it ships |
| No SSO URL | The SSO is [found by WebFinger](#finding-the-sso-webfinger) on `serverUrl`, the Basic form shows when there is none |
| `serverUrl` on another origin than the app | The CSP `connect-src` is derived from `env.file` at startup |
| No `securityContext` by default, writable root filesystem | Works as is; [hardened values](#port-80-as-a-non-root-user) available |

The values to set (a complete example with `example.com` addresses is
[`workplace-values.yaml`](../deploy/helm/linagora-tmail-frontend/workplace-values.yaml)):

```yaml
image:
  registry: ghcr.io # or the registry set by IMAGE_REPOSITORY
  repository: <owner>/twake-mail-frontend
  tag: 1.2.3 # a version tag, immutable

config:
  serverUrl: https://jmap.example.com
  domainRedirectUrl: https://mail.example.com
  clientID: <the OIDC public client of the app>
  appGridAvailable: supported
  cozyIntegration: true # inside Twake Workplace
  appGrid: { apps: [...] } # unchanged

# Only with cozyIntegration: who may frame the app (one origin per user here)
extraEnv:
  - name: CSP_FRAME_ANCESTORS
    value: "'self' https://*.example.com"
```

Nothing else changes: `config.sentry.*` works (the CSP allows the ingest
origin of the DSN), `ingress.*` and `resources` too (the image needs less
than the chart's default limits). To switch from `tmail-web`: change
`image.repository` and `image.tag`, `helm upgrade`, and sign in again. Going
back is the same change. An OIDC client registered for tmail-flutter works as
is, the redirect URIs being the same (`<domainRedirectUrl>/login-callback.html`
and `/logout-callback.html`).

Ignored, because they concern the mobile apps or what this app does
differently: `fcmAvailable`, `iosFcm`, `fcm.*` (`env.fcm` is not even mounted),
`platformType` (`PLATFORM`), `forceEmailQuery` (`FORCE_EMAIL_QUERY`: the list
is refetched on push), `COZY_EXTERNAL_BRIDGE_VERSION`. `forwardWarningMessage`,
`oidcScopes`, `appGridAvailable`, `config.sentry.*` and `cozyIntegration` are
used.

`COZY_INTEGRATION=true` turns on the Workplace embedding (as
`WORKPLACE_EMBEDDING`): tmail-flutter injects the cozy-external-bridge script
at a pinned version, this app bundles the bridge, so the CSP needs no extra
`script-src`. Inside an iframe the container holds the logotype and the app
grid. The image cannot guess who frames the app (tmail-flutter has no rule
either, its policy says `frame-ancestors 'self'`), and never allows `*`: give
the origins of the Workplace in `CSP_FRAME_ANCESTORS`, or browsers refuse to
show the app in the frame. The container logs a warning at startup when
`COZY_INTEGRATION` is on and it is not set.

### Port 80 as a non-root user

The image keeps running as user 101. A non-root process may bind a port below
1024 when the kernel says so (`net.ipv4.ip_unprivileged_port_start`) or when
it has `CAP_NET_BIND_SERVICE`. Tested:

| Context | Result |
|---|---|
| Docker defaults (the sysctl is 0) | Works |
| Kubernetes on kind (containerd lowers the sysctl) | Works, with the chart's defaults and with the hardened values below |
| Sysctl kept at 1024, default capabilities | Works: the start script runs `nginx-bind`, a copy of nginx with the file capability `cap_net_bind_service` |
| Sysctl at 1024, `capabilities.drop: [ALL]` or `allowPrivilegeEscalation: false` | The container stops with a message naming the sysctl (a binary with a file capability cannot even start without the capability; with `no_new_privs` the kernel ignores it) |
| `LISTEN_PORT=8080` | Works everywhere |

So the chart's defaults work on any cluster whose runtime keeps the default
capabilities. For a restricted pod security profile, set the sysctl (safe
since Kubernetes 1.22) rather than a capability, with a read-only root
filesystem and `/tmp` as an `emptyDir`
([`hardened-values.yaml`](../deploy/helm/linagora-tmail-frontend/hardened-values.yaml)):

```yaml
podSecurityContext:
  runAsNonRoot: true
  runAsUser: 101
  fsGroup: 101
  seccompProfile: { type: RuntimeDefault }
  sysctls:
    - { name: net.ipv4.ip_unprivileged_port_start, value: "0" }
securityContext:
  allowPrivilegeEscalation: false
  readOnlyRootFilesystem: true
  capabilities: { drop: [ALL] }
extraVolumes: [{ name: tmp, emptyDir: {} }]
extraVolumeMounts: [{ name: tmp, mountPath: /tmp }]
```

The chart mounts `env.file` and `app_dashboard.json` as `subPath` files: they
work with a read-only root filesystem.

### Finding the SSO (WebFinger)

Without `SSO_BASE_URL` (and with `AUTH_MODE` unset), the app finds the SSO as
tmail-flutter does, before it starts:

1. `GET <SERVER_URL>/.well-known/webfinger?resource=<origin of SERVER_URL>&rel=http://openid.net/specs/connect/1.0/issuer`,
   without credentials, five seconds at most; the `href` of the link with that
   relation is the issuer (else the first link);
2. otherwise `SERVER_URL` itself, if it serves `/.well-known/openid-configuration`;
3. otherwise the Basic form (credentials checked against the JMAP session), as
   tmail-flutter's login page. With `AUTH_MODE=oidc` explicit the SSO is
   required: no fallback.

`SSO_BASE_URL` skips the lookup; `AUTH_MODE=basic` too. The issuer found is
kept in `sessionStorage` for the round trip to the SSO. The server must answer
CORS on the WebFinger path when it is not on the origin of the app.

The browser can only call the issuer if the CSP allows its origin, and the
issuer is only known at runtime. The options considered:

- **(a) The image asks the same question at startup** and adds the origin to
  `connect-src`. Implemented, because it is the only way to make the chart's
  values enough. Bounded: two attempts of `CSP_WEBFINGER_TIMEOUT` seconds
  (3), one second apart, 7 seconds at most before nginx starts; never fatal,
  never following a redirect, no credentials, http(s) only, 64 KiB at most,
  the origin validated before it reaches the configuration. Trade-offs: the
  answer is the state of the SSO at startup (after a change, restart the pods
  or use (b)); a JMAP server not reachable from the pod, or not yet up, gives
  no origin (a warning is logged and the login fails with "Refused to
  connect" until (b) is set), and then the 7 seconds delay the start of
  nginx: the readiness probe of the chart (5 s initial delay, every 30 s)
  fails once or twice, the pod is ready after ~35 s (set
  `CSP_WEBFINGER_DISCOVERY=false` with (b) to avoid it); the pod makes one
  outgoing request. A server
  that lies can only get its own answer's origin allowed to be *contacted*,
  never scripts nor frames.
- **(b) `CSP_CONNECT_SRC` through `extraEnv`**: deterministic, added to
  what is derived. The reference when (a) is unwanted
  (`CSP_WEBFINGER_DISCOVERY=false`), when the SSO has endpoints on other
  origins than its issuer, or when the server is not reachable from the pod.
- **(c) `connect-src https:`**, as tmail-flutter's policy: no work, but any
  injected script could send data anywhere. Not done.

### App grid (app_dashboard.json)

With `APP_GRID_AVAILABLE=supported` and no app in `appList.js`, the app reads
`/assets/configurations/app_dashboard.json` (same origin, five seconds at
most) before it starts: `{"apps": [{"appName", "appLink", "icon"}]}`. The
`icon` names a file of tmail-flutter's bundle; the app shows its own icon:

| `icon` | Shown |
|---|---|
| `ic_twake_app.svg` | `app-chat.svg` |
| `ic_tdrive_app.svg` | `app-drive.svg` |
| `ic_tmail_app.svg` | `app-mail.svg` |
| `ic_calendar_app.svg` | `app-calendar.svg` |
| `ic_contacts_app.svg` | `app-contacts.svg` |
| `ic_teleskop_app.svg` | `app-meet.svg` |
| any other name (`ic_linshare_app.png`...) | `app-generic.svg` |

An absolute URL or path as `icon`, or a `publicIconUri`, is used as is. The
icons are in `/assets/images/svg/`. A missing or malformed file gives an empty
grid. Fields for the mobile apps (`androidPackageId`, `iosUrlScheme`...) are
ignored.

### Tests

[`deploy/docker/smoke-test.sh`](../deploy/docker/smoke-test.sh) starts the
image as the chart does (port 80, the two files mounted at the paths above, a
stub answering WebFinger) in the default, the hardened and the blocked
contexts. [`deploy/helm/linagora-tmail-frontend/test.sh`](../deploy/helm/linagora-tmail-frontend/test.sh)
pulls the chart, renders it with Workplace-like values and, with `--kind`,
installs it in a kind cluster (default context, sysctl kept at 1024,
hardened). The end-to-end suite starts the image the same way
([`e2e/README.md`](../e2e/README.md)).

## Security headers

Every response carries:

| Header | Value |
|---|---|
| `Content-Security-Policy` | see below |
| `X-Content-Type-Options` | `nosniff` |
| `Referrer-Policy` | `same-origin` (`REFERRER_POLICY`) |
| `Permissions-Policy` | `accelerometer=(), camera=(), geolocation=(), gyroscope=(), magnetometer=(), microphone=(), payment=(), usb=()` (`PERMISSIONS_POLICY`) |

`Strict-Transport-Security` belongs to the TLS terminating proxy or ingress,
not to the image (served over plain HTTP).

### Content-Security-Policy

The default policy only allows the origin of the app:

```
default-src 'self';
script-src 'self' 'sha256-…';
style-src 'self' 'unsafe-inline';
img-src 'self' data: blob: cid: https: http:;
font-src 'self' data: https: http:;
connect-src 'self' data: blob: ws://<host> wss://<host> $CSP_CONNECT_SRC;
frame-src 'self' blob: $CSP_FRAME_SRC;
frame-ancestors $CSP_FRAME_ANCESTORS;
object-src 'none'; base-uri 'self'; form-action 'self'
```

- `script-src`: the bundle, and the inline script of `index.html` through its
  hash, computed at build time. No `eval`, no inline event handler.
- `style-src 'unsafe-inline'`: MUI (emotion) injects its styles at runtime.
- `img-src`, `font-src`: the email reader renders each body in a sandboxed
  `blob:` frame, which inherits this policy. The frame adds its own policy:
  no remote image nor font until the user unblocks the remote content of the
  email, then any `http:` / `https:` source. Images of the app grid may come
  from other origins too. `cid:`: the composer keeps the inline images of a
  quoted email as `cid:` URLs, which never load (no console noise).
- `connect-src`: JMAP (API, upload, download, push WebSocket), the SSO
  (discovery, token, userinfo) and Sentry. `<host>` is the `Host` of the
  request: a JMAP server on the origin of the app works without any setting.
  The image adds, from the configuration it reads at startup: the origin of
  `SERVER_URL` and its `ws:`/`wss:` counterpart, `SSO_BASE_URL`, the SSO found
  by WebFinger on `SERVER_URL` (see [below](#finding-the-sso-webfinger)) and
  the Sentry origin of `SENTRY_DSN`.
  `data:` and `blob:`: the composer reads pasted and quoted images with
  `fetch()` before uploading them.
- `frame-src blob:`: the email body and the HTML blocks of the composer.

Environment variables of the container:

| Variable | Default | |
|---|---|---|
| `CSP_CONNECT_SRC` | | Extra `connect-src` sources, space separated, added to those the image derives from `SERVER_URL`, `SSO_BASE_URL` and `SENTRY_DSN`: the origins of the SSO endpoints when they are not on the one of the issuer, the Sentry ingest origin of a DSN given by the ecosystem of the server, a SSO the image could not find |
| `CSP_WEBFINGER_DISCOVERY` | `true` | `false`: no WebFinger request at startup |
| `CSP_WEBFINGER_TIMEOUT` | `3` | Seconds of each of its two attempts |
| `LISTEN_PORT` | `80` | The port nginx listens on |
| `CSP_FRAME_SRC` | | Extra `frame-src` sources, e.g. the Twake Drive origin for its intents |
| `CSP_FRAME_ANCESTORS` | `'self'` | Origins allowed to embed Twake Mail in a frame, see [below](#embedding-in-twake-workplace-iframe) |
| `CSP_REPORT_URI` | | Adds `report-uri`: where browsers report violations (e.g. the security endpoint of a Sentry project) |
| `CSP_REPORT_ONLY` | `false` | `true` sends `Content-Security-Policy-Report-Only` instead: nothing blocked, violations reported. For a progressive rollout |
| `CONTENT_SECURITY_POLICY` | | Replaces the whole policy (the variables above are then ignored) |
| `REFERRER_POLICY` | `same-origin` | |
| `PERMISSIONS_POLICY` | see above | |

Values must hold on one line, without double quotes, backslashes nor dollar
signs (and, for the source lists, without `;` nor `,`): the container refuses
to start otherwise.

**The SSO is almost always on another origin.** Its origin comes from
`SSO_BASE_URL`, or from the WebFinger request the image makes at startup; in
any other case (`CSP_WEBFINGER_DISCOVERY=false`, an SSO that did not answer
then, endpoints of the SSO on other origins) put it in `CSP_CONNECT_SRC`, or
the login fails ("Refused to connect" in the browser console). Check the
browser console after any change of the configuration that adds an origin. The AI assistant of the composer, when tmail-backend
advertises `com:linagora:params:jmap:aibot`, talks to its `scribeEndpoint`:
put that origin in `CSP_CONNECT_SRC` too.

## Reverse proxy, JMAP on the same origin or not

Two layouts work:

- **Same origin** (recommended): the proxy in front of the app routes `/jmap`,
  `/upload`, `/download`, `/eventSource` and `/.well-known/jmap` to
  tmail-backend, and everything else to the app. No CORS, and `connect-src
  'self'` covers JMAP. tmail-backend must advertise URLs of that origin in the
  JMAP session: either `url.prefix` / `websocket.url.prefix` in its
  `jmap.properties`, or `dynamic.jmap.prefix.resolution.enabled=true` with the
  `X-JMAP-PREFIX` and `X-JMAP-WEBSOCKET-PREFIX` request headers set by the
  proxy. The WebSocket (`/jmap/ws`) needs the `Upgrade` and `Connection`
  headers forwarded.
- **Another origin** (`jmap.example.com`): tmail-backend answers CORS itself
  (`Access-Control-Allow-Origin: *`); add the JMAP origin and its `wss://`
  origin to `CSP_CONNECT_SRC`.

## Embedding in Twake Workplace (iframe)

Inside Twake Workplace, the app runs in an iframe of the Workplace container:

1. set `var WORKPLACE_EMBEDDING = true` in `.env.js`: inside an iframe, the
   top bar leaves the logotype and the app grid to the container;
2. allow the container to frame the app. By default only the origin of the
   app may (`frame-ancestors 'self'`); list the origins of the Workplace:

```bash
-e CSP_FRAME_ANCESTORS="'self' https://workplace.example.com https://*.workplace.example.com"
```

Keep the quotes around `'self'` (a CSP keyword). A wildcard covers the
Workplace of every user when each one has its own host. Browsers ignore
`X-Frame-Options` when `frame-ancestors` is set, so the image does not send
it; make sure the reverse proxy does not add one either.

## Twake Drive picker

With `TDRIVE_ENABLED = true` (OIDC only), the composer trades the ID token
for a Drive token and opens the Drive picker in a frame. The browser then
talks to the Drive (cozy-stack) of the user, `TDRIVE_INTENT_URL`, and frames
the Drive application, usually on another host (`<user>-drive.<domain>`).
Allow both, with wildcards when every user has their own host:

```bash
-e CSP_CONNECT_SRC="https://sso.example.com https://*.workplace.example.com" \
-e CSP_FRAME_SRC="https://*.workplace.example.com"
```

The cozy-stack must also accept the token exchange for this OIDC client and
this origin.


Register a public client (no secret) using Authorization Code with PKCE
(S256):

- redirect URI: `<DOMAIN_REDIRECT_URL>/login-callback.html` (or
  `SSO_REDIRECT_URI`), by default `https://<app>/callback`;
- post-logout redirect URI: `<DOMAIN_REDIRECT_URL>/logout-callback.html` (or
  `SSO_POST_LOGOUT_REDIRECT`), by default
  `https://<app>/`;
- scopes `openid profile email offline_access`, refresh tokens allowed;
- the access token must be accepted by tmail-backend (its OIDC audience).
