import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { registros_mensuales, snapshots_categorias, categorias } from '@/lib/db/schema'
import { eq, and, asc } from 'drizzle-orm'
import { ingresoSchema } from '@/lib/validations/ingreso'
import { getAuthenticatedUserId, isNextResponse } from '@/lib/api-utils'
import { sql } from 'drizzle-orm'

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await getAuthenticatedUserId()
  if (isNextResponse(auth)) return auth

  const { id } = await params
  const registroId = parseInt(id)
  const body = await req.json()
  const parsed = ingresoSchema.safeParse(body)

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }

  const [actualizado] = await db
    .update(registros_mensuales)
    .set({ ...parsed.data, updated_at: sql`(datetime('now'))` })
    .where(
      and(
        eq(registros_mensuales.id, registroId),
        eq(registros_mensuales.usuario_id, auth.userId)
      )
    )
    .returning()

  if (!actualizado) {
    return NextResponse.json({ error: 'No encontrado' }, { status: 404 })
  }

  // Recalcular snapshots con el nuevo ingreso
  await db.delete(snapshots_categorias).where(eq(snapshots_categorias.registro_id, registroId))

  const cats = await db.query.categorias.findMany({
    where: eq(categorias.usuario_id, auth.userId),
    orderBy: [asc(categorias.orden), asc(categorias.id)],
  })

  if (cats.length > 0) {
    const snapshotsData = cats.map((cat) => ({
      registro_id: registroId,
      categoria_nombre: cat.nombre,
      porcentaje: cat.porcentaje,
      color: cat.color,
      icono: cat.icono ?? '💰',
      monto_calculado:
        Math.round(actualizado.ingreso_bruto * (cat.porcentaje / 100) * 100) / 100,
    }))
    await db.insert(snapshots_categorias).values(snapshotsData)
  }

  return NextResponse.json(actualizado)
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await getAuthenticatedUserId()
  if (isNextResponse(auth)) return auth

  const { id } = await params
  const registroId = parseInt(id)

  // Borrar snapshots primero (FK)
  await db.delete(snapshots_categorias).where(eq(snapshots_categorias.registro_id, registroId))

  const [eliminado] = await db
    .delete(registros_mensuales)
    .where(
      and(
        eq(registros_mensuales.id, registroId),
        eq(registros_mensuales.usuario_id, auth.userId)
      )
    )
    .returning()

  if (!eliminado) {
    return NextResponse.json({ error: 'No encontrado' }, { status: 404 })
  }

  return NextResponse.json({ ok: true })
}
