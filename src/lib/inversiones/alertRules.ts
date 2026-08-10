import { and, asc, eq } from 'drizzle-orm'
import { db } from '@/lib/db'
import { inversiones_alertas, inversiones_posiciones, type InversionAlerta, type InversionPosicion } from '@/lib/db/schema'
import { fetchAssetPrice, refreshInvestmentPrices, type RefreshPricesResult } from '@/lib/inversiones/marketData'

export type AlertSignal = 'normal' | 'subida' | 'caida'

export type TriggeredInvestmentAlert = {
  id: number
  alcance: 'cartera' | 'activo'
  ticker: string
  activo: string
  tipo: 'subida' | 'caida'
  rendimiento_pct: number
  umbral_pct: number
  precio_actual: number | null
  precio_referencia: number | null
  canal_telegram: boolean
  canal_email: boolean
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

function portfolioReturn(positions: InversionPosicion[]) {
  const known = positions.filter((position) => position.coste !== null && position.coste > 0)
  const knownCost = known.reduce((sum, position) => sum + (position.coste ?? 0), 0)
  const value = known.reduce((sum, position) => sum + (position.valor_actual ?? 0), 0)
  return knownCost > 0 ? (value - knownCost) / knownCost : null
}

function activeSignal(rule: InversionAlerta, value: number): AlertSignal {
  const rise = rule.umbral_subida_pct === null ? null : Math.abs(rule.umbral_subida_pct)
  const drop = rule.umbral_caida_pct === null ? null : Math.abs(rule.umbral_caida_pct)
  if (rise !== null && rise > 0 && value >= rise) return 'subida'
  if (drop !== null && drop > 0 && value <= -drop) return 'caida'
  return 'normal'
}

function signalWithRearm(rule: InversionAlerta, value: number): AlertSignal {
  const fresh = activeSignal(rule, value)
  const previous = (rule.estado as AlertSignal) || 'normal'
  const margin = Math.abs(rule.rearmar_pct ?? 0.01)
  const rise = rule.umbral_subida_pct === null ? null : Math.abs(rule.umbral_subida_pct)
  const drop = rule.umbral_caida_pct === null ? null : Math.abs(rule.umbral_caida_pct)

  if (previous === 'subida' && fresh === 'normal' && rise !== null && value > rise - margin) return 'subida'
  if (previous === 'caida' && fresh === 'normal' && drop !== null && value < -drop + margin) return 'caida'
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
  portfolioPct: number | null,
  checkedAt: string
) {
  const position = rule.posicion_id === null ? undefined : positions.find((item) => item.id === rule.posicion_id)
  let currentPct: number | null = null
  let currentPrice: number | null = null
  let referencePrice = rule.precio_referencia

  if (rule.alcance === 'cartera') {
    currentPct = portfolioPct
  } else if (position) {
    currentPrice = position.precio_actual
    if (position.pnl_pct !== null) {
      currentPct = position.pnl_pct
    } else if (referencePrice !== null && currentPrice !== null && referencePrice > 0) {
      currentPct = (currentPrice - referencePrice) / referencePrice
    }
  } else {
    const price = await fetchAssetPrice({
      tipoActivo: rule.tipo_activo || 'Acción',
      ticker: rule.price_ticker || rule.ticker || '',
      cryptoId: rule.crypto_id,
      marketSymbol: rule.market_symbol,
    })
    currentPrice = price.price
    if (referencePrice === null || referencePrice <= 0) referencePrice = price.price
    currentPct = referencePrice > 0 ? (price.price - referencePrice) / referencePrice : null
  }

  if (currentPct === null || !Number.isFinite(currentPct)) {
    await db.update(inversiones_alertas).set({
      ultima_comprobacion_at: checkedAt,
      ultimo_error: 'No hay suficiente precio/coste para calcular el porcentaje.',
      updated_at: checkedAt,
    }).where(eq(inversiones_alertas.id, rule.id))
    return { triggered: null, skipped: true }
  }

  const nextState = signalWithRearm(rule, currentPct)
  const triggered = nextState !== 'normal' && nextState !== (rule.estado as AlertSignal)
  const label = ruleLabel(rule, position)
  const threshold = nextState === 'subida' ? Math.abs(rule.umbral_subida_pct ?? 0) : Math.abs(rule.umbral_caida_pct ?? 0)

  await db.update(inversiones_alertas).set({
    precio_referencia: referencePrice,
    precio_actual: currentPrice,
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
      rendimiento_pct: currentPct,
      umbral_pct: threshold,
      precio_actual: currentPrice,
      precio_referencia: referencePrice,
      canal_telegram: rule.canal_telegram,
      canal_email: rule.canal_email,
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
  const portfolioPct = portfolioReturn(positions)
  const alerts: TriggeredInvestmentAlert[] = []
  let skippedRules = 0

  for (const rule of rules) {
    try {
      const result = await evaluateRule(rule, positions, portfolioPct, checkedAt)
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
