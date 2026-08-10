import { NextResponse } from 'next/server'
import { getAuthenticatedUserId, isNextResponse } from '@/lib/api-utils'
import { BENCHMARKS, type BenchmarkKey } from '@/lib/inversiones/benchmark'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

function isDate(value: string | null): value is string {
  return Boolean(value && /^\d{4}-\d{2}-\d{2}$/.test(value))
}

function dateToUnixSeconds(value: string) {
  return Math.floor(new Date(`${value}T00:00:00Z`).getTime() / 1000)
}

function nextDate(value: string) {
  const date = new Date(`${value}T00:00:00Z`)
  date.setUTCDate(date.getUTCDate() + 1)
  return date.toISOString().slice(0, 10)
}

export async function GET(request: Request) {
  const auth = await getAuthenticatedUserId()
  if (isNextResponse(auth)) return auth

  const params = new URL(request.url).searchParams
  const benchmark = params.get('benchmark') as BenchmarkKey | null
  const from = params.get('from')
  const to = params.get('to')
  const config = benchmark ? BENCHMARKS[benchmark] : undefined

  if (!config || !isDate(from) || !isDate(to)) {
    return NextResponse.json({ error: 'Benchmark o fechas no válidas' }, { status: 400 })
  }
  if (from > to || !Number.isFinite(dateToUnixSeconds(from)) || !Number.isFinite(dateToUnixSeconds(to))) {
    return NextResponse.json({ error: 'El intervalo de fechas no es válido' }, { status: 400 })
  }

  const chartUrl = new URL(`https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(config.symbol)}`)
  chartUrl.searchParams.set('period1', String(dateToUnixSeconds(from)))
  chartUrl.searchParams.set('period2', String(dateToUnixSeconds(nextDate(to))))
  chartUrl.searchParams.set('interval', '1d')
  chartUrl.searchParams.set('events', 'history')
  chartUrl.searchParams.set('includeAdjustedClose', 'true')

  try {
    const response = await fetch(chartUrl, {
      cache: 'no-store',
      headers: {
        Accept: 'application/json',
        'User-Agent': 'Finanzas Portfolio/1.0',
      },
    })
    if (!response.ok) {
      return NextResponse.json({ error: 'Yahoo Finance no respondió con datos' }, { status: 502 })
    }

    const payload = await response.json() as {
      chart?: {
        result?: Array<{
          timestamp?: number[]
          indicators?: {
            quote?: Array<{ close?: Array<number | null> }>
            adjclose?: Array<{ adjclose?: Array<number | null> }>
          }
        }>
      }
    }
    const result = payload.chart?.result?.[0]
    const timestamps = result?.timestamp ?? []
    const values = result?.indicators?.adjclose?.[0]?.adjclose ?? result?.indicators?.quote?.[0]?.close ?? []
    const points = timestamps
      .map((timestamp, index) => {
        const value = values[index]
        if (!Number.isFinite(timestamp) || typeof value !== 'number' || !Number.isFinite(value) || value <= 0) return null
        return { date: new Date(timestamp * 1000).toISOString().slice(0, 10), value }
      })
      .filter((point): point is { date: string; value: number } => point !== null)
      .filter((point, index, list) => index === list.findIndex((candidate) => candidate.date === point.date))

    if (points.length === 0) {
      return NextResponse.json({ error: 'Yahoo Finance no devolvió cierres para esas fechas' }, { status: 502 })
    }

    return NextResponse.json({
      benchmark,
      label: config.label,
      symbol: config.symbol,
      points,
      sourceUrl: `https://finance.yahoo.com/quote/${encodeURIComponent(config.symbol)}/history`,
    })
  } catch {
    return NextResponse.json({ error: 'No se pudo consultar Yahoo Finance' }, { status: 502 })
  }
}
