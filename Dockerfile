# syntax=docker/dockerfile:1
# Imagem de produção do sqlboard (Next.js standalone). Migrações rodam no start.

FROM node:22-bookworm-slim AS base
ENV PNPM_HOME=/pnpm PATH=/pnpm:$PATH NEXT_TELEMETRY_DISABLED=1
RUN corepack enable

FROM base AS deps
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends python3 make g++ && rm -rf /var/lib/apt/lists/*
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile

FROM base AS build
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN pnpm build

FROM node:22-bookworm-slim AS runner
WORKDIR /app
ENV NODE_ENV=production PORT=3000 HOSTNAME=0.0.0.0 NEXT_TELEMETRY_DISABLED=1
RUN groupadd -r sqlboard && useradd -r -g sqlboard sqlboard
COPY --from=build /app/.next/standalone ./
COPY --from=build /app/.next/static ./.next/static
COPY --from=build /app/public ./public
# SQL migrations applied by instrumentation.ts on boot.
COPY --from=build /app/server/db/migrations ./server/db/migrations
ENV SQLBOARD_MIGRATE_ON_BOOT=on
USER sqlboard
EXPOSE 3000
CMD ["node", "server.js"]
