import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { categorias } from '@/lib/db/schema'
import { eq, asc } from 'drizzle-orm'
import { categoriaSchema } from '@/lib/validations/categoria'
import { getAuthenticatedUserId, isNextResponse } from '@/lib/api-utils'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function GET() {
  const auth = await getAuthenticatedUserId()
  if (isNextResponse(auth)) return auth

  const data = await db.query.categorias.findMany({
    where: eq(categorias.usuario_id, auth.userId),
    orderBy: [asc(categorias.orden), asc(categorias.id)],
  })

  return NextResponse.json(data)
}

export async function POST(req: Request) {
  const auth = await getAuthenticatedUserId()
  if (isNextResponse(auth)) return auth

  const body = await req.json()
  const parsed = categoriaSchema.safeParse(body)

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }

  const totalActual = await db.query.categorias.findMany({
    where: eq(categorias.usuario_id, auth.userId),
  })
  const suma = totalActual.reduce((acc, c) => acc + c.porcentaje, 0) + parsed.data.porcentaje
  if (suma > 100) {
    return NextResponse.json({ error: 'El total de porcentajes no puede superar 100%' }, { status: 400 })
  }

  const [nueva] = await db
    .insert(categorias)
    .values({ ...parsed.data, usuario_id: auth.userId })
    .returning()

  return NextResponse.json(nueva, { status: 201 })
}
