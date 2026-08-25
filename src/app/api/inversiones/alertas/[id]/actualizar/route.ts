import { NextResponse } from 'next/server'
import { and, eq } from 'drizzle-orm'
import { db } from '@/lib/db'
import { inversiones_alertas, inversiones_posiciones } from '@/lib/db/schema'
import { getAuthenticatedUserId, isNextResponse } from '@/lib/api-utils'
import { fetchAssetPrice, refreshInvestmentPrices } from '@/lib/inversiones/marketData'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await getAuthenticatedUserId()
  if (isNextResponse(auth)) return auth

  const id = Number((await params).id)
  if (!Number.isInteger(id) || id <= 0) return NextResponse.json({ error: 'Alerta no válida' }, { status: 400 })

  const rule = await db.query.inversiones_alertas.findFirst({
    where: and(eq(inversiones_alertas.id, id), eq(inversiones_alertas.usuario_id, auth.userId)),
  })
  if (!rule) return NextResponse.json({ error: 'Alerta no encontrada' }, { status: 404 })
  if (rule.alcance !== 'activo') return NextResponse.json({ error: 'La cartera completa se actualiza con el botón general de precios' }, { status: 400 })

  const checkedAt = new Date().toISOString()

  try {
    if (rule.posicion_id !== null) {
      await refreshInvestmentPrices(auth.userId)
      const position = await db.query.inversiones_posiciones.findFirst({
        where: and(eq(inversiones_posiciones.id, rule.posicion_id), eq(inversiones_posiciones.usuario_id, auth.userId)),
      })
      if (!position?.precio_actual || position.precio_actual <= 0) {
        return NextResponse.json({ error: 'La posición no tiene un precio actual disponible' }, { status: 422 })
      }

      const referencePrice = rule.precio_referencia ?? (position.coste !== null && position.cantidad > 0 ? position.coste / position.cantidad : position.precio_actual)
      const rendimientoPct = position.pnl_pct ?? (referencePrice > 0 ? (position.precio_actual - referencePrice) / referencePrice : null)
      const [updated] = await db.update(inversiones_alertas).set({
        precio_referencia: rule.precio_referencia ?? referencePrice,
        precio_actual: position.precio_actual,
        precio_actual_nativo: position.precio_actual_nativo,
        divisa_nativa: position.divisa_nativa,
        rendimiento_pct: rendimientoPct,
        ultima_comprobacion_at: checkedAt,
        ultimo_error: null,
        updated_at: checkedAt,
      }).where(eq(inversiones_alertas.id, rule.id)).returning()
      return NextResponse.json(updated)
    }

    const price = await fetchAssetPrice({
      tipoActivo: rule.tipo_activo || 'Acción',
      ticker: rule.price_ticker || rule.ticker || '',
      cryptoId: rule.crypto_id,
      marketSymbol: rule.market_symbol,
    })
    const referencePrice = rule.precio_referencia ?? price.price
    const rendimientoPct = referencePrice > 0 ? (price.price - referencePrice) / referencePrice : null
    const [updated] = await db.update(inversiones_alertas).set({
      precio_referencia: referencePrice,
      precio_actual: price.price,
      precio_actual_nativo: price.nativeCurrency ? price.nativePrice : null,
      divisa_nativa: price.nativeCurrency ?? null,
      rendimiento_pct: rendimientoPct,
      ultima_comprobacion_at: checkedAt,
      ultimo_error: null,
      updated_at: checkedAt,
    }).where(eq(inversiones_alertas.id, rule.id)).returning()
    return NextResponse.json(updated)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'No se pudo consultar el precio'
    await db.update(inversiones_alertas).set({
      ultima_comprobacion_at: checkedAt,
      ultimo_error: message,
      updated_at: checkedAt,
    }).where(eq(inversiones_alertas.id, rule.id))
    return NextResponse.json({ error: message }, { status: 502 })
  }
}
