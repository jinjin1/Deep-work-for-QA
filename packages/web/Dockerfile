FROM node:20-alpine AS builder

RUN npm install -g pnpm

WORKDIR /app
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY packages/web/package.json packages/web/
COPY packages/shared/package.json packages/shared/

RUN pnpm install --frozen-lockfile

COPY packages/shared packages/shared
COPY packages/web packages/web

RUN pnpm --filter @deep-work/web build

FROM node:20-alpine

WORKDIR /app

COPY --from=builder /app/packages/web/.next ./.next
COPY --from=builder /app/packages/web/public ./public
COPY --from=builder /app/packages/web/package.json ./
COPY --from=builder /app/node_modules ./node_modules

EXPOSE 3000

CMD ["npx", "next", "start", "-p", "3000"]
