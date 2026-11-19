# syntax=docker/dockerfile:1.7
# POS website image for Coolify (Build Pack: Dockerfile).
# Fast rebuilds:
#  - the npm install layer is reused until package.json / package-lock.json change
#  - Next.js keeps its compile cache (.next/cache) between builds
#  - the type check is NOT run here (next.config: typescript.ignoreBuildErrors);
#    GitHub Actions runs it on every push (.github/workflows/typecheck.yml)
#  - the final image only holds the standalone server (small, quick to start)

FROM node:22-slim AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN --mount=type=cache,target=/root/.npm \
    npm ci --no-audit --no-fund

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
