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

echo "Starting Next.js server..."
# Ejecutar servidor como usuario nextjs (drop privileges)
exec su-exec nextjs node /app/server.js
