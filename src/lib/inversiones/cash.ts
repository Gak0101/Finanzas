import { asc, eq, sql } from 'drizzle-orm'
import { db } from '@/lib/db'
import { inversiones_movimientos_efectivo } from '@/lib/db/schema'

export const tiposMovimientoEfectivoInversion = [
  'APERTURA_LEGACY',
  'APORTACION_CAPITAL',
  'COMPRA',
  'VENTA',
  'DIVIDENDO',
  'APORTACION',
] as const

export type TipoMovimientoEfectivoInversion = typeof tiposMovimientoEfectivoInversion[number]

export type InvestmentCashBalance = {
  custodia: string
  divisa: string
  saldo: number
}

export type InvestmentCashSnapshot = {
  balances: InvestmentCashBalance[]
  totalEur: number
}

export function getInvestmentCashSnapshot(userId: number): InvestmentCashSnapshot {
  const rows = db
    .select({
      custodia: inversiones_movimientos_efectivo.custodia,
      divisa: inversiones_movimientos_efectivo.divisa,
      saldo: sql<number>`coalesce(sum(${inversiones_movimientos_efectivo.importe}), 0)`,
    })
    .from(inversiones_movimientos_efectivo)
    .where(eq(inversiones_movimientos_efectivo.usuario_id, userId))
    .groupBy(inversiones_movimientos_efectivo.custodia, inversiones_movimientos_efectivo.divisa)
    .orderBy(asc(inversiones_movimientos_efectivo.custodia), asc(inversiones_movimientos_efectivo.divisa))
    .all()

  const balances = rows.map((row) => ({
    custodia: row.custodia,
    divisa: row.divisa,
    saldo: Number(row.saldo ?? 0),
  }))

  return {
    balances,
    totalEur: balances
      .filter((balance) => balance.divisa === 'EUR')
      .reduce((total, balance) => total + balance.saldo, 0),
  }
}

export function operationCashAmount(amount: number, commission: number, tax: number) {
  return amount - commission - tax
}
