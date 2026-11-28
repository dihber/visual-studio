# Build a partir da raiz do monorepo:
#   docker build -f apps/web/Dockerfile -t dihber-web .
FROM node:20-slim AS build
RUN corepack enable
WORKDIR /app
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc turbo.json tsconfig.base.json ./
COPY packages/shared ./packages/shared
COPY apps/web ./apps/web
RUN pnpm install --frozen-lockfile --filter web...
RUN pnpm --filter web build

FROM nginx:1.27-alpine
# template: a imagem do nginx troca ${PORT} e ${API_UPSTREAM} pelos valores do ambiente
COPY apps/web/nginx.conf /etc/nginx/templates/default.conf.template
ENV PORT=80 API_UPSTREAM=http://api:3333 NGINX_ENTRYPOINT_LOCAL_RESOLVERS=1
COPY --from=build /app/apps/web/dist /usr/share/nginx/html
EXPOSE 80
