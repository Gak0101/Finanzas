import { NextResponse } from 'next/server'
import { and, eq } from 'drizzle-orm'
import { db } from '@/lib/db'
import { inversiones_posiciones } from '@/lib/db/schema'
import { getAuthenticatedUserId, isNextResponse } from '@/lib/api-utils'
import { persistDailyInvestmentSnapshots } from '@/lib/inversiones/snapshots'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

type YahooChartPayload = {
  chart?: {
    result?: Array<{
      meta?: { currency?: string; regularMarketPrice?: number }
      timestamp?: number[]
      indicators?: { quote?: Array<{ close?: Array<number | null> }> }
    }> | null
  }
}

type PriceResult = {
  price: number
  sourceUrl: string
  provider: string
  asOf?: string
  nativeCurrency?: string
  fxRate?: number
}

async function fetchYahooCloseRaw(symbol: string): Promise<PriceResult> {
  const sourceUrl = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?range=5d&interval=1d&events=history`
  const response = await fetch(sourceUrl, {
    cache: 'no-store',
    headers: { Accept: 'application/json', 'User-Agent': 'Finanzas portfolio tracker' },
  })
  if (!response.ok) throw new Error(`Yahoo ${symbol}: HTTP ${response.status}`)

  const payload = (await response.json()) as YahooChartPayload
  const result = payload.chart?.result?.[0]
  const closes = result?.indicators?.quote?.[0]?.close ?? []
  const validCloses = closes.filter((value): value is number => typeof value === 'number' && value > 0)
  const price = validCloses.at(-1) ?? result?.meta?.regularMarketPrice
  if (!price || price <= 0) throw new Error(`Yahoo ${symbol}: sin último cierre`)

  const timestamps = result?.timestamp ?? []
  const asOfTimestamp = timestamps.at(-1)
  return {
    price,
    sourceUrl,
    provider: `Yahoo Finance · ${symbol} · último cierre`,
    asOf: asOfTimestamp ? new Date(asOfTimestamp * 1000).toISOString() : undefined,
    nativeCurrency: result?.meta?.currency,
  }
}

async function fetchYahooClose(symbol: string): Promise<PriceResult> {
  const result = await fetchYahooCloseRaw(symbol)
  let currency = result.nativeCurrency
  let nativePrice = result.price

  if (!currency || currency === 'EUR') return result
  if (currency === 'GBp') {
    currency = 'GBP'
    nativePrice /= 100
  }

  const fx = await fetchYahooCloseRaw(`${currency}EUR=X`)
  return {
    ...result,
    price: nativePrice * fx.price,
    nativeCurrency: currency,
    fxRate: fx.price,
    provider: `${result.provider} · convertido ${currency}/EUR`,
  }
}

export async function POST() {
  const auth = await getAuthenticatedUserId()
  if (isNextResponse(auth)) return auth

  const positions = await db.query.inversiones_posiciones.findMany({
    where: and(
      eq(inversiones_posiciones.usuario_id, auth.userId),
      eq(inversiones_posiciones.incluido_resumen, true)
    ),
  })

  const updatedAt = new Date().toISOString()
  const errors: string[] = []
  const updates: Array<{ id: number; result: PriceResult }> = []

  const cryptoIds = [...new Set(positions.map((position) => position.crypto_id).filter(Boolean))]
  if (cryptoIds.length > 0) {
    const query = new URLSearchParams({ ids: cryptoIds.join(','), vs_currencies: 'eur' })
    try {
      const response = await fetch(`https://api.coingecko.com/api/v3/simple/price?${query.toString()}`, {
        cache: 'no-store',
        headers: { Accept: 'application/json' },
      })
      if (!response.ok) throw new Error(`CoinGecko HTTP ${response.status}`)
      const prices = (await response.json()) as Record<string, { eur?: number }>
      for (const position of positions) {
        if (!position.crypto_id) continue
        const price = prices[position.crypto_id]?.eur
        if (typeof price === 'number' && price > 0) {
          updates.push({
            id: position.id,
            result: {
              price,
              provider: `CoinGecko · ${position.crypto_id} · spot EUR`,
              sourceUrl: `https://api.coingecko.com/api/v3/simple/price?ids=${position.crypto_id}&vs_currencies=eur`,
            },
          })
        } else {
          errors.push(`CoinGecko no devolvió precio para ${position.ticker}`)
        }
      }
    } catch (error) {
      errors.push(error instanceof Error ? error.message : 'CoinGecko no disponible')
    }
  }

  for (const position of positions.filter((item) => item.market_symbol)) {
    try {
      const result = await fetchYahooClose(position.market_symbol!)
      updates.push({ id: position.id, result })
    } catch (error) {
      errors.push(error instanceof Error ? error.message : `No se pudo actualizar ${position.market_symbol}`)
    }
  }

  for (const update of updates) {
    const position = positions.find((item) => item.id === update.id)
    if (!position) continue
    const value = position.cantidad * update.result.price
    const pnl = position.coste === null ? null : value - position.coste
    const pnlPct = position.coste && position.coste > 0 && pnl !== null ? pnl / position.coste : null
    await db
      .update(inversiones_posiciones)
      .set({
        precio_actual: update.result.price,
        valor_actual: value,
        pnl,
        pnl_pct: pnlPct,
        fuente: update.result.provider,
        estado_fuente: 'API_OK',
        ultimo_valido: update.result.price,
        proveedor: update.result.provider,
        fuente_url: update.result.sourceUrl,
        snapshot_at: update.result.asOf ?? updatedAt,
        divisa: 'EUR',
        updated_at: updatedAt,
      })
      .where(eq(inversiones_posiciones.id, update.id))
  }

  const allPositions = await db.query.inversiones_posiciones.findMany({
    where: and(
      eq(inversiones_posiciones.usuario_id, auth.userId),
      eq(inversiones_posiciones.incluido_resumen, true)
    ),
  })
  const total = allPositions.reduce((sum, position) => sum + (position.valor_actual ?? 0), 0)
  await Promise.all(
    allPositions.map((position) =>
      db
        .update(inversiones_posiciones)
        .set({
          peso: total > 0 ? (position.valor_actual ?? 0) / total : 0,
          updated_at: updatedAt,
        })
        .where(eq(inversiones_posiciones.id, position.id))
    )
  )

  const positionsUpdated = await db.query.inversiones_posiciones.findMany({
    where: and(
      eq(inversiones_posiciones.usuario_id, auth.userId),
      eq(inversiones_posiciones.incluido_resumen, true)
    ),
  })

  await persistDailyInvestmentSnapshots(auth.userId, positionsUpdated)

  return NextResponse.json({
    positions: positionsUpdated,
    updated: updates.length,
    updatedCrypto: updates.filter(({ id }) => positions.find((position) => position.id === id)?.crypto_id).length,
    updatedEtf: updates.filter(({ id }) => positions.find((position) => position.id === id)?.market_symbol).length,
    errors,
    updatedAt,
    etfMessage: 'ETFs actualizados con el último cierre disponible en Yahoo/Xetra.',
  })
}
