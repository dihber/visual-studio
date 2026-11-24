# Build a partir da raiz do monorepo:
#   docker build -f apps/api/Dockerfile -t dihber-api .
FROM node:20-slim AS base
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/* && corepack enable
WORKDIR /app

FROM base AS build
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc turbo.json tsconfig.base.json ./
COPY packages/shared ./packages/shared
COPY apps/api ./apps/api
RUN pnpm install --frozen-lockfile --filter api...
RUN pnpm --filter api build

FROM base
ENV NODE_ENV=production
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/apps/api/package.json ./apps/api/package.json
COPY --from=build /app/apps/api/prisma ./apps/api/prisma
COPY --from=build /app/apps/api/dist ./apps/api/dist
WORKDIR /app/apps/api
EXPOSE 3333
# aplica migrations pendentes e sobe a API
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/server.js"]
