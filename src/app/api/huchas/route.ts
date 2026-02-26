import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { huchas, aportaciones } from '@/lib/db/schema'
import { eq, desc, sum } from 'drizzle-orm'
import { huchaSchema } from '@/lib/validations/hucha'
import { getAuthenticatedUserId, isNextResponse } from '@/lib/api-utils'

export async function GET() {
  const auth = await getAuthenticatedUserId()
  if (isNextResponse(auth)) return auth

  const data = await db.query.huchas.findMany({
    where: eq(huchas.usuario_id, auth.userId),
    orderBy: [desc(huchas.created_at)],
    with: {
      aportaciones: {
        orderBy: [desc(aportaciones.fecha)],
      },
    },
  })

  // Calcular saldo de cada hucha
  const huchasConSaldo = data.map((h) => ({
    ...h,
    saldo_actual: h.aportaciones.reduce((acc, a) => acc + a.cantidad, 0),
  }))

  return NextResponse.json(huchasConSaldo)
}

export async function POST(req: Request) {
  const auth = await getAuthenticatedUserId()
  if (isNextResponse(auth)) return auth

  const body = await req.json()
  const parsed = huchaSchema.safeParse(body)

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }

  const [nueva] = await db
    .insert(huchas)
    .values({ ...parsed.data, usuario_id: auth.userId })
    .returning()

  return NextResponse.json({ ...nueva, saldo_actual: 0 }, { status: 201 })
}
