import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { huchas, aportaciones } from '@/lib/db/schema'
import { eq, and, desc } from 'drizzle-orm'
import { aportacionSchema } from '@/lib/validations/hucha'
import { getAuthenticatedUserId, isNextResponse } from '@/lib/api-utils'

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await getAuthenticatedUserId()
  if (isNextResponse(auth)) return auth

  const { id } = await params
  const huchaId = parseInt(id)

  // Verificar que la hucha pertenece al usuario
  const hucha = await db.query.huchas.findFirst({
    where: and(eq(huchas.id, huchaId), eq(huchas.usuario_id, auth.userId)),
  })

  if (!hucha) {
    return NextResponse.json({ error: 'Hucha no encontrada' }, { status: 404 })
  }

  const body = await req.json()
  const parsed = aportacionSchema.safeParse(body)

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }

  const [nueva] = await db
    .insert(aportaciones)
    .values({ ...parsed.data, hucha_id: huchaId })
    .returning()

  return NextResponse.json(nueva, { status: 201 })
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await getAuthenticatedUserId()
  if (isNextResponse(auth)) return auth

  const { id } = await params
  const url = new URL(req.url)
  const aportacionId = url.searchParams.get('aportacion_id')

  if (!aportacionId) {
    return NextResponse.json({ error: 'aportacion_id requerido' }, { status: 400 })
  }

  // Verificar que la hucha es del usuario
  const hucha = await db.query.huchas.findFirst({
    where: and(eq(huchas.id, parseInt(id)), eq(huchas.usuario_id, auth.userId)),
  })

  if (!hucha) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
  }

  const [eliminada] = await db
    .delete(aportaciones)
    .where(
      and(
        eq(aportaciones.id, parseInt(aportacionId)),
        eq(aportaciones.hucha_id, parseInt(id))
      )
    )
    .returning()

  if (!eliminada) {
    return NextResponse.json({ error: 'No encontrada' }, { status: 404 })
  }

  return NextResponse.json({ ok: true })
}
