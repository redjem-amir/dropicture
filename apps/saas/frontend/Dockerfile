# dropicture/apps/saas/frontend/Dockerfile
FROM oven/bun:1.3.14-alpine AS base
WORKDIR /app

FROM base AS deps
RUN apk add --no-cache libc6-compat

COPY package.json bun.lock* ./
RUN bun install

FROM base AS builder
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

ARG NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL

COPY --from=deps /app/node_modules ./node_modules
COPY . .

RUN bun run build

FROM oven/bun:1.3.14-alpine AS runner
WORKDIR /app
ENV HOSTNAME="0.0.0.0"
ENV PORT=3001
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

RUN addgroup -S nodejs && adduser -S nextjs -G nodejs
USER nextjs

COPY --from=builder --chown=nextjs:nodejs /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

EXPOSE 3001
CMD ["bun", "server.js"]