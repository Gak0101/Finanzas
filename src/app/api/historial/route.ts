import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { registros_mensuales } from '@/lib/db/schema'
import { eq, desc } from 'drizzle-orm'
import { getAuthenticatedUserId, isNextResponse } from '@/lib/api-utils'

export async function GET() {
  const auth = await getAuthenticatedUserId()
  if (isNextResponse(auth)) return auth

  const registros = await db.query.registros_mensuales.findMany({
    where: eq(registros_mensuales.usuario_id, auth.userId),
    orderBy: [desc(registros_mensuales.anio), desc(registros_mensuales.mes)],
    with: {
      snapshots: true,
    },
  })

  return NextResponse.json(registros)
}
