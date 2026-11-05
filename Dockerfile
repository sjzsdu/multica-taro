# syntax=docker/dockerfile:1

# ---- build stage -----------------------------------------------------------
# Taro compiles the H5 bundle; the runtime stage only serves static files and
# proxies the API, so Node never ships to production.
FROM node:22-bookworm-slim AS build

WORKDIR /app

# .npmrc pins legacy-peer-deps (Babel 8 vs babel-preset-taro peer conflict).
COPY package.json package-lock.json .npmrc ./
RUN npm ci --no-audit --no-fund

COPY . .

# H5 talks to the API through the same origin: nginx proxies /api and /auth,
# so the bundle is built with a relative API base by default.
ARG TARO_APP_API_BASE=""
ARG TARO_APP_H5_BASE="/"
ENV TARO_APP_API_BASE=${TARO_APP_API_BASE} \
    TARO_APP_H5_BASE=${TARO_APP_H5_BASE}

RUN npm run build:h5

# ---- runtime stage ---------------------------------------------------------
FROM nginx:1.27-alpine

# The official image renders /etc/nginx/templates/*.template with envsubst.
# API_UPSTREAM stays configurable so the same image works against the shared
# multica-backend container or a staging backend.
ENV API_UPSTREAM=http://multica-backend:8080

COPY docker/nginx.conf.template /etc/nginx/templates/default.conf.template
COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 80

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget -q -O /dev/null http://127.0.0.1/healthz || exit 1
