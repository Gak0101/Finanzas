import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import {
  registros_mensuales,
  snapshots_categorias,
  categorias,
} from '@/lib/db/schema'
import { eq, desc, asc } from 'drizzle-orm'
import { ingresoSchema } from '@/lib/validations/ingreso'
import { getAuthenticatedUserId, isNextResponse } from '@/lib/api-utils'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

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

export async function POST(req: Request) {
  const auth = await getAuthenticatedUserId()
  if (isNextResponse(auth)) return auth

  const body = await req.json()
  const parsed = ingresoSchema.safeParse(body)

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }

  // Obtener categorías actuales del usuario
  const cats = await db.query.categorias.findMany({
    where: eq(categorias.usuario_id, auth.userId),
    orderBy: [asc(categorias.orden), asc(categorias.id)],
  })

  if (cats.length === 0) {
    return NextResponse.json(
      { error: 'Debes crear categorías antes de registrar un ingreso' },
      { status: 400 }
    )
  }

  // Crear el registro mensual
  const [registro] = await db
    .insert(registros_mensuales)
    .values({ ...parsed.data, usuario_id: auth.userId })
    .returning()

  // Calcular snapshots según las categorías actuales.
  // Las deudas pendientes NO se saldan automáticamente al registrar ingresos:
  // se pagan manualmente desde el dashboard eligiendo de qué categoría sale el dinero.
  const snapshotsData = cats.map((cat) => ({
    registro_id: registro.id,
    categoria_nombre: cat.nombre,
    porcentaje: cat.porcentaje,
    color: cat.color,
    icono: cat.icono ?? '💰',
    monto_calculado: Math.round(registro.ingreso_bruto * (cat.porcentaje / 100) * 100) / 100,
  }))

  await db.insert(snapshots_categorias).values(snapshotsData)

  const registroCompleto = await db.query.registros_mensuales.findFirst({
    where: eq(registros_mensuales.id, registro.id),
    with: { snapshots: true },
  })

  return NextResponse.json(registroCompleto, { status: 201 })
}
