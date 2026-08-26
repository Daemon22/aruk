# ============================================================
# Aruk — Keeper of Secrets and Keys
# Multi-stage Docker build for production deployment
# ============================================================

# ─── Stage 1: Dependencies ─────────────────────────────────
FROM oven/bun:1 AS deps
WORKDIR /app
COPY package.json bun.lock* ./
RUN bun install --frozen-lockfile --production

# ─── Stage 2: Build ────────────────────────────────────────
FROM oven/bun:1 AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN bun run db:generate
ENV NEXT_TELEMETRY_DISABLED=1
RUN bun run build

# ─── Stage 3: Production ───────────────────────────────────
FROM oven/bun:1 AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

RUN addgroup --system --gid 1001 aruk && \
    adduser --system --uid 1001 aruk

# Copy standalone build
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public

# Create data directory for SQLite
RUN mkdir -p /app/data && chown aruk:aruk /app/data

# Expose port
EXPOSE 3000

USER aruk

# Health check
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD curl -f http://localhost:3000/api/health || exit 1

CMD ["bun", ".next/standalone/server.js"]
