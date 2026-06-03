# 🏠 Base Image: Lightweight Node.js environment
FROM oven/bun:1.3.14-alpine AS base
WORKDIR /app

# 📦 Dependencies Installation
FROM base AS deps
RUN apk add --no-cache libc6-compat

COPY package.json ./
RUN bun install

# 🔧 Build Stage: Compiling Next.js Application
FROM base AS builder
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

COPY --from=deps /app/node_modules ./node_modules
COPY . .

RUN bun run build

# 🚀 Production Image: Optimized and Ready-to-Run
FROM oven/bun:1.3.14-alpine AS runner
WORKDIR /app
ENV HOSTNAME="0.0.0.0"
ENV PORT=3000
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

RUN addgroup -S nodejs && adduser -S nextjs -G nodejs
USER nextjs

COPY --from=builder --chown=nextjs:nodejs /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

EXPOSE 3000
CMD ["bun", "server.js"]