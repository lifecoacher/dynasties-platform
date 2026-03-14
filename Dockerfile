FROM node:20-slim AS base
RUN corepack enable && corepack prepare pnpm@9 --activate

WORKDIR /app
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY lib/ ./lib/
COPY services/ ./services/
COPY artifacts/api-server/ ./artifacts/api-server/

FROM base AS deps
RUN pnpm install --frozen-lockfile --prod=false

FROM deps AS build
RUN pnpm --filter @workspace/api-server run build

FROM node:20-slim AS runner
WORKDIR /app

COPY --from=build /app/artifacts/api-server/dist/index.cjs ./server.cjs
COPY --from=build /app/node_modules ./node_modules

ENV NODE_ENV=production
ENV PORT=8080
EXPOSE 8080

USER node
CMD ["node", "server.cjs"]
