import Database from 'better-sqlite3'
import { drizzle } from 'drizzle-orm/better-sqlite3'
import * as schema from './schema'
import path from 'path'

const DB_PATH = process.env.DATABASE_URL || path.join(process.cwd(), 'data', 'finanzas.db')

// Singleton: una sola conexión durante toda la vida del proceso
const sqlite = new Database(DB_PATH)

// WAL mode para mejor rendimiento y concurrencia de lectura. Durante `next
// build` varios workers pueden importar este módulo a la vez sobre la base
// temporal del builder; no necesitamos cambiar el modo de journal allí y
// evitamos una carrera SQLITE_BUSY.
if (process.env.NEXT_PHASE !== 'phase-production-build') {
  sqlite.pragma('journal_mode = WAL')
}
sqlite.pragma('foreign_keys = ON')

export const db = drizzle(sqlite, { schema })
export { sqlite }
