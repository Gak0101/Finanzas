import { sqliteTable, text, integer, real, uniqueIndex } from 'drizzle-orm/sqlite-core'
import { sql, relations } from 'drizzle-orm'

// ─── USUARIOS ────────────────────────────────────────────────────────────────
export const usuarios = sqliteTable('usuarios', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  username: text('username').notNull().unique(),
  password_hash: text('password_hash').notNull(),
  created_at: text('created_at').default(sql`(datetime('now'))`),
})

// ─── CATEGORIAS ──────────────────────────────────────────────────────────────
export const categorias = sqliteTable('categorias', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  usuario_id: integer('usuario_id').notNull().references(() => usuarios.id),
  nombre: text('nombre').notNull(),
  porcentaje: real('porcentaje').notNull(),
  color: text('color').notNull().default('#6366f1'),
  icono: text('icono').default('💰'),
  orden: integer('orden').default(0),
  activa: integer('activa', { mode: 'boolean' }).default(true),
  created_at: text('created_at').default(sql`(datetime('now'))`),
  updated_at: text('updated_at').default(sql`(datetime('now'))`),
})

// ─── REGISTROS MENSUALES ─────────────────────────────────────────────────────
export const registros_mensuales = sqliteTable(
  'registros_mensuales',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    usuario_id: integer('usuario_id').notNull().references(() => usuarios.id),
    anio: integer('anio').notNull(),
    mes: integer('mes').notNull(),
    ingreso_bruto: real('ingreso_bruto').notNull(),
    notas: text('notas'),
    created_at: text('created_at').default(sql`(datetime('now'))`),
    updated_at: text('updated_at').default(sql`(datetime('now'))`),
  },
  (t) => [uniqueIndex('unique_usuario_anio_mes').on(t.usuario_id, t.anio, t.mes)]
)

// ─── SNAPSHOTS DE CATEGORIAS POR MES ─────────────────────────────────────────
// Guarda los porcentajes TAL COMO ESTABAN al registrar ese mes
// Crítico para que el historial sea fiel aunque cambien los % después
export const snapshots_categorias = sqliteTable('snapshots_categorias', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  registro_id: integer('registro_id').notNull().references(() => registros_mensuales.id),
  categoria_nombre: text('categoria_nombre').notNull(),
  porcentaje: real('porcentaje').notNull(),
  color: text('color').notNull(),
  icono: text('icono').default('💰'),
  monto_calculado: real('monto_calculado').notNull(),
})

// ─── HUCHAS ──────────────────────────────────────────────────────────────────
export const huchas = sqliteTable('huchas', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  usuario_id: integer('usuario_id').notNull().references(() => usuarios.id),
  nombre: text('nombre').notNull(),
  objetivo: real('objetivo').notNull(),
  descripcion: text('descripcion'),
  color: text('color').default('#4ECDC4'),
  icono: text('icono').default('🐷'),
  activa: integer('activa', { mode: 'boolean' }).default(true),
  fecha_objetivo: text('fecha_objetivo'),
  created_at: text('created_at').default(sql`(datetime('now'))`),
})

// ─── APORTACIONES A HUCHAS ───────────────────────────────────────────────────
export const aportaciones = sqliteTable('aportaciones', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  hucha_id: integer('hucha_id').notNull().references(() => huchas.id),
  cantidad: real('cantidad').notNull(),
  fecha: text('fecha').notNull(),
  notas: text('notas'),
  created_at: text('created_at').default(sql`(datetime('now'))`),
})

// ─── RELACIONES ──────────────────────────────────────────────────────────────
export const usuariosRelations = relations(usuarios, ({ many }) => ({
  categorias: many(categorias),
  registros_mensuales: many(registros_mensuales),
  huchas: many(huchas),
}))

export const categoriasRelations = relations(categorias, ({ one }) => ({
  usuario: one(usuarios, { fields: [categorias.usuario_id], references: [usuarios.id] }),
}))

export const registrosMensualesRelations = relations(registros_mensuales, ({ one, many }) => ({
  usuario: one(usuarios, { fields: [registros_mensuales.usuario_id], references: [usuarios.id] }),
  snapshots: many(snapshots_categorias),
}))

export const snapshotsCategoriasRelations = relations(snapshots_categorias, ({ one }) => ({
  registro: one(registros_mensuales, {
    fields: [snapshots_categorias.registro_id],
    references: [registros_mensuales.id],
  }),
}))

export const huchasRelations = relations(huchas, ({ one, many }) => ({
  usuario: one(usuarios, { fields: [huchas.usuario_id], references: [usuarios.id] }),
  aportaciones: many(aportaciones),
}))

export const aportacionesRelations = relations(aportaciones, ({ one }) => ({
  hucha: one(huchas, { fields: [aportaciones.hucha_id], references: [huchas.id] }),
}))

// Tipos inferidos de Drizzle
export type Usuario = typeof usuarios.$inferSelect
export type NuevoUsuario = typeof usuarios.$inferInsert
export type Categoria = typeof categorias.$inferSelect
export type NuevaCategoria = typeof categorias.$inferInsert
export type RegistroMensual = typeof registros_mensuales.$inferSelect
export type NuevoRegistroMensual = typeof registros_mensuales.$inferInsert
export type SnapshotCategoria = typeof snapshots_categorias.$inferSelect
export type Hucha = typeof huchas.$inferSelect
export type NuevaHucha = typeof huchas.$inferInsert
export type Aportacion = typeof aportaciones.$inferSelect
export type NuevaAportacion = typeof aportaciones.$inferInsert
