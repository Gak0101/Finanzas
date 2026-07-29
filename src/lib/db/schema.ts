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

// ─── DESVIACIONES ────────────────────────────────────────────────────────────
// Editado: 2026-03-30 — Sistema de desviaciones/deudas entre categorías
// Registra movimientos de dinero: de dónde salió, a dónde fue, por qué, y si está saldada
export const desviaciones = sqliteTable('desviaciones', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  registro_id: integer('registro_id').notNull().references(() => registros_mensuales.id),
  usuario_id: integer('usuario_id').notNull().references(() => usuarios.id),
  categoria_origen: text('categoria_origen').notNull(),   // De dónde salió el dinero (ej: "Ocio")
  categoria_destino: text('categoria_destino').notNull(),  // A dónde se debe (ej: "Ahorro")
  monto: real('monto').notNull(),                          // Cantidad desviada (ej: 280.80)
  motivo: text('motivo'),                                  // En qué se gastó (ej: "Deuda cuenta ahorro")
  etiqueta: text('etiqueta'),                              // Tipo: "ahorro_forzado","imprevisto","capricho","emergencia"
  saldada: integer('saldada', { mode: 'boolean' }).default(false), // false=pendiente, true=saldada
  saldada_en_registro_id: integer('saldada_en_registro_id'), // ID del registro donde se saldó
  created_at: text('created_at').default(sql`(datetime('now'))`),
})

// ─── INVERSIONES / POSICIONES ───────────────────────────────────────────────
// Fuente activa de posiciones y precios de referencia dentro de la app.
// Los campos de origen solo conservan trazabilidad de la importación inicial.
export const inversiones_posiciones = sqliteTable(
  'inversiones_posiciones',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    usuario_id: integer('usuario_id').notNull().references(() => usuarios.id),
    custodia: text('custodia').notNull(),
    broker: text('broker'),
    activo: text('activo').notNull(),
    tipo: text('tipo').notNull(),
    ticker: text('ticker').notNull(),
    price_ticker: text('price_ticker'),
    crypto_id: text('crypto_id'),
    cantidad: real('cantidad').notNull(),
    precio_compra: real('precio_compra'),
    coste: real('coste'),
    precio_actual: real('precio_actual'),
    valor_actual: real('valor_actual'),
    pnl: real('pnl'),
    pnl_pct: real('pnl_pct'),
    peso: real('peso'),
    fuente: text('fuente'),
    estado_fuente: text('estado_fuente').notNull().default('SNAPSHOT'),
    ultimo_valido: real('ultimo_valido'),
    fallback_map: real('fallback_map'),
    proveedor: text('proveedor'),
    fuente_url: text('fuente_url'),
    nota: text('nota'),
    snapshot_at: text('snapshot_at'),
    fecha_apertura: text('fecha_apertura'),
    hoja_origen: text('hoja_origen').notNull().default('Portfolio Nuevo'),
    fila_origen: integer('fila_origen'),
    incluido_resumen: integer('incluido_resumen', { mode: 'boolean' }).notNull().default(true),
    divisa: text('divisa').notNull().default('EUR'),
    sector: text('sector'),
    market_symbol: text('market_symbol'),
    created_at: text('created_at').default(sql`(datetime('now'))`),
    updated_at: text('updated_at').default(sql`(datetime('now'))`),
  },
  (t) => [uniqueIndex('unique_inversion_usuario_activo_custodia').on(t.usuario_id, t.activo, t.custodia)]
)

// Archivo histórico de la importación inicial. La aplicación ya no consulta
// ni actualiza estas filas durante el funcionamiento normal.
export const inversiones_excel_filas = sqliteTable(
  'inversiones_excel_filas',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    usuario_id: integer('usuario_id').notNull().references(() => usuarios.id),
    hoja: text('hoja').notNull(),
    fila: integer('fila').notNull(),
    tipo: text('tipo').notNull().default('fila'),
    datos: text('datos').notNull(),
    imported_at: text('imported_at').notNull(),
  },
  (t) => [uniqueIndex('unique_inversion_excel_usuario_hoja_fila').on(t.usuario_id, t.hoja, t.fila)]
)

// ─── INVERSIONES / OPERACIONES ──────────────────────────────────────────────
// Registro de compras, ventas, dividendos, aportaciones y traspasos.
export const inversiones_operaciones = sqliteTable('inversiones_operaciones', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  usuario_id: integer('usuario_id').notNull().references(() => usuarios.id),
  fecha: text('fecha').notNull(),
  tipo: text('tipo').notNull(),
  activo: text('activo').notNull(),
  ticker: text('ticker').notNull(),
  tipo_activo: text('tipo_activo').notNull().default('Otro'),
  custodia: text('custodia').notNull(),
  cantidad: real('cantidad').notNull(),
  precio_unitario: real('precio_unitario').notNull(),
  importe: real('importe').notNull(),
  notas: text('notas'),
  created_at: text('created_at').default(sql`(datetime('now'))`),
})

// ─── RELACIONES ──────────────────────────────────────────────────────────────
export const usuariosRelations = relations(usuarios, ({ many }) => ({
  categorias: many(categorias),
  registros_mensuales: many(registros_mensuales),
  huchas: many(huchas),
  desviaciones: many(desviaciones), // Editado: 2026-03-30 — relación con desviaciones
  inversiones_posiciones: many(inversiones_posiciones),
  inversiones_operaciones: many(inversiones_operaciones),
  inversiones_excel_filas: many(inversiones_excel_filas),
}))

export const categoriasRelations = relations(categorias, ({ one }) => ({
  usuario: one(usuarios, { fields: [categorias.usuario_id], references: [usuarios.id] }),
}))

// Editado: 2026-03-30 — añadida relación con desviaciones
export const registrosMensualesRelations = relations(registros_mensuales, ({ one, many }) => ({
  usuario: one(usuarios, { fields: [registros_mensuales.usuario_id], references: [usuarios.id] }),
  snapshots: many(snapshots_categorias),
  desviaciones: many(desviaciones),
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

// Editado: 2026-03-30 — relaciones de desviaciones con registro y usuario
export const desviacionesRelations = relations(desviaciones, ({ one }) => ({
  registro: one(registros_mensuales, {
    fields: [desviaciones.registro_id],
    references: [registros_mensuales.id],
  }),
  usuario: one(usuarios, {
    fields: [desviaciones.usuario_id],
    references: [usuarios.id],
  }),
}))

export const inversionesPosicionesRelations = relations(inversiones_posiciones, ({ one }) => ({
  usuario: one(usuarios, {
    fields: [inversiones_posiciones.usuario_id],
    references: [usuarios.id],
  }),
}))

export const inversionesOperacionesRelations = relations(inversiones_operaciones, ({ one }) => ({
  usuario: one(usuarios, {
    fields: [inversiones_operaciones.usuario_id],
    references: [usuarios.id],
  }),
}))

export const inversionesExcelFilasRelations = relations(inversiones_excel_filas, ({ one }) => ({
  usuario: one(usuarios, {
    fields: [inversiones_excel_filas.usuario_id],
    references: [usuarios.id],
  }),
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
export type Desviacion = typeof desviaciones.$inferSelect        // Editado: 2026-03-30
export type NuevaDesviacion = typeof desviaciones.$inferInsert   // Editado: 2026-03-30
export type InversionPosicion = typeof inversiones_posiciones.$inferSelect
export type NuevaInversionPosicion = typeof inversiones_posiciones.$inferInsert
export type InversionOperacion = typeof inversiones_operaciones.$inferSelect
export type NuevaInversionOperacion = typeof inversiones_operaciones.$inferInsert
export type InversionExcelFila = typeof inversiones_excel_filas.$inferSelect
export type NuevaInversionExcelFila = typeof inversiones_excel_filas.$inferInsert
