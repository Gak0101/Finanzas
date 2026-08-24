'use client'

import { useEffect, useMemo, useState } from 'react'
import {
  AlertTriangle,
  BarChart3,
  CalendarDays,
  CheckCircle2,
  Download,
  Info,
  Loader2,
  RefreshCw,
  Search,
  ShieldAlert,
  WalletCards,
} from 'lucide-react'
import {
  CartesianGrid,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Progress } from '@/components/ui/progress'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import type { InversionPosicion } from '@/lib/db/schema'
import type { ClosedInvestmentPosition } from '@/lib/inversiones/history'
import { BENCHMARKS, type BenchmarkKey, type BenchmarkPoint } from '@/lib/inversiones/benchmark'
import { inferTradingViewSymbol } from '@/lib/inversiones/instrumentIdentity'
import type {
  AllocationPoint,
  InvestmentAlert,
  InvestmentAnalytics,
  InvestmentFiscalYear,
  InvestmentSnapshotPoint,
} from '@/lib/inversiones/analytics'

type InvestmentAnalyticsPanelProps = {
  analytics: InvestmentAnalytics
  positions: InversionPosicion[]
  closedPositions: ClosedInvestmentPosition[]
  onRefresh: () => void | Promise<void>
  onOpenPosition: (positionId: number) => void
}

type SnapshotRange = '1M' | '3M' | 'YTD' | '1Y' | 'ALL'
type AllocationMode = 'type' | 'custody' | 'currency' | 'sector' | 'country'

type BenchmarkResponse = {
  benchmark: BenchmarkKey
  label: string
  symbol: string
  points: BenchmarkPoint[]
  sourceUrl: string
}

type MarketSearchResult = {
  key: string
  activo: string
  ticker: string
  tipo_activo: string
  price_ticker: string
  market_symbol: string | null
  isin: string | null
  exchange: string | null
  poseido: boolean
  posicion_id: number | null
}

type ComparisonPoint = {
  date: string
  portfolioReturnPct: number | null
  benchmarkReturnPct: number | null
}

type PortfolioCandlePoint = InvestmentSnapshotPoint & {
  open: number
  close: number
  high: number
  low: number
}

const SNAPSHOT_RANGES: Array<{ value: SnapshotRange; label: string }> = [
  { value: '1M', label: '1M' },
  { value: '3M', label: '3M' },
  { value: 'YTD', label: 'YTD' },
  { value: '1Y', label: '1A' },
  { value: 'ALL', label: 'Todo' },
]

const ALLOCATION_OPTIONS: Array<{ value: AllocationMode; label: string }> = [
  { value: 'type', label: 'Tipo' },
  { value: 'custody', label: 'Custodia' },
  { value: 'currency', label: 'Divisa' },
  { value: 'sector', label: 'Sector' },
  { value: 'country', label: 'País' },
]

const CHART_COLORS = ['#c8f56a', '#7e8bff', '#4ba88b', '#e7a35e', '#9b82d5', '#9aa5ae']

const EURO_FORMATTER = new Intl.NumberFormat('es-ES', {
  style: 'currency',
  currency: 'EUR',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

const COMPACT_EURO_FORMATTER = new Intl.NumberFormat('es-ES', {
  style: 'currency',
  currency: 'EUR',
  notation: 'compact',
  maximumFractionDigits: 1,
})

const DATE_FORMATTER = new Intl.DateTimeFormat('es-ES', {
  day: '2-digit',
  month: 'short',
})

function formatEuro(value: number | null | undefined) {
  return value === null || value === undefined || !Number.isFinite(value)
    ? '—'
    : EURO_FORMATTER.format(value)
}

function formatCompactEuro(value: number | null | undefined) {
  return value === null || value === undefined || !Number.isFinite(value)
    ? '—'
    : COMPACT_EURO_FORMATTER.format(value)
}

function formatPercent(value: number | null | undefined) {
  return value === null || value === undefined || !Number.isFinite(value)
    ? '—'
    : `${(value * 100).toFixed(1)}%`
}

function formatSnapshotDate(value: string) {
  const date = new Date(`${value}T12:00:00`)
  return Number.isFinite(date.getTime()) ? DATE_FORMATTER.format(date) : value
}

function csvCell(value: string | number) {
  const content = String(value).replaceAll('"', '""')
  return `"${content}"`
}

function exportFiscalCsv(fiscal: InvestmentFiscalYear) {
  const rows: Array<[string, string | number]> = [
    ['Ejercicio', fiscal.year],
    ['Compras registradas', fiscal.purchases],
    ['Importe de ventas', fiscal.saleProceeds],
    ['Ganancias realizadas', fiscal.realisedGains],
    ['Pérdidas realizadas', fiscal.realisedLosses],
    ['Resultado realizado neto', fiscal.realisedNet],
    ['Dividendos', fiscal.dividends],
    ['Bonificaciones', fiscal.bonuses],
    ['Comisiones', fiscal.commissions],
    ['Impuestos y retenciones', fiscal.taxes],
    ['Resultado neto registrado', fiscal.netRegistered],
    ['Operaciones de venta', fiscal.salesCount],
    ['Ventas sin coste conciliado', fiscal.unmatchedSales],
  ]
  const csv = `\uFEFFConcepto;Importe\r\n${rows.map((row) => row.map(csvCell).join(';')).join('\r\n')}`
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }))
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = `resumen-fiscal-inversiones-${fiscal.year}.csv`
  anchor.click()
  URL.revokeObjectURL(url)
}

function shiftMonths(date: Date, months: number) {
  const result = new Date(date)
  result.setUTCMonth(result.getUTCMonth() - months)
  return result
}

function filterSnapshots(history: InvestmentSnapshotPoint[], range: SnapshotRange) {
  const sorted = history.toSorted((left, right) => left.date.localeCompare(right.date))
  const last = sorted.at(-1)
  if (!last || range === 'ALL') return sorted

  const endDate = new Date(`${last.date}T00:00:00Z`)
  if (!Number.isFinite(endDate.getTime())) return sorted
  const startDate = range === 'YTD'
    ? new Date(Date.UTC(endDate.getUTCFullYear(), 0, 1))
    : range === '1M'
      ? shiftMonths(endDate, 1)
      : range === '3M'
        ? shiftMonths(endDate, 3)
        : shiftMonths(endDate, 12)

  return sorted.filter((point) => {
    const date = new Date(`${point.date}T00:00:00Z`)
    return Number.isFinite(date.getTime()) && date >= startDate && date <= endDate
  })
}

function buildPortfolioCandleSeries(points: InvestmentSnapshotPoint[], fullHistory: InvestmentSnapshotPoint[]) {
  const valued = points.filter((point): point is InvestmentSnapshotPoint & { value: number } => point.value !== null && point.value > 0)
  const allValued = fullHistory
    .filter((point): point is InvestmentSnapshotPoint & { value: number } => point.value !== null && point.value > 0)
    .toSorted((left, right) => left.date.localeCompare(right.date))

  return valued.map((point) => {
    const previous = allValued[allValued.findIndex((candidate) => candidate.date === point.date) - 1]
    const open = previous?.value ?? point.value
    const close = point.value
    return {
      ...point,
      open,
      close,
      high: Math.max(open, close),
      low: Math.min(open, close),
    }
  }) satisfies PortfolioCandlePoint[]
}

function snapshotRangeSummary(range: SnapshotRange, snapshots: InvestmentSnapshotPoint[], totalSnapshots: number) {
  if (snapshots.length === 0) return 'No hay valoraciones guardadas en este periodo.'
  const label = SNAPSHOT_RANGES.find((option) => option.value === range)?.label ?? range
  const dates = `${formatSnapshotDate(snapshots[0].date)} → ${formatSnapshotDate(snapshots.at(-1)!.date)}`
  const coverageNote = range !== 'ALL' && snapshots.length === totalSnapshots
    ? ' · Todo el histórico disponible cabe aquí'
    : ''
  return `${label} · ${snapshots.length} ${snapshots.length === 1 ? 'valoración' : 'valoraciones'} · ${dates}${coverageNote}`
}

function compactAllocation(points: AllocationPoint[]) {
  if (points.length <= 6) return points
  const primary = points.slice(0, 5)
  const rest = points.slice(5).reduce(
    (total, point) => ({ value: total.value + point.value, percent: total.percent + point.percent }),
    { value: 0, percent: 0 }
  )
  return [...primary, { name: 'Otros', ...rest }]
}

function benchmarkAtOrBefore(points: BenchmarkPoint[], date: string) {
  return points
    .filter((point) => point.date <= date)
    .at(-1)
}

function buildComparisonSeries(snapshots: InvestmentSnapshotPoint[], benchmarkPoints: BenchmarkPoint[]): ComparisonPoint[] {
  const valuedSnapshots = snapshots.filter((point): point is InvestmentSnapshotPoint & { value: number } => point.value !== null && point.value > 0)
  const firstSnapshot = valuedSnapshots[0]
  if (!firstSnapshot || benchmarkPoints.length === 0) return []

  const sortedBenchmarkPoints = benchmarkPoints.toSorted((left, right) => left.date.localeCompare(right.date))
  const benchmarkBase = benchmarkAtOrBefore(sortedBenchmarkPoints, firstSnapshot.date)
    ?? sortedBenchmarkPoints.find((point) => point.date >= firstSnapshot.date)
  if (!benchmarkBase || benchmarkBase.value <= 0) return []

  return valuedSnapshots.map((snapshot) => {
    const benchmark = benchmarkAtOrBefore(sortedBenchmarkPoints, snapshot.date)
    return {
      date: snapshot.date,
      portfolioReturnPct: snapshot.value / firstSnapshot.value - 1,
      benchmarkReturnPct: benchmark ? benchmark.value / benchmarkBase.value - 1 : null,
    }
  })
}

function alertStyle(severity: InvestmentAlert['severity']) {
  if (severity === 'critical') {
    return {
      wrapper: 'border-red-200 bg-red-50',
      icon: 'text-red-600',
      badge: 'border-red-200 bg-red-100 !text-red-700',
      label: 'Crítica',
    }
  }
  if (severity === 'warning') {
    return {
      wrapper: 'border-amber-200 bg-amber-50',
      icon: 'text-amber-600',
      badge: 'border-amber-200 bg-amber-100 !text-amber-700',
      label: 'Revisar',
    }
  }
  return {
    wrapper: 'border-sky-200 bg-sky-50',
    icon: 'text-sky-600',
    badge: 'border-sky-200 bg-sky-100 !text-sky-700',
    label: 'Información',
  }
}

function BenchmarkTooltip({
  active,
  payload,
}: {
  active?: boolean
  payload?: Array<{ payload?: ComparisonPoint }>
}) {
  const point = payload?.[0]?.payload
  if (!active || !point) return null
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-3 text-[11px] text-slate-600 shadow-xl">
      <p className="font-semibold text-slate-900">{formatSnapshotDate(point.date)}</p>
      <div className="mt-2 grid gap-1.5 tabular-nums">
        <p className="flex justify-between gap-6"><span>Tu cartera abierta</span><strong>{formatPercent(point.portfolioReturnPct)}</strong></p>
        <p className="flex justify-between gap-6"><span>Índice</span><strong>{formatPercent(point.benchmarkReturnPct)}</strong></p>
      </div>
    </div>
  )
}

function PortfolioCandlestickChart({ points }: { points: PortfolioCandlePoint[] }) {
  const chart = { left: 68, right: 986, top: 14, bottom: 258, labelY: 292 }
  const values = points.flatMap((point) => [point.high, point.low, point.knownCost]).filter((value) => Number.isFinite(value) && value > 0)
  const rawMin = Math.min(...values)
  const rawMax = Math.max(...values)
  const padding = Math.max((rawMax - rawMin) * 0.08, rawMax * 0.01, 1)
  const minValue = Math.max(0, rawMin - padding)
  const maxValue = rawMax + padding
  const scale = (value: number) => chart.top + ((maxValue - value) / (maxValue - minValue)) * (chart.bottom - chart.top)
  const xForIndex = (index: number) => points.length === 1
    ? (chart.left + chart.right) / 2
    : chart.left + (index / (points.length - 1)) * (chart.right - chart.left)
  const candleWidth = Math.max(10, Math.min(28, (chart.right - chart.left) / Math.max(points.length * 2.5, 1)))
  const ticks = Array.from({ length: 5 }, (_, index) => maxValue - ((maxValue - minValue) * index) / 4)
  const knownCostPoints = points.filter((point) => point.knownCost > 0)
  const knownCostPath = knownCostPoints.length > 0
    ? knownCostPoints.map((point) => {
        const index = points.findIndex((candidate) => candidate.date === point.date)
        return `${index === 0 ? 'M' : 'L'} ${xForIndex(index)} ${scale(point.knownCost)}`
      }).join(' ')
    : ''
  const labelStride = Math.max(1, Math.ceil(points.length / 5))

  return (
    <div className="h-[310px] w-full min-w-0 overflow-hidden rounded-lg bg-white">
      <svg viewBox="0 0 1000 310" className="h-full w-full" preserveAspectRatio="none" role="img" aria-label="Velas de variación del valor de la cartera">
        <title>Velas de variación del valor de la cartera</title>
        {ticks.map((tick) => {
          const y = scale(tick)
          return (
            <g key={tick}>
              <line x1={chart.left} x2={chart.right} y1={y} y2={y} stroke="#e3e1d9" strokeDasharray="3 3" />
              <text x={chart.left - 10} y={y + 4} textAnchor="end" fill="#7b8791" fontSize="11">{formatCompactEuro(tick)}</text>
            </g>
          )
        })}
        {knownCostPath ? <path d={knownCostPath} fill="none" stroke="#66727d" strokeDasharray="5 4" strokeWidth="1.5" /> : null}
        {points.map((point, index) => {
          const x = xForIndex(index)
          const openY = scale(point.open)
          const closeY = scale(point.close)
          const bodyTop = Math.min(openY, closeY)
          const bodyHeight = Math.max(Math.abs(closeY - openY), 4)
          const color = point.close >= point.open ? '#168261' : '#e0555d'
          return (
            <g key={point.date}>
              <title>{`${formatSnapshotDate(point.date)} · Apertura ${formatEuro(point.open)} · Cierre ${formatEuro(point.close)}`}</title>
              <line x1={x} x2={x} y1={scale(point.high)} y2={scale(point.low)} stroke={color} strokeWidth="2" />
              <rect x={x - candleWidth / 2} y={bodyTop - (bodyHeight === 4 ? 2 : 0)} width={candleWidth} height={bodyHeight} rx="1" fill={color} />
              {(index % labelStride === 0 || index === points.length - 1) ? <text x={x} y={chart.labelY} textAnchor="middle" fill="#7b8791" fontSize="11">{formatSnapshotDate(point.date)}</text> : null}
            </g>
          )
        })}
      </svg>
    </div>
  )
}

function tradingViewUrl(symbol: string) {
  const query = new URLSearchParams({
    symbol,
    interval: 'D',
    hidesidetoolbar: '1',
    symboledit: '0',
    saveimage: '0',
    toolbarbg: 'f7f5ef',
    theme: 'light',
    style: '1',
    timezone: 'Europe/Madrid',
    withdateranges: '1',
    hideideas: '1',
    hidelegend: '1',
    locale: 'es',
  })
  return `https://s.tradingview.com/widgetembed/?${query.toString()}`
}

function normalizeMarketIdentifier(value: string | null | undefined) {
  return value?.trim().toLocaleLowerCase('es') ?? ''
}

function positionMatchesMarketResult(position: InversionPosicion, result: MarketSearchResult) {
  const resultIdentifiers = [result.market_symbol, result.price_ticker, result.ticker]
    .map(normalizeMarketIdentifier)
    .filter(Boolean)
  return [position.market_symbol, position.price_ticker, position.ticker]
    .map(normalizeMarketIdentifier)
    .filter(Boolean)
    .some((identifier) => resultIdentifiers.includes(identifier))
}

function positionTradingViewSymbol(position: InversionPosicion) {
  return inferTradingViewSymbol(position.isin, position.market_symbol, position.price_ticker, position.ticker)
}

function marketResultTradingViewSymbol(result: MarketSearchResult) {
  return inferTradingViewSymbol(result.isin, result.market_symbol, result.price_ticker, result.ticker)
}

function FiscalMetric({ label, value, tone = 'default' }: { label: string; value: number; tone?: 'default' | 'positive' | 'negative' }) {
  const color = tone === 'positive' ? 'text-emerald-700' : tone === 'negative' ? 'text-red-600' : 'text-slate-900'
  return (
    <div className="rounded-lg border border-slate-200 bg-white/70 p-3">
      <p className="text-[11px] text-slate-500">{label}</p>
      <p className={`mt-1 text-sm font-semibold tabular-nums ${color}`}>{formatEuro(value)}</p>
    </div>
  )
}

export function InvestmentAnalyticsPanel({ analytics, positions, closedPositions, onRefresh, onOpenPosition }: InvestmentAnalyticsPanelProps) {
  const [snapshotRange, setSnapshotRange] = useState<SnapshotRange>('ALL')
  const [allocationMode, setAllocationMode] = useState<AllocationMode>('type')
  const [selectedFiscalYear, setSelectedFiscalYear] = useState(() => analytics.fiscalYears[0]?.year.toString() ?? '')
  const [selectedMarketPositionId, setSelectedMarketPositionId] = useState<number | null>(null)
  const [selectedMarketSearchResult, setSelectedMarketSearchResult] = useState<MarketSearchResult | null>(null)
  const [marketSearchQuery, setMarketSearchQuery] = useState('')
  const [marketSearchResults, setMarketSearchResults] = useState<MarketSearchResult[]>([])
  const [marketSearchState, setMarketSearchState] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle')
  const [marketSearchError, setMarketSearchError] = useState<string | null>(null)
  const [benchmarkKey, setBenchmarkKey] = useState<BenchmarkKey>('world')
  const [benchmarkState, setBenchmarkState] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle')
  const [benchmarkData, setBenchmarkData] = useState<BenchmarkResponse | null>(null)
  const [benchmarkError, setBenchmarkError] = useState<string | null>(null)

  const snapshots = useMemo(
    () => filterSnapshots(analytics.snapshotHistory, snapshotRange),
    [analytics.snapshotHistory, snapshotRange]
  )
  const candleSeries = useMemo(
    () => buildPortfolioCandleSeries(snapshots, analytics.snapshotHistory),
    [analytics.snapshotHistory, snapshots]
  )
  const uniqueSnapshotDates = useMemo(() => new Set(snapshots.map((point) => point.date)).size, [snapshots])
  const firstSnapshot = snapshots[0] ?? null
  const latestSnapshot = snapshots.at(-1) ?? null
  const valuedSnapshots = useMemo(
    () => snapshots.filter((point): point is InvestmentSnapshotPoint & { value: number } => point.value !== null && point.value > 0),
    [snapshots]
  )
  const benchmarkFromDate = valuedSnapshots[0]?.date ?? null
  const benchmarkToDate = valuedSnapshots.at(-1)?.date ?? null
  const snapshotDelta = uniqueSnapshotDates >= 2 && firstSnapshot && latestSnapshot && firstSnapshot.value !== null && latestSnapshot.value !== null
    ? latestSnapshot.value - firstSnapshot.value
    : null
  const snapshotDeltaPct = firstSnapshot?.value && snapshotDelta !== null && firstSnapshot.value > 0
    ? snapshotDelta / firstSnapshot.value
    : null
  const comparisonSeries = useMemo(
    () => buildComparisonSeries(snapshots, benchmarkData?.points ?? []),
    [snapshots, benchmarkData?.points]
  )

  useEffect(() => {
    if (valuedSnapshots.length < 2 || !benchmarkFromDate || !benchmarkToDate) {
      setBenchmarkState('idle')
      setBenchmarkData(null)
      setBenchmarkError(null)
      return
    }

    const controller = new AbortController()
    setBenchmarkState('loading')
    setBenchmarkData(null)
    setBenchmarkError(null)
    const query = new URLSearchParams({
      benchmark: benchmarkKey,
      from: benchmarkFromDate,
      to: benchmarkToDate,
    })

    void fetch(`/api/inversiones/benchmark?${query.toString()}`, { cache: 'no-store', signal: controller.signal })
      .then(async (response) => {
        const payload = await response.json() as Partial<BenchmarkResponse> & { error?: string }
        if (!response.ok || !Array.isArray(payload.points)) {
          throw new Error(payload.error || 'Yahoo Finance no devolvió datos')
        }
        setBenchmarkData({
          benchmark: benchmarkKey,
          label: payload.label || BENCHMARKS[benchmarkKey].label,
          symbol: payload.symbol || BENCHMARKS[benchmarkKey].symbol,
          points: payload.points,
          sourceUrl: payload.sourceUrl || `https://finance.yahoo.com/quote/${encodeURIComponent(BENCHMARKS[benchmarkKey].symbol)}/history`,
        })
        setBenchmarkState('ready')
      })
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === 'AbortError') return
        setBenchmarkState('error')
        setBenchmarkError(error instanceof Error ? error.message : 'No se pudo consultar Yahoo Finance')
      })

    return () => controller.abort()
  }, [benchmarkFromDate, benchmarkKey, benchmarkToDate, valuedSnapshots.length])

  const allocationSource = allocationMode === 'type'
    ? analytics.risk.byType
    : allocationMode === 'custody'
      ? analytics.risk.byCustody
      : allocationMode === 'currency'
        ? analytics.risk.byCurrency
        : allocationMode === 'sector'
          ? analytics.risk.bySector
          : analytics.risk.byCountry
  const allocationData = useMemo(() => compactAllocation(allocationSource), [allocationSource])
  const marketPositions = useMemo(
    () => positions.filter((position) => Boolean(positionTradingViewSymbol(position))),
    [positions]
  )
  const marketPosition = marketPositions.find((position) => position.id === selectedMarketPositionId) ?? marketPositions[0] ?? null
  const selectedMarketOwnedPosition = selectedMarketSearchResult
    ? marketPositions.find((position) => positionMatchesMarketResult(position, selectedMarketSearchResult)) ?? null
    : null
  const marketChartSymbol = selectedMarketSearchResult
    ? marketResultTradingViewSymbol(selectedMarketSearchResult)
    : marketPosition
      ? positionTradingViewSymbol(marketPosition)
      : null
  const marketChartName = selectedMarketSearchResult?.activo ?? marketPosition?.activo ?? ''
  const marketChartTicker = selectedMarketSearchResult?.ticker ?? marketPosition?.price_ticker ?? marketPosition?.ticker ?? ''
  const marketChartIsOwned = selectedMarketSearchResult
    ? selectedMarketSearchResult.poseido || Boolean(selectedMarketOwnedPosition)
    : Boolean(marketPosition)

  useEffect(() => {
    const query = marketSearchQuery.trim()
    if (query.length < 2) {
      setMarketSearchResults([])
      setMarketSearchState('idle')
      setMarketSearchError(null)
      return
    }

    const controller = new AbortController()
    const timeout = window.setTimeout(() => {
      setMarketSearchState('loading')
      setMarketSearchError(null)
      void fetch(`/api/inversiones/alertas/buscar-activo?q=${encodeURIComponent(query)}`, {
        cache: 'no-store',
        signal: controller.signal,
      })
        .then(async (response) => {
          const payload = await response.json() as { results?: MarketSearchResult[]; error?: string }
          if (!response.ok || !Array.isArray(payload.results)) {
            throw new Error(payload.error || 'No se pudo buscar el instrumento')
          }
          const chartableResults = payload.results.filter((result) => Boolean(marketResultTradingViewSymbol(result)))
          setMarketSearchResults(chartableResults.filter((result, index, results) => {
            const symbol = marketResultTradingViewSymbol(result)
            return results.findIndex((candidate) => marketResultTradingViewSymbol(candidate) === symbol) === index
          }))
          setMarketSearchState('ready')
        })
        .catch((error: unknown) => {
          if (error instanceof DOMException && error.name === 'AbortError') return
          setMarketSearchState('error')
          setMarketSearchError(error instanceof Error ? error.message : 'No se pudo buscar el instrumento')
        })
    }, 300)

    return () => {
      window.clearTimeout(timeout)
      controller.abort()
    }
  }, [marketSearchQuery])

  const fiscal = analytics.fiscalYears.find((year) => year.year.toString() === selectedFiscalYear)
    ?? analytics.fiscalYears[0]
  const costs = analytics.performance.commissions + analytics.performance.taxes
  const costCoverage = analytics.performance.coverage.totalPositions > 0
    ? analytics.performance.coverage.costPositions / analytics.performance.coverage.totalPositions
    : 0
  const incomeTotal = analytics.performance.dividends + analytics.performance.bonuses
  const bonusValue = analytics.performance.bonuses
  const historicalNetResult = analytics.performance.historicalNetResult
  const openAnnualizedReturnPct = analytics.performance.openAnnualizedReturnPct ?? null
  const openReturnCoverage = analytics.performance.openReturnCoverage ?? {
    totalPositions: analytics.performance.coverage.totalPositions,
    eligiblePositions: 0,
    coveredValue: 0,
    totalValue: analytics.performance.totalValue,
  }

  function runAlertAction(alert: InvestmentAlert) {
    if (alert.action === 'refresh') {
      void onRefresh()
      return
    }
    if (alert.positionId !== undefined) {
      onOpenPosition(alert.positionId)
      return
    }
    void onRefresh()
  }

  function selectMarketSearchResult(result: MarketSearchResult) {
    setSelectedMarketSearchResult(result)
    setSelectedMarketPositionId(result.posicion_id)
    setMarketSearchQuery('')
    setMarketSearchResults([])
    setMarketSearchState('idle')
  }

  return (
    <section className="grid gap-3" aria-label="Análisis de inversiones">
      <Card className="gap-0 border-0 bg-[#f7f5ef] py-0 text-slate-900 shadow-[0_12px_30px_rgba(0,0,0,.14)]">
        <CardHeader className="gap-2 border-b border-slate-200 px-5 py-5 sm:px-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-slate-400">Cartera abierta / operaciones realizadas</p>
              <CardTitle className="mt-2 text-lg tracking-[-0.04em]">Qué está generando tu resultado</CardTitle>
            </div>
            <Badge variant="outline" className="shrink-0 border-slate-200 bg-white text-[11px] !text-slate-700">
              Coste de compra: {analytics.performance.coverage.costPositions}/{analytics.performance.coverage.totalPositions}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="grid gap-3 px-5 py-5 sm:grid-cols-2 sm:px-6 xl:grid-cols-4">
          {[
            { label: 'Cartera abierta · P/L actual', value: analytics.performance.unrealisedPnl, detail: `${formatPercent(analytics.performance.currentReturnPct)} sobre el coste conocido` },
            { label: 'Ventas realizadas', value: analytics.performance.realisedPnl, detail: `${closedPositions.length} cierres completos abajo · también incluye ventas parciales` },
            { label: 'Ingresos registrados', value: incomeTotal, detail: `${formatEuro(analytics.performance.dividends)} dividendos · ${formatEuro(bonusValue)} bonificaciones` },
            { label: 'Costes registrados', value: -costs, detail: `${formatEuro(analytics.performance.commissions)} comisiones · ${formatEuro(analytics.performance.taxes)} impuestos` },
          ].map((item) => (
            <div key={item.label} className="rounded-lg border border-slate-200 bg-white/70 p-4">
              <p className="text-[11px] font-medium text-slate-500">{item.label}</p>
              <p className={`mt-2 text-xl font-semibold tracking-[-0.04em] tabular-nums ${item.value > 0 ? 'text-emerald-700' : item.value < 0 ? 'text-red-600' : 'text-slate-900'}`}>
                {item.value > 0 ? '+' : ''}{formatEuro(item.value)}
              </p>
              <p className="mt-2 text-[11px] leading-relaxed text-slate-400">{item.detail}</p>
            </div>
          ))}
          <div className="sm:col-span-2 xl:col-span-2 rounded-lg border border-slate-200 bg-[#eeece5] p-4">
            <p className="text-[11px] font-medium text-slate-600">TIR anualizada · toda la actividad</p>
            <p className={`mt-1 text-xl font-semibold tracking-[-0.04em] tabular-nums ${analytics.performance.annualizedReturnPct !== null ? analytics.performance.annualizedReturnPct >= 0 ? 'text-emerald-700' : 'text-red-600' : 'text-slate-700'}`}>
              {analytics.performance.annualizedReturnPct !== null ? formatPercent(analytics.performance.annualizedReturnPct) : 'Pendiente'}
            </p>
            <p className="mt-2 text-[11px] leading-relaxed text-slate-500">
              {analytics.performance.cashFlowCount > 0
                ? `${analytics.performance.cashFlowCount} movimientos${analytics.performance.firstCashFlowDate ? ` desde ${formatSnapshotDate(analytics.performance.firstCashFlowDate)}` : ''} · incluye ventas cerradas e ingresos.`
                : 'Necesita operaciones registradas y una valoración actual.'}
            </p>
            <p className="mt-3 border-t border-slate-200 pt-3 text-[11px] leading-relaxed text-slate-500">Es el ritmo anual histórico de toda la actividad, no solo de tu cartera abierta.</p>
          </div>
          <div className="sm:col-span-2 xl:col-span-2 rounded-lg border border-slate-200 bg-[#e8f0e3] p-4">
            <p className="text-[11px] font-medium text-slate-600">Equivalente anual · cartera abierta</p>
            <p className={`mt-1 text-xl font-semibold tracking-[-0.04em] tabular-nums ${openAnnualizedReturnPct !== null ? openAnnualizedReturnPct >= 0 ? 'text-emerald-700' : 'text-red-600' : 'text-slate-700'}`}>
              {openAnnualizedReturnPct !== null ? formatPercent(openAnnualizedReturnPct) : 'Pendiente'}
            </p>
            <p className="mt-2 text-[11px] leading-relaxed text-slate-500">
              {openReturnCoverage.eligiblePositions > 0
                ? `${openReturnCoverage.eligiblePositions} de ${openReturnCoverage.totalPositions} posiciones · ${formatEuro(openReturnCoverage.coveredValue)} de ${formatEuro(openReturnCoverage.totalValue)} cubiertos.`
                : 'Necesita coste, fecha y operaciones suficientes en las posiciones abiertas.'}
            </p>
            <p className="mt-3 border-t border-slate-200 pt-3 text-[11px] leading-relaxed text-slate-500">Anualiza lo observado en las posiciones con datos suficientes; no promete ese porcentaje para el próximo año.</p>
          </div>
          <div className="sm:col-span-2 xl:col-span-4">
            <div className="rounded-lg border border-slate-200 bg-white/60 p-3">
              <div className="flex flex-wrap items-center justify-between gap-2 text-[11px]">
                <span className="font-medium text-slate-600">Coste de compra identificado</span>
                <strong className="tabular-nums text-slate-900">{analytics.performance.coverage.costPositions} de {analytics.performance.coverage.totalPositions} posiciones · {formatPercent(costCoverage)}</strong>
              </div>
              <p className="mt-1 text-[11px] leading-relaxed text-slate-500">Solo esas posiciones tienen un importe de compra registrado para calcular su P/L. Los importes de esta tarjeta salen de la actividad guardada en la app; no son una estimación fiscal.</p>
              <Progress value={costCoverage * 100} className="mt-3 h-2 bg-slate-200 [&_[data-slot=progress-indicator]]:bg-[#7e8bff]" />
            </div>
            <p className="mt-3 text-[11px] leading-relaxed text-slate-500">Resultado realizado registrado: <strong className="text-slate-700">{formatEuro(historicalNetResult)}</strong> · combinado con la cartera abierta: <strong className="text-slate-700">{formatEuro(analytics.performance.totalNetResult)}</strong>.</p>
          </div>
        </CardContent>
      </Card>

      <Card className="gap-0 border-0 bg-[#f7f5ef] py-0 text-slate-900 shadow-[0_12px_30px_rgba(0,0,0,.14)]">
        <CardHeader className="gap-2 border-b border-slate-200 px-5 py-5 sm:px-6">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-slate-400">Control / acciones</p>
              <CardTitle className="mt-2 text-lg tracking-[-0.04em]">Alertas de cartera</CardTitle>
            </div>
            <Badge variant="outline" className="shrink-0 border-slate-200 bg-white text-[11px] !text-slate-700">
              {analytics.alerts.length} {analytics.alerts.length === 1 ? 'alerta' : 'alertas'}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="grid gap-3 px-5 py-5 sm:px-6">
          {analytics.alerts.length === 0 ? (
            <div className="flex items-start gap-3 rounded-lg border border-emerald-200 bg-emerald-50 p-4">
              <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-700" />
              <div>
                <p className="text-sm font-semibold text-emerald-900">No hay alertas pendientes</p>
                <p className="mt-1 text-[11px] leading-relaxed text-emerald-800">Los datos disponibles no requieren una acción inmediata.</p>
              </div>
            </div>
          ) : analytics.alerts.map((alert) => {
            const style = alertStyle(alert.severity)
            const AlertIcon = alert.severity === 'critical' ? ShieldAlert : alert.severity === 'warning' ? AlertTriangle : Info
            return (
              <div key={alert.id} className={`flex flex-col gap-3 rounded-lg border p-4 sm:flex-row sm:items-center sm:justify-between ${style.wrapper}`}>
                <div className="flex min-w-0 items-start gap-3">
                  <AlertIcon className={`mt-0.5 h-5 w-5 shrink-0 ${style.icon}`} />
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-sm font-semibold text-slate-900">{alert.title}</p>
                      <Badge variant="outline" className={`text-[11px] ${style.badge}`}>{style.label}</Badge>
                    </div>
                    <p className="mt-1 text-[11px] leading-relaxed text-slate-600">{alert.detail}</p>
                  </div>
                </div>
                <Button type="button" size="sm" variant="outline" className="min-h-9 shrink-0 border-slate-300 bg-white text-slate-800 hover:bg-slate-100" onClick={() => runAlertAction(alert)}>
                  {alert.action === 'refresh' ? <RefreshCw /> : <WalletCards />}
                  {alert.action === 'refresh' ? 'Actualizar' : alert.action === 'complete_data' ? 'Completar ficha' : alert.positionId ? 'Ver posición' : 'Actualizar datos'}
                </Button>
              </div>
            )
          })}
        </CardContent>
      </Card>

      <div className="grid gap-3 xl:grid-cols-[minmax(0,1.45fr)_minmax(340px,.8fr)]">
        <Card className="min-w-0 gap-0 border-0 bg-[#f7f5ef] py-0 text-slate-900 shadow-[0_12px_30px_rgba(0,0,0,.14)]">
          <CardHeader className="gap-4 border-b border-slate-200 px-5 py-5 sm:flex-row sm:items-end sm:justify-between sm:px-6">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-slate-400">Evolución / cartera abierta</p>
              <CardTitle className="mt-2 text-lg tracking-[-0.04em]">Valor de la cartera abierta</CardTitle>
            </div>
            <div className="min-w-[170px] text-left sm:text-right">
              <p className="text-[10px] font-medium uppercase tracking-[0.08em] text-slate-400">Última valoración</p>
              <p className="mt-1 text-lg font-semibold tabular-nums text-slate-900">{formatEuro(latestSnapshot?.value)}</p>
              {snapshotDelta !== null ? (
                <p className={`mt-1 text-[11px] font-semibold tabular-nums ${snapshotDelta >= 0 ? 'text-emerald-700' : 'text-red-600'}`}>
                  {snapshotDelta >= 0 ? '+' : ''}{formatEuro(snapshotDelta)}{snapshotDeltaPct !== null ? ` · ${formatPercent(snapshotDeltaPct)}` : ''} desde {formatSnapshotDate(firstSnapshot!.date)}
                </p>
              ) : (
                <p className="mt-1 text-[11px] text-slate-500">Necesitas dos valoraciones para comparar</p>
              )}
            </div>
            <div className="flex flex-wrap rounded-lg border border-slate-200 bg-[#eeece5] p-1" role="group" aria-label="Periodo del gráfico">
              {SNAPSHOT_RANGES.map((range) => (
                <button
                  key={range.value}
                  type="button"
                  aria-pressed={snapshotRange === range.value}
                  onClick={() => setSnapshotRange(range.value)}
                  className={`min-h-8 rounded-md px-3 text-[11px] font-semibold transition ${snapshotRange === range.value ? 'bg-slate-900 text-white shadow-sm' : 'text-slate-500 hover:text-slate-900'}`}
                >
                  {range.label}
                </button>
              ))}
            </div>
            <p className="text-right text-[10px] text-slate-400" aria-live="polite">{snapshotRangeSummary(snapshotRange, snapshots, analytics.snapshotHistory.length)}</p>
          </CardHeader>
          <CardContent className="px-5 py-5 sm:px-6">
            <p className="mb-4 max-w-2xl text-[11px] leading-relaxed text-slate-500">Suma de los activos abiertos con una valoración guardada en la app. Las posiciones cerradas no entran en esta curva.</p>
            {candleSeries.length < 2 ? (
              <div className="grid min-h-[300px] place-items-center rounded-xl border border-dashed border-slate-300 bg-white/50 p-6 text-center">
                <div className="max-w-md">
                  <CalendarDays className="mx-auto h-8 w-8 text-slate-400" />
                  <p className="mt-4 text-base font-semibold text-slate-900">El histórico empieza hoy</p>
                  <p className="mt-2 text-[11px] leading-relaxed text-slate-500">
                    Necesitas al menos dos valoraciones diarias con valor para dibujar las velas. Mañana se añadirá otra si todavía falta histórico; no reconstruimos ni estimamos precios ausentes.
                  </p>
                  {snapshots.length === 1 ? (
                    <p className="mt-3 text-[11px] font-medium text-slate-700">1 valoración guardada · {formatSnapshotDate(snapshots[0].date)} · {formatEuro(snapshots[0].value)}</p>
                  ) : null}
                </div>
              </div>
            ) : (
              <>
                <div className="mb-4 flex flex-wrap items-center gap-x-5 gap-y-2 text-[11px] text-slate-500">
                  <span className="inline-flex items-center gap-2"><span className="h-3 w-2 rounded-sm bg-[#168261]" />Velas de variación</span>
                  <span className="inline-flex items-center gap-2"><span className="h-0.5 w-4 bg-slate-500" />Coste conocido</span>
                  <span className="ml-auto tabular-nums">{candleSeries.length} fechas con valor</span>
                </div>
                <PortfolioCandlestickChart points={candleSeries} />
                <p className="mt-3 flex items-start gap-2 border-t border-slate-200 pt-3 text-[11px] leading-relaxed text-slate-500">
                  <Info className="mt-0.5 h-4 w-4 shrink-0" />Cada vela compara el cierre guardado anterior con la siguiente valoración diaria. No son velas intradía ni reconstruyen precios que la aplicación no haya guardado.
                </p>
              </>
            )}
            <div className="mt-5 grid gap-3 border-t border-slate-200 pt-5 sm:grid-cols-3">
              <div className="rounded-lg bg-white/60 p-3">
                <p className="text-[11px] text-slate-500">Caída actual desde máximo</p>
                <p className={`mt-1 text-base font-semibold tabular-nums ${analytics.risk.drawdown.currentPct !== null && analytics.risk.drawdown.currentPct < 0 ? 'text-red-600' : 'text-slate-900'}`}>
                  {analytics.risk.drawdown.currentPct !== null ? formatPercent(analytics.risk.drawdown.currentPct) : 'Pendiente'}
                </p>
                <p className="mt-1 text-[10px] leading-relaxed text-slate-500">Compara la última valoración con el máximo de la serie. Un 0% significa que está en el máximo.</p>
              </div>
              <div className="rounded-lg bg-white/60 p-3">
                <p className="text-[11px] text-slate-500">Peor caída registrada</p>
                <p className={`mt-1 text-base font-semibold tabular-nums ${analytics.risk.drawdown.maxPct !== null && analytics.risk.drawdown.maxPct < 0 ? 'text-red-600' : 'text-slate-900'}`}>
                  {analytics.risk.drawdown.maxPct !== null ? formatPercent(analytics.risk.drawdown.maxPct) : 'Pendiente'}
                </p>
                <p className="mt-1 text-[10px] leading-relaxed text-slate-500">Mayor descenso entre valoraciones guardadas.</p>
              </div>
              <div className="rounded-lg bg-white/60 p-3">
                <p className="text-[11px] text-slate-500">Máximo observado</p>
                <p className="mt-1 text-base font-semibold tabular-nums text-slate-900">{formatEuro(analytics.risk.drawdown.peakValue)}</p>
                <p className="mt-1 text-[10px] leading-relaxed text-slate-500">{analytics.risk.drawdown.peakDate ? `${formatSnapshotDate(analytics.risk.drawdown.peakDate)} · pico de referencia` : 'Necesita dos valoraciones'}</p>
              </div>
            </div>
            <div className="mt-5 border-t border-slate-200 pt-5">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-slate-400">Comparativa gratuita</p>
                  <h3 className="mt-1 text-sm font-semibold text-slate-900">¿Cómo va frente a un índice?</h3>
                  <p className="mt-1 max-w-xl text-[11px] leading-relaxed text-slate-500">Compara desde la primera valoración disponible con el cierre histórico del índice elegido en Yahoo Finance. No mezcla euros de tu cartera con el índice.</p>
                </div>
                <Select value={benchmarkKey} onValueChange={(value) => setBenchmarkKey(value as BenchmarkKey)} disabled={valuedSnapshots.length < 2 || benchmarkState === 'loading'}>
                  <SelectTrigger size="sm" className="min-w-40 border-slate-200 bg-white text-[11px] text-slate-700" aria-label="Índice de referencia">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="border-slate-200 bg-white text-slate-900">
                    {(Object.entries(BENCHMARKS) as Array<[BenchmarkKey, (typeof BENCHMARKS)[BenchmarkKey]]>).map(([key, option]) => (
                      <SelectItem key={key} value={key}>{option.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {valuedSnapshots.length < 2 ? (
                <div className="mt-4 rounded-lg border border-dashed border-slate-300 bg-white/50 p-4 text-[11px] leading-relaxed text-slate-500">Se activa cuando existan al menos dos valoraciones reales de la cartera abierta.</div>
              ) : benchmarkState === 'loading' ? (
                <div className="mt-4 rounded-lg border border-slate-200 bg-white/50 p-4 text-[11px] text-slate-500">Consultando cierres gratuitos de Yahoo Finance…</div>
              ) : benchmarkState === 'error' ? (
                <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-4 text-[11px] leading-relaxed text-amber-900">No se pudo consultar la referencia: {benchmarkError ?? 'respuesta no disponible'}.</div>
              ) : comparisonSeries.length >= 2 && benchmarkData ? (
                <>
                  <div className="mb-3 mt-4 flex flex-wrap items-center gap-x-5 gap-y-2 text-[11px] text-slate-500">
                    <span className="inline-flex items-center gap-2"><span className="h-0.5 w-4 bg-[#7e8bff]" />Tu cartera abierta</span>
                    <span className="inline-flex items-center gap-2"><span className="h-0.5 w-4 bg-[#4ba88b]" />{benchmarkData.label}</span>
                    <a className="ml-auto text-slate-500 underline decoration-slate-300 underline-offset-2 hover:text-slate-900" href={benchmarkData.sourceUrl} target="_blank" rel="noreferrer">Fuente Yahoo Finance</a>
                  </div>
                  <div className="h-[230px] w-full min-w-0">
                    <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0} initialDimension={{ width: 1, height: 1 }}>
                      <ComposedChart data={comparisonSeries} margin={{ top: 8, right: 8, bottom: 4, left: 0 }}>
                        <CartesianGrid vertical={false} stroke="#e3e1d9" strokeDasharray="3 3" />
                        <XAxis dataKey="date" axisLine={false} tickLine={false} minTickGap={28} tick={{ fill: '#7b8791', fontSize: 11 }} tickFormatter={formatSnapshotDate} />
                        <YAxis axisLine={false} tickLine={false} width={44} tick={{ fill: '#7b8791', fontSize: 11 }} tickFormatter={formatPercent} />
                        <Tooltip content={<BenchmarkTooltip />} />
                        <Line type="monotone" dataKey="portfolioReturnPct" stroke="#7e8bff" strokeWidth={2.5} dot={{ r: 3, fill: '#7e8bff', strokeWidth: 0 }} connectNulls={false} />
                        <Line type="monotone" dataKey="benchmarkReturnPct" stroke="#4ba88b" strokeWidth={2} dot={{ r: 2.5, fill: '#4ba88b', strokeWidth: 0 }} connectNulls={false} />
                      </ComposedChart>
                    </ResponsiveContainer>
                  </div>
                </>
              ) : (
                <div className="mt-4 rounded-lg border border-dashed border-slate-300 bg-white/50 p-4 text-[11px] leading-relaxed text-slate-500">Yahoo Finance no devolvió cierres comparables para estas fechas.</div>
              )}
            </div>
          </CardContent>
        </Card>

        <Card className="min-w-0 gap-0 border-0 bg-[#f7f5ef] py-0 text-slate-900 shadow-[0_12px_30px_rgba(0,0,0,.14)]">
          <CardHeader className="gap-4 border-b border-slate-200 px-5 py-5 sm:flex-row sm:items-end sm:justify-between sm:px-6">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-slate-400">Distribución / riesgo</p>
              <CardTitle className="mt-2 text-lg tracking-[-0.04em]">Concentración</CardTitle>
            </div>
            <Select value={allocationMode} onValueChange={(value) => setAllocationMode(value as AllocationMode)}>
              <SelectTrigger size="sm" className="min-w-32 border-slate-200 bg-white text-[11px] text-slate-700">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="border-slate-200 bg-white text-slate-900">
                {ALLOCATION_OPTIONS.map((option) => <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </CardHeader>
          <CardContent className="px-5 py-5 sm:px-6">
            {allocationData.length === 0 || allocationData.every((point) => point.value === 0) ? (
              <div className="grid min-h-[230px] place-items-center rounded-xl border border-dashed border-slate-300 bg-white/50 p-6 text-center">
                <div>
                  <BarChart3 className="mx-auto h-8 w-8 text-slate-400" />
                  <p className="mt-3 text-sm font-semibold">Sin datos de distribución</p>
                  <p className="mt-1 text-[11px] text-slate-500">Completa el valor y la clasificación de las posiciones.</p>
                </div>
              </div>
            ) : (
              <div className="grid gap-4">
                <p className="text-[11px] leading-relaxed text-slate-500">Peso sobre el valor actual de la cartera. Las barras muestran dónde está concentrado el dinero.</p>
                <div className="grid gap-3">
                  {allocationData.map((point, index) => (
                    <div key={point.name} className="grid gap-1.5">
                      <div className="flex items-center justify-between gap-3 text-[11px]">
                        <span className="flex min-w-0 items-center gap-2 font-medium text-slate-700"><span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: CHART_COLORS[index % CHART_COLORS.length] }} /><span className="truncate">{point.name}</span></span>
                        <span className="shrink-0 tabular-nums font-semibold text-slate-900">{formatPercent(point.percent)}</span>
                      </div>
                      <div className="h-2 overflow-hidden rounded-full bg-slate-200"><div className="h-full rounded-full" style={{ width: `${Math.max(1, point.percent * 100)}%`, backgroundColor: CHART_COLORS[index % CHART_COLORS.length] }} /></div>
                    </div>
                  ))}
                </div>
              </div>
            )}
            <div className="mt-5 grid grid-cols-3 gap-2 border-t border-slate-200 pt-4">
              <div><p className="text-[11px] text-slate-400">Top 1</p><strong className="mt-1 block text-sm tabular-nums">{formatPercent(analytics.risk.top1Pct)}</strong></div>
              <div><p className="text-[11px] text-slate-400">Top 3</p><strong className="mt-1 block text-sm tabular-nums">{formatPercent(analytics.risk.top3Pct)}</strong></div>
              <div><p className="text-[11px] text-slate-400">Crypto</p><strong className="mt-1 block text-sm tabular-nums">{formatPercent(analytics.risk.cryptoPct)}</strong></div>
            </div>
            <div className="mt-3 flex items-center justify-between gap-3 rounded-lg bg-[#eeece5] p-3 text-[11px]">
              <span className="text-slate-600">Nivel de concentración · 3 mayores: {formatPercent(analytics.risk.top3Pct)}</span>
              <Badge className={analytics.risk.level === 'Alta' ? 'bg-red-100 text-red-700' : analytics.risk.level === 'Media' ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700'}>{analytics.risk.level}</Badge>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="gap-0 border-0 bg-[#f7f5ef] py-0 text-slate-900 shadow-[0_12px_30px_rgba(0,0,0,.14)]">
        <CardHeader className="gap-4 border-b border-slate-200 px-5 py-5 sm:px-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-slate-400">Mercado / referencia</p>
              <CardTitle className="mt-2 flex items-center gap-2 text-lg tracking-[-0.04em]"><BarChart3 className="h-5 w-5 text-[#7e8bff]" />Gráfico de mercado</CardTitle>
            </div>
            {marketChartSymbol ? (
              <div className="flex shrink-0 flex-wrap items-center gap-2">
                <Badge className={marketChartIsOwned ? 'border-0 bg-[#dfffa1] text-[10px] font-bold uppercase tracking-[0.08em] text-[#35501d]' : 'border border-slate-200 bg-white text-[10px] font-semibold text-slate-500'}>
                  {marketChartIsOwned ? 'En cartera' : 'Vista externa'}
                </Badge>
                <span className="text-[10px] font-semibold text-slate-500">TradingView · {marketChartSymbol}</span>
              </div>
            ) : null}
          </div>
          <div className="grid gap-2 md:grid-cols-[minmax(0,1fr)_minmax(220px,auto)]">
            <div className="relative">
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <Input
                  value={marketSearchQuery}
                  onChange={(event) => setMarketSearchQuery(event.target.value)}
                  placeholder="Busca AAPL, SXR8, Nasdaq…"
                  aria-label="Buscar instrumento para el gráfico de mercado"
                  className="h-9 border-slate-200 bg-white pl-9 text-[11px] text-slate-700 placeholder:text-slate-400"
                />
              </div>
              {marketSearchQuery.trim().length >= 2 ? (
                <div role="listbox" aria-label="Resultados de búsqueda de instrumentos" className="absolute left-0 right-0 top-full z-30 mt-1 max-h-72 overflow-y-auto rounded-xl border border-slate-200 bg-white p-1.5 text-slate-900 shadow-xl">
                  {marketSearchState === 'loading' ? (
                    <div className="flex items-center gap-2 px-3 py-3 text-[11px] text-slate-500"><Loader2 className="h-4 w-4 animate-spin" />Buscando instrumentos…</div>
                  ) : marketSearchState === 'error' ? (
                    <div className="px-3 py-3 text-[11px] text-red-600">{marketSearchError || 'No se pudo completar la búsqueda.'}</div>
                  ) : marketSearchResults.length > 0 ? (
                    marketSearchResults.map((result) => {
                      const owned = result.poseido || marketPositions.some((position) => positionMatchesMarketResult(position, result))
                      return (
                        <button
                          key={result.key}
                          type="button"
                          role="option"
                          aria-selected={false}
                          onClick={() => selectMarketSearchResult(result)}
                          className="flex w-full items-center justify-between gap-3 rounded-lg px-3 py-2.5 text-left transition hover:bg-[#f1f8df]"
                        >
                          <span className="min-w-0">
                            <span className="flex items-center gap-2">
                              <span className="truncate text-[11px] font-semibold text-slate-900">{result.ticker}</span>
                              {owned ? <span className="shrink-0 rounded-full bg-[#dfffa1] px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-[0.08em] text-[#35501d]">En cartera</span> : null}
                            </span>
                            <span className="mt-0.5 block truncate text-[10px] text-slate-500">{result.activo}</span>
                          </span>
                          <span className="shrink-0 text-[9px] text-slate-400">{result.exchange || result.tipo_activo}</span>
                        </button>
                      )
                    })
                  ) : marketSearchState === 'ready' ? (
                    <div className="px-3 py-3 text-[11px] text-slate-500">No se encontraron instrumentos con gráfico disponible.</div>
                  ) : null}
                </div>
              ) : null}
            </div>
            {marketPositions.length > 0 ? (
              <Select
                value={selectedMarketSearchResult ? '' : String(marketPosition?.id ?? '')}
                onValueChange={(value) => {
                  setSelectedMarketSearchResult(null)
                  setSelectedMarketPositionId(Number(value))
                }}
              >
                <SelectTrigger size="sm" className="w-full border-slate-200 bg-white text-[11px] text-slate-700" aria-label="Activo de la cartera para el gráfico de mercado">
                  <SelectValue placeholder="Elegir activo de tu cartera" />
                </SelectTrigger>
                <SelectContent className="border-slate-200 bg-white text-slate-900">
                  {marketPositions.map((position) => (
                    <SelectItem key={position.id} value={String(position.id)}>
                      <span className="flex min-w-0 items-center gap-2">
                        <span className="h-2 w-2 shrink-0 rounded-full bg-[#c8f56a]" />
                        <span className="truncate">{position.price_ticker || position.ticker} · {position.activo}</span>
                        <span className="ml-auto shrink-0 text-[8px] font-bold uppercase tracking-[0.08em] text-[#587c2a]">En cartera</span>
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : null}
          </div>
          <p className="text-[10px] leading-relaxed text-slate-500">Busca acciones, ETF o índices y ábrelos aquí sin salir de la aplicación. Las posiciones de tu cartera se identifican en verde lima.</p>
        </CardHeader>
        <CardContent className="px-5 py-5 sm:px-6">
          {marketChartSymbol ? (
            <>
              <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
                <iframe
                  key={marketChartSymbol}
                  title={`Gráfico de mercado de ${marketChartName || marketChartTicker}`}
                  src={tradingViewUrl(marketChartSymbol)}
                  className="h-[320px] w-full border-0 sm:h-[380px]"
                  loading="lazy"
                  referrerPolicy="no-referrer-when-downgrade"
                />
              </div>
              <p className="mt-3 flex items-start gap-2 text-[11px] leading-relaxed text-slate-500"><Info className="mt-0.5 h-4 w-4 shrink-0" />Widget gratuito de TradingView para el instrumento seleccionado. Es un gráfico de mercado, no una reconstrucción del valor agregado de tu cartera.</p>
            </>
          ) : (
            <div className="grid min-h-32 place-items-center rounded-xl border border-dashed border-slate-300 bg-white/50 p-6 text-center text-[11px] text-slate-500">Busca un instrumento arriba o configura un símbolo de mercado en una posición para mostrar su gráfico.</div>
          )}
        </CardContent>
      </Card>

      <Card className="gap-0 border-0 bg-[#f7f5ef] py-0 text-slate-900 shadow-[0_12px_30px_rgba(0,0,0,.14)]">
        <CardHeader className="gap-4 border-b border-slate-200 px-5 py-5 sm:flex-row sm:items-end sm:justify-between sm:px-6">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-slate-400">Fiscalidad / operaciones registradas</p>
            <CardTitle className="mt-2 text-lg tracking-[-0.04em]">Resumen anual</CardTitle>
          </div>
          {analytics.fiscalYears.length > 0 ? (
            <div className="flex flex-wrap items-center gap-2">
              <Select value={fiscal?.year.toString() ?? selectedFiscalYear} onValueChange={setSelectedFiscalYear}>
                <SelectTrigger size="sm" className="min-w-28 border-slate-200 bg-white text-[11px] text-slate-700" aria-label="Ejercicio fiscal">
                  <SelectValue placeholder="Ejercicio" />
                </SelectTrigger>
                <SelectContent className="border-slate-200 bg-white text-slate-900">
                  {analytics.fiscalYears.map((year) => <SelectItem key={year.year} value={year.year.toString()}>{year.year}</SelectItem>)}
                </SelectContent>
              </Select>
              <Button type="button" size="sm" variant="outline" className="min-h-8 border-slate-200 bg-white text-slate-700" disabled={!fiscal} onClick={() => fiscal && exportFiscalCsv(fiscal)}>
                <Download />Exportar CSV
              </Button>
            </div>
          ) : null}
        </CardHeader>
        <CardContent className="px-5 py-5 sm:px-6">
          {!fiscal ? (
            <div className="grid min-h-40 place-items-center rounded-xl border border-dashed border-slate-300 bg-white/50 p-6 text-center">
              <div>
                <BarChart3 className="mx-auto h-8 w-8 text-slate-400" />
                <p className="mt-3 text-sm font-semibold">Sin operaciones para resumir</p>
                <p className="mt-1 text-[11px] text-slate-500">El resumen aparecerá cuando existan compras, ventas, dividendos o costes registrados.</p>
              </div>
            </div>
          ) : (
            <>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <FiscalMetric label="Ganancias realizadas" value={fiscal.realisedGains} tone="positive" />
                <FiscalMetric label="Pérdidas realizadas" value={fiscal.realisedLosses} tone="negative" />
                <FiscalMetric label="Dividendos" value={fiscal.dividends} />
                <FiscalMetric label="Retenciones e impuestos" value={-fiscal.taxes} tone="negative" />
                <FiscalMetric label="Importe de ventas" value={fiscal.saleProceeds} />
                <FiscalMetric label="Comisiones" value={-fiscal.commissions} tone="negative" />
                <FiscalMetric label="Bonificaciones" value={fiscal.bonuses} />
                <FiscalMetric label="Resultado neto registrado" value={fiscal.netRegistered} tone={fiscal.netRegistered >= 0 ? 'positive' : 'negative'} />
              </div>
              {fiscal.unmatchedSales > 0 ? (
                <div className="mt-4 flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 p-4 text-[11px] text-amber-900">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                  <p><strong>{fiscal.unmatchedSales} ventas sin coste conciliado.</strong> El resultado realizado del ejercicio puede estar incompleto.</p>
                </div>
              ) : null}
              <p className="mt-4 flex items-start gap-2 border-t border-slate-200 pt-4 text-[11px] leading-relaxed text-slate-500">
                <Info className="mt-0.5 h-4 w-4 shrink-0" />
                Estimación basada exclusivamente en las operaciones registradas. Puede no coincidir con el resultado fiscal definitivo y no sustituye la documentación del broker.
              </p>
            </>
          )}
        </CardContent>
      </Card>
    </section>
  )
}
