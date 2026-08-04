import type { InversionOperacion } from '@/lib/db/schema'

const QUANTITY_EPSILON = 1e-7
const DAY_MS = 86_400_000

export type ClosedInvestmentPosition = {
  id: string
  activo: string
  ticker: string
  tipo_activo: string
  custodia: string
  fecha_apertura: string
  fecha_cierre: string
  dias_activa: number
  cantidad: number
  importe_compras: number
  importe_ventas: number
  dividendos: number
  bonificaciones: number
  comisiones: number
  impuestos: number
  resultado_realizado: number
  rentabilidad_pct: number | null
  operaciones: number
  fuente: string
}

type Cycle = ClosedInvestmentPosition & {
  openingAt: number
  closingAt: number
  balance: number
  tickers: Set<string>
  sources: Set<string>
}

function operationTimestamp(operation: InversionOperacion) {
  const value = operation.fecha_hora || `${operation.fecha}T12:00:00.000Z`
  const timestamp = new Date(value).getTime()
  return Number.isFinite(timestamp) ? timestamp : new Date(`${operation.fecha}T12:00:00.000Z`).getTime()
}

function operationOrder(left: InversionOperacion, right: InversionOperacion) {
  const byTime = operationTimestamp(left) - operationTimestamp(right)
  return byTime || left.id - right.id
}

function positionKey(operation: InversionOperacion) {
  return `${operation.custodia.trim().toLocaleLowerCase('es')}|${operation.activo.trim().toLocaleLowerCase('es')}`
}

function absolute(value: number | null | undefined) {
  return Math.abs(value ?? 0)
}

function finaliseCycle(cycle: Cycle) {
  cycle.ticker = [...cycle.tickers].filter(Boolean).join(' / ') || '—'
  cycle.fuente = [...cycle.sources].filter(Boolean).join(' · ') || 'App'
  cycle.dias_activa = Math.max(0, Math.floor((cycle.closingAt - cycle.openingAt) / DAY_MS))
  cycle.resultado_realizado = cycle.importe_ventas
    + cycle.dividendos
    + cycle.bonificaciones
    - cycle.importe_compras
    - cycle.comisiones
    - cycle.impuestos
  const capital = cycle.importe_compras + cycle.comisiones + cycle.impuestos
  cycle.rentabilidad_pct = capital > 0 ? cycle.resultado_realizado / capital : null
}

function newCycle(operation: InversionOperacion): Cycle {
  const timestamp = operationTimestamp(operation)
  return {
    id: '',
    activo: operation.activo,
    ticker: operation.ticker,
    tipo_activo: operation.tipo_activo,
    custodia: operation.custodia,
    fecha_apertura: operation.fecha,
    fecha_cierre: operation.fecha,
    dias_activa: 0,
    cantidad: 0,
    importe_compras: 0,
    importe_ventas: 0,
    dividendos: 0,
    bonificaciones: 0,
    comisiones: 0,
    impuestos: 0,
    resultado_realizado: 0,
    rentabilidad_pct: null,
    operaciones: 0,
    fuente: operation.fuente,
    openingAt: timestamp,
    closingAt: timestamp,
    balance: 0,
    tickers: new Set(),
    sources: new Set(),
  }
}

function addTrace(cycle: Cycle, operation: InversionOperacion) {
  if (operation.ticker) cycle.tickers.add(operation.ticker)
  if (operation.fuente) cycle.sources.add(operation.fuente)
  cycle.operaciones += 1
}

export function calculateClosedInvestmentPositions(operations: InversionOperacion[]) {
  const groups = new Map<string, InversionOperacion[]>()

  for (const operation of operations) {
    const rows = groups.get(positionKey(operation)) ?? []
    rows.push(operation)
    groups.set(positionKey(operation), rows)
  }

  const closed: Cycle[] = []

  for (const groupOperations of groups.values()) {
    const ordered = groupOperations.toSorted(operationOrder)
    const economic = ordered.filter((operation) => operation.tipo === 'Compra' || operation.tipo === 'Venta')
    const groupCycles: Cycle[] = []
    let active: Cycle | null = null

    for (const operation of economic) {
      const quantity = absolute(operation.cantidad)
      if (quantity <= QUANTITY_EPSILON) continue

      if (operation.tipo === 'Compra') {
        if (!active || active.balance <= QUANTITY_EPSILON) active = newCycle(operation)
        active.balance += quantity
        active.cantidad += quantity
        active.importe_compras += absolute(operation.importe)
        active.comisiones += absolute(operation.comision)
        active.impuestos += absolute(operation.impuesto)
        addTrace(active, operation)
        continue
      }

      if (!active || active.balance <= QUANTITY_EPSILON) continue
      active.balance -= quantity
      active.importe_ventas += absolute(operation.importe)
      active.comisiones += absolute(operation.comision)
      active.impuestos += absolute(operation.impuesto)
      active.fecha_cierre = operation.fecha
      active.closingAt = operationTimestamp(operation)
      addTrace(active, operation)

      if (active.balance <= QUANTITY_EPSILON) {
        active.balance = 0
        active.id = `${positionKey(operation)}|${active.fecha_apertura}|${active.fecha_cierre}|${groupCycles.length + 1}`
        groupCycles.push(active)
        closed.push(active)
        active = null
      }
    }

    const incomeOperations = ordered.filter((operation) => operation.tipo === 'Dividendo' || operation.tipo === 'Bonificación')
    for (const operation of incomeOperations) {
      const timestamp = operationTimestamp(operation)
      let target = groupCycles.find((cycle) => timestamp >= cycle.openingAt && timestamp <= cycle.closingAt)

      if (!target && operation.tipo === 'Bonificación') {
        target = groupCycles.find((cycle) => cycle.openingAt >= timestamp && cycle.openingAt - timestamp <= DAY_MS)
      }

      if (!target && operation.tipo === 'Dividendo') {
        target = groupCycles
          .filter((cycle) => cycle.closingAt <= timestamp && timestamp - cycle.closingAt <= 60 * DAY_MS)
          .at(-1)
      }

      if (!target) continue
      if (operation.tipo === 'Dividendo') target.dividendos += absolute(operation.importe)
      else target.bonificaciones += absolute(operation.importe)
      target.comisiones += absolute(operation.comision)
      target.impuestos += absolute(operation.impuesto)
      addTrace(target, operation)
    }
  }

  for (const cycle of closed) finaliseCycle(cycle)

  return closed
    .toSorted((left, right) => right.closingAt - left.closingAt || right.openingAt - left.openingAt)
    .map(({ openingAt: _openingAt, closingAt: _closingAt, balance: _balance, tickers: _tickers, sources: _sources, ...position }) => position)
}
