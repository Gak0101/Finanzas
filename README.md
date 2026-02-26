# Finanzas Personales

App web de gestión de finanzas personales. Gestiona categorías de gasto con porcentajes, registra ingresos mensuales, crea huchas de ahorro y visualiza el historial con gráficos.

## Funcionalidades

- **Categorías**: Define cómo distribuir tus ingresos (Alimentación 30%, Ahorro 20%, etc.)
- **Ingresos**: Registra tu ingreso mensual bruto y la app calcula el desglose automáticamente
- **Huchas**: Crea objetivos de ahorro y añade aportaciones manuales
- **Dashboard**: Gráfico donut con la distribución del mes seleccionado
- **Historial**: Evolución de ingresos mes a mes con gráfico de barras

## Stack

- Next.js 14 (App Router)
- SQLite + Drizzle ORM
- next-auth v5
- Recharts + Tailwind + shadcn/ui

---

## Desarrollo local

### 1. Instalar dependencias

```bash
npm install
```

### 2. Variables de entorno

Copia `.env.example` como `.env.local` y edítalo:

```bash
DATABASE_URL=./data/finanzas.db
NEXTAUTH_SECRET=un-secreto-de-minimo-32-caracteres
NEXTAUTH_URL=http://localhost:3000
```

### 3. Crear base de datos y usuario inicial

```bash
# Crear tablas
node scripts/migrate.mjs

# Crear usuario (cambia los valores)
node scripts/seed.mjs tuusuario tupassword
```

### 4. Arrancar

```bash
npm run dev
```

---

## Despliegue en Coolify (VPS)

### Variables de entorno en Coolify

| Variable | Valor |
|----------|-------|
| `DATABASE_URL` | `/app/data/finanzas.db` |
| `NEXTAUTH_SECRET` | Genera con: `openssl rand -base64 32` |
| `NEXTAUTH_URL` | `https://tudominio.com` |

### Volumen persistente

En Coolify, configura un volumen persistente:
- **Ruta del contenedor**: `/app/data`

Esto preserva la base de datos SQLite entre reinicios y permite hacer backups desde Coolify.

### Crear usuario inicial en producción

Tras el primer despliegue, ejecuta en el terminal de Coolify:

```bash
docker exec -it <nombre_contenedor> node /app/scripts/seed.mjs tuusuario tupassword
```

### Puerto

La app escucha en el puerto `3000`.

---

## Scripts disponibles

```bash
npm run dev                          # Desarrollo local
npm run build                        # Build de producción
node scripts/migrate.mjs             # Ejecutar migraciones
node scripts/seed.mjs <user> <pass>  # Crear/actualizar usuario
npx drizzle-kit generate             # Generar migraciones tras cambiar el schema
```
