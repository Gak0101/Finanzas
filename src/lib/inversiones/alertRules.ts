import { and, asc, eq } from 'drizzle-orm'
import { db } from '@/lib/db'
import { inversiones_alertas, inversiones_posiciones, type InversionAlerta, type InversionPosicion } from '@/lib/db/schema'
import { fetchAssetPrice, refreshInvestmentPrices, type RefreshPricesResult } from '@/lib/inversiones/marketData'
import { normalizeTargetCurrency } from '@/lib/inversiones/alertTarget'

export type AlertSignal = 'normal' | 'subida' | 'caida'
export type AlertTriggerReason = 'porcentaje' | 'precio_objetivo'

export type TriggeredInvestmentAlert = {
  id: number
  alcance: 'cartera' | 'activo'
  ticker: string
  activo: string
  tipo: 'subida' | 'caida'
  razon: AlertTriggerReason
  rendimiento_pct: number | null
  umbral_pct: number | null
  precio_actual: number | null
  precio_actual_nativo: number | null
  divisa_nativa: string | null
  precio_referencia: number | null
  precio_objetivo: number | null
  precio_objetivo_importe: number | null
  divisa_objetivo: string | null
  canal_telegram: boolean
  canal_email: boolean
  canal_whatsapp: boolean
  checked_at: string
}

export type InvestmentAlertCheckResult = {
  checkedAt: string
  refresh: RefreshPricesResult
  alerts: TriggeredInvestmentAlert[]
  checkedRules: number
  skippedRules: number
}

export async function listInvestmentAlertRules(userId: number) {
  return db.query.inversiones_alertas.findMany({
    where: eq(inversiones_alertas.usuario_id, userId),
    orderBy: [asc(inversiones_alertas.alcance), asc(inversiones_alertas.activo), asc(inversiones_alertas.id)],
  })
}

function positive(value: number | null | undefined): value is number {
  return value !== null && value !== undefined && Number.isFinite(value) && value > 0
}

function portfolioValue(positions: InversionPosicion[]) {
  return positions.reduce((sum, position) => sum + (position.valor_actual ?? 0), 0)
}

function portfolioCost(positions: InversionPosicion[]) {
  const known = positions.filter((position) => position.coste !== null && position.coste > 0)
  return known.reduce((sum, position) => sum + (position.coste ?? 0), 0)
}

type SignalEvaluation = {
  signal: AlertSignal
  reason: AlertTriggerReason
}

type ComparableTarget = {
  target: number
  current: number
  reference: number
  direction: 'subida' | 'caida'
}

function percentageSignal(rule: InversionAlerta, value: number): AlertSignal {
  const rise = rule.umbral_subida_pct === null ? null : Math.abs(rule.umbral_subida_pct)
  const drop = rule.umbral_caida_pct === null ? null : Math.abs(rule.umbral_caida_pct)
  if (rise !== null && rise > 0 && value >= rise) return 'subida'
  if (drop !== null && drop > 0 && value <= -drop) return 'caida'
  return 'normal'
}

export function percentageFromBase(
  currentPrice: number | null,
  currentNativePrice: number | null,
  nativeCurrency: string | null,
  basePrice: number | null,
  baseNativePrice: number | null,
  baseCurrency: string | null,
) {
  const normalizedCurrency = nativeCurrency?.trim().toUpperCase()
  const normalizedBaseCurrency = baseCurrency?.trim().toUpperCase()
  if (positive(currentNativePrice) && positive(baseNativePrice) && normalizedCurrency && normalizedCurrency === normalizedBaseCurrency) {
    return (currentNativePrice - baseNativePrice) / baseNativePrice
  }
  if (positive(currentPrice) && positive(basePrice)) return (currentPrice - basePrice) / basePrice
  return null
}

function comparableTarget(
  rule: InversionAlerta,
  currentPrice: number | null,
  currentNativePrice: number | null,
  nativeCurrency: string | null,
  referencePrice: number | null,
  percentageBasePrice: number | null,
  percentageBaseNativePrice: number | null,
  percentageBaseCurrency: string | null,
): ComparableTarget | null {
  const hasOriginalTarget = positive(rule.precio_objetivo_importe) && Boolean(rule.divisa_objetivo)
  const configuredAmount = hasOriginalTarget ? rule.precio_objetivo_importe : rule.precio_objetivo
  const configuredCurrency = hasOriginalTarget && rule.divisa_objetivo ? normalizeTargetCurrency(rule.divisa_objetivo) : 'EUR'
  if (!positive(configuredAmount)) return null

  if (configuredCurrency === 'EUR') {
    if (!positive(currentPrice)) return null
    const reference = positive(percentageBasePrice) ? percentageBasePrice : (positive(referencePrice) ? referencePrice : currentPrice)
    return {
      target: configuredAmount,
      current: currentPrice,
      reference,
      direction: configuredAmount >= reference ? 'subida' : 'caida',
    }
  }

  if (!positive(currentPrice) || !positive(currentNativePrice) || !nativeCurrency || normalizeTargetCurrency(nativeCurrency) !== configuredCurrency) {
    return null
  }
  const eurPerNative = currentPrice / currentNativePrice
  if (!positive(eurPerNative)) return null
  const reference = positive(percentageBaseNativePrice) && percentageBaseCurrency && normalizeTargetCurrency(percentageBaseCurrency) === configuredCurrency
    ? percentageBaseNativePrice
    : positive(referencePrice) ? referencePrice / eurPerNative : currentNativePrice
  if (!positive(reference)) return null

  return {
    target: configuredAmount,
    current: currentNativePrice,
    reference,
    direction: configuredAmount >= reference ? 'subida' : 'caida',
  }
}

function activeSignal(rule: InversionAlerta, value: number, target: ComparableTarget | null): SignalEvaluation {
  if (target?.direction === 'subida' && target.current >= target.target) {
    return { signal: 'subida', reason: 'precio_objetivo' }
  }
  if (target?.direction === 'caida' && target.current <= target.target) {
    return { signal: 'caida', reason: 'precio_objetivo' }
  }
  return { signal: percentageSignal(rule, value), reason: 'porcentaje' }
}

function signalWithRearm(rule: InversionAlerta, value: number, target: ComparableTarget | null): SignalEvaluation {
  const fresh = activeSignal(rule, value, target)
  const previous = (rule.estado as AlertSignal) || 'normal'
  const margin = Math.abs(rule.rearmar_pct ?? 0.01)
  const rise = rule.umbral_subida_pct === null ? null : Math.abs(rule.umbral_subida_pct)
  const drop = rule.umbral_caida_pct === null ? null : Math.abs(rule.umbral_caida_pct)

  if (previous === 'subida' && fresh.signal === 'normal') {
    if (rise !== null && value > rise - margin) return { signal: 'subida', reason: 'porcentaje' }
    if (target?.direction === 'subida' && target.current > target.target * (1 - margin)) {
      return { signal: 'subida', reason: 'precio_objetivo' }
    }
  }
  if (previous === 'caida' && fresh.signal === 'normal') {
    if (drop !== null && value < -drop + margin) return { signal: 'caida', reason: 'porcentaje' }
    if (target?.direction === 'caida' && target.current < target.target * (1 + margin)) {
      return { signal: 'caida', reason: 'precio_objetivo' }
    }
  }
  return fresh
}

function ruleLabel(rule: InversionAlerta, position: InversionPosicion | undefined) {
  if (rule.alcance === 'cartera') return { activo: 'Cartera completa', ticker: 'CARTERA' }
  return {
    activo: position?.activo || rule.activo || rule.ticker || 'Activo vigilado',
    ticker: position?.price_ticker || position?.ticker || rule.price_ticker || rule.ticker || '—',
  }
}

async function evaluateRule(
  rule: InversionAlerta,
  positions: InversionPosicion[],
  checkedAt: string
) {
  const position = rule.posicion_id === null ? undefined : positions.find((item) => item.id === rule.posicion_id)
  let currentPct: number | null = null
  let currentPrice: number | null = null
  let currentNativePrice: number | null = null
  let nativeCurrency: string | null = null
  let referencePrice = rule.precio_referencia
  let percentageBasePrice = rule.precio_base_porcentaje
  let percentageBaseNativePrice = rule.precio_base_porcentaje_nativo
  let percentageBaseCurrency = rule.divisa_base_porcentaje

  if (rule.alcance === 'cartera') {
    currentPrice = portfolioValue(positions)
    if (referencePrice === null || referencePrice <= 0) referencePrice = portfolioCost(positions)
    if (percentageBasePrice === null && currentPrice !== null) percentageBasePrice = currentPrice
    currentPct = currentPrice !== null && percentageBasePrice !== null && percentageBasePrice > 0
      ? (currentPrice - percentageBasePrice) / percentageBasePrice
      : null
  } else if (position) {
    currentPrice = position.precio_actual
    currentNativePrice = position.precio_actual_nativo
    nativeCurrency = position.divisa_nativa
    if (referencePrice === null && position.cantidad > 0 && position.coste !== null && position.coste > 0) {
      referencePrice = position.coste / position.cantidad
    }
    if (rule.precio_objetivo !== null && rule.precio_objetivo !== undefined && referencePrice === null) referencePrice = position.precio_compra ?? currentPrice
    if (percentageBasePrice === null && currentPrice !== null) percentageBasePrice = currentPrice
    if (percentageBaseNativePrice === null && currentNativePrice !== null) percentageBaseNativePrice = currentNativePrice
    if (percentageBaseCurrency === null) percentageBaseCurrency = nativeCurrency
    currentPct = percentageFromBase(
      currentPrice,
      currentNativePrice,
      nativeCurrency,
      percentageBasePrice,
      percentageBaseNativePrice,
      percentageBaseCurrency,
    )
  } else {
    const price = await fetchAssetPrice({
      tipoActivo: rule.tipo_activo || 'Acción',
      ticker: rule.price_ticker || rule.ticker || '',
      cryptoId: rule.crypto_id,
      marketSymbol: rule.market_symbol,
    })
    currentPrice = price.price
    currentNativePrice = price.nativeCurrency ? price.nativePrice : null
    nativeCurrency = price.nativeCurrency ?? null
    if (referencePrice === null || referencePrice <= 0) referencePrice = price.price
    if (percentageBasePrice === null) percentageBasePrice = price.price
    if (percentageBaseNativePrice === null && currentNativePrice !== null) percentageBaseNativePrice = currentNativePrice
    if (percentageBaseCurrency === null) percentageBaseCurrency = nativeCurrency
    currentPct = percentageFromBase(
      currentPrice,
      currentNativePrice,
      nativeCurrency,
      percentageBasePrice,
      percentageBaseNativePrice,
      percentageBaseCurrency,
    )
  }

  const target = comparableTarget(
    rule,
    currentPrice,
    currentNativePrice,
    nativeCurrency,
    referencePrice,
    percentageBasePrice,
    percentageBaseNativePrice,
    percentageBaseCurrency,
  )
  if ((currentPct === null || !Number.isFinite(currentPct)) && target === null) {
    await db.update(inversiones_alertas).set({
      ultima_comprobacion_at: checkedAt,
      ultimo_error: 'No hay suficiente cotización comparable para calcular la alerta.',
      updated_at: checkedAt,
    }).where(eq(inversiones_alertas.id, rule.id))
    return { triggered: null, skipped: true }
  }

  const evaluation = signalWithRearm(rule, currentPct ?? 0, target)
  const nextState = evaluation.signal
  const triggered = nextState !== 'normal' && nextState !== (rule.estado as AlertSignal)
  const label = ruleLabel(rule, position)
  const threshold = evaluation.reason === 'precio_objetivo'
    ? null
    : nextState === 'subida'
      ? Math.abs(rule.umbral_subida_pct ?? 0)
      : Math.abs(rule.umbral_caida_pct ?? 0)

  await db.update(inversiones_alertas).set({
    precio_referencia: referencePrice,
    precio_actual: currentPrice,
    precio_actual_nativo: currentNativePrice,
    divisa_nativa: nativeCurrency,
    precio_base_porcentaje: percentageBasePrice,
    precio_base_porcentaje_nativo: percentageBaseNativePrice,
    divisa_base_porcentaje: percentageBaseCurrency,
    rendimiento_pct: currentPct,
    estado: nextState,
    ultima_comprobacion_at: checkedAt,
    ultima_alerta_at: triggered ? checkedAt : rule.ultima_alerta_at,
    ultimo_error: null,
    updated_at: checkedAt,
  }).where(eq(inversiones_alertas.id, rule.id))

  return {
    skipped: false,
    triggered: triggered ? {
      id: rule.id,
      alcance: rule.alcance as 'cartera' | 'activo',
      ticker: label.ticker,
      activo: label.activo,
      tipo: nextState as 'subida' | 'caida',
      razon: evaluation.reason,
      rendimiento_pct: currentPct,
      umbral_pct: threshold,
      precio_actual: currentPrice,
      precio_actual_nativo: currentNativePrice,
      divisa_nativa: nativeCurrency,
      precio_referencia: referencePrice,
      precio_objetivo: rule.precio_objetivo ?? null,
      precio_objetivo_importe: rule.precio_objetivo_importe ?? null,
      divisa_objetivo: rule.divisa_objetivo ?? null,
      canal_telegram: rule.canal_telegram,
      canal_email: rule.canal_email,
      canal_whatsapp: rule.canal_whatsapp,
      checked_at: checkedAt,
    } satisfies TriggeredInvestmentAlert : null,
  }
}

export async function checkInvestmentAlerts(userId: number): Promise<InvestmentAlertCheckResult> {
  const refresh = await refreshInvestmentPrices(userId)
  const [positions, rules] = await Promise.all([
    db.query.inversiones_posiciones.findMany({
      where: and(
        eq(inversiones_posiciones.usuario_id, userId),
        eq(inversiones_posiciones.incluido_resumen, true)
      ),
    }),
    db.query.inversiones_alertas.findMany({
      where: and(eq(inversiones_alertas.usuario_id, userId), eq(inversiones_alertas.activa, true)),
      orderBy: [asc(inversiones_alertas.id)],
    }),
  ])

  const checkedAt = new Date().toISOString()
  const alerts: TriggeredInvestmentAlert[] = []
  let skippedRules = 0

  for (const rule of rules) {
    try {
      const result = await evaluateRule(rule, positions, checkedAt)
      if (result.skipped) skippedRules += 1
      if (result.triggered) alerts.push(result.triggered)
    } catch (error) {
      skippedRules += 1
      await db.update(inversiones_alertas).set({
        ultima_comprobacion_at: checkedAt,
        ultimo_error: error instanceof Error ? error.message : 'No se pudo consultar el precio.',
        updated_at: checkedAt,
      }).where(eq(inversiones_alertas.id, rule.id))
    }
  }

  return {
    checkedAt,
    refresh,
    alerts,
    checkedRules: rules.length,
    skippedRules,
  }
}
