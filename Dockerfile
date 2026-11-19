# Multi-stage Dockerfile for BazarBeat (Single-Service Production Deployment)
# Stage 1: Build shared library, React SPA web app, and Express API
FROM node:22-alpine AS builder

WORKDIR /app

# Copy root workspace manifests
COPY package*.json tsconfig.base.json ./
COPY packages/shared/package*.json ./packages/shared/
COPY apps/api/package*.json ./apps/api/
COPY apps/web/package*.json ./apps/web/

# Install all dependencies across the workspace
RUN npm ci

# Copy source trees
COPY packages/shared ./packages/shared
COPY apps/api ./apps/api
COPY apps/web ./apps/web

# Build packages in dependency order
RUN npm run build -w @bazarbeat/shared && \
    npm run build -w @bazarbeat/web && \
    npm run build -w @bazarbeat/api

# Stage 2: Lean production runtime image
FROM node:22-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV SERVE_WEB=true

# Copy root workspace manifests for runtime
COPY package*.json ./
COPY packages/shared/package*.json ./packages/shared/
COPY apps/api/package*.json ./apps/api/
COPY apps/web/package*.json ./apps/web/

# Install only production dependencies
RUN npm ci --omit=dev

# Copy compiled artifacts from builder stage
COPY --from=builder /app/packages/shared/dist ./packages/shared/dist
COPY --from=builder /app/apps/api/dist ./apps/api/dist
COPY --from=builder /app/apps/web/dist ./apps/web/dist

# Expose default port (Render injects PORT dynamically)
EXPOSE 4000

# Start single-service Express API (serves API routes, SSE, and SPA web app)
CMD ["npm", "run", "start", "-w", "@bazarbeat/api"]
