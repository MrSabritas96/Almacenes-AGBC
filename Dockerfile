FROM node:22-alpine AS base
RUN corepack enable && corepack prepare pnpm@10.18.3 --activate
WORKDIR /app

FROM base AS deps
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

FROM base AS builder
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
# Valores exclusivos de compilación; las credenciales reales se inyectan al ejecutar.
RUN DATABASE_URL=postgresql://build:build@127.0.0.1:5432/build \
    BETTER_AUTH_SECRET=build-only-placeholder-secret-at-least-32-characters \
    BETTER_AUTH_URL=http://localhost:3000 pnpm build

FROM base AS runner
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1
COPY --from=deps /app/node_modules ./node_modules
COPY --from=builder --chown=node:node /app/.next ./.next
COPY --from=builder /app/public ./public
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/server.js ./server.js
COPY --from=builder /app/next.config.ts ./next.config.ts
COPY --from=builder /app/drizzle ./drizzle
RUN mkdir -p /app/backups && chown node:node /app/backups
USER node
EXPOSE 3000
CMD ["node", "server.js"]
