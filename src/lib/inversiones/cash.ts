import { z } from 'zod'
import { randomUUID } from 'node:crypto'
import { and, asc, eq, sql } from 'drizzle-orm'
import { db } from '@/lib/db'
import { inversiones_movimientos_efectivo } from '@/lib/db/schema'

export const tiposMovimientoEfectivoInversion = [
  'APERTURA_LEGACY',
  'APORTACION_CAPITAL',
  'COMPRA',
  'VENTA',
  'DIVIDENDO',
  'APORTACION',
  'AJUSTE',
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

const CASH_ADJUSTMENT_EPSILON = 1e-7

function isCalendarDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false

  const year = Number(value.slice(0, 4))
  const month = Number(value.slice(5, 7))
  const day = Number(value.slice(8, 10))
  const daysInMonth = [31, year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0) ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]

  return month >= 1 && month <= 12 && day >= 1 && day <= daysInMonth[month - 1]
}

export const investmentCashAdjustmentSchema = z.object({
  custodia: z.string().trim().min(1, 'La custodia es requerida').max(120),
  divisa: z.string().trim().regex(/^[A-Za-z]{3}$/, 'La divisa debe tener tres letras').transform((value) => value.toUpperCase()).default('EUR'),
  fecha: z.string().refine(isCalendarDate, 'La fecha debe ser una fecha de calendario válida con formato YYYY-MM-DD'),
  saldo_objetivo: z.number().finite().nonnegative('El saldo objetivo no puede ser negativo'),
  descripcion: z.string().trim().max(500, 'La descripción no puede superar los 500 caracteres').optional(),
})

export type InvestmentCashAdjustmentInput = z.infer<typeof investmentCashAdjustmentSchema>

export type InvestmentCashAdjustmentResult = {
  cash: InvestmentCashSnapshot
  adjusted: boolean
  detail: {
    custodia: string
    divisa: string
    saldoAnterior: number
    saldoObjetivo: number
    importe: number
  }
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

export function adjustInvestmentCash(userId: number, input: InvestmentCashAdjustmentInput): InvestmentCashAdjustmentResult {
  const adjustment = db.transaction((tx) => {
    const [currentRow] = tx
      .select({
        saldo: sql<number>`coalesce(sum(${inversiones_movimientos_efectivo.importe}), 0)`,
      })
      .from(inversiones_movimientos_efectivo)
      .where(and(
        eq(inversiones_movimientos_efectivo.usuario_id, userId),
        eq(inversiones_movimientos_efectivo.custodia, input.custodia),
        eq(inversiones_movimientos_efectivo.divisa, input.divisa),
      ))
      .all()

    const saldoAnterior = Number(currentRow?.saldo ?? 0)
    const importe = input.saldo_objetivo - saldoAnterior
    const adjusted = Math.abs(importe) > CASH_ADJUSTMENT_EPSILON

    if (adjusted) {
      tx
        .insert(inversiones_movimientos_efectivo)
        .values({
          usuario_id: userId,
          custodia: input.custodia,
          divisa: input.divisa,
          fecha: input.fecha,
          importe,
          tipo: 'AJUSTE',
          operacion_id: null,
          referencia: `ajuste:${randomUUID()}`,
          descripcion: input.descripcion || null,
        })
        .run()
    }

    return { adjusted, saldoAnterior, importe: adjusted ? importe : 0 }
  })

  return {
    cash: getInvestmentCashSnapshot(userId),
    adjusted: adjustment.adjusted,
    detail: {
      custodia: input.custodia,
      divisa: input.divisa,
      saldoAnterior: adjustment.saldoAnterior,
      saldoObjetivo: input.saldo_objetivo,
      importe: adjustment.importe,
    },
  }
}

export function operationCashAmount(amount: number, commission: number, tax: number) {
  return amount - commission - tax
}
