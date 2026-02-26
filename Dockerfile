# ── Base ──────────────────────────────────────────────────────────────────────
FROM node:20-alpine AS base
# Dependencias del sistema para compilar better-sqlite3 (addon nativo)
RUN apk add --no-cache libc6-compat python3 make g++
WORKDIR /app

# ── Dependencias ──────────────────────────────────────────────────────────────
FROM base AS deps
# [2026-02-26] Forzar NODE_ENV=development para que npm ci instale devDependencies
# (typescript, tailwindcss, etc.) necesarias para el build.
# Coolify inyecta NODE_ENV=production a build-time, lo que causa que se salten.
ENV NODE_ENV=development
COPY package.json package-lock.json* ./
RUN npm ci

# ── Builder ───────────────────────────────────────────────────────────────────
FROM base AS builder
WORKDIR /app
# [2026-02-26] Forzar NODE_ENV=development para que next build encuentre typescript
ENV NODE_ENV=development
COPY --from=deps /app/node_modules ./node_modules
COPY . .

ENV NEXT_TELEMETRY_DISABLED=1
# Variables dummy para que el build no falle (se sobreescriben en runtime)
ENV NEXTAUTH_SECRET=build-time-secret
ENV NEXTAUTH_URL=http://localhost:3000
ENV DATABASE_URL=./data/finanzas.db

RUN npm run build

# ── Runner ────────────────────────────────────────────────────────────────────
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# Dependencias de sistema para better-sqlite3 en runtime
RUN apk add --no-cache libc6-compat

# Usuario no-root por seguridad
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

# Archivos Next.js standalone
COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

# Scripts de inicio y migraciones
COPY --chown=nextjs:nodejs scripts/migrate.mjs ./scripts/migrate.mjs
COPY --chown=nextjs:nodejs scripts/start.sh ./scripts/start.sh

# Migraciones de Drizzle
COPY --from=builder --chown=nextjs:nodejs /app/src/lib/db/migrations ./src/lib/db/migrations

# Directorio para SQLite (volumen persistente se monta aquí)
RUN mkdir -p /app/data && chown nextjs:nodejs /app/data

RUN chmod +x ./scripts/start.sh

USER nextjs

EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

CMD ["./scripts/start.sh"]
