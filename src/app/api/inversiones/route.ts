import { NextResponse } from 'next/server'
import { and, asc, desc, eq, sql, type SQL } from 'drizzle-orm'
import { db } from '@/lib/db'
import {
  inversiones_alertas,
  inversiones_movimientos_efectivo,
  inversiones_operaciones,
  inversiones_posiciones,
  inversiones_snapshots_diarios,
} from '@/lib/db/schema'
import { getAuthenticatedUserId, isNextResponse } from '@/lib/api-utils'
import { inversionOperacionSchema } from '@/lib/validations/inversion'
import { calculateClosedInvestmentPositions } from '@/lib/inversiones/history'
import { priceIdentifiers } from '@/lib/inversiones/priceIdentifiers'
import { inferIsin } from '@/lib/inversiones/instrumentIdentity'
import { calculateInvestmentAnalytics } from '@/lib/inversiones/analytics'
import { persistDailyInvestmentSnapshots } from '@/lib/inversiones/snapshots'
import { getInvestmentCashSnapshot, operationCashAmount } from '@/lib/inversiones/cash'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const QUANTITY_EPSILON = 1e-7

async function getPortfolio(userId: number, captureToday = false) {
  const [positions, identityPositions, operations, notificationAlerts] = await Promise.all([
    db.query.inversiones_posiciones.findMany({
      where: and(
        eq(inversiones_posiciones.usuario_id, userId),
        eq(inversiones_posiciones.incluido_resumen, true)
      ),
      orderBy: [desc(inversiones_posiciones.valor_actual), desc(inversiones_posiciones.id)],
    }),
    db.query.inversiones_posiciones.findMany({
      where: eq(inversiones_posiciones.usuario_id, userId),
    }),
    db.query.inversiones_operaciones.findMany({
      where: eq(inversiones_operaciones.usuario_id, userId),
      orderBy: [desc(inversiones_operaciones.fecha), desc(inversiones_operaciones.fecha_hora), desc(inversiones_operaciones.id)],
    }),
    db.query.inversiones_alertas.findMany({
      where: eq(inversiones_alertas.usuario_id, userId),
      orderBy: [asc(inversiones_alertas.alcance), asc(inversiones_alertas.activo), asc(inversiones_alertas.id)],
    }),
  ])

  if (captureToday) await persistDailyInvestmentSnapshots(userId, positions)

  const snapshots = await db.query.inversiones_snapshots_diarios.findMany({
    where: eq(inversiones_snapshots_diarios.usuario_id, userId),
    orderBy: [asc(inversiones_snapshots_diarios.fecha_valoracion), asc(inversiones_snapshots_diarios.posicion_id)],
  })

  return {
    positions,
    operations,
    notificationAlerts,
    closedPositions: calculateClosedInvestmentPositions(operations, identityPositions),
    analytics: calculateInvestmentAnalytics(positions, operations, snapshots, identityPositions),
    cash: getInvestmentCashSnapshot(userId),
  }
}

type TransactionRunner = {
  run(query: SQL): unknown
}

function recalculateWeightsInTransaction(tx: TransactionRunner, userId: number, now: string) {
  tx.run(sql`
    UPDATE inversiones_posiciones
    SET peso = CASE
      WHEN (
        SELECT COALESCE(SUM(valor_actual), 0)
        FROM inversiones_posiciones
        WHERE usuario_id = ${userId} AND incluido_resumen = 1
      ) > 0
      THEN COALESCE(valor_actual, 0) / (
        SELECT COALESCE(SUM(valor_actual), 0)
        FROM inversiones_posiciones
        WHERE usuario_id = ${userId} AND incluido_resumen = 1
      )
      ELSE 0
    END,
    updated_at = ${now}
    WHERE usuario_id = ${userId} AND incluido_resumen = 1
  `)
}

export async function GET() {
  const auth = await getAuthenticatedUserId()
  if (isNextResponse(auth)) return auth

  return NextResponse.json(await getPortfolio(auth.userId, true))
}

export async function POST(req: Request) {
  const auth = await getAuthenticatedUserId()
  if (isNextResponse(auth)) return auth

  const parsed = inversionOperacionSchema.safeParse(await req.json())
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }

  const input = parsed.data
  const importe = input.importe ?? input.cantidad * input.precio_unitario
  const now = new Date().toISOString()
  const selectedPriceTicker = input.price_ticker?.trim() || input.ticker.trim()
  const identifiers = priceIdentifiers(input.tipo_activo, selectedPriceTicker)
  const cryptoId = input.crypto_id?.trim() || identifiers.cryptoId
  const marketSymbol = input.market_symbol?.trim() || identifiers.marketSymbol
  const isin = input.isin?.trim() || inferIsin(input.ticker, selectedPriceTicker, marketSymbol)
  const divisa = input.divisa.trim().toUpperCase()
  const transactionCost = importe + input.comision + input.impuesto

  class InsufficientCashError extends Error {
    constructor(readonly balance: number) {
      super('INSUFFICIENT_INVESTMENT_CASH')
    }
  }

  try {
    const operation = db.transaction((tx) => {
      const existing = tx
        .select()
        .from(inversiones_posiciones)
        .where(and(
          eq(inversiones_posiciones.usuario_id, auth.userId),
          eq(inversiones_posiciones.activo, input.activo),
          eq(inversiones_posiciones.custodia, input.custodia),
        ))
        .orderBy(desc(inversiones_posiciones.incluido_resumen), desc(inversiones_posiciones.id))
        .limit(1)
        .get()

      if (input.tipo === 'Venta') {
        if (!existing || !existing.incluido_resumen) {
          throw new Error('POSITION_NOT_FOUND')
        }
        if (input.cantidad > existing.cantidad) {
          throw new Error('POSITION_QUANTITY_EXCEEDED')
        }
      }

      if (input.tipo === 'Compra' && input.origen_fondos === 'saldo_existente') {
        const [cashRow] = tx
          .select({
            saldo: sql<number>`coalesce(sum(${inversiones_movimientos_efectivo.importe}), 0)`,
          })
          .from(inversiones_movimientos_efectivo)
          .where(and(
            eq(inversiones_movimientos_efectivo.usuario_id, auth.userId),
            eq(inversiones_movimientos_efectivo.custodia, input.custodia),
            eq(inversiones_movimientos_efectivo.divisa, divisa),
          ))
          .all()
        const balance = Number(cashRow?.saldo ?? 0)
        if (balance + QUANTITY_EPSILON < transactionCost) {
          throw new InsufficientCashError(balance)
        }
      }

      const createdOperation = tx
        .insert(inversiones_operaciones)
        .values({
          usuario_id: auth.userId,
          fecha: input.fecha,
          fecha_hora: now,
          tipo: input.tipo,
          origen_fondos: input.tipo === 'Compra' ? input.origen_fondos ?? null : null,
          activo: input.activo,
          ticker: input.ticker,
          tipo_activo: input.tipo_activo,
          custodia: input.custodia,
          cantidad: input.cantidad,
          precio_unitario: input.precio_unitario,
          importe,
          comision: input.comision,
          impuesto: input.impuesto,
          divisa,
          fuente: 'App',
          notas: input.notas,
        })
        .returning()
        .get()

      if (!createdOperation) throw new Error('OPERATION_NOT_CREATED')

      if (input.tipo === 'Venta' && existing) {
        const newQuantity = existing.cantidad - input.cantidad
        const averageCost = existing.cantidad > 0 && existing.coste !== null
          ? existing.coste / existing.cantidad
          : null
        const newCost = averageCost === null ? existing.coste : Math.max(0, existing.coste! - averageCost * input.cantidad)
        const newValue = existing.precio_actual === null ? null : newQuantity * existing.precio_actual

        tx
          .update(inversiones_posiciones)
          .set({
            cantidad: newQuantity,
            coste: newCost,
            precio_compra: newCost !== null && newQuantity > 0 ? newCost / newQuantity : null,
            valor_actual: newValue,
            pnl: newValue !== null && newCost !== null ? newValue - newCost : null,
            pnl_pct: newValue !== null && newCost !== null && newCost > 0 ? (newValue - newCost) / newCost : null,
            incluido_resumen: newQuantity > QUANTITY_EPSILON,
            updated_at: now,
          })
          .where(eq(inversiones_posiciones.id, existing.id))
          .run()
      } else if (input.tipo === 'Compra') {
        if (existing) {
          const newQuantity = existing.cantidad + input.cantidad
          const newCost = (existing.coste ?? 0) + transactionCost
          const currentPrice = existing.precio_actual ?? input.precio_unitario
          const newValue = newQuantity * currentPrice

          tx
            .update(inversiones_posiciones)
            .set({
              cantidad: newQuantity,
              coste: newCost,
              precio_compra: newCost / newQuantity,
              precio_actual: existing.precio_actual ?? input.precio_unitario,
              valor_actual: newValue,
              pnl: newValue - newCost,
              pnl_pct: newCost > 0 ? (newValue - newCost) / newCost : null,
              estado_fuente: existing.estado_fuente === 'FALLBACK' ? 'FALLBACK' : 'MANUAL',
              isin: existing.isin || isin,
              price_ticker: input.price_ticker?.trim() || existing.price_ticker || selectedPriceTicker,
              crypto_id: existing.crypto_id ?? cryptoId,
              market_symbol: existing.market_symbol ?? marketSymbol,
              fecha_apertura: !existing.fecha_apertura || input.fecha < existing.fecha_apertura
                ? input.fecha
                : existing.fecha_apertura,
              incluido_resumen: true,
              updated_at: now,
            })
            .where(eq(inversiones_posiciones.id, existing.id))
            .run()
        } else {
          const currentValue = importe
          tx.insert(inversiones_posiciones).values({
            usuario_id: auth.userId,
            custodia: input.custodia,
            broker: input.custodia,
            activo: input.activo,
            tipo: input.tipo_activo,
            ticker: input.ticker,
            isin,
            price_ticker: selectedPriceTicker,
            crypto_id: cryptoId,
            cantidad: input.cantidad,
            precio_compra: transactionCost / input.cantidad,
            coste: transactionCost,
            precio_actual: input.precio_unitario,
            valor_actual: currentValue,
            pnl: currentValue - transactionCost,
            pnl_pct: transactionCost > 0 ? (currentValue - transactionCost) / transactionCost : null,
            peso: 0,
            fuente: 'Manual · operación registrada',
            estado_fuente: 'MANUAL',
            ultimo_valido: input.precio_unitario,
            fallback_map: null,
            proveedor: 'Usuario',
            fuente_url: null,
            nota: null,
            snapshot_at: now,
            fecha_apertura: input.fecha,
            hoja_origen: 'App',
            fila_origen: null,
            incluido_resumen: true,
            divisa,
            sector: input.tipo_activo,
            market_symbol: marketSymbol,
          }).run()
        }
      }

      const netCash = operationCashAmount(importe, input.comision, input.impuesto)
      if (input.tipo === 'Compra' && input.origen_fondos === 'capital_nuevo') {
        tx
          .insert(inversiones_movimientos_efectivo)
          .values({
            usuario_id: auth.userId,
            custodia: input.custodia,
            divisa,
            fecha: input.fecha,
            importe: transactionCost,
            tipo: 'APORTACION_CAPITAL',
            operacion_id: createdOperation.id,
            referencia: `operacion:${createdOperation.id}:capital`,
            descripcion: 'Capital nuevo aplicado a la compra',
          })
          .run()
      }

      if (input.tipo === 'Compra') {
        tx
          .insert(inversiones_movimientos_efectivo)
          .values({
            usuario_id: auth.userId,
            custodia: input.custodia,
            divisa,
            fecha: input.fecha,
            importe: -transactionCost,
            tipo: 'COMPRA',
            operacion_id: createdOperation.id,
            referencia: `operacion:${createdOperation.id}:compra`,
            descripcion: input.origen_fondos === 'capital_nuevo'
              ? 'Débito de compra contra el capital aportado'
              : 'Débito de compra contra saldo disponible',
          })
          .run()
      } else if (input.tipo === 'Venta') {
        tx
          .insert(inversiones_movimientos_efectivo)
          .values({
            usuario_id: auth.userId,
            custodia: input.custodia,
            divisa,
            fecha: input.fecha,
            importe: netCash,
            tipo: 'VENTA',
            operacion_id: createdOperation.id,
            referencia: `operacion:${createdOperation.id}:venta`,
            descripcion: 'Neto de venta disponible en la custodia',
          })
          .run()
      } else if (input.tipo === 'Dividendo') {
        tx
          .insert(inversiones_movimientos_efectivo)
          .values({
            usuario_id: auth.userId,
            custodia: input.custodia,
            divisa,
            fecha: input.fecha,
            importe: netCash,
            tipo: 'DIVIDENDO',
            operacion_id: createdOperation.id,
            referencia: `operacion:${createdOperation.id}:dividendo`,
            descripcion: 'Dividendo neto disponible en la custodia',
          })
          .run()
      } else if (input.tipo === 'Aportación') {
        tx
          .insert(inversiones_movimientos_efectivo)
          .values({
            usuario_id: auth.userId,
            custodia: input.custodia,
            divisa,
            fecha: input.fecha,
            importe: netCash,
            tipo: 'APORTACION',
            operacion_id: createdOperation.id,
            referencia: `operacion:${createdOperation.id}:aportacion`,
            descripcion: 'Aportación disponible en la custodia',
          })
          .run()
      }

      recalculateWeightsInTransaction(tx, auth.userId, now)
      return createdOperation
    })

    const portfolio = await getPortfolio(auth.userId, true)
    return NextResponse.json({ ...portfolio, operation }, { status: 201 })
  } catch (error) {
    if (error instanceof InsufficientCashError) {
      return NextResponse.json({
        error: 'Saldo insuficiente en la custodia seleccionada',
        detail: {
          custodia: input.custodia,
          divisa,
          disponible: error.balance,
          necesario: transactionCost,
        },
      }, { status: 400 })
    }
    if (error instanceof Error && error.message === 'POSITION_NOT_FOUND') {
      return NextResponse.json({ error: 'No existe esa posición en la custodia seleccionada' }, { status: 404 })
    }
    if (error instanceof Error && error.message === 'POSITION_QUANTITY_EXCEEDED') {
      return NextResponse.json({ error: 'La venta supera la cantidad disponible de la posición' }, { status: 400 })
    }
    throw error
  }
}
