import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  output: 'standalone',
  // Evita que otro package-lock.json fuera del repo cambie la raíz del
  // tracing y anide el servidor en una ruta que el Dockerfile no copia.
  turbopack: {
    root: process.cwd(),
  },
  outputFileTracingRoot: process.cwd(),
  // El buscador consulta estos artefactos locales para recuperar extractos
  // relevantes del libro sin enviar el PDF completo en cada petición.
  outputFileTracingIncludes: {
    '/*': [
      './src/lib/buscador-acciones/lynch-book.md',
      './src/lib/buscador-acciones/lynch-book-index.json',
    ],
  },
  // Node necesita cargar estos paquetes en runtime: better-sqlite3 incluye un
  // addon nativo y xlsx se usa para una importación opcional de compatibilidad.
  // El Dockerfile copia sus dependencias junto con el standalone.
  serverExternalPackages: ['better-sqlite3', 'xlsx'],
}

export default nextConfig
