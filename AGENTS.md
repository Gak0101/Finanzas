# Finanzas

Este repositorio contiene la aplicación web actual de Finanzas Personales. Es
Next.js con App Router, TypeScript estricto, SQLite y Drizzle ORM. No recuperar
ni mezclar el proyecto antiguo de Python/Kivy.

## Arranque reproducible

- Usa Node.js compatible con Next.js 16 y `npm`, porque el repositorio incluye
  `package-lock.json`.
- Instala dependencias con `npm ci` en un checkout limpio.
- Copia `.env.example` a `.env.local` y rellena los secretos solo en el entorno
  local o en el proveedor de despliegue; nunca los guardes en Git.
- Para una base local nueva, ejecuta `node scripts/migrate.mjs` y después
  `node scripts/seed.mjs <usuario> <password>`.
- Arranca en desarrollo con `npm run dev` y valida el build con `npm run build`.

## Variables de entorno

La aplicación documenta sus variables en `.env.example`. Las principales son
`DATABASE_URL`, `NEXTAUTH_SECRET`, `NEXTAUTH_URL`, `PORT` y `HOSTNAME`. El
buscador de inversiones puede usar además `OPENROUTER_API_KEY` u otras claves
opcionales documentadas allí. Ninguna clave real debe aparecer en el repositorio.

## Validación y cambios

- `package.json` no define scripts formales de lint, typecheck ni tests; no
  inventar esos comandos. La comprobación disponible de producción es
  `npm run build`.
- Si se modifica `src/lib/db/schema.ts`, genera y revisa una migración Drizzle.
- Las APIs que usan SQLite/better-sqlite3 deben conservar runtime `nodejs`.
- No importar la base de datos desde el middleware ni desde `auth.config.ts`.
- Tratar snapshots mensuales y desviaciones como historial: no alterarlos fuera
  de los flujos explícitos de edición, regeneración o reajuste.
- `outputs/` y las inspecciones/logs de `workbench_lynch/` son artefactos locales
  generados y están excluidos de Git; conserva en Git únicamente los scripts y
  código fuente útiles para reproducirlos.
