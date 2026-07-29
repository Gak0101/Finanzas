#!/bin/sh
set -eu

DATA_DIR=/app/data
DB_PATH="${DATABASE_URL:-$DATA_DIR/finanzas.db}"

# La base debe vivir en el volumen de /app/data. Así se evita arrancar con una
# SQLite efímera dentro de la capa del contenedor por una variable mal puesta.
case "$DB_PATH" in
  /app/data/*|./data/*|data/*) ;;
  *)
    echo "DATABASE_URL debe apuntar a /app/data/finanzas.db en producción (recibido: $DB_PATH)" >&2
    exit 1
    ;;
esac

export DATABASE_URL="$DB_PATH"

# Asegurar que el volumen y una base creada en un despliegue anterior sean
# escribibles por nextjs. No se borra ni se recrea ningún dato.
mkdir -p "$DATA_DIR"
chown -R nextjs:nodejs "$DATA_DIR"
chmod -R u+rwX "$DATA_DIR"

echo "Running database migrations on $DATABASE_URL..."
su-exec nextjs node /app/scripts/migrate.mjs

# Crear/actualizar el usuario inicial solo cuando Coolify proporciona ambas
# variables. Si se proporciona una sola, fallar explícitamente.
if [ -n "${ADMIN_USER:-}" ] || [ -n "${ADMIN_PASSWORD:-}" ]; then
  if [ -z "${ADMIN_USER:-}" ] || [ -z "${ADMIN_PASSWORD:-}" ]; then
    echo "ADMIN_USER y ADMIN_PASSWORD deben configurarse juntos" >&2
    exit 1
  fi
  echo "Running seed (creating/updating admin user)..."
  su-exec nextjs node /app/scripts/seed.mjs "$ADMIN_USER" "$ADMIN_PASSWORD"
fi

echo "Starting Next.js server..."
exec su-exec nextjs node /app/server.js
