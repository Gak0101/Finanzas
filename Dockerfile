# ── Base ──────────────────────────────────────────────────────────────────────
FROM node:20-alpine AS base
# Dependencias del sistema para compilar better-sqlite3 (addon nativo).
RUN apk add --no-cache libc6-compat python3 make g++
WORKDIR /app

# ── Dependencias ──────────────────────────────────────────────────────────────
FROM base AS deps
# El build de Next necesita las devDependencies (TypeScript, Tailwind, etc.).
# --include=dev lo hace explícito aunque Coolify inyecte NODE_ENV=production.
ENV NODE_ENV=development
COPY package.json package-lock.json* ./
RUN npm ci --include=dev

# ── Builder ───────────────────────────────────────────────────────────────────
FROM base AS builder
WORKDIR /app
ENV NODE_ENV=development
COPY --from=deps /app/node_modules ./node_modules
COPY . .

ENV NEXT_TELEMETRY_DISABLED=1
# Variables dummy para que el build no falle (se sobreescriben en runtime)
ENV NEXTAUTH_SECRET=build-time-secret
ENV NEXTAUTH_URL=http://localhost:3000
ENV DATABASE_URL=./data/finanzas.db

# Crear el directorio de build; el volumen persistente real se monta en runtime.
RUN mkdir -p data && NODE_ENV=production npm run build

# ── Runner ────────────────────────────────────────────────────────────────────
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# Dependencias de runtime para better-sqlite3 y su-exec para bajar privilegios.
RUN apk add --no-cache libc6-compat libstdc++ su-exec

# Usuario no-root por seguridad
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

# Archivos Next.js standalone
COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

# Contexto local indexado de Lynch para el buscador; no se envía el PDF
# completo en cada consulta, solo los extractos relevantes.
COPY --from=builder --chown=nextjs:nodejs /app/src/lib/buscador-acciones/lynch-book.md ./src/lib/buscador-acciones/lynch-book.md
COPY --from=builder --chown=nextjs:nodejs /app/src/lib/buscador-acciones/lynch-book-index.json ./src/lib/buscador-acciones/lynch-book-index.json

# El standalone contiene el servidor Next; estos archivos quedan fuera del
# tracing de Next y se copian explícitamente para el bootstrap de producción.
COPY --from=builder --chown=nextjs:nodejs /app/scripts/migrate.mjs ./scripts/migrate.mjs
COPY --from=builder --chown=nextjs:nodejs /app/scripts/seed.mjs ./scripts/seed.mjs
COPY --from=builder --chown=nextjs:nodejs /app/scripts/start.sh ./scripts/start.sh

# migrate.mjs y seed.mjs necesitan Drizzle, better-sqlite3 y bcryptjs. Se copia
# el árbol instalado para que el arranque y el servidor compartan las mismas
# versiones y el addon nativo compilado para Alpine.
COPY --from=builder --chown=nextjs:nodejs /app/node_modules ./node_modules

# Drizzle busca las migraciones relativas a /app/scripts/migrate.mjs.
COPY --from=builder --chown=nextjs:nodejs /app/src/lib/db/migrations ./src/lib/db/migrations

# Directorio para SQLite (Coolify debe montar el volumen persistente aquí).
RUN mkdir -p /app/data && chown nextjs:nodejs /app/data

RUN chmod +x ./scripts/start.sh

# start.sh comienza como root para preparar un volumen creado por Docker y
# ejecuta migraciones/servidor como nextjs.

EXPOSE 3000
ENV DATABASE_URL=/app/data/finanzas.db
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:' + (process.env.PORT || '3000') + '/login').then((response) => process.exit(response.ok ? 0 : 1)).catch(() => process.exit(1))"

CMD ["./scripts/start.sh"]
