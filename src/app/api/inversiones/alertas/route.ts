import { NextResponse } from 'next/server'
import { and, eq } from 'drizzle-orm'
import { db } from '@/lib/db'
import { inversiones_alertas, inversiones_posiciones } from '@/lib/db/schema'
import { getAuthenticatedUserId, isNextResponse } from '@/lib/api-utils'
import { fetchAssetPrice } from '@/lib/inversiones/marketData'
import { priceIdentifiers } from '@/lib/inversiones/priceIdentifiers'
import { inversionAlertaSchema } from '@/lib/validations/inversionAlerta'
import { listInvestmentAlertRules } from '@/lib/inversiones/alertRules'
import { inferIsin, normalizeIsin } from '@/lib/inversiones/instrumentIdentity'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

function normalizedAssetKey(value: { ticker?: string | null; price_ticker?: string | null; market_symbol?: string | null }) {
  return (value.market_symbol || value.price_ticker || value.ticker || '').trim().toLocaleLowerCase('es')
}

export async function GET() {
  const auth = await getAuthenticatedUserId()
  if (isNextResponse(auth)) return auth

  return NextResponse.json({ rules: await listInvestmentAlertRules(auth.userId) })
}

export async function POST(req: Request) {
  const auth = await getAuthenticatedUserId()
  if (isNextResponse(auth)) return auth

  const parsed = inversionAlertaSchema.safeParse(await req.json())
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Datos de alerta no válidos' }, { status: 400 })
  }

  const input = parsed.data
  const explicitIsin = input.isin?.trim() || null
  if (explicitIsin && !normalizeIsin(explicitIsin)) {
    return NextResponse.json({ error: 'El ISIN debe tener 12 caracteres y un formato válido' }, { status: 400 })
  }
  const now = new Date().toISOString()
  let position: typeof inversiones_posiciones.$inferSelect | undefined

  if (input.posicion_id) {
    position = await db.query.inversiones_posiciones.findFirst({
      where: and(
        eq(inversiones_posiciones.id, input.posicion_id),
        eq(inversiones_posiciones.usuario_id, auth.userId)
      ),
    })
    if (!position) return NextResponse.json({ error: 'La posición seleccionada no existe' }, { status: 404 })
  }

  const identifiers = priceIdentifiers(input.tipo_activo || position?.tipo || 'Acción', input.price_ticker || input.ticker || position?.ticker || '')
  const ticker = (input.ticker || position?.ticker || input.price_ticker || '').trim()
  const priceTicker = (input.price_ticker || position?.price_ticker || position?.ticker || ticker).trim()
  const marketSymbol = input.market_symbol ?? position?.market_symbol ?? identifiers.marketSymbol
  const cryptoId = input.crypto_id ?? position?.crypto_id ?? identifiers.cryptoId

  let referencePrice = input.precio_referencia ?? null
  if (input.alcance === 'activo' && !position && referencePrice === null) {
    try {
      referencePrice = (await fetchAssetPrice({
        tipoActivo: input.tipo_activo || 'Acción',
        ticker: priceTicker,
        cryptoId,
        marketSymbol,
      })).price
    } catch (error) {
      return NextResponse.json({
        error: error instanceof Error
          ? `${error.message}. Puedes indicar un precio de referencia manual para crear la alerta.`
          : 'No se pudo consultar el precio de referencia.',
      }, { status: 400 })
    }
  }
  if (input.alcance === 'activo' && position && referencePrice === null && position.coste === null) {
    referencePrice = position.precio_actual
  }
  if (input.alcance === 'activo' && input.precio_objetivo !== null && input.precio_objetivo !== undefined && referencePrice === null && position) {
    referencePrice = position.precio_compra ?? position.precio_actual
  }

  const existingRules = await listInvestmentAlertRules(auth.userId)
  const existing = existingRules.find((rule) => {
    if (input.alcance === 'cartera') return rule.alcance === 'cartera'
    if (rule.alcance !== 'activo') return false
    if (input.posicion_id) return rule.posicion_id === input.posicion_id
    return rule.posicion_id === null && normalizedAssetKey(rule) === normalizedAssetKey({
      ticker,
      price_ticker: priceTicker,
      market_symbol: marketSymbol,
    })
  })
  const isin = input.alcance === 'cartera'
    ? null
    : (normalizeIsin(explicitIsin) || existing?.isin || inferIsin(position?.isin, position?.ticker, position?.market_symbol, input.ticker, marketSymbol))

  const values = {
    usuario_id: auth.userId,
    alcance: input.alcance,
    posicion_id: input.alcance === 'activo' ? (position?.id ?? null) : null,
    activo: input.alcance === 'cartera' ? 'Cartera completa' : (input.activo || position?.activo || ticker).trim(),
    ticker: input.alcance === 'cartera' ? 'CARTERA' : ticker,
    tipo_activo: input.alcance === 'cartera' ? 'Cartera' : (input.tipo_activo || position?.tipo || 'Acción').trim(),
    price_ticker: input.alcance === 'cartera' ? null : priceTicker,
    crypto_id: input.alcance === 'cartera' ? null : cryptoId,
    market_symbol: input.alcance === 'cartera' ? null : marketSymbol,
    isin,
    precio_referencia: input.alcance === 'cartera' ? null : referencePrice,
    precio_objetivo: input.alcance === 'cartera' ? null : input.precio_objetivo ?? null,
    precio_actual: existing?.precio_actual ?? (position?.precio_actual ?? null),
    rendimiento_pct: existing?.rendimiento_pct ?? (position?.pnl_pct ?? null),
    umbral_subida_pct: input.umbral_subida_pct,
    umbral_caida_pct: input.umbral_caida_pct,
    rearmar_pct: input.rearmar_pct,
    estado: 'normal',
    canal_telegram: input.canal_telegram,
    canal_email: input.canal_email,
    activa: input.activa,
    ultimo_error: null,
    updated_at: now,
  }

  if (existing) {
    const [updated] = await db.update(inversiones_alertas)
      .set(values)
      .where(and(eq(inversiones_alertas.id, existing.id), eq(inversiones_alertas.usuario_id, auth.userId)))
      .returning()
    return NextResponse.json(updated)
  }

  const [created] = await db.insert(inversiones_alertas).values(values).returning()
  return NextResponse.json(created, { status: 201 })
}
