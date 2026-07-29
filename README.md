# Finanzas Personales

App web de gestión de finanzas personales. Gestiona categorías de gasto con porcentajes, registra ingresos mensuales, crea huchas de ahorro y visualiza el historial con gráficos.

## Funcionalidades

- **Categorías**: Define cómo distribuir tus ingresos (Alimentación 30%, Ahorro 20%, etc.)
- **Ingresos**: Registra tu ingreso mensual bruto y la app calcula el desglose automáticamente
- **Huchas**: Crea objetivos de ahorro y añade aportaciones manuales
- **Dashboard**: Gráfico donut con la distribución del mes seleccionado
- **Historial**: Evolución de ingresos mes a mes con gráfico de barras
- **Inversiones**: Mantiene la cartera en SQLite, registra compras, ventas,
  dividendos, aportaciones y traspasos, y consulta la evolución con gráficas
  interactivas.
- **Cartera inicial app-native**: Incluye la cartera actual y el histórico como
  datos de arranque; después todo se gestiona desde SQLite y las APIs de precios.

## Stack

- Next.js 16 (App Router)
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
PORT=3000
HOSTNAME=0.0.0.0
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

### Portfolio de inversiones y actualización de precios

Al entrar por primera vez en **Inversiones**, la app crea la cartera desde el
snapshot app-native incluido en el código. El resultado se guarda en SQLite y
las siguientes visitas trabajan siempre con la base de datos de la app.

La actualización gratuita usa CoinGecko para criptoactivos y Yahoo Finance con
los símbolos Xetra equivalentes para los ETF. La app guarda y muestra siempre
el proveedor, la URL y la fecha del último dato usado.

La cartera actual alimenta el resumen. Las posiciones históricas se conservan
fuera del total para evitar duplicar activos.

---

## Despliegue en Coolify (VPS)

El contenedor no necesita ficheros externos de escritorio. Inversiones dispone
de un snapshot app-native, por lo que se puede desplegar limpio y seguir
operando solo con la app.

### Variables de entorno en Coolify

| Variable | Valor |
|----------|-------|
| `DATABASE_URL` | `/app/data/finanzas.db` |
| `NEXTAUTH_SECRET` | Genera con: `openssl rand -base64 32` |
| `NEXTAUTH_URL` | `https://tudominio.com` |
| `PORT` | `3000` |
| `HOSTNAME` | `0.0.0.0` |

### Volumen persistente

En Coolify, configura un volumen persistente:
- **Ruta del contenedor**: `/app/data`

El arranque crea el directorio si hace falta, corrige sus permisos para el usuario
de la aplicación y ejecuta las migraciones antes de iniciar Next.js. Esto preserva
la base de datos SQLite entre reinicios/redeploys y permite hacer backups desde Coolify.

Configura el puerto de la aplicación en Coolify como `3000`. El proxy de Coolify
debe apuntar al puerto interno del contenedor.

### Crear usuario inicial en producción

Puedes configurar `ADMIN_USER` y `ADMIN_PASSWORD` durante el primer arranque, o
ejecutar en el terminal de Coolify:

```bash
docker exec -it <nombre_contenedor> node /app/scripts/seed.mjs tuusuario tupassword
```

Si usas `ADMIN_USER`/`ADMIN_PASSWORD`, retíralas después del primer arranque:
`start.sh` ejecuta el seed en cada inicio cuando ambas variables están presentes.

### Puerto

La app escucha en `0.0.0.0:3000`. La imagen incluye un healthcheck contra `/login`.

---

## Scripts disponibles

```bash
npm run dev                          # Desarrollo local
npm run build                        # Build de producción
node scripts/migrate.mjs             # Ejecutar migraciones
node scripts/seed.mjs <user> <pass>  # Crear/actualizar usuario
npx drizzle-kit generate             # Generar migraciones tras cambiar el schema
```
