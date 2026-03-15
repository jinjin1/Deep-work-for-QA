FROM node:20-alpine AS builder

RUN npm install -g pnpm

WORKDIR /app
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY packages/api/package.json packages/api/
COPY packages/shared/package.json packages/shared/

RUN pnpm install --frozen-lockfile

COPY packages/shared packages/shared
COPY packages/api packages/api

RUN pnpm --filter @deep-work/api build

FROM node:20-alpine

WORKDIR /app
RUN mkdir -p /app/data/uploads

COPY --from=builder /app/packages/api/dist ./dist
COPY --from=builder /app/packages/api/drizzle ./drizzle
COPY --from=builder /app/packages/api/package.json ./
COPY --from=builder /app/node_modules ./node_modules

EXPOSE 3001

CMD ["node", "dist/index.js"]
