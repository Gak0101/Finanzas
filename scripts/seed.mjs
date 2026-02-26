/**
 * Script para crear el usuario inicial.
 * Uso: node scripts/seed.mjs <username> <password>
 * Ejemplo: node scripts/seed.mjs cesar mipassword123
 */
import Database from 'better-sqlite3'
import { drizzle } from 'drizzle-orm/better-sqlite3'
import { hash } from 'bcryptjs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

const DB_PATH = process.env.DATABASE_URL || path.join(process.cwd(), 'data', 'finanzas.db')

const username = process.argv[2]
const password = process.argv[3]

if (!username || !password) {
  console.error('Uso: node scripts/seed.mjs <username> <password>')
  process.exit(1)
}

const sqlite = new Database(DB_PATH)
sqlite.pragma('foreign_keys = ON')

const passwordHash = await hash(password, 10)

const existing = sqlite.prepare('SELECT id FROM usuarios WHERE username = ?').get(username)
if (existing) {
  console.log(`El usuario "${username}" ya existe. Actualizando contraseña...`)
  sqlite.prepare('UPDATE usuarios SET password_hash = ? WHERE username = ?').run(passwordHash, username)
} else {
  sqlite.prepare('INSERT INTO usuarios (username, password_hash) VALUES (?, ?)').run(username, passwordHash)

  // Crear categorías por defecto para el nuevo usuario
  const userId = sqlite.prepare('SELECT id FROM usuarios WHERE username = ?').get(username).id

  const categoriasDefault = [
    { nombre: 'Vivienda', porcentaje: 30, color: '#ef4444', icono: '🏠', orden: 1 },
    { nombre: 'Alimentación', porcentaje: 20, color: '#f97316', icono: '🛒', orden: 2 },
    { nombre: 'Transporte', porcentaje: 10, color: '#eab308', icono: '🚗', orden: 3 },
    { nombre: 'Ocio', porcentaje: 10, color: '#22c55e', icono: '🎮', orden: 4 },
    { nombre: 'Ahorro', porcentaje: 20, color: '#3b82f6', icono: '💰', orden: 5 },
    { nombre: 'Otros', porcentaje: 10, color: '#8b5cf6', icono: '📦', orden: 6 },
  ]

  const insertCategoria = sqlite.prepare(
    'INSERT INTO categorias (usuario_id, nombre, porcentaje, color, icono, orden) VALUES (?, ?, ?, ?, ?, ?)'
  )

  for (const cat of categoriasDefault) {
    insertCategoria.run(userId, cat.nombre, cat.porcentaje, cat.color, cat.icono, cat.orden)
  }

  console.log(`✅ Usuario "${username}" creado con categorías por defecto.`)
}

sqlite.close()
