import { NextResponse } from 'next/server'
import { and, eq } from 'drizzle-orm'
import { db } from '@/lib/db'
import { inversiones_posiciones } from '@/lib/db/schema'
import { getAuthenticatedUserId, isNextResponse } from '@/lib/api-utils'
import { searchYahooAssets } from '@/lib/inversiones/marketData'
import { priceIdentifiers } from '@/lib/inversiones/priceIdentifiers'
import { listInvestmentAlertRules } from '@/lib/inversiones/alertRules'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function GET(req: Request) {
  const auth = await getAuthenticatedUserId()
  if (isNextResponse(auth)) return auth

  const query = new URL(req.url).searchParams.get('q')?.trim() ?? ''
  if (query.length < 2) return NextResponse.json({ results: [] })

  const [positions, rules] = await Promise.all([
    db.query.inversiones_posiciones.findMany({
      where: and(
        eq(inversiones_posiciones.usuario_id, auth.userId),
        eq(inversiones_posiciones.incluido_resumen, true)
      ),
    }),
    listInvestmentAlertRules(auth.userId),
  ])
  const normalizedQuery = query.toLocaleLowerCase('es')
  const results = new Map<string, {
    key: string
    activo: string
    ticker: string
    tipo_activo: string
    price_ticker: string
    crypto_id: string | null
    market_symbol: string | null
    exchange: string | null
    poseido: boolean
    posicion_id: number | null
    alerta_configurada: boolean
  }>()

  for (const position of positions) {
    const hayCoincidencia = [position.activo, position.ticker, position.price_ticker, position.market_symbol]
      .filter(Boolean)
      .some((value) => value!.toLocaleLowerCase('es').includes(normalizedQuery))
    if (!hayCoincidencia) continue
    const key = `position:${position.id}`
    results.set(key, {
      key,
      activo: position.activo,
      ticker: position.ticker,
      tipo_activo: position.tipo,
      price_ticker: position.price_ticker || position.ticker,
      crypto_id: position.crypto_id,
      market_symbol: position.market_symbol,
      exchange: null,
      poseido: true,
      posicion_id: position.id,
      alerta_configurada: rules.some((rule) => rule.posicion_id === position.id && rule.activa),
    })
  }

  const knownCrypto = priceIdentifiers('Crypto', query)
  if (knownCrypto.cryptoId) {
    results.set(`crypto:${query.toUpperCase()}`, {
      key: `crypto:${query.toUpperCase()}`,
      activo: query.toUpperCase(),
      ticker: query.toUpperCase(),
      tipo_activo: 'Crypto',
      price_ticker: query.toUpperCase(),
      crypto_id: knownCrypto.cryptoId,
      market_symbol: null,
      exchange: 'CoinGecko',
      poseido: false,
      posicion_id: null,
      alerta_configurada: rules.some((rule) => rule.posicion_id === null && (rule.crypto_id === knownCrypto.cryptoId || rule.ticker?.toLocaleLowerCase('es') === normalizedQuery)),
    })
  }

  try {
    const marketResults = await searchYahooAssets(query)
    for (const item of marketResults) {
      const matchingPosition = positions.find((position) =>
        [position.ticker, position.price_ticker, position.market_symbol]
          .filter(Boolean)
          .some((value) => value!.toLocaleLowerCase('es') === item.market_symbol.toLocaleLowerCase('es'))
      )
      const key = `market:${item.market_symbol.toUpperCase()}`
      results.set(key, {
        key,
        activo: item.name,
        ticker: item.ticker,
        tipo_activo: item.tipo_activo,
        price_ticker: item.market_symbol,
        crypto_id: null,
        market_symbol: item.market_symbol,
        exchange: item.exchange,
        poseido: Boolean(matchingPosition),
        posicion_id: matchingPosition?.id ?? null,
        alerta_configurada: rules.some((rule) => matchingPosition
          ? rule.posicion_id === matchingPosition.id && rule.activa
          : rule.posicion_id === null && (rule.market_symbol || rule.price_ticker || rule.ticker)?.toLocaleLowerCase('es') === item.market_symbol.toLocaleLowerCase('es') && rule.activa),
      })
    }
  } catch {
    // El fallback manual mantiene usable el selector aunque Yahoo no responda.
  }

  if (results.size === 0) {
    const identifiers = priceIdentifiers('Acción', query)
    results.set(`manual:${query.toUpperCase()}`, {
      key: `manual:${query.toUpperCase()}`,
      activo: query.toUpperCase(),
      ticker: query.toUpperCase(),
      tipo_activo: 'Acción',
      price_ticker: query.toUpperCase(),
      crypto_id: identifiers.cryptoId,
      market_symbol: identifiers.marketSymbol || query.toUpperCase(),
      exchange: null,
      poseido: false,
      posicion_id: null,
      alerta_configurada: false,
    })
  }

  return NextResponse.json({ results: [...results.values()].slice(0, 20) })
}
