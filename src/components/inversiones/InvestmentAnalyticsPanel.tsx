'use client'

import { useMemo, useState } from 'react'
import {
  AlertTriangle,
  BarChart3,
  CalendarDays,
  CheckCircle2,
  Download,
  Info,
  RefreshCw,
  ShieldAlert,
  WalletCards,
} from 'lucide-react'
import {
  Area,
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

function compactAllocation(points: AllocationPoint[]) {
  if (points.length <= 6) return points
  const primary = points.slice(0, 5)
  const rest = points.slice(5).reduce(
    (total, point) => ({ value: total.value + point.value, percent: total.percent + point.percent }),
    { value: 0, percent: 0 }
  )
  return [...primary, { name: 'Otros', ...rest }]
}

function alertStyle(severity: InvestmentAlert['severity']) {
  if (severity === 'critical') {
    return {
      wrapper: 'border-red-200 bg-red-50',
      icon: 'text-red-600',
      badge: 'border-red-200 bg-red-100 text-red-700',
      label: 'Crítica',
    }
  }
  if (severity === 'warning') {
    return {
      wrapper: 'border-amber-200 bg-amber-50',
      icon: 'text-amber-600',
      badge: 'border-amber-200 bg-amber-100 text-amber-700',
      label: 'Revisar',
    }
  }
  return {
    wrapper: 'border-sky-200 bg-sky-50',
    icon: 'text-sky-600',
    badge: 'border-sky-200 bg-sky-100 text-sky-700',
    label: 'Información',
  }
}

function SnapshotTooltip({
  active,
  payload,
}: {
  active?: boolean
  payload?: Array<{ payload?: InvestmentSnapshotPoint }>
}) {
  const point = payload?.[0]?.payload
  if (!active || !point) return null
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-3 text-[11px] text-slate-600 shadow-xl">
      <p className="font-semibold text-slate-900">{formatSnapshotDate(point.date)}</p>
      <div className="mt-2 grid gap-1.5 tabular-nums">
        <p className="flex justify-between gap-6"><span>Valor</span><strong>{formatEuro(point.value)}</strong></p>
        <p className="flex justify-between gap-6"><span>Coste conocido</span><strong>{formatEuro(point.knownCost)}</strong></p>
        <p className="flex justify-between gap-6"><span>P/L no realizado</span><strong>{formatEuro(point.unrealisedPnl)}</strong></p>
        <p className="flex justify-between gap-6"><span>Cobertura</span><strong>{formatPercent(point.coveragePct)}</strong></p>
      </div>
    </div>
  )
}

function tradingViewUrl(symbol: string) {
  const tradingViewSymbol = symbol.endsWith('.DE') ? `XETR:${symbol.slice(0, -3)}` : symbol
  const query = new URLSearchParams({
    symbol: tradingViewSymbol,
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

  const snapshots = useMemo(
    () => filterSnapshots(analytics.snapshotHistory, snapshotRange),
    [analytics.snapshotHistory, snapshotRange]
  )
  const uniqueSnapshotDates = useMemo(() => new Set(snapshots.map((point) => point.date)).size, [snapshots])

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
    () => positions.filter((position) => Boolean(position.market_symbol)),
    [positions]
  )
  const marketPosition = marketPositions.find((position) => position.id === selectedMarketPositionId) ?? marketPositions[0] ?? null

  const fiscal = analytics.fiscalYears.find((year) => year.year.toString() === selectedFiscalYear)
    ?? analytics.fiscalYears[0]
  const costs = analytics.performance.commissions + analytics.performance.taxes
  const costCoverage = analytics.performance.coverage.totalPositions > 0
    ? analytics.performance.coverage.costPositions / analytics.performance.coverage.totalPositions
    : 0
  const incomeTotal = analytics.performance.dividends + analytics.performance.bonuses
  const bonusValue = analytics.performance.bonuses
  const historicalNetResult = analytics.performance.historicalNetResult

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

  return (
    <section className="grid gap-3" aria-label="Análisis de inversiones">
      <Card className="gap-0 border-0 bg-[#f7f5ef] py-0 text-slate-900 shadow-[0_12px_30px_rgba(0,0,0,.14)]">
        <CardHeader className="gap-2 border-b border-slate-200 px-5 py-5 sm:px-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-slate-400">Cartera abierta / histórico</p>
              <CardTitle className="mt-2 text-lg tracking-[-0.04em]">Qué está generando tu resultado</CardTitle>
            </div>
            <Badge variant="outline" className="border-slate-200 bg-white text-[11px] text-slate-600">
              Coste de compra: {analytics.performance.coverage.costPositions}/{analytics.performance.coverage.totalPositions}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="grid gap-3 px-5 py-5 sm:grid-cols-2 sm:px-6 xl:grid-cols-4">
          {[
            { label: 'Cartera abierta · P/L actual', value: analytics.performance.unrealisedPnl, detail: `${formatPercent(analytics.performance.currentReturnPct)} sobre el coste conocido` },
            { label: 'Ventas realizadas', value: analytics.performance.realisedPnl, detail: `${closedPositions.length} ciclos cerrados abajo; incluye ventas parciales` },
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
          <div className="sm:col-span-2 xl:col-span-4">
            <div className="rounded-lg border border-slate-200 bg-white/60 p-3">
              <div className="flex flex-wrap items-center justify-between gap-2 text-[11px]">
                <span className="font-medium text-slate-600">Coste de compra identificado</span>
                <strong className="tabular-nums text-slate-900">{analytics.performance.coverage.costPositions} de {analytics.performance.coverage.totalPositions} posiciones · {formatPercent(costCoverage)}</strong>
              </div>
              <p className="mt-1 text-[11px] leading-relaxed text-slate-500">Solo esas posiciones tienen un importe de compra registrado para calcular su P/L. Los importes de esta tarjeta salen de la actividad guardada en la app; no son una estimación fiscal.</p>
              <Progress value={costCoverage * 100} className="mt-3 h-2 bg-slate-200 [&_[data-slot=progress-indicator]]:bg-[#7e8bff]" />
            </div>
            <p className="mt-3 text-[11px] leading-relaxed text-slate-500">Resultado histórico registrado: <strong className="text-slate-700">{formatEuro(historicalNetResult)}</strong> · combinado con la cartera abierta: <strong className="text-slate-700">{formatEuro(analytics.performance.totalNetResult)}</strong>.</p>
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
            <Badge variant="outline" className="border-slate-200 bg-white text-[11px] text-slate-600">
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
              <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-slate-400">Histórico / snapshots</p>
              <CardTitle className="mt-2 text-lg tracking-[-0.04em]">Evolución de la cartera</CardTitle>
            </div>
            <div className="flex flex-wrap rounded-lg border border-slate-200 bg-[#eeece5] p-1" aria-label="Periodo del gráfico">
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
          </CardHeader>
          <CardContent className="px-5 py-5 sm:px-6">
            {uniqueSnapshotDates < 2 ? (
              <div className="grid min-h-[300px] place-items-center rounded-xl border border-dashed border-slate-300 bg-white/50 p-6 text-center">
                <div className="max-w-md">
                  <CalendarDays className="mx-auto h-8 w-8 text-slate-400" />
                  <p className="mt-4 text-base font-semibold text-slate-900">El histórico empieza hoy</p>
                  <p className="mt-2 text-[11px] leading-relaxed text-slate-500">
                    Es normal que todavía no haya una curva: solo existe una valoración guardada. Mañana se añadirá otra y podrás comparar la evolución real de tu cartera. No reconstruimos ni estimamos precios ausentes.
                  </p>
                  {snapshots.length === 1 ? (
                    <p className="mt-3 text-[11px] font-medium text-slate-700">1 valoración guardada · {formatSnapshotDate(snapshots[0].date)} · {formatEuro(snapshots[0].value)}</p>
                  ) : null}
                </div>
              </div>
            ) : (
              <>
                <div className="mb-4 flex flex-wrap items-center gap-x-5 gap-y-2 text-[11px] text-slate-500">
                  <span className="inline-flex items-center gap-2"><span className="h-2 w-2 rounded-full bg-[#7e8bff]" />Valor de mercado</span>
                  <span className="inline-flex items-center gap-2"><span className="h-0.5 w-4 bg-slate-500" />Coste conocido</span>
                  <span className="ml-auto tabular-nums">{snapshots.length} fechas</span>
                </div>
                <div className="h-[310px] w-full min-w-0">
                  <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0} initialDimension={{ width: 1, height: 1 }}>
                    <ComposedChart data={snapshots} margin={{ top: 8, right: 8, bottom: 4, left: 0 }}>
                      <defs>
                        <linearGradient id="investment-value-gradient" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#7e8bff" stopOpacity={0.3} />
                          <stop offset="95%" stopColor="#7e8bff" stopOpacity={0.02} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid vertical={false} stroke="#e3e1d9" strokeDasharray="3 3" />
                      <XAxis dataKey="date" axisLine={false} tickLine={false} minTickGap={28} tick={{ fill: '#7b8791', fontSize: 11 }} tickFormatter={formatSnapshotDate} />
                      <YAxis axisLine={false} tickLine={false} width={52} tick={{ fill: '#7b8791', fontSize: 11 }} tickFormatter={formatCompactEuro} />
                      <Tooltip content={<SnapshotTooltip />} />
                      <Area type="monotone" dataKey="value" stroke="#7e8bff" strokeWidth={2.5} fill="url(#investment-value-gradient)" connectNulls={false} />
                      <Line type="monotone" dataKey="knownCost" stroke="#66727d" strokeWidth={1.5} strokeDasharray="5 4" dot={false} />
                    </ComposedChart>
                  </ResponsiveContainer>
                </div>
                <p className="mt-3 flex items-start gap-2 border-t border-slate-200 pt-3 text-[11px] leading-relaxed text-slate-500">
                  <Info className="mt-0.5 h-4 w-4 shrink-0" />Solo se muestran valoraciones realmente guardadas; los huecos permanecen vacíos.
                </p>
              </>
            )}
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
        <CardHeader className="gap-4 border-b border-slate-200 px-5 py-5 sm:flex-row sm:items-end sm:justify-between sm:px-6">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-slate-400">Mercado / referencia</p>
            <CardTitle className="mt-2 flex items-center gap-2 text-lg tracking-[-0.04em]"><BarChart3 className="h-5 w-5 text-[#7e8bff]" />Gráfico de mercado</CardTitle>
          </div>
          {marketPositions.length > 0 ? (
            <Select value={String(marketPosition?.id ?? '')} onValueChange={(value) => setSelectedMarketPositionId(Number(value))}>
              <SelectTrigger size="sm" className="min-w-52 border-slate-200 bg-white text-[11px] text-slate-700" aria-label="Activo del gráfico de mercado">
                <SelectValue placeholder="Elegir activo" />
              </SelectTrigger>
              <SelectContent className="border-slate-200 bg-white text-slate-900">
                {marketPositions.map((position) => <SelectItem key={position.id} value={String(position.id)}>{position.price_ticker || position.ticker} · {position.activo}</SelectItem>)}
              </SelectContent>
            </Select>
          ) : null}
        </CardHeader>
        <CardContent className="px-5 py-5 sm:px-6">
          {marketPosition?.market_symbol ? (
            <>
              <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
                <iframe
                  key={marketPosition.market_symbol}
                  title={`Gráfico de mercado de ${marketPosition.activo}`}
                  src={tradingViewUrl(marketPosition.market_symbol)}
                  className="h-[320px] w-full border-0 sm:h-[380px]"
                  loading="lazy"
                  referrerPolicy="no-referrer-when-downgrade"
                />
              </div>
              <p className="mt-3 flex items-start gap-2 text-[11px] leading-relaxed text-slate-500"><Info className="mt-0.5 h-4 w-4 shrink-0" />Widget gratuito de TradingView para el activo seleccionado. Es un gráfico de mercado, no una reconstrucción del valor agregado de tu cartera.</p>
            </>
          ) : (
            <div className="grid min-h-32 place-items-center rounded-xl border border-dashed border-slate-300 bg-white/50 p-6 text-center text-[11px] text-slate-500">Configura un símbolo de mercado en una posición para mostrar su gráfico.</div>
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
