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

La cartera y las operaciones viven en SQLite (`data/finanzas.db` en local y
`/app/data/finanzas.db` en Coolify). Ese archivo está fuera de Git: en una
instalación local limpia hay que restaurar una copia segura de la base de datos
de producción por SSH o registrar de nuevo las operaciones. No conviene que el
servidor local consulte directamente la base de datos de producción.

La actualización gratuita usa CoinGecko para criptoactivos y Yahoo Finance con
los símbolos Xetra equivalentes para los ETF. La app guarda y muestra siempre
el proveedor, la URL y la fecha del último dato usado.

La cartera actual alimenta el resumen. Las posiciones históricas se conservan
fuera del total para evitar duplicar activos.

### Buscador de inversiones con IA

El buscador empieza con un preparador Lynch de seis pasos: observación, historia
del negocio, categoría, prioridades numéricas, tesis y señales de invalidación.
Ese perfil viaja junto a la consulta para que el modelo no reciba solo una frase
genérica, sino un brief de investigación personalizado. El informe separa datos
verificados, interpretación, métricas que seguir y condiciones para revisar la
tesis.

Sin una clave configurada, el buscador utiliza únicamente el marco local y lo
indica expresamente en la interfaz. Cuando las APIs financieras sí devuelven
identidad y métricas, conserva un cribado determinista aunque el modelo no
redacte texto; no rellena candidatos ni cifras inventadas. Regla de integridad:
si una empresa, ticker, cifra, fecha o fuente no tiene respaldo trazable, se
muestra como «No encontrado» o el candidato se descarta. Las categorías, tesis,
riesgos y señales de seguimiento generadas por IA se presentan como hipótesis
para contrastar, nunca como hechos verificados.

Para activar OpenRouter:

```bash
BUSCADOR_ACCIONES_PROVIDER=openrouter
OPENROUTER_API_KEY=tu-clave
OPENROUTER_MODEL=nvidia/nemotron-3-super-120b-a12b:free
OPENROUTER_SITE_URL=http://localhost:3000
```

La clave se mantiene siempre en `.env.local` o en las variables secretas de
Coolify. El modelo gratuito es adecuado para pruebas y uso personal moderado,
pero mantiene límites de peticiones. La búsqueda web puede consumir créditos
independientemente del coste del modelo.

Una suscripción de ChatGPT no aporta saldo a la API de OpenAI. El inicio de
sesión con ChatGPT/OAuth está disponible en clientes oficiales como Codex, pero
sus credenciales no se reutilizan en esta aplicación; para seleccionar OpenAI
aquí hace falta una clave de la plataforma API y su facturación separada.

Desde Configuración se pueden elegir como máximo dos modelos: uno principal
para pruebas y tareas gratuitas, y otro avanzado opcional para investigación
web y análisis de cartera. El buscador no usa el router aleatorio de OpenRouter:
si falla el modelo principal, prueba en orden cuatro modelos explícitos con
salida estructurada (Gemma 4 26B, gpt-oss-20b, Gemma 4 31B y Nemotron Nano 9B).

La búsqueda consulta primero las fuentes y entrega después el contexto al
modelo. Yahoo Finance funciona sin clave para resolver tickers, cotizaciones y
fundamentales disponibles. Finnhub, NewsAPI, Alpha Vantage, Fiscal.ai,
Financial Datasets y SEC EDGAR amplían la cobertura cuando están configurados.
Financial Datasets puede exigir un plan compatible; la aplicación informa del
límite y no activa pagos. La búsqueda web usa la instancia Firecrawl configurada
mediante `POST /v2/search` y recurre a `/v1/scrape` cuando esa instalación no
expone el buscador. La app no activa la búsqueda web de pago de OpenRouter.

### Contexto local de Lynch

El PDF original puede conservarse localmente en `src/`, pero no se versiona.
El asistente utiliza los artefactos generados
`src/lib/buscador-acciones/lynch-book.md` y
`src/lib/buscador-acciones/lynch-book-index.json`: el endpoint selecciona
extractos por pista, categoría y métricas, en lugar de enviar el libro completo
en cada petición. El prompt obliga a parafrasear y a usar las fuentes actuales
para los datos financieros.

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
| `APP_ENCRYPTION_KEY` | Opcional: clave dedicada para cifrar credenciales guardadas |
| `NEXTAUTH_URL` | `https://tudominio.com` |
| `PORT` | `3000` |
| `HOSTNAME` | `0.0.0.0` |
| `BUSCADOR_ACCIONES_PROVIDER` | `openrouter` |
| `OPENROUTER_API_KEY` | Clave secreta creada en OpenRouter |
| `OPENROUTER_MODEL` | `nvidia/nemotron-3-super-120b-a12b:free` o un modelo fijado |
| `OPENROUTER_SITE_URL` | URL pública de la aplicación |

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
