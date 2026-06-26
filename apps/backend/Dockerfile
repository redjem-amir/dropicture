# 🏡 Production Build
FROM oven/bun:1.3.14-alpine as builder
WORKDIR /app

ENV NODE_ENV=production

COPY package.json ./
RUN bun install

COPY . .
RUN bun run build

# 🏭 Production Runtime
FROM oven/bun:1.3.14-alpine
WORKDIR /app

ENV NODE_ENV=production

COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules

EXPOSE 3001
CMD ["bun", "run", "dist/main"]