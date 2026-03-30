// Editado: 2026-03-30 — API para desviaciones pendientes (no saldadas)
// Devuelve todas las desviaciones que aún no se han saldado, agrupables por categoría
import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { desviaciones } from '@/lib/db/schema'
import { eq, and, desc } from 'drizzle-orm'
import { getAuthenticatedUserId, isNextResponse } from '@/lib/api-utils'

// GET /api/desviaciones/pendientes — Deudas no saldadas del usuario
export async function GET() {
  const auth = await getAuthenticatedUserId()
  if (isNextResponse(auth)) return auth

  // Obtener todas las desviaciones pendientes (no saldadas) del usuario
  const pendientes = await db.query.desviaciones.findMany({
    where: and(
      eq(desviaciones.usuario_id, auth.userId),
      eq(desviaciones.saldada, false)
    ),
    orderBy: [desc(desviaciones.created_at)],
    with: {
      registro: true, // Incluir datos del registro para saber mes/año
    },
  })

  // Agrupar deudas por categoría origen (quién prestó el dinero)
  // Esto permite ver: "Le debes 180€ a Ocio, 80€ a Inversión..."
  const resumenPorCategoria: Record<string, { total: number; detalle: typeof pendientes }> = {}

  for (const p of pendientes) {
    const cat = p.categoria_origen
    if (!resumenPorCategoria[cat]) {
      resumenPorCategoria[cat] = { total: 0, detalle: [] }
    }
    resumenPorCategoria[cat].total += p.monto
    resumenPorCategoria[cat].detalle.push(p)
  }

  return NextResponse.json({
    pendientes,
    resumen: resumenPorCategoria,
    total_deuda: pendientes.reduce((sum, p) => sum + p.monto, 0),
  })
}
