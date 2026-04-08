// Editado: 2026-04-08 — Al crear ingreso, descuenta automáticamente deudas pendientes
import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import {
  registros_mensuales,
  snapshots_categorias,
  categorias,
  desviaciones,
} from '@/lib/db/schema'
import { eq, desc, asc, and } from 'drizzle-orm'
import { ingresoSchema } from '@/lib/validations/ingreso'
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

  // Calcular montos base según porcentajes
  const snapshotsBase = cats.map((cat) => ({
    categoria_nombre: cat.nombre,
    porcentaje: cat.porcentaje,
    color: cat.color,
    icono: cat.icono ?? '💰',
    monto_calculado: Math.round(registro.ingreso_bruto * (cat.porcentaje / 100) * 100) / 100,
  }))

  // --- Editado: 2026-04-08 — Descuento automático de deudas pendientes ---
  // Buscar desviaciones pendientes (saldada = false) del usuario
  const deudasPendientes = await db.query.desviaciones.findMany({
    where: and(
      eq(desviaciones.usuario_id, auth.userId),
      eq(desviaciones.saldada, false)
    ),
  })

  // Calcular ajuste neto por categoría:
  // - categoria_origen (Ahorro) prestó dinero → le devolvemos (+deuda)
  // - categoria_destino (Gastos) tomó prestado → paga de vuelta (-deuda)
  // Ejemplo: moviste 100€ de Ahorro a Gastos en abril →
  //   Mayo: Ahorro = porcentaje normal + 100€ / Gastos = porcentaje normal - 100€
  const ajustePorCategoria: Record<string, number> = {}
  for (const deuda of deudasPendientes) {
    // Origen (prestó): recibe de vuelta → suma
    ajustePorCategoria[deuda.categoria_origen] =
      (ajustePorCategoria[deuda.categoria_origen] ?? 0) + deuda.monto
    // Destino (tomó prestado): paga → resta
    ajustePorCategoria[deuda.categoria_destino] =
      (ajustePorCategoria[deuda.categoria_destino] ?? 0) - deuda.monto
  }

  // Aplicar ajustes a los snapshots base
  const snapshotsData = snapshotsBase.map((snap) => {
    const ajuste = ajustePorCategoria[snap.categoria_nombre] ?? 0
    if (ajuste !== 0) {
      const nuevoMonto = Math.round((snap.monto_calculado + ajuste) * 100) / 100
      return {
        ...snap,
        registro_id: registro.id,
        monto_calculado: nuevoMonto,
        porcentaje: Math.round((nuevoMonto / registro.ingreso_bruto) * 10000) / 100,
      }
    }
    return { ...snap, registro_id: registro.id }
  })

  await db.insert(snapshots_categorias).values(snapshotsData)

  // Marcar todas las deudas pendientes como saldadas en este nuevo registro
  if (deudasPendientes.length > 0) {
    for (const deuda of deudasPendientes) {
      await db
        .update(desviaciones)
        .set({
          saldada: true,
          saldada_en_registro_id: registro.id,
        })
        .where(eq(desviaciones.id, deuda.id))
    }
  }
  // --- Fin descuento automático ---

  const registroCompleto = await db.query.registros_mensuales.findFirst({
    where: eq(registros_mensuales.id, registro.id),
    with: { snapshots: true },
  })

  return NextResponse.json(registroCompleto, { status: 201 })
}

