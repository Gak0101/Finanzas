import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { desviaciones } from '@/lib/db/schema'
import { and, eq } from 'drizzle-orm'
import { getAuthenticatedUserId, isNextResponse } from '@/lib/api-utils'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function POST(req: Request) {
  const auth = await getAuthenticatedUserId()
  if (isNextResponse(auth)) return auth

  const body = await req.json().catch(() => ({}))
  const categoriaOrigen = typeof body.categoria_origen === 'string' ? body.categoria_origen : ''
  const registroId = typeof body.registro_id === 'number' ? body.registro_id : null

  if (!categoriaOrigen) {
    return NextResponse.json({ error: 'Se requiere categoria_origen' }, { status: 400 })
  }

  const where = registroId
    ? and(
        eq(desviaciones.usuario_id, auth.userId),
        eq(desviaciones.categoria_origen, categoriaOrigen),
        eq(desviaciones.saldada, false),
        eq(desviaciones.registro_id, registroId)
      )
    : and(
        eq(desviaciones.usuario_id, auth.userId),
        eq(desviaciones.categoria_origen, categoriaOrigen),
        eq(desviaciones.saldada, false)
      )

  const pendientes = await db.query.desviaciones.findMany({ where })

  if (pendientes.length === 0) {
    return NextResponse.json({ ok: true, actualizadas: 0 })
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

  return NextResponse.json({ ok: true, actualizadas: pendientes.length })
}
