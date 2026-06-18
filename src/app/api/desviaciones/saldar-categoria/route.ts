import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { desviaciones, registros_mensuales, snapshots_categorias } from '@/lib/db/schema'
import { and, eq, sql } from 'drizzle-orm'
import { getAuthenticatedUserId, isNextResponse } from '@/lib/api-utils'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const FUENTE_EXTERNA = '__externo__'

export async function POST(req: Request) {
  const auth = await getAuthenticatedUserId()
  if (isNextResponse(auth)) return auth

  const body = await req.json().catch(() => ({}))
  const categoriaOrigen = typeof body.categoria_origen === 'string' ? body.categoria_origen : ''
  const categoriaPago = typeof body.categoria_pago === 'string' ? body.categoria_pago : ''
  const registroId = typeof body.registro_id === 'number' ? body.registro_id : null

  if (!categoriaOrigen) {
    return NextResponse.json({ error: 'Se requiere categoria_origen' }, { status: 400 })
  }

  if (!categoriaPago) {
    return NextResponse.json({ error: 'Se requiere categoria_pago' }, { status: 400 })
  }

  if (!registroId) {
    return NextResponse.json({ error: 'Se requiere registro_id' }, { status: 400 })
  }

  const pagaDesdeFuenteExterna = categoriaPago === FUENTE_EXTERNA

  if (!pagaDesdeFuenteExterna && categoriaPago === categoriaOrigen) {
    return NextResponse.json(
      { error: 'El dinero debe salir de una categoría distinta a la que recibe el pago' },
      { status: 400 }
    )
  }

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

  const pendientes = await db.query.desviaciones.findMany({
    where: and(
      eq(desviaciones.usuario_id, auth.userId),
      eq(desviaciones.categoria_origen, categoriaOrigen),
      eq(desviaciones.saldada, false)
    ),
  })

  if (pendientes.length === 0) {
    return NextResponse.json({ ok: true, actualizadas: 0 })
  }

  const total = Math.round(pendientes.reduce((sum, d) => sum + d.monto, 0) * 100) / 100
  const snapOrigen = registro.snapshots.find((s) => s.categoria_nombre === categoriaOrigen)
  const snapPago = pagaDesdeFuenteExterna
    ? null
    : registro.snapshots.find((s) => s.categoria_nombre === categoriaPago)

  if (!snapOrigen) {
    return NextResponse.json(
      { error: `La categoría "${categoriaOrigen}" no existe en la distribución de este mes` },
      { status: 400 }
    )
  }

  if (!pagaDesdeFuenteExterna && !snapPago) {
    return NextResponse.json(
      { error: `La categoría "${categoriaPago}" no existe en la distribución de este mes` },
      { status: 400 }
    )
  }

  if (snapPago && snapPago.monto_calculado < total) {
    return NextResponse.json(
      {
        error: `No hay saldo suficiente en "${categoriaPago}" para pagar ${total.toFixed(2)}€`,
      },
      { status: 400 }
    )
  }

  await db
    .update(snapshots_categorias)
    .set({ monto_calculado: Math.round((snapOrigen.monto_calculado + total) * 100) / 100 })
    .where(eq(snapshots_categorias.id, snapOrigen.id))

  if (snapPago) {
    await db
      .update(snapshots_categorias)
      .set({ monto_calculado: Math.round((snapPago.monto_calculado - total) * 100) / 100 })
      .where(eq(snapshots_categorias.id, snapPago.id))
  }

  for (const d of pendientes) {
    await db
      .update(desviaciones)
      .set({
        saldada: true,
        saldada_en_registro_id: registroId,
      })
      .where(eq(desviaciones.id, d.id))
  }

  await db
    .update(registros_mensuales)
    .set({ updated_at: sql`(datetime('now'))` })
    .where(eq(registros_mensuales.id, registroId))

  return NextResponse.json({
    ok: true,
    actualizadas: pendientes.length,
    total_pagado: total,
    categoria_origen: categoriaOrigen,
    categoria_pago: pagaDesdeFuenteExterna ? 'Metálico / fuera de categorías' : categoriaPago,
    fuente_externa: pagaDesdeFuenteExterna,
  })
}
