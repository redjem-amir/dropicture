# dropicture/apps/saas/jobs/Dockerfile
FROM oven/bun:1.3.14-alpine AS builder
WORKDIR /app

COPY package.json bun.lock* ./
RUN bun install --frozen-lockfile

COPY . .
RUN bun run build

FROM oven/bun:1.3.14-alpine AS deps
WORKDIR /app
ENV NODE_ENV=production

COPY package.json bun.lock* ./
RUN bun install --frozen-lockfile --production

FROM oven/bun:1.3.14-alpine
WORKDIR /app
ENV NODE_ENV=production

RUN apk add --no-cache ffmpeg tini

COPY --from=deps /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist

USER bun

ENTRYPOINT ["/sbin/tini", "--"]
CMD ["bun", "run", "dist/main"]