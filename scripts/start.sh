#!/bin/sh
set -e

# [2026-02-26] El script corre como root para poder arreglar permisos del volumen
# Luego usa su-exec para ejecutar la app como usuario nextjs (seguridad)

# Asegurar que el directorio data existe y es escribible por nextjs
mkdir -p /app/data
chown nextjs:nodejs /app/data

echo "Running database migrations..."
# Ejecutar migraciones como usuario nextjs
su-exec nextjs node /app/scripts/migrate.mjs

# [2026-02-26] Auto-seed: crear usuario admin si ADMIN_USER y ADMIN_PASSWORD están definidos
# Solo se ejecuta si las variables de entorno están configuradas en Coolify (Runtime only)
if [ -n "$ADMIN_USER" ] && [ -n "$ADMIN_PASSWORD" ]; then
  echo "Running seed (creating/updating admin user)..."
  su-exec nextjs node /app/scripts/seed.mjs "$ADMIN_USER" "$ADMIN_PASSWORD"
fi

echo "Starting Next.js server..."
# Ejecutar servidor como usuario nextjs (drop privileges)
exec su-exec nextjs node /app/server.js
