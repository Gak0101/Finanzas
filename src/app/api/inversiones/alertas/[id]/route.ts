import { NextResponse } from 'next/server'
import { and, eq } from 'drizzle-orm'
import { db } from '@/lib/db'
import { inversiones_alertas } from '@/lib/db/schema'
import { getAuthenticatedUserId, isNextResponse } from '@/lib/api-utils'
import { inversionAlertaPatchSchema } from '@/lib/validations/inversionAlerta'
import { normalizeIsin } from '@/lib/inversiones/instrumentIdentity'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await getAuthenticatedUserId()
  if (isNextResponse(auth)) return auth

  const id = Number((await params).id)
  if (!Number.isInteger(id) || id <= 0) return NextResponse.json({ error: 'Alerta no válida' }, { status: 400 })

  const parsed = inversionAlertaPatchSchema.safeParse(await req.json())
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Datos no válidos' }, { status: 400 })
  }
  const input = parsed.data
  const values: Record<string, unknown> = { updated_at: new Date().toISOString() }
  for (const key of ['isin', 'precio_objetivo', 'umbral_subida_pct', 'umbral_caida_pct', 'rearmar_pct', 'canal_telegram', 'canal_email', 'activa']) {
    if (Object.prototype.hasOwnProperty.call(input, key)) {
      values[key] = key === 'isin' ? normalizeIsin(input.isin) : input[key as keyof typeof input]
    }
  }
  if (Object.prototype.hasOwnProperty.call(input, 'precio_objetivo') || Object.prototype.hasOwnProperty.call(input, 'umbral_subida_pct') || Object.prototype.hasOwnProperty.call(input, 'umbral_caida_pct')) {
    values.estado = 'normal'
    values.ultimo_error = null
  }

  const [updated] = await db.update(inversiones_alertas)
    .set(values)
    .where(and(eq(inversiones_alertas.id, id), eq(inversiones_alertas.usuario_id, auth.userId)))
    .returning()
  if (!updated) return NextResponse.json({ error: 'Alerta no encontrada' }, { status: 404 })
  return NextResponse.json(updated)
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await getAuthenticatedUserId()
  if (isNextResponse(auth)) return auth

  const id = Number((await params).id)
  if (!Number.isInteger(id) || id <= 0) return NextResponse.json({ error: 'Alerta no válida' }, { status: 400 })

  const [deleted] = await db.delete(inversiones_alertas)
    .where(and(eq(inversiones_alertas.id, id), eq(inversiones_alertas.usuario_id, auth.userId)))
    .returning({ id: inversiones_alertas.id })
  if (!deleted) return NextResponse.json({ error: 'Alerta no encontrada' }, { status: 404 })
  return NextResponse.json({ ok: true, id: deleted.id })
}
