# ==============================================================================
# TitanPaaS Production Dockerfile
# Multi-stage build for lightweight, secure container image
# ==============================================================================

# Stage 1: Build application
FROM node:22-alpine AS builder

WORKDIR /app

# Install native compilation dependencies for packages like bcrypt
RUN apk add --no-cache python3 make g++

COPY package*.json ./
RUN npm ci

COPY tsconfig*.json nest-cli.json ./
COPY src/ ./src/
COPY test/ ./test/

RUN npm run build
RUN npm prune --omit=dev

# Stage 2: Production runtime
FROM node:22-alpine AS runner

WORKDIR /app

# Install Docker CLI and system utilities required for orchestration
RUN apk add --no-cache \
    docker-cli \
    bash \
    curl \
    postgresql-client \
    ca-certificates

ENV NODE_ENV=production
ENV PORT=3000

COPY --from=builder /app/package*.json ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/bin ./bin

# Create directories for persistent runtime data
RUN mkdir -p /app/data /app/logs

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD curl -f http://localhost:3000/system/health || exit 1

CMD ["node", "dist/main.js"]
