// Editado: 2026-03-30 — Endpoint para reajustar snapshots de un registro
// Recibe los montos nuevos de cada categoría y actualiza los snapshots
// Registra la desviación en la tabla desviaciones para historial
import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { registros_mensuales, snapshots_categorias, desviaciones } from '@/lib/db/schema'
import { eq, and, sql } from 'drizzle-orm'
import { getAuthenticatedUserId, isNextResponse } from '@/lib/api-utils'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

// PUT /api/ingresos/[id]/reajustar — Reajustar distribución de un mes
export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await getAuthenticatedUserId()
  if (isNextResponse(auth)) return auth

  const { id } = await params
  const registroId = parseInt(id)
  const body = await req.json()

  // body esperado: { snapshots: [...], motivo?, etiqueta?, skipDesviacion?: boolean }
  // Editado: 2026-04-08 — Añadido skipDesviacion para evitar doble registro desde MoverDinero
  const { snapshots: nuevosSnaps, motivo, etiqueta, skipDesviacion } = body

  if (!Array.isArray(nuevosSnaps) || nuevosSnaps.length === 0) {
    return NextResponse.json({ error: 'Se requiere array de snapshots' }, { status: 400 })
  }

  // Verificar que el registro existe y pertenece al usuario
  const registro = await db.query.registros_mensuales.findFirst({
    where: and(
      eq(registros_mensuales.id, registroId),
      eq(registros_mensuales.usuario_id, auth.userId)
    ),
    with: { snapshots: true },
  })

  if (!registro) {
    return NextResponse.json({ error: 'Registro no encontrado' }, { status: 404 })
  }

  // Obtener snapshots originales para calcular diferencias
  const snapsOriginales = registro.snapshots

  // Actualizar cada snapshot con el nuevo monto y porcentaje
  for (const snap of nuevosSnaps) {
    await db
      .update(snapshots_categorias)
      .set({
        monto_calculado: snap.monto_calculado,
        porcentaje: snap.porcentaje,
      })
      .where(
        and(
          eq(snapshots_categorias.id, snap.id),
          eq(snapshots_categorias.registro_id, registroId)
        )
      )
  }

  // Editado: 2026-04-08 — Solo registrar desviaciones si no se indica skipDesviacion
  // Cuando se llama desde MoverDinero, la desviación ya fue creada antes
  if (!skipDesviacion) {
    // Registrar las desviaciones (diferencias) en la tabla desviaciones
    for (const snap of nuevosSnaps) {
      const original = snapsOriginales.find((s) => s.id === snap.id)
      if (!original) continue

      const diferencia = snap.monto_calculado - original.monto_calculado
      // Solo registrar si hay cambio significativo (> 0.01€)
      if (Math.abs(diferencia) > 0.01) {
        // Si la categoría recibió más dinero → destino
        // Si la categoría perdió dinero → origen
        if (diferencia > 0) {
          // Esta categoría recibió más → buscar de dónde salió (las que bajaron)
          await db.insert(desviaciones).values({
            registro_id: registroId,
            usuario_id: auth.userId,
            categoria_origen: 'Distribución variable',
            categoria_destino: original.categoria_nombre,
            monto: Math.round(diferencia * 100) / 100,
            motivo: motivo || `Reajuste: ${original.categoria_nombre} de ${original.monto_calculado}€ a ${snap.monto_calculado}€`,
            etiqueta: etiqueta || null,
            saldada: true, // Ya se aplicó, no es deuda pendiente
          })
        }
      }
    }
  }

  // Actualizar updated_at del registro
  await db
    .update(registros_mensuales)
    .set({ updated_at: sql`(datetime('now'))` })
    .where(eq(registros_mensuales.id, registroId))

  // Devolver registro actualizado
  const registroActualizado = await db.query.registros_mensuales.findFirst({
    where: eq(registros_mensuales.id, registroId),
    with: { snapshots: true },
  })

  return NextResponse.json(registroActualizado)
}
