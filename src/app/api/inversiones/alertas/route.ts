import { NextResponse } from 'next/server'
import { and, eq } from 'drizzle-orm'
import { db } from '@/lib/db'
import { inversiones_alertas, inversiones_posiciones } from '@/lib/db/schema'
import { getAuthenticatedUserId, isNextResponse } from '@/lib/api-utils'
import { fetchAssetPrice } from '@/lib/inversiones/marketData'
import { priceIdentifiers } from '@/lib/inversiones/priceIdentifiers'
import { AlertTargetResolutionError, resolveAlertTarget, targetFromInput } from '@/lib/inversiones/alertTarget'
import { inversionAlertaSchema } from '@/lib/validations/inversionAlerta'
import { listInvestmentAlertRules } from '@/lib/inversiones/alertRules'
import { inferIsin, normalizeIsin } from '@/lib/inversiones/instrumentIdentity'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

function normalizedAssetKey(value: { ticker?: string | null; price_ticker?: string | null; market_symbol?: string | null }) {
  return (value.market_symbol || value.price_ticker || value.ticker || '').trim().toLocaleLowerCase('es')
}

type NativeQuote = {
  precio_actual_nativo: number | null
  divisa_nativa: string | null
}

function completeNativeQuote(price: number | null | undefined, currency: string | null | undefined): NativeQuote | null {
  const normalizedCurrency = currency?.trim().toUpperCase()
  return price !== null && price !== undefined && Number.isFinite(price) && normalizedCurrency
    ? { precio_actual_nativo: price, divisa_nativa: normalizedCurrency }
    : null
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
  let targetInput
  try {
    targetInput = targetFromInput(input)
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Objetivo no válido' }, { status: 400 })
  }

  const explicitIsin = input.isin?.trim() || null
  if (explicitIsin && !normalizeIsin(explicitIsin)) {
    return NextResponse.json({ error: 'El ISIN debe tener 12 caracteres y un formato válido' }, { status: 400 })
  }
  const now = new Date().toISOString()
  let position: typeof inversiones_posiciones.$inferSelect | undefined
  let portfolioValue: number | null = null

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
  const needsCurrentNativeQuote = targetInput !== undefined && targetInput !== null && targetInput.divisa !== 'EUR'

  let referencePrice = input.precio_referencia ?? null
  let capturedPrice: Awaited<ReturnType<typeof fetchAssetPrice>> | null = null
  const shouldCapturePrice = input.alcance === 'activo' && (!position || needsCurrentNativeQuote)
  if (shouldCapturePrice) {
    try {
      capturedPrice = await fetchAssetPrice({
        tipoActivo: input.tipo_activo || position?.tipo || 'Acción',
        ticker: priceTicker,
        cryptoId,
        marketSymbol,
      })
      if (referencePrice === null) referencePrice = capturedPrice.price
    } catch (error) {
      if (needsCurrentNativeQuote) {
        return NextResponse.json({
          error: error instanceof Error
            ? `No se pudo obtener una cotización nativa actual para este objetivo: ${error.message}`
            : 'No se pudo obtener una cotización nativa actual para este objetivo.',
        }, { status: 400 })
      }
      if (referencePrice === null) {
        return NextResponse.json({
          error: error instanceof Error
            ? `${error.message}. Puedes indicar un precio de referencia manual para crear la alerta.`
            : 'No se pudo consultar el precio de referencia.',
        }, { status: 400 })
      }
    }
  }

  if (input.alcance === 'cartera') {
    const portfolioPositions = await db.query.inversiones_posiciones.findMany({
      where: and(
        eq(inversiones_posiciones.usuario_id, auth.userId),
        eq(inversiones_posiciones.incluido_resumen, true)
      ),
    })
    portfolioValue = portfolioPositions.reduce((sum, item) => sum + (item.valor_actual ?? 0), 0)
    if (referencePrice === null && portfolioValue > 0) referencePrice = portfolioValue
    if (referencePrice === null || referencePrice <= 0) {
      return NextResponse.json({ error: 'Indica un valor base de cartera válido' }, { status: 400 })
    }
  }
  if (input.alcance === 'activo' && position && referencePrice === null && position.coste === null) {
    referencePrice = position.precio_actual
  }
  if (input.alcance === 'activo' && targetInput !== null && targetInput !== undefined && referencePrice === null && position) {
    referencePrice = position.precio_compra ?? position.precio_actual
  }

  let resolvedTarget
  try {
    resolvedTarget = resolveAlertTarget(targetInput ?? null, capturedPrice)
  } catch (error) {
    return NextResponse.json({
      error: error instanceof AlertTargetResolutionError ? error.message : 'No se pudo resolver el objetivo de alerta.',
    }, { status: 400 })
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
  const nativeQuote = completeNativeQuote(capturedPrice?.nativePrice, capturedPrice?.nativeCurrency)
    ?? completeNativeQuote(existing?.precio_actual_nativo, existing?.divisa_nativa)
    ?? completeNativeQuote(position?.precio_actual_nativo, position?.divisa_nativa)
    ?? { precio_actual_nativo: null, divisa_nativa: null }

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
    precio_referencia: referencePrice,
    ...resolvedTarget,
    precio_actual: input.alcance === 'cartera' ? portfolioValue : (capturedPrice?.price ?? existing?.precio_actual ?? position?.precio_actual ?? null),
    ...nativeQuote,
    rendimiento_pct: input.alcance === 'cartera'
      ? portfolioValue !== null && referencePrice !== null && referencePrice > 0 ? (portfolioValue - referencePrice) / referencePrice : null
      : capturedPrice !== null
        ? referencePrice && referencePrice > 0 ? (capturedPrice.price - referencePrice) / referencePrice : null
        : existing?.rendimiento_pct ?? position?.pnl_pct ?? null,
    umbral_subida_pct: input.umbral_subida_pct,
    umbral_caida_pct: input.umbral_caida_pct,
    rearmar_pct: input.rearmar_pct,
    estado: 'normal',
    canal_telegram: input.canal_telegram,
    canal_email: input.canal_email,
    canal_whatsapp: input.canal_whatsapp,
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
