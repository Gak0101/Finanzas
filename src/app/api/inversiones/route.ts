import { NextResponse } from 'next/server'
import { and, asc, desc, eq } from 'drizzle-orm'
import { db } from '@/lib/db'
import {
  inversiones_alertas,
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

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

async function getPortfolio(userId: number, captureToday = false) {
  const [positions, operations, notificationAlerts] = await Promise.all([
    db.query.inversiones_posiciones.findMany({
      where: and(
        eq(inversiones_posiciones.usuario_id, userId),
        eq(inversiones_posiciones.incluido_resumen, true)
      ),
      orderBy: [desc(inversiones_posiciones.valor_actual), desc(inversiones_posiciones.id)],
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
    closedPositions: calculateClosedInvestmentPositions(operations),
    analytics: calculateInvestmentAnalytics(positions, operations, snapshots),
  }
}

async function recalculateWeights(userId: number) {
  const positions = await db.query.inversiones_posiciones.findMany({
    where: and(
      eq(inversiones_posiciones.usuario_id, userId),
      eq(inversiones_posiciones.incluido_resumen, true)
    ),
  })
  const total = positions.reduce((sum, position) => sum + (position.valor_actual ?? 0), 0)

  await Promise.all(
    positions.map((position) =>
      db
        .update(inversiones_posiciones)
        .set({
          peso: total > 0 ? (position.valor_actual ?? 0) / total : 0,
          updated_at: new Date().toISOString(),
        })
        .where(eq(inversiones_posiciones.id, position.id))
    )
  )
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
  const identifiers = priceIdentifiers(input.tipo_activo, input.ticker)
  const existing = await db.query.inversiones_posiciones.findFirst({
    where: and(
      eq(inversiones_posiciones.usuario_id, auth.userId),
      eq(inversiones_posiciones.activo, input.activo),
      eq(inversiones_posiciones.custodia, input.custodia),
      eq(inversiones_posiciones.incluido_resumen, true)
    ),
  })

  if (input.tipo === 'Venta') {
    if (!existing) {
      return NextResponse.json({ error: 'No existe esa posición en la custodia seleccionada' }, { status: 404 })
    }
    if (input.cantidad > existing.cantidad) {
      return NextResponse.json({ error: 'La venta supera la cantidad disponible de la posición' }, { status: 400 })
    }

    const newQuantity = existing.cantidad - input.cantidad
    const averageCost = existing.cantidad > 0 && existing.coste !== null
      ? existing.coste / existing.cantidad
      : null
    const newCost = averageCost === null ? existing.coste : Math.max(0, existing.coste! - averageCost * input.cantidad)
    const newValue = existing.precio_actual === null ? null : newQuantity * existing.precio_actual

    await db
      .update(inversiones_posiciones)
      .set({
        cantidad: newQuantity,
        coste: newCost,
        precio_compra: newCost !== null && newQuantity > 0 ? newCost / newQuantity : null,
        valor_actual: newValue,
        pnl: newValue !== null && newCost !== null ? newValue - newCost : null,
        pnl_pct: newValue !== null && newCost !== null && newCost > 0 ? (newValue - newCost) / newCost : null,
        updated_at: now,
      })
      .where(eq(inversiones_posiciones.id, existing.id))
  } else if (input.tipo === 'Compra') {
    if (existing) {
      const newQuantity = existing.cantidad + input.cantidad
      const newCost = (existing.coste ?? 0) + importe
      const currentPrice = existing.precio_actual ?? input.precio_unitario
      const newValue = newQuantity * currentPrice

      await db
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
          isin: existing.isin || inferIsin(existing.ticker, existing.market_symbol),
          crypto_id: existing.crypto_id ?? identifiers.cryptoId,
          market_symbol: existing.market_symbol ?? identifiers.marketSymbol,
          fecha_apertura: !existing.fecha_apertura || input.fecha < existing.fecha_apertura
            ? input.fecha
            : existing.fecha_apertura,
          updated_at: now,
        })
        .where(eq(inversiones_posiciones.id, existing.id))
    } else {
      await db.insert(inversiones_posiciones).values({
        usuario_id: auth.userId,
        custodia: input.custodia,
        broker: input.custodia,
        activo: input.activo,
        tipo: input.tipo_activo,
        ticker: input.ticker,
        isin: inferIsin(input.ticker, identifiers.marketSymbol),
        price_ticker: input.ticker,
        crypto_id: identifiers.cryptoId,
        cantidad: input.cantidad,
        precio_compra: input.precio_unitario,
        coste: importe,
        precio_actual: input.precio_unitario,
        valor_actual: importe,
        pnl: 0,
        pnl_pct: 0,
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
        divisa: 'EUR',
        sector: input.tipo_activo,
        market_symbol: identifiers.marketSymbol,
      })
    }
  }

  const [operation] = await db
    .insert(inversiones_operaciones)
    .values({
      usuario_id: auth.userId,
      fecha: input.fecha,
      tipo: input.tipo,
      activo: input.activo,
      ticker: input.ticker,
      tipo_activo: input.tipo_activo,
      custodia: input.custodia,
      cantidad: input.cantidad,
      precio_unitario: input.precio_unitario,
      importe,
      comision: input.comision,
      impuesto: input.impuesto,
      fuente: 'App',
      notas: input.notas,
    })
    .returning()

  await recalculateWeights(auth.userId)
  const portfolio = await getPortfolio(auth.userId, true)
  return NextResponse.json({ ...portfolio, operation }, { status: 201 })
}
