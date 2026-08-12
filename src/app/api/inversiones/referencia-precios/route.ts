import { NextResponse } from 'next/server'
import { getAuthenticatedUserId, isNextResponse } from '@/lib/api-utils'
import { fetchAssetPrice } from '@/lib/inversiones/marketData'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

type ReferenceAsset = {
  id: number
  tipo_activo: string
  ticker: string
  crypto_id?: string | null
}

export async function POST(req: Request) {
  const auth = await getAuthenticatedUserId()
  if (isNextResponse(auth)) return auth

  const body = await req.json().catch(() => null) as { assets?: ReferenceAsset[] } | null
  const assets = Array.isArray(body?.assets)
    ? body.assets.filter((asset): asset is ReferenceAsset => (
      Number.isInteger(asset?.id)
      && typeof asset?.tipo_activo === 'string'
      && typeof asset?.ticker === 'string'
      && asset.ticker.trim().length > 0
    )).slice(0, 24)
    : []

  if (assets.length === 0) return NextResponse.json({ error: 'No se han indicado activos para consultar' }, { status: 400 })

  const updates = await Promise.all(assets.map(async (asset) => {
    try {
      const price = await fetchAssetPrice({
        tipoActivo: asset.tipo_activo,
        ticker: asset.ticker,
        cryptoId: asset.crypto_id,
        // The local scenario stores TradingView-style symbols (NASDAQ:NVDA),
        // while the provider lookup accepts the underlying Yahoo ticker.
        marketSymbol: asset.ticker,
      })
      return { id: asset.id, ...price }
    } catch (error) {
      return { id: asset.id, error: error instanceof Error ? error.message : `No se pudo consultar ${asset.ticker}` }
    }
  }))

  return NextResponse.json({
    updates: updates.filter((item): item is { id: number; price: number; sourceUrl: string; provider: string; asOf?: string; nativeCurrency?: string; fxRate?: number } => 'price' in item),
    errors: updates.filter((item): item is { id: number; error: string } => 'error' in item),
  })
}
