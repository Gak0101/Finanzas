// Editado: 2026-03-30 — API para registrar y listar desviaciones
// POST: registra una nueva desviación entre categorías
// GET: lista desviaciones de un registro concreto (por query param registro_id)
import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { desviaciones, registros_mensuales } from '@/lib/db/schema'
import { eq, and, desc } from 'drizzle-orm'
import { desviacionSchema } from '@/lib/validations/desviacion'
import { getAuthenticatedUserId, isNextResponse } from '@/lib/api-utils'

// GET /api/desviaciones?registro_id=X — Lista desviaciones de un registro
export async function GET(req: Request) {
  const auth = await getAuthenticatedUserId()
  if (isNextResponse(auth)) return auth

  const { searchParams } = new URL(req.url)
  const registroId = searchParams.get('registro_id')

  // Si se pasa registro_id, filtrar por ese registro
  const where = registroId
    ? and(
        eq(desviaciones.usuario_id, auth.userId),
        eq(desviaciones.registro_id, parseInt(registroId))
      )
    : eq(desviaciones.usuario_id, auth.userId)

  const data = await db.query.desviaciones.findMany({
    where,
    orderBy: [desc(desviaciones.created_at)],
  })

  return NextResponse.json(data)
}

// POST /api/desviaciones — Registra una nueva desviación
export async function POST(req: Request) {
  const auth = await getAuthenticatedUserId()
  if (isNextResponse(auth)) return auth

  const body = await req.json()
  const parsed = desviacionSchema.safeParse(body)

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }

  // Verificar que el registro existe y pertenece al usuario
  const registro = await db.query.registros_mensuales.findFirst({
    where: and(
      eq(registros_mensuales.id, parsed.data.registro_id),
      eq(registros_mensuales.usuario_id, auth.userId)
    ),
  })

  if (!registro) {
    return NextResponse.json({ error: 'Registro no encontrado' }, { status: 404 })
  }

  // Crear la desviación
  const [nueva] = await db
    .insert(desviaciones)
    .values({
      ...parsed.data,
      usuario_id: auth.userId,
    })
    .returning()

  return NextResponse.json(nueva, { status: 201 })
}
