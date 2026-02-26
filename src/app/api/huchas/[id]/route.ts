import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { huchas, aportaciones } from '@/lib/db/schema'
import { eq, and, desc } from 'drizzle-orm'
import { huchaSchema } from '@/lib/validations/hucha'
import { getAuthenticatedUserId, isNextResponse } from '@/lib/api-utils'

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await getAuthenticatedUserId()
  if (isNextResponse(auth)) return auth

  const { id } = await params

  const hucha = await db.query.huchas.findFirst({
    where: and(eq(huchas.id, parseInt(id)), eq(huchas.usuario_id, auth.userId)),
    with: {
      aportaciones: {
        orderBy: [desc(aportaciones.fecha)],
      },
    },
  })

  if (!hucha) {
    return NextResponse.json({ error: 'No encontrada' }, { status: 404 })
  }

  const saldo_actual = hucha.aportaciones.reduce((acc, a) => acc + a.cantidad, 0)

  return NextResponse.json({ ...hucha, saldo_actual })
}

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await getAuthenticatedUserId()
  if (isNextResponse(auth)) return auth

  const { id } = await params
  const body = await req.json()
  const parsed = huchaSchema.safeParse(body)

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }

  const [actualizada] = await db
    .update(huchas)
    .set(parsed.data)
    .where(and(eq(huchas.id, parseInt(id)), eq(huchas.usuario_id, auth.userId)))
    .returning()

  if (!actualizada) {
    return NextResponse.json({ error: 'No encontrada' }, { status: 404 })
  }

  return NextResponse.json(actualizada)
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await getAuthenticatedUserId()
  if (isNextResponse(auth)) return auth

  const { id } = await params
  const huchaId = parseInt(id)

  // Borrar aportaciones primero
  await db.delete(aportaciones).where(eq(aportaciones.hucha_id, huchaId))

  const [eliminada] = await db
    .delete(huchas)
    .where(and(eq(huchas.id, huchaId), eq(huchas.usuario_id, auth.userId)))
    .returning()

  if (!eliminada) {
    return NextResponse.json({ error: 'No encontrada' }, { status: 404 })
  }

  return NextResponse.json({ ok: true })
}
