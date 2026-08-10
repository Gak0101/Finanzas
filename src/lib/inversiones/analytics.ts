import type {
  InversionOperacion,
  InversionPosicion,
  InversionSnapshotDiario,
} from '@/lib/db/schema'

const QUANTITY_EPSILON = 1e-7
const DAY_MS = 86_400_000

export type AllocationPoint = {
  name: string
  value: number
  percent: number
}

export type InvestmentPerformanceSummary = {
  totalValue: number
  knownCost: number
  unrealisedPnl: number
  realisedPnl: number
  dividends: number
  bonuses: number
  commissions: number
  taxes: number
  historicalNetResult: number
  totalNetResult: number
  currentReturnPct: number | null
  totalReturnPct: number | null
  annualizedReturnPct: number | null
  cashFlowCount: number
  firstCashFlowDate: string | null
  openAnnualizedReturnPct: number | null
  openCashFlowCount: number
  openFirstCashFlowDate: string | null
  openReturnCoverage: {
    totalPositions: number
    eligiblePositions: number
    coveredValue: number
    totalValue: number
  }
  capitalTracked: number
  unmatchedSales: number
  coverage: {
    totalPositions: number
    costPositions: number
    valuedPositions: number
    datedPositions: number
  }
}

export type InvestmentDrawdownSummary = {
  currentPct: number | null
  maxPct: number | null
  peakValue: number | null
  peakDate: string | null
}

export type InvestmentRebalanceItem = {
  positionId: number
  name: string
  ticker: string
  currentPct: number
  targetPct: number
  gapPct: number
  amountDelta: number
}

export type InvestmentRiskSummary = {
  top1Pct: number
  top3Pct: number
  top5Pct: number
  cryptoPct: number
  hhi: number
  level: 'Baja' | 'Media' | 'Alta'
  byType: AllocationPoint[]
  byCustody: AllocationPoint[]
  byCurrency: AllocationPoint[]
  bySector: AllocationPoint[]
  byCountry: AllocationPoint[]
  drawdown: InvestmentDrawdownSummary
  targetTotalPct: number
  configuredTargetPositions: number
  rebalance: InvestmentRebalanceItem[]
}

export type InvestmentFiscalYear = {
  year: number
  purchases: number
  saleProceeds: number
  realisedGains: number
  realisedLosses: number
  realisedNet: number
  dividends: number
  bonuses: number
  commissions: number
  taxes: number
  netRegistered: number
  salesCount: number
  unmatchedSales: number
}

export type InvestmentSnapshotPoint = {
  date: string
  value: number | null
  knownCost: number
  unrealisedPnl: number | null
  positions: number
  valuedPositions: number
  coveragePct: number
}

export type PositionInvestmentAnalytics = {
  positionId: number
  purchases: number
  saleProceeds: number
  realisedPnl: number
  dividends: number
  bonuses: number
  commissions: number
  taxes: number
  operations: number
  firstOperation: string | null
  lastOperation: string | null
}

export type InvestmentAlert = {
  id: string
  severity: 'info' | 'warning' | 'critical'
  title: string
  detail: string
  action: 'refresh' | 'complete_data' | 'review_position'
  positionId?: number
}

export type InvestmentAnalytics = {
  performance: InvestmentPerformanceSummary
  risk: InvestmentRiskSummary
  fiscalYears: InvestmentFiscalYear[]
  snapshotHistory: InvestmentSnapshotPoint[]
  positionAnalytics: PositionInvestmentAnalytics[]
  alerts: InvestmentAlert[]
}

type ReplayState = {
  quantity: number
  costBasis: number
  purchases: number
  saleProceeds: number
  realisedPnl: number
  dividends: number
  bonuses: number
  commissions: number
  taxes: number
  operations: number
  firstOperation: string | null
  lastOperation: string | null
  unmatchedSales: number
}

function absolute(value: number | null | undefined) {
  return Math.abs(value ?? 0)
}

type ReturnCashFlow = {
  date: string
  amount: number
}

function yearsBetween(start: number, end: number) {
  return Math.max(0, (end - start) / DAY_MS / 365.25)
}

function xirr(flows: ReturnCashFlow[]) {
  if (flows.length < 2) return null

  const firstDate = new Date(`${flows[0].date}T12:00:00Z`).getTime()
  if (!Number.isFinite(firstDate)) return null

  const normalized = flows
    .map((flow) => ({
      amount: flow.amount,
      years: yearsBetween(firstDate, new Date(`${flow.date}T12:00:00Z`).getTime()),
    }))
    .filter((flow) => Number.isFinite(flow.years) && Number.isFinite(flow.amount))
  if (normalized.length < 2 || !normalized.some((flow) => flow.amount < 0) || !normalized.some((flow) => flow.amount > 0)) return null

  const netPresentValue = (rate: number) => normalized.reduce((total, flow) => {
    const denominator = Math.pow(1 + rate, flow.years)
    return Number.isFinite(denominator) && denominator !== 0 ? total + flow.amount / denominator : Number.NaN
  }, 0)

  let lower = -0.9999
  let upper = 1
  let lowerValue = netPresentValue(lower)
  let upperValue = netPresentValue(upper)
  let attempts = 0
  while (Number.isFinite(lowerValue) && Number.isFinite(upperValue) && lowerValue * upperValue > 0 && attempts < 24) {
    upper = upper * 2 + 1
    upperValue = netPresentValue(upper)
    attempts += 1
  }
  if (!Number.isFinite(lowerValue) || !Number.isFinite(upperValue) || lowerValue * upperValue > 0) return null

  for (let index = 0; index < 80; index += 1) {
    const middle = (lower + upper) / 2
    const middleValue = netPresentValue(middle)
    if (!Number.isFinite(middleValue)) return null
    if (Math.abs(middleValue) < 0.000001) return middle
    if (lowerValue * middleValue <= 0) {
      upper = middle
      upperValue = middleValue
    } else {
      lower = middle
      lowerValue = middleValue
    }
  }

  return (lower + upper) / 2
}

function operationCashFlow(operation: InversionOperacion): ReturnCashFlow | null {
  const fees = absolute(operation.comision) + absolute(operation.impuesto)
  const amount = absolute(operation.importe)
  if (operation.tipo === 'Compra') return { date: operation.fecha, amount: -(amount + fees) }
  if (operation.tipo === 'Venta') return { date: operation.fecha, amount: amount - fees }
  if (operation.tipo === 'Dividendo' || operation.tipo === 'Bonificación') return { date: operation.fecha, amount: amount - fees }
  return null
}

function cashFlowsFromOperations(operations: InversionOperacion[]) {
  return operations
    .toSorted((left, right) => timestamp(left) - timestamp(right) || left.id - right.id)
    .flatMap<ReturnCashFlow>((operation) => {
      const flow = operationCashFlow(operation)
      return flow ? [flow] : []
    })
}

function valuationDate(snapshots: InversionSnapshotDiario[]) {
  return snapshots.toSorted((left, right) => left.fecha_valoracion.localeCompare(right.fecha_valoracion)).at(-1)?.fecha_valoracion
}

function returnMetricsFromFlows(flows: ReturnCashFlow[], totalValue: number, valuationDateValue: string | undefined) {
  const firstCashFlowDate = flows[0]?.date ?? null
  if (!valuationDateValue || totalValue <= 0 || flows.length === 0) {
    return { annualizedReturnPct: null, cashFlowCount: flows.length, firstCashFlowDate }
  }

  return {
    annualizedReturnPct: xirr([...flows, { date: valuationDateValue, amount: totalValue }]),
    cashFlowCount: flows.length,
    firstCashFlowDate,
  }
}

function returnMetrics(operations: InversionOperacion[], totalValue: number, snapshots: InversionSnapshotDiario[]) {
  return returnMetricsFromFlows(cashFlowsFromOperations(operations), totalValue, valuationDate(snapshots))
}

function openReturnMetrics(positions: InversionPosicion[], operations: InversionOperacion[], snapshots: InversionSnapshotDiario[], totalValue: number) {
  const operationsByKey = new Map<string, ReturnCashFlow[]>()
  for (const operation of operations.toSorted((left, right) => timestamp(left) - timestamp(right) || left.id - right.id)) {
    const flow = operationCashFlow(operation)
    if (!flow) continue
    const key = investmentPositionKey(operation)
    operationsByKey.set(key, [...(operationsByKey.get(key) ?? []), flow])
  }

  const flows: ReturnCashFlow[] = []
  let eligiblePositions = 0
  let coveredValue = 0
  for (const position of positions) {
    const value = position.valor_actual ?? 0
    if (value <= 0) continue
    const positionFlows = [...(operationsByKey.get(investmentPositionKey(position)) ?? [])]
    if (!positionFlows.some((flow) => flow.amount < 0) && position.coste !== null && position.coste > 0 && position.fecha_apertura) {
      positionFlows.unshift({ date: position.fecha_apertura, amount: -position.coste })
    }
    if (!positionFlows.some((flow) => flow.amount < 0)) continue
    eligiblePositions += 1
    coveredValue += value
    flows.push(...positionFlows)
  }

  const metrics = returnMetricsFromFlows(flows, coveredValue, valuationDate(snapshots))
  return {
    ...metrics,
    coverage: {
      totalPositions: positions.length,
      eligiblePositions,
      coveredValue,
      totalValue,
    },
  }
}

function drawdownSummary(points: InvestmentSnapshotPoint[]): InvestmentDrawdownSummary {
  const valued = points.filter((point): point is InvestmentSnapshotPoint & { value: number } => point.value !== null)
  if (valued.length < 2) return { currentPct: null, maxPct: null, peakValue: null, peakDate: null }

  let peakValue = valued[0].value
  let peakDate = valued[0].date
  let currentPct = 0
  let maxPct = 0
  for (const point of valued) {
    if (point.value > peakValue) {
      peakValue = point.value
      peakDate = point.date
    }
    const drawdown = peakValue > 0 ? (point.value - peakValue) / peakValue : 0
    currentPct = drawdown
    maxPct = Math.min(maxPct, drawdown)
  }
  return { currentPct, maxPct, peakValue, peakDate }
}

function rebalanceSummary(positions: InversionPosicion[], totalValue: number) {
  const configured = positions.filter((position) => position.objetivo_peso_pct !== null)
  const targetTotalPct = configured.reduce((sum, position) => sum + (position.objetivo_peso_pct ?? 0), 0)
  const items = configured
    .map<InvestmentRebalanceItem>((position) => {
      const currentPct = totalValue > 0 ? (position.valor_actual ?? 0) / totalValue : 0
      const targetPct = position.objetivo_peso_pct ?? 0
      return {
        positionId: position.id,
        name: position.activo,
        ticker: position.price_ticker || position.ticker,
        currentPct,
        targetPct,
        gapPct: targetPct - currentPct,
        amountDelta: (targetPct - currentPct) * totalValue,
      }
    })
    .toSorted((left, right) => Math.abs(right.gapPct) - Math.abs(left.gapPct))

  return { targetTotalPct, configuredTargetPositions: configured.length, items }
}

function timestamp(operation: InversionOperacion) {
  const value = operation.fecha_hora || `${operation.fecha}T12:00:00.000Z`
  const parsed = new Date(value).getTime()
  return Number.isFinite(parsed) ? parsed : 0
}

export function investmentPositionKey(value: Pick<InversionOperacion, 'activo' | 'custodia' | 'ticker'> | Pick<InversionPosicion, 'activo' | 'custodia' | 'ticker'>) {
  const ticker = value.ticker?.trim().toLocaleLowerCase('es')
  const asset = value.activo.trim().toLocaleLowerCase('es')
  const identity = ticker ? `ticker:${ticker}` : `asset:${asset}`
  return `${value.custodia.trim().toLocaleLowerCase('es')}|${identity}`
}

function emptyReplayState(): ReplayState {
  return {
    quantity: 0,
    costBasis: 0,
    purchases: 0,
    saleProceeds: 0,
    realisedPnl: 0,
    dividends: 0,
    bonuses: 0,
    commissions: 0,
    taxes: 0,
    operations: 0,
    firstOperation: null,
    lastOperation: null,
    unmatchedSales: 0,
  }
}

function fiscalYear(map: Map<number, InvestmentFiscalYear>, year: number) {
  const current = map.get(year)
  if (current) return current
  const created: InvestmentFiscalYear = {
    year,
    purchases: 0,
    saleProceeds: 0,
    realisedGains: 0,
    realisedLosses: 0,
    realisedNet: 0,
    dividends: 0,
    bonuses: 0,
    commissions: 0,
    taxes: 0,
    netRegistered: 0,
    salesCount: 0,
    unmatchedSales: 0,
  }
  map.set(year, created)
  return created
}

function replayOperations(operations: InversionOperacion[]) {
  const states = new Map<string, ReplayState>()
  const fiscal = new Map<number, InvestmentFiscalYear>()
  let realisedPnl = 0
  let dividends = 0
  let bonuses = 0
  let commissions = 0
  let taxes = 0
  let purchases = 0
  let unmatchedSales = 0

  for (const operation of operations.toSorted((left, right) => timestamp(left) - timestamp(right) || left.id - right.id)) {
    const key = investmentPositionKey(operation)
    const state = states.get(key) ?? emptyReplayState()
    states.set(key, state)

    state.operations += 1
    state.firstOperation ??= operation.fecha
    state.lastOperation = operation.fecha

    const year = Number(operation.fecha.slice(0, 4))
    const yearSummary = Number.isInteger(year) ? fiscalYear(fiscal, year) : null
    const fee = absolute(operation.comision)
    const tax = absolute(operation.impuesto)
    state.commissions += fee
    state.taxes += tax
    commissions += fee
    taxes += tax
    if (yearSummary) {
      yearSummary.commissions += fee
      yearSummary.taxes += tax
    }

    if (operation.tipo === 'Compra') {
      const quantity = absolute(operation.cantidad)
      const amount = absolute(operation.importe)
      state.quantity += quantity
      state.costBasis += amount
      state.purchases += amount
      purchases += amount
      if (yearSummary) yearSummary.purchases += amount
      continue
    }

    if (operation.tipo === 'Venta') {
      const quantity = absolute(operation.cantidad)
      const proceeds = absolute(operation.importe)
      const matchedQuantity = Math.min(quantity, Math.max(0, state.quantity))
      const averageCost = state.quantity > QUANTITY_EPSILON ? state.costBasis / state.quantity : 0
      const assignedCost = matchedQuantity * averageCost
      const matchedProceeds = quantity > QUANTITY_EPSILON ? proceeds * (matchedQuantity / quantity) : 0
      const result = matchedProceeds - assignedCost

      state.quantity = Math.max(0, state.quantity - matchedQuantity)
      state.costBasis = Math.max(0, state.costBasis - assignedCost)
      if (state.quantity <= QUANTITY_EPSILON) {
        state.quantity = 0
        state.costBasis = 0
      }
      state.saleProceeds += proceeds
      state.realisedPnl += result
      realisedPnl += result

      const unmatched = Math.max(0, quantity - matchedQuantity)
      if (unmatched > QUANTITY_EPSILON) {
        state.unmatchedSales += 1
        unmatchedSales += 1
      }

      if (yearSummary) {
        yearSummary.saleProceeds += proceeds
        yearSummary.salesCount += 1
        yearSummary.unmatchedSales += unmatched > QUANTITY_EPSILON ? 1 : 0
        if (result >= 0) yearSummary.realisedGains += result
        else yearSummary.realisedLosses += result
      }
      continue
    }

    if (operation.tipo === 'Dividendo') {
      const amount = absolute(operation.importe)
      state.dividends += amount
      dividends += amount
      if (yearSummary) yearSummary.dividends += amount
      continue
    }

    if (operation.tipo === 'Bonificación') {
      const amount = absolute(operation.importe)
      state.bonuses += amount
      bonuses += amount
      if (yearSummary) yearSummary.bonuses += amount
    }
  }

  for (const item of fiscal.values()) {
    item.realisedNet = item.realisedGains + item.realisedLosses
    item.netRegistered = item.realisedNet + item.dividends + item.bonuses - item.commissions - item.taxes
  }

  return {
    states,
    fiscalYears: [...fiscal.values()].toSorted((left, right) => right.year - left.year),
    realisedPnl,
    dividends,
    bonuses,
    commissions,
    taxes,
    purchases,
    unmatchedSales,
  }
}

function allocation(positions: InversionPosicion[], totalValue: number, selector: (position: InversionPosicion) => string | null | undefined) {
  const values = new Map<string, number>()
  for (const position of positions) {
    const name = selector(position)?.trim() || 'Sin clasificar'
    values.set(name, (values.get(name) ?? 0) + (position.valor_actual ?? 0))
  }
  return [...values.entries()]
    .map(([name, value]) => ({ name, value, percent: totalValue > 0 ? value / totalValue : 0 }))
    .toSorted((left, right) => right.value - left.value)
}

function aggregateSnapshots(snapshots: InversionSnapshotDiario[]) {
  const grouped = new Map<string, { value: number; knownCost: number; pnl: number; rows: number; valued: number; pnlRows: number }>()
  for (const snapshot of snapshots) {
    const point = grouped.get(snapshot.fecha_valoracion) ?? { value: 0, knownCost: 0, pnl: 0, rows: 0, valued: 0, pnlRows: 0 }
    point.rows += 1
    if (snapshot.valor_eur !== null) {
      point.value += snapshot.valor_eur
      point.valued += 1
    }
    if (snapshot.coste_eur !== null) point.knownCost += snapshot.coste_eur
    if (snapshot.pnl_no_realizado_eur !== null) {
      point.pnl += snapshot.pnl_no_realizado_eur
      point.pnlRows += 1
    }
    grouped.set(snapshot.fecha_valoracion, point)
  }

  return [...grouped.entries()]
    .map(([date, point]) => ({
      date,
      value: point.valued > 0 ? point.value : null,
      knownCost: point.knownCost,
      unrealisedPnl: point.pnlRows > 0 ? point.pnl : null,
      positions: point.rows,
      valuedPositions: point.valued,
      coveragePct: point.rows > 0 ? point.valued / point.rows : 0,
    }))
    .toSorted((left, right) => left.date.localeCompare(right.date))
}

function buildAlerts(positions: InversionPosicion[], risk: InvestmentRiskSummary) {
  const alerts: InvestmentAlert[] = []
  const fallback = positions.filter((position) => position.estado_fuente === 'FALLBACK')
  const missingCost = positions.filter((position) => position.coste === null)
  const missingDate = positions.filter((position) => !position.fecha_apertura)
  const now = Date.now()
  const stale = positions.filter((position) => {
    const value = position.snapshot_at ?? position.updated_at
    if (!value || position.estado_fuente !== 'API_OK') return false
    const parsed = new Date(value).getTime()
    return Number.isFinite(parsed) && now - parsed > 3 * DAY_MS
  })
  const largestPosition = positions.toSorted((left, right) => (right.valor_actual ?? 0) - (left.valor_actual ?? 0))[0]

  if (fallback.length > 0) alerts.push({
    id: 'fallback-prices', severity: 'warning', title: `${fallback.length} precios en fallback`,
    detail: 'Se conserva el último valor válido; actualiza las fuentes antes de comparar rentabilidades.', action: 'refresh',
  })
  if (stale.length > 0) alerts.push({
    id: 'stale-prices', severity: 'warning', title: `${stale.length} cotizaciones con más de 72 horas`,
    detail: 'La valoración puede no reflejar el último cierre disponible.', action: 'refresh',
  })
  if (missingCost.length > 0) alerts.push({
    id: 'missing-cost', severity: 'warning', title: `${missingCost.length} posiciones sin coste`,
    detail: 'El P/L de la cartera abierta solo incluye las posiciones con coste de compra registrado.', action: 'complete_data', positionId: missingCost[0]?.id,
  })
  if (missingDate.length > 0) alerts.push({
    id: 'missing-date', severity: 'info', title: `${missingDate.length} posiciones sin fecha`,
    detail: 'Añade la primera compra para calcular antigüedad y rentabilidad anualizada.', action: 'complete_data', positionId: missingDate[0]?.id,
  })
  if (risk.level === 'Alta') alerts.push({
    id: 'concentration', severity: 'warning', title: 'Concentración elevada',
    detail: `Las tres mayores posiciones representan ${(risk.top3Pct * 100).toFixed(1)}% de la cartera.`, action: 'review_position', positionId: largestPosition?.id,
  })
  if (risk.configuredTargetPositions > 0 && Math.abs(risk.targetTotalPct - 1) > 0.01) {
    const targetPosition = positions.find((position) => position.objetivo_peso_pct !== null)
    alerts.push({
      id: 'target-total', severity: 'info', title: 'Objetivos de cartera incompletos',
      detail: `Has definido objetivos para ${risk.configuredTargetPositions} posiciones que suman ${(risk.targetTotalPct * 100).toFixed(1)}%. Para usar el rebalanceo como guía, deberían sumar 100%.`, action: 'review_position', positionId: targetPosition?.id,
    })
  } else if (risk.configuredTargetPositions > 0) {
    const largestGap = risk.rebalance[0]
    const deviations = risk.rebalance.filter((item) => Math.abs(item.gapPct) >= 0.03)
    if (deviations.length > 0 && largestGap) {
      alerts.push({
        id: 'rebalance', severity: 'warning', title: `${deviations.length} posiciones se alejan del objetivo`,
        detail: `${largestGap.ticker || largestGap.name} está ${Math.abs(largestGap.gapPct * 100).toFixed(1)} puntos ${largestGap.gapPct > 0 ? 'por debajo' : 'por encima'} de su objetivo.`, action: 'review_position', positionId: largestGap.positionId,
      })
    }
  }

  for (const position of positions) {
    if (position.objetivo_precio !== null && position.precio_actual !== null && position.precio_actual >= position.objetivo_precio) {
      alerts.push({ id: `target-${position.id}`, severity: 'info', title: `${position.ticker} alcanzó el objetivo`, detail: `Precio actual ${position.precio_actual.toFixed(2)} € · objetivo ${position.objetivo_precio.toFixed(2)} €.`, action: 'review_position', positionId: position.id })
    }
    if (position.alerta_subida_pct !== null && position.pnl_pct !== null && position.pnl_pct >= Math.abs(position.alerta_subida_pct)) {
      alerts.push({ id: `rise-${position.id}`, severity: 'info', title: `${position.ticker} superó tu alerta de subida`, detail: `Rentabilidad actual ${(position.pnl_pct * 100).toFixed(1)}%.`, action: 'review_position', positionId: position.id })
    }
    if (position.alerta_caida_pct !== null && position.pnl_pct !== null && position.pnl_pct <= -Math.abs(position.alerta_caida_pct)) {
      alerts.push({ id: `drop-${position.id}`, severity: 'critical', title: `${position.ticker} superó tu alerta de caída`, detail: `Rentabilidad actual ${(position.pnl_pct * 100).toFixed(1)}%.`, action: 'review_position', positionId: position.id })
    }
  }

  return alerts
}

export function calculateInvestmentAnalytics(
  positions: InversionPosicion[],
  operations: InversionOperacion[],
  snapshots: InversionSnapshotDiario[]
): InvestmentAnalytics {
  const replay = replayOperations(operations)
  const totalValue = positions.reduce((sum, position) => sum + (position.valor_actual ?? 0), 0)
  const known = positions.filter((position) => position.coste !== null)
  const knownCost = known.reduce((sum, position) => sum + (position.coste ?? 0), 0)
  const unrealisedPnl = known.reduce((sum, position) => sum + (position.pnl ?? ((position.valor_actual ?? 0) - (position.coste ?? 0))), 0)
  const capitalTracked = replay.purchases + replay.commissions + replay.taxes
  const historicalNetResult = replay.realisedPnl + replay.dividends + replay.bonuses - replay.commissions - replay.taxes
  const totalNetResult = unrealisedPnl + historicalNetResult
  const snapshotHistory = aggregateSnapshots(snapshots)
  const flowReturn = returnMetrics(operations, totalValue, snapshots)
  const openReturn = openReturnMetrics(positions, operations, snapshots, totalValue)
  const drawdown = drawdownSummary(snapshotHistory)
  const rebalance = rebalanceSummary(positions, totalValue)
  const performance: InvestmentPerformanceSummary = {
    totalValue,
    knownCost,
    unrealisedPnl,
    realisedPnl: replay.realisedPnl,
    dividends: replay.dividends,
    bonuses: replay.bonuses,
    commissions: replay.commissions,
    taxes: replay.taxes,
    historicalNetResult,
    totalNetResult,
    currentReturnPct: knownCost > 0 ? unrealisedPnl / knownCost : null,
    totalReturnPct: capitalTracked > 0 ? totalNetResult / capitalTracked : null,
    annualizedReturnPct: flowReturn.annualizedReturnPct,
    cashFlowCount: flowReturn.cashFlowCount,
    firstCashFlowDate: flowReturn.firstCashFlowDate,
    openAnnualizedReturnPct: openReturn.annualizedReturnPct,
    openCashFlowCount: openReturn.cashFlowCount,
    openFirstCashFlowDate: openReturn.firstCashFlowDate,
    openReturnCoverage: openReturn.coverage,
    capitalTracked,
    unmatchedSales: replay.unmatchedSales,
    coverage: {
      totalPositions: positions.length,
      costPositions: known.length,
      valuedPositions: positions.filter((position) => position.valor_actual !== null).length,
      datedPositions: positions.filter((position) => Boolean(position.fecha_apertura)).length,
    },
  }

  const weights = positions.map((position) => totalValue > 0 ? (position.valor_actual ?? 0) / totalValue : 0).toSorted((a, b) => b - a)
  const top1Pct = weights[0] ?? 0
  const top3Pct = weights.slice(0, 3).reduce((sum, weight) => sum + weight, 0)
  const top5Pct = weights.slice(0, 5).reduce((sum, weight) => sum + weight, 0)
  const byType = allocation(positions, totalValue, (position) => position.tipo)
  const cryptoPct = byType.filter((item) => item.name.toLocaleLowerCase('es').includes('crypto')).reduce((sum, item) => sum + item.percent, 0)
  const risk: InvestmentRiskSummary = {
    top1Pct,
    top3Pct,
    top5Pct,
    cryptoPct,
    hhi: weights.reduce((sum, weight) => sum + weight ** 2, 0),
    level: top1Pct > 0.35 || top3Pct > 0.7 ? 'Alta' : top1Pct > 0.25 || top3Pct > 0.55 ? 'Media' : 'Baja',
    byType,
    byCustody: allocation(positions, totalValue, (position) => position.custodia),
    byCurrency: allocation(positions, totalValue, (position) => position.divisa),
    bySector: allocation(positions, totalValue, (position) => position.sector),
    byCountry: allocation(positions, totalValue, (position) => position.pais),
    drawdown,
    targetTotalPct: rebalance.targetTotalPct,
    configuredTargetPositions: rebalance.configuredTargetPositions,
    rebalance: rebalance.items,
  }

  const positionAnalytics = positions.map((position) => {
    const state = replay.states.get(investmentPositionKey(position)) ?? emptyReplayState()
    return {
      positionId: position.id,
      purchases: state.purchases,
      saleProceeds: state.saleProceeds,
      realisedPnl: state.realisedPnl,
      dividends: state.dividends,
      bonuses: state.bonuses,
      commissions: state.commissions,
      taxes: state.taxes,
      operations: state.operations,
      firstOperation: state.firstOperation,
      lastOperation: state.lastOperation,
    }
  })

  return {
    performance,
    risk,
    fiscalYears: replay.fiscalYears,
    snapshotHistory,
    positionAnalytics,
    alerts: buildAlerts(positions, risk),
  }
}
