import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { registros_mensuales, snapshots_categorias, categorias } from '@/lib/db/schema'
import { eq, and, asc, sql } from 'drizzle-orm'
import { getAuthenticatedUserId, isNextResponse } from '@/lib/api-utils'

/**
 * POST /api/ingresos/[id]/regenerar
 *
 * Regenera los snapshots de categorías de un registro mensual existente
 * usando los porcentajes ACTUALES de las categorías del usuario.
 *
 * Útil cuando el usuario cambia sus % de categorías después de haber
 * registrado el ingreso del mes en curso.
 *
 * Nota: el historial de meses pasados solo cambia si el usuario lo decide
 * explícitamente pulsando este botón.
 */
export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await getAuthenticatedUserId()
  if (isNextResponse(auth)) return auth

  const { id } = await params
  const registroId = parseInt(id)

  // Verificar que el registro existe y pertenece al usuario
  const registro = await db.query.registros_mensuales.findFirst({
    where: and(
      eq(registros_mensuales.id, registroId),
      eq(registros_mensuales.usuario_id, auth.userId)
    ),
  })

  if (!registro) {
    return NextResponse.json({ error: 'Registro no encontrado' }, { status: 404 })
  }

  // Obtener categorías actuales del usuario
  const cats = await db.query.categorias.findMany({
    where: eq(categorias.usuario_id, auth.userId),
    orderBy: [asc(categorias.orden), asc(categorias.id)],
  })

  if (cats.length === 0) {
    return NextResponse.json(
      { error: 'No tienes categorías definidas' },
      { status: 400 }
    )
  }

  // Borrar snapshots existentes y recrearlos con los % actuales
  await db.delete(snapshots_categorias).where(
    eq(snapshots_categorias.registro_id, registroId)
  )

  const snapshotsData = cats.map((cat) => ({
    registro_id: registroId,
    categoria_nombre: cat.nombre,
    porcentaje: cat.porcentaje,
    color: cat.color,
    icono: cat.icono ?? '💰',
    monto_calculado:
      Math.round(registro.ingreso_bruto * (cat.porcentaje / 100) * 100) / 100,
  }))

  await db.insert(snapshots_categorias).values(snapshotsData)

  // Actualizar updated_at del registro para que el dashboard detecte que ya está sincronizado
  await db
    .update(registros_mensuales)
    .set({ updated_at: sql`(datetime('now'))` })
    .where(eq(registros_mensuales.id, registroId))

  // Devolver el registro completo con los nuevos snapshots
  const registroActualizado = await db.query.registros_mensuales.findFirst({
    where: eq(registros_mensuales.id, registroId),
    with: { snapshots: true },
  })

  return NextResponse.json(registroActualizado)
}
