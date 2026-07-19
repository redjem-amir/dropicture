# dropicture/apps/saas/backend/Dockerfile
FROM oven/bun:1.3.14-alpine AS builder
WORKDIR /app

ENV NODE_ENV=production

COPY package.json bun.lock* ./
RUN bun install

COPY . .
RUN bun run build

FROM oven/bun:1.3.14-alpine
WORKDIR /app

ENV NODE_ENV=production

COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules

EXPOSE 3002
CMD ["bun", "run", "dist/main"]