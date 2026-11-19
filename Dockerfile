# syntax=docker/dockerfile:1.7
# POS website image for Coolify (Build Pack: Dockerfile).
# Fast rebuilds:
#  - node_modules is reused from a build cache until package-lock.json changes
#  - Next.js keeps its compile cache (.next/cache) between builds
#  - the type check is NOT run here (next.config: typescript.ignoreBuildErrors);
#    GitHub Actions runs it on every push (.github/workflows/typecheck.yml)
#  - the final image only holds the standalone server (small, quick to start)

FROM node:22-slim AS deps
WORKDIR /app
COPY package.json package-lock.json ./
# The npm ci layer was rebuilt on every deploy (30-70 s) even with the same
# lock file, so node_modules is also kept in a build cache mount, keyed by the
# lock file's hash: same lock file = copy it back (seconds); changed lock file
# (or cache cleared by Docker cleanup) = normal npm ci, then saved again.
RUN --mount=type=cache,target=/root/.npm \
    --mount=type=cache,id=pos-frontend-node-modules,target=/nm-cache \
    set -e; \
    H=$(sha256sum package-lock.json | cut -c1-16); \
    if [ -f "/nm-cache/$H.done" ] && [ -d /nm-cache/node_modules ]; then \
      echo "node_modules from cache ($H)"; cp -a /nm-cache/node_modules ./node_modules; \
    else \
      npm ci --no-audit --no-fund --prefer-offline; \
      rm -rf /nm-cache/node_modules /nm-cache/*.done; \
      cp -a node_modules /nm-cache/node_modules; touch "/nm-cache/$H.done"; \
    fi

FROM node:22-slim AS build
WORKDIR /app
# Baked into the browser code at build time. In Coolify these must be ticked as
# "Build Variable" (the default below is the live API).
ARG NEXT_PUBLIC_BACKEND_URL=https://api.dollarandco.org
ARG SOURCE_COMMIT=dev
ENV NEXT_PUBLIC_BACKEND_URL=$NEXT_PUBLIC_BACKEND_URL \
    SOURCE_COMMIT=$SOURCE_COMMIT \
    NEXT_TELEMETRY_DISABLED=1 \
    NODE_ENV=production
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN --mount=type=cache,target=/app/.next/cache \
    npm run build

FROM node:22-slim AS run
WORKDIR /app
ENV NODE_ENV=production \
    PORT=3000 \
    HOSTNAME=0.0.0.0 \
    NEXT_TELEMETRY_DISABLED=1
COPY --from=build /app/.next/standalone ./
COPY --from=build /app/.next/static ./.next/static
COPY --from=build /app/public ./public
EXPOSE 3000
CMD ["node", "server.js"]
