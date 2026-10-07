# syntax=docker/dockerfile:1
#
# Twake Mail web image: the SPA served by an unprivileged nginx, on port 80 by
# default (LISTEN_PORT changes it). A drop-in replacement for linagora/tmail-web
# under the linagora/tmail-frontend Helm chart; see docs/deployment.md.
# Build from the repository root (the app is built inside the image):
#
#   docker build -f apps/private/Dockerfile --build-arg BUILD_VERSION=x.y.z -t twake-mail-frontend .
#
# Source maps are uploaded to Sentry when SENTRY_URL, SENTRY_ORG and
# SENTRY_PROJECT are given as build arguments and the token as a build secret:
#
#   SENTRY_AUTH_TOKEN=... docker build --secret id=sentry_auth_token,env=SENTRY_AUTH_TOKEN \
#     --build-arg SENTRY_URL=... --build-arg SENTRY_ORG=... --build-arg SENTRY_PROJECT=... ...
#
# The runtime configuration (.env.js) is mounted at deploy time
# next to index.html; see docs/deployment.md.

# ---------------------------------------------------------------- build
# On the platform of the builder: the bundle is the same for every target
# architecture, only the nginx stage is multi-platform.
FROM --platform=$BUILDPLATFORM node:24-alpine AS build
# git: jmap-client-ts is installed from GitHub
RUN apk add --no-cache git
WORKDIR /src

COPY package.json package-lock.json ./
COPY apps/private/package.json apps/private/
COPY common/package.json common/
RUN npm ci --no-audit --no-fund

COPY . .
ARG BUILD_VERSION=dev
ARG SENTRY_URL=
ARG SENTRY_ORG=
ARG SENTRY_PROJECT=
RUN --mount=type=secret,id=sentry_auth_token,env=SENTRY_AUTH_TOKEN \
    SENTRY_RELEASE="$BUILD_VERSION" npm run build

WORKDIR /src/apps/private/dist
# The runtime configuration is mounted at deploy time: never ship the one of a
# development checkout, which the build copies from public/.
# Hashes of the inline scripts of index.html, allowed by the CSP.
# Assets pre-compressed for gzip_static.
# Source maps are never shipped: those of a build that uploads them to Sentry
# are deleted by the plugin already, this removes any other.
RUN rm -f .env.js \
 && find . -type f -name '*.map' -delete \
 && echo "var APP_VERSION = \"${BUILD_VERSION}\";" > version.js \
 && node /src/scripts/csp-script-hashes.mjs index.html > /src/csp-script-hashes \
 && find . -type f ! -name '.env.js' ! -name 'version.js' \
      ! -name '.env.example.js' -exec gzip -k -9 {} +

# ---------------------------------------------------------------- runtime
FROM nginxinc/nginx-unprivileged:1.31-alpine

ARG BUILD_VERSION=dev
LABEL org.opencontainers.image.title="Twake Mail" \
      org.opencontainers.image.description="Twake Mail webmail (React), served by an unprivileged nginx" \
      org.opencontainers.image.licenses="AGPL-3.0-only" \
      org.opencontainers.image.version="${BUILD_VERSION}"

# The default server of the base image is replaced by nginx.conf.
# nginx-bind: a copy of nginx allowed to bind a port below 1024 through a file
# capability, for clusters whose runtime does not lower
# net.ipv4.ip_unprivileged_port_start. It cannot start under
# `capabilities.drop: [ALL]` or `allowPrivilegeEscalation: false`, so the
# wrapper /usr/local/bin/nginx only picks it when it is needed and works.
USER root
RUN rm -f /etc/nginx/conf.d/default.conf \
 && apk add --no-cache libcap \
 && cp /usr/sbin/nginx /usr/sbin/nginx-bind \
 && setcap cap_net_bind_service=+ep /usr/sbin/nginx-bind \
 && apk del libcap
COPY deploy/docker/nginx.conf /etc/nginx/nginx.conf
COPY deploy/docker/security-headers.conf /etc/nginx/twake-mail/security-headers.conf
COPY --chmod=755 deploy/docker/40-twake-mail-runtime.sh /docker-entrypoint.d/
COPY --chmod=755 deploy/docker/nginx-wrapper.sh /usr/local/bin/nginx
COPY --from=build /src/csp-script-hashes /etc/nginx/twake-mail/csp-script-hashes
COPY --from=build /src/apps/private/dist /usr/share/nginx/html

# Check the configuration with the defaults (nginx -t does not bind: the build
# sandbox may not allow port 80 to a non-root user), then leave /tmp empty: it is a
# tmpfs or an emptyDir at runtime
USER 101
RUN LISTEN_PORT=8080 NGINX_ENTRYPOINT_QUIET_LOGS=1 /docker-entrypoint.d/40-twake-mail-runtime.sh \
 && nginx -t -q \
 && rm -rf /tmp/nginx /tmp/nginx.pid

EXPOSE 80
HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
  CMD wget -q -O /dev/null "http://127.0.0.1:${LISTEN_PORT:-80}/healthz" || exit 1
CMD ["nginx", "-g", "daemon off;"]
