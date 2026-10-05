# syntax=docker/dockerfile:1
#
# Twake Mail web image: the SPA served by an unprivileged nginx on port 8080.
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
# The runtime configuration (.env.js, appList.js) is mounted at deploy time
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
RUN rm -f .env.js appList.js \
 && echo "var APP_VERSION = \"${BUILD_VERSION}\";" > version.js \
 && node /src/scripts/csp-script-hashes.mjs index.html > /src/csp-script-hashes \
 && find . -type f ! -name '.env.js' ! -name 'version.js' ! -name 'appList.js' \
      ! -name '.env.example.js' ! -name 'appList.example.js' -exec gzip -k -9 {} +

# ---------------------------------------------------------------- runtime
FROM nginxinc/nginx-unprivileged:1.31-alpine

ARG BUILD_VERSION=dev
LABEL org.opencontainers.image.title="Twake Mail" \
      org.opencontainers.image.description="Twake Mail webmail (React), served by an unprivileged nginx" \
      org.opencontainers.image.licenses="AGPL-3.0-only" \
      org.opencontainers.image.version="${BUILD_VERSION}"

# The default server of the base image is replaced by nginx.conf
RUN rm -f /etc/nginx/conf.d/default.conf
COPY deploy/docker/nginx.conf /etc/nginx/nginx.conf
COPY deploy/docker/security-headers.conf /etc/nginx/twake-mail/security-headers.conf
COPY --chmod=755 deploy/docker/40-twake-mail-runtime.sh /docker-entrypoint.d/
COPY --from=build /src/csp-script-hashes /etc/nginx/twake-mail/csp-script-hashes
COPY --from=build /src/apps/private/dist /usr/share/nginx/html

# Check the configuration with the defaults, then leave /tmp empty: it is a
# tmpfs or an emptyDir at runtime
RUN NGINX_ENTRYPOINT_QUIET_LOGS=1 /docker-entrypoint.d/40-twake-mail-runtime.sh \
 && nginx -t -q \
 && rm -rf /tmp/nginx /tmp/nginx.pid

USER 101
EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
  CMD wget -q -O /dev/null http://127.0.0.1:8080/healthz || exit 1
CMD ["nginx", "-g", "daemon off;"]
