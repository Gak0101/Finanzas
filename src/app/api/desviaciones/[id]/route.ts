// Editado: 2026-03-30 — API para saldar/eliminar una desviación individual
// PUT: marca una desviación como saldada
// DELETE: elimina una desviación
import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { desviaciones } from '@/lib/db/schema'
import { eq, and, sql } from 'drizzle-orm'
import { getAuthenticatedUserId, isNextResponse } from '@/lib/api-utils'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

// PUT /api/desviaciones/[id] — Marcar desviación como saldada
export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await getAuthenticatedUserId()
  if (isNextResponse(auth)) return auth

  const { id } = await params
  const desviacionId = parseInt(id)
  const body = await req.json().catch(() => ({}))

  // Actualizar: marcar como saldada
  const [actualizada] = await db
    .update(desviaciones)
    .set({
      saldada: true,
      saldada_en_registro_id: body.saldada_en_registro_id ?? null,
    })
    .where(
      and(
        eq(desviaciones.id, desviacionId),
        eq(desviaciones.usuario_id, auth.userId)
      )
    )
    .returning()

  if (!actualizada) {
    return NextResponse.json({ error: 'Desviación no encontrada' }, { status: 404 })
  }

  return NextResponse.json(actualizada)
}

// DELETE /api/desviaciones/[id] — Eliminar una desviación
export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await getAuthenticatedUserId()
  if (isNextResponse(auth)) return auth

  const { id } = await params
  const desviacionId = parseInt(id)

  const [eliminada] = await db
    .delete(desviaciones)
    .where(
      and(
        eq(desviaciones.id, desviacionId),
        eq(desviaciones.usuario_id, auth.userId)
      )
    )
    .returning()

  if (!eliminada) {
    return NextResponse.json({ error: 'Desviación no encontrada' }, { status: 404 })
  }

  return NextResponse.json({ ok: true })
}
