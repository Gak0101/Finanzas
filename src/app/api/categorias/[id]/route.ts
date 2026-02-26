import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { categorias } from '@/lib/db/schema'
import { eq, and } from 'drizzle-orm'
import { categoriaSchema } from '@/lib/validations/categoria'
import { getAuthenticatedUserId, isNextResponse } from '@/lib/api-utils'
import { sql } from 'drizzle-orm'

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await getAuthenticatedUserId()
  if (isNextResponse(auth)) return auth

  const { id } = await params
  const body = await req.json()
  const parsed = categoriaSchema.safeParse(body)

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }

  const [actualizada] = await db
    .update(categorias)
    .set({ ...parsed.data, updated_at: sql`(datetime('now'))` })
    .where(and(eq(categorias.id, parseInt(id)), eq(categorias.usuario_id, auth.userId)))
    .returning()

  if (!actualizada) {
    return NextResponse.json({ error: 'No encontrado' }, { status: 404 })
  }

  return NextResponse.json(actualizada)
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await getAuthenticatedUserId()
  if (isNextResponse(auth)) return auth

  const { id } = await params

  const [eliminada] = await db
    .delete(categorias)
    .where(and(eq(categorias.id, parseInt(id)), eq(categorias.usuario_id, auth.userId)))
    .returning()

  if (!eliminada) {
    return NextResponse.json({ error: 'No encontrado' }, { status: 404 })
  }

  return NextResponse.json({ ok: true })
}
