# Build from the repository root, after `npm ci && npm run build`:
#   docker build -f apps/private/Dockerfile --build-arg BUILD_VERSION=x.y.z .
FROM nginx:alpine
RUN apk add --no-cache gzip
COPY nginx.conf /etc/nginx
COPY apps/private/dist /usr/share/nginx/html
# The runtime configuration is mounted at deploy time: never ship the one of a
# development checkout, which the build copies from public/.
RUN rm -f /usr/share/nginx/html/.env.js /usr/share/nginx/html/appList.js
ARG BUILD_VERSION=dev
RUN echo "var APP_VERSION = \"${BUILD_VERSION}\";" > /usr/share/nginx/html/version.js

# Initialize cache_env.conf with defaults so Nginx configuration checks pass during build
RUN echo "map \$uri \$static_cache_control { default \"no-cache\"; }" > /etc/nginx/conf.d/cache_env.conf && \
    echo "map \$uri \$html_cache_control { default \"no-cache\"; }" >> /etc/nginx/conf.d/cache_env.conf

# Compress static files at build-time (exclude runtime configuration and version)
RUN find /usr/share/nginx/html -type f ! -name '.env.js' ! -name 'version.js' ! -name 'appList.js' ! -name '.env.example.js' ! -name 'appList.example.js' -exec gzip -k -f {} \;

EXPOSE 80

CMD sh -c 'if [ -f /usr/share/nginx/html/.env.js ] && grep -q -E "DEBUG\s*=\s*true" /usr/share/nginx/html/.env.js; then \
             echo "map \$uri \$static_cache_control { default \"no-cache\"; }" > /etc/nginx/conf.d/cache_env.conf; \
             echo "map \$uri \$html_cache_control { default \"no-cache\"; }" >> /etc/nginx/conf.d/cache_env.conf; \
             echo "Debug mode detected. Disabling Nginx browser cache."; \
           else \
             echo "map \$uri \$static_cache_control { default \"public, max-age=31536000, immutable\"; }" > /etc/nginx/conf.d/cache_env.conf; \
             echo "map \$uri \$html_cache_control { default \"no-store, no-cache, must-revalidate, proxy-revalidate\"; }" >> /etc/nginx/conf.d/cache_env.conf; \
             echo "Production mode detected. Enabling Nginx browser cache."; \
           fi && nginx -g "daemon off;"'
