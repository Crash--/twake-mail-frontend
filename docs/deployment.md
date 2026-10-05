# Deploying Twake Mail

Twake Mail is a static single page application: one Docker image serves every
deployment, configured at runtime. It talks JMAP to
[tmail-backend](https://github.com/linagora/tmail-backend) (or any JMAP
server) and signs users in through an OpenID Connect provider (or HTTP Basic
against the JMAP server).

- [The Docker image](#the-docker-image)
- [Published images](#published-images)
- [Runtime configuration](#runtime-configuration)
- [Docker Compose](#docker-compose)
- [Kubernetes (Helm)](#kubernetes-helm)
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
| Port | `8080` |
| User | `101` (`nginx`), never root |
| Root filesystem | can be read-only: nginx writes only under `/tmp` (tmpfs, `emptyDir`) |
| Health endpoint | `GET /healthz` → `200 ok`, used by the Docker `HEALTHCHECK` |
| Runtime configuration | `/usr/share/nginx/html/.env.js` and `/usr/share/nginx/html/appList.js`, mounted |
| Logs | stdout / stderr; OIDC codes, states, tokens and tickets masked |

```bash
docker build -f apps/private/Dockerfile --build-arg BUILD_VERSION=1.2.3 -t twake-mail-frontend .

docker run --rm -p 127.0.0.1:8080:8080 \
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

Without `.env.js` the app shows its "refresh" fallback page: the file is
required. `appList.js` is optional (no app grid).

## Docker Compose

Two examples in [`deploy/docker-compose/`](../deploy/docker-compose/), both
building the image from the repository (set `TWAKE_MAIL_IMAGE` to use a
published one) and running it as in production (user 101, read-only root
filesystem, `/tmp` tmpfs, no capability).

**The app alone**, in front of an existing JMAP server and SSO:

```bash
cd deploy/docker-compose
cp config/.env.example.js config/.env.js          # set JMAP_SESSION_URL, SSO_*
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
  (`config.jmapSessionUrl`, `config.authMode`, `config.sso.*`,
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

## Security headers

Every response carries:

| Header | Value |
|---|---|
| `Content-Security-Policy` | see below |
| `X-Content-Type-Options` | `nosniff` |
| `Referrer-Policy` | `same-origin` (`REFERRER_POLICY`) |
| `Permissions-Policy` | `accelerometer=(), camera=(), geolocation=(), gyroscope=(), magnetometer=(), microphone=(), payment=(), usb=()` (`PERMISSIONS_POLICY`) |

`Strict-Transport-Security` belongs to the TLS terminating proxy or ingress,
not to the image (served over plain HTTP on 8080).

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
  `data:` and `blob:`: the composer reads pasted and quoted images with
  `fetch()` before uploading them.
- `frame-src blob:`: the email body and the HTML blocks of the composer.

Environment variables of the container:

| Variable | Default | |
|---|---|---|
| `CSP_CONNECT_SRC` | | Extra `connect-src` sources, space separated: the JMAP origin **and** its WebSocket origin when JMAP is not on the origin of the app (`https://jmap.example.com wss://jmap.example.com`), the SSO origin with `AUTH_MODE = 'oidc'` (`https://sso.example.com`), the Sentry ingest origin when `SENTRY_DSN` is set |
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

**The SSO is almost always on another origin**: with `AUTH_MODE = 'oidc'`,
put its origin in `CSP_CONNECT_SRC`, or the login fails ("Refused to connect"
in the browser console). Check the browser console after any change of
`.env.js` that adds an origin (`JMAP_SESSION_URL`, `SSO_BASE_URL`,
`SENTRY_DSN`). The AI assistant of the composer, when tmail-backend
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

- redirect URI: `SSO_REDIRECT_URI`, by default `https://<app>/callback`;
- post-logout redirect URI: `SSO_POST_LOGOUT_REDIRECT`, by default
  `https://<app>/`;
- scopes `openid profile email offline_access`, refresh tokens allowed;
- the access token must be accepted by tmail-backend (its OIDC audience).
