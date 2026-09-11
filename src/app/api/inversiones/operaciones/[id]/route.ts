import { NextResponse } from 'next/server'
import { and, eq, sql } from 'drizzle-orm'
import { z } from 'zod'
import { getAuthenticatedUserId, isNextResponse } from '@/lib/api-utils'
import { db } from '@/lib/db'
import { inversiones_movimientos_efectivo, inversiones_operaciones } from '@/lib/db/schema'
import { getInvestmentCashSnapshotWithMarketRates } from '@/lib/inversiones/cash'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const operationFundingUpdateSchema = z.object({
  origen_fondos: z.enum(['saldo_existente', 'capital_nuevo']),
}).strict()

const CASH_EPSILON = 1e-7

class OperationFundingError extends Error {
  constructor(readonly code: string, readonly detail?: Record<string, unknown>) {
    super(code)
  }
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await getAuthenticatedUserId()
  if (isNextResponse(auth)) return auth

  const { id } = await params
  const operationId = Number(id)
  if (!Number.isInteger(operationId) || operationId <= 0) {
    return NextResponse.json({ error: 'Operación no válida' }, { status: 400 })
  }

  const parsed = operationFundingUpdateSchema.safeParse(await req.json())
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Datos no válidos' }, { status: 400 })
  }

  try {
    const operation = db.transaction((tx) => {
      const current = tx
        .select()
        .from(inversiones_operaciones)
        .where(and(
          eq(inversiones_operaciones.id, operationId),
          eq(inversiones_operaciones.usuario_id, auth.userId),
        ))
        .get()

      if (!current) throw new OperationFundingError('OPERATION_NOT_FOUND')
      if (current.tipo !== 'Compra' || !current.origen_fondos) {
        throw new OperationFundingError('FUNDING_NOT_EDITABLE')
      }

      const movements = tx
        .select()
        .from(inversiones_movimientos_efectivo)
        .where(and(
          eq(inversiones_movimientos_efectivo.usuario_id, auth.userId),
          eq(inversiones_movimientos_efectivo.operacion_id, operationId),
        ))
        .all()
      const capitalMovement = movements.find((movement) => movement.tipo === 'APORTACION_CAPITAL')
      const purchaseMovement = movements.find((movement) => movement.tipo === 'COMPRA')
      if (!purchaseMovement) throw new OperationFundingError('FUNDING_LEDGER_INCOMPLETE')

      const requestedFunding = parsed.data.origen_fondos
      if (requestedFunding === current.origen_fondos) return current

      const transactionCost = current.importe + current.comision + current.impuesto
      const balanceRow = tx
        .select({ saldo: sql<number>`coalesce(sum(${inversiones_movimientos_efectivo.importe}), 0)` })
        .from(inversiones_movimientos_efectivo)
        .where(and(
          eq(inversiones_movimientos_efectivo.usuario_id, auth.userId),
          eq(inversiones_movimientos_efectivo.custodia, current.custodia),
          eq(inversiones_movimientos_efectivo.divisa, current.divisa),
        ))
        .get()
      const currentBalance = Number(balanceRow?.saldo ?? 0)

      if (requestedFunding === 'saldo_existente') {
        const capitalAmount = Number(capitalMovement?.importe ?? transactionCost)
        const balanceWithoutCapital = currentBalance - capitalAmount
        if (balanceWithoutCapital + CASH_EPSILON < transactionCost) {
          throw new OperationFundingError('INSUFFICIENT_CASH', {
            custodia: current.custodia,
            divisa: current.divisa,
            disponible: balanceWithoutCapital,
            necesario: transactionCost,
          })
        }

        if (capitalMovement) {
          tx
            .update(inversiones_movimientos_efectivo)
            .set({
              importe: 0,
              descripcion: 'Capital nuevo anulado al corregir la compra a saldo disponible',
            })
            .where(eq(inversiones_movimientos_efectivo.id, capitalMovement.id))
            .run()
        }
      } else if (capitalMovement) {
        tx
          .update(inversiones_movimientos_efectivo)
          .set({
            importe: transactionCost,
            descripcion: 'Capital nuevo aplicado a la compra',
          })
          .where(eq(inversiones_movimientos_efectivo.id, capitalMovement.id))
          .run()
      } else {
        tx
          .insert(inversiones_movimientos_efectivo)
          .values({
            usuario_id: auth.userId,
            custodia: current.custodia,
            divisa: current.divisa,
            fecha: current.fecha,
            importe: transactionCost,
            tipo: 'APORTACION_CAPITAL',
            operacion_id: current.id,
            referencia: `operacion:${current.id}:capital`,
            descripcion: 'Capital nuevo aplicado a la compra',
          })
          .run()
      }

      return tx
        .update(inversiones_operaciones)
        .set({ origen_fondos: requestedFunding })
        .where(and(
          eq(inversiones_operaciones.id, current.id),
          eq(inversiones_operaciones.usuario_id, auth.userId),
        ))
        .returning()
        .get()
    })

    return NextResponse.json({ operation, cash: await getInvestmentCashSnapshotWithMarketRates(auth.userId) })
  } catch (error) {
    if (error instanceof OperationFundingError) {
      if (error.code === 'OPERATION_NOT_FOUND') return NextResponse.json({ error: 'Operación no encontrada' }, { status: 404 })
      if (error.code === 'FUNDING_NOT_EDITABLE') return NextResponse.json({ error: 'Solo se puede corregir la financiación de compras registradas desde la app' }, { status: 400 })
      if (error.code === 'FUNDING_LEDGER_INCOMPLETE') return NextResponse.json({ error: 'La operación no tiene su movimiento de compra asociado; no se ha modificado' }, { status: 409 })
      if (error.code === 'INSUFFICIENT_CASH') return NextResponse.json({ error: 'Saldo insuficiente para cambiar esta compra a efectivo disponible', detail: error.detail }, { status: 400 })
    }
    throw error
  }
}
