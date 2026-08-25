import { NextResponse } from 'next/server'
import { and, eq } from 'drizzle-orm'
import { db } from '@/lib/db'
import { inversiones_alertas } from '@/lib/db/schema'
import { getAuthenticatedUserId, isNextResponse } from '@/lib/api-utils'
import { AlertTargetResolutionError, resolveAlertTarget, targetFromInput } from '@/lib/inversiones/alertTarget'
import { fetchAssetPrice } from '@/lib/inversiones/marketData'
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
  const rule = await db.query.inversiones_alertas.findFirst({
    where: and(eq(inversiones_alertas.id, id), eq(inversiones_alertas.usuario_id, auth.userId)),
  })
  if (!rule) return NextResponse.json({ error: 'Alerta no encontrada' }, { status: 404 })

  let targetInput
  try {
    targetInput = targetFromInput(input)
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Objetivo no válido' }, { status: 400 })
  }
  if (targetInput !== undefined && rule.alcance !== 'activo') {
    return NextResponse.json({ error: 'El precio objetivo solo está disponible para activos' }, { status: 400 })
  }

  const values: Record<string, unknown> = { updated_at: new Date().toISOString() }
  for (const key of ['isin', 'precio_referencia', 'umbral_subida_pct', 'umbral_caida_pct', 'rearmar_pct', 'canal_telegram', 'canal_email', 'activa']) {
    if (Object.hasOwn(input, key)) {
      values[key] = key === 'isin' ? normalizeIsin(input.isin) : input[key as keyof typeof input]
    }
  }

  if (targetInput !== undefined) {
    let capturedPrice: Awaited<ReturnType<typeof fetchAssetPrice>> | null = null
    if (targetInput !== null && targetInput.divisa !== 'EUR') {
      try {
        capturedPrice = await fetchAssetPrice({
          tipoActivo: rule.tipo_activo || 'Acción',
          ticker: rule.price_ticker || rule.ticker || '',
          cryptoId: rule.crypto_id,
          marketSymbol: rule.market_symbol,
        })
      } catch (error) {
        return NextResponse.json({
          error: error instanceof Error
            ? `No se pudo obtener una cotización nativa actual para este objetivo: ${error.message}`
            : 'No se pudo obtener una cotización nativa actual para este objetivo.',
        }, { status: 400 })
      }
    }
    try {
      Object.assign(values, resolveAlertTarget(targetInput, capturedPrice))
    } catch (error) {
      return NextResponse.json({
        error: error instanceof AlertTargetResolutionError ? error.message : 'No se pudo resolver el objetivo de alerta.',
      }, { status: 400 })
    }
  }

  if (Object.hasOwn(input, 'precio_referencia') || targetInput !== undefined || Object.hasOwn(input, 'umbral_subida_pct') || Object.hasOwn(input, 'umbral_caida_pct')) {
    values.estado = 'normal'
    values.ultimo_error = null
  }

  const [updated] = await db.update(inversiones_alertas)
    .set(values)
    .where(and(eq(inversiones_alertas.id, id), eq(inversiones_alertas.usuario_id, auth.userId)))
    .returning()
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
