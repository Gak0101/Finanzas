import Database from 'better-sqlite3'
import { drizzle } from 'drizzle-orm/better-sqlite3'
import { migrate } from 'drizzle-orm/better-sqlite3/migrator'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

const DB_PATH = process.env.DATABASE_URL || path.join(process.cwd(), 'data', 'finanzas.db')
const MIGRATIONS_PATH = path.join(__dirname, '..', 'src', 'lib', 'db', 'migrations')

console.log(`Running migrations on: ${DB_PATH}`)

const sqlite = new Database(DB_PATH)
sqlite.pragma('journal_mode = WAL')
sqlite.pragma('foreign_keys = ON')

const db = drizzle(sqlite)

migrate(db, { migrationsFolder: MIGRATIONS_PATH })

console.log('Migrations completed successfully')
sqlite.close()
