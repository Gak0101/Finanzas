import { NextResponse } from 'next/server'
import { and, eq } from 'drizzle-orm'
import { z } from 'zod'
import { getAuthenticatedUserId, isNextResponse } from '@/lib/api-utils'
import { db } from '@/lib/db'
import { inversiones_posiciones } from '@/lib/db/schema'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const positionUpdateSchema = z.object({
  fecha_apertura: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'La fecha no es válida')
    .refine((value) => value <= new Date().toISOString().slice(0, 10), 'La fecha no puede estar en el futuro')
    .optional(),
  nota: z.string().max(2000).nullable().optional(),
  sector: z.string().max(100).nullable().optional(),
  pais: z.string().max(100).nullable().optional(),
  objetivo_precio: z.number().nonnegative().nullable().optional(),
  objetivo_peso_pct: z.number().min(0).max(1).nullable().optional(),
  alerta_subida_pct: z.number().min(0).max(10).nullable().optional(),
  alerta_caida_pct: z.number().min(0).max(10).nullable().optional(),
}).refine((value) => Object.keys(value).length > 0, 'No hay cambios que guardar')

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await getAuthenticatedUserId()
  if (isNextResponse(auth)) return auth

  const { id } = await params
  const positionId = Number(id)
  if (!Number.isInteger(positionId) || positionId <= 0) {
    return NextResponse.json({ error: 'Posición no válida' }, { status: 400 })
  }

  const parsed = positionUpdateSchema.safeParse(await req.json())
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Datos no válidos' }, { status: 400 })
  }

  const [position] = await db
    .update(inversiones_posiciones)
    .set({
      ...parsed.data,
      updated_at: new Date().toISOString(),
    })
    .where(and(
      eq(inversiones_posiciones.id, positionId),
      eq(inversiones_posiciones.usuario_id, auth.userId)
    ))
    .returning()

  if (!position) {
    return NextResponse.json({ error: 'Posición no encontrada' }, { status: 404 })
  }

  return NextResponse.json(position)
}
