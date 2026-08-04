'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import {
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  ArrowUpRight,
  BarChart3,
  CalendarDays,
  CheckCircle2,
  ChevronDown,
  ChevronsUpDown,
  CircleDollarSign,
  Clock3,
  Download,
  Info,
  Plus,
  RefreshCw,
  Search,
  ShieldCheck,
  Wallet,
} from 'lucide-react'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import type { InversionOperacion, InversionPosicion } from '@/lib/db/schema'
import type { ClosedInvestmentPosition } from '@/lib/inversiones/history'
import { StockFinder } from '@/components/buscador-acciones/StockFinder'

type PortfolioData = {
  positions: InversionPosicion[]
  operations: InversionOperacion[]
  closedPositions: ClosedInvestmentPosition[]
}

type ChartMode = 'valor' | 'pnl'
type OperationType = 'Compra' | 'Venta' | 'Dividendo' | 'Aportación' | 'Traspaso'
type InvestmentTab = 'portfolio' | 'buscador'
type PositionSort =
  | 'name_asc'
  | 'name_desc'
  | 'type_asc'
  | 'type_desc'
  | 'price_desc'
  | 'price_asc'
  | 'value_desc'
  | 'value_asc'
  | 'pnl_desc'
  | 'pnl_asc'
  | 'return_desc'
  | 'return_asc'
  | 'annual_desc'
  | 'annual_asc'
  | 'oldest'
  | 'newest'
  | 'source_asc'
  | 'source_desc'

const TYPE_COLORS: Record<string, string> = {
  Crypto: '#c8f56a',
  'Crypto / Staking': '#e7a35e',
  ETF: '#7e8bff',
  Acción: '#4ba88b',
  Fondo: '#9b82d5',
  Otro: '#9aa5ae',
}

const OPERATION_TYPES: OperationType[] = ['Compra', 'Venta', 'Dividendo', 'Aportación', 'Traspaso']

const POSITION_SORT_OPTIONS: Array<{ value: PositionSort; label: string }> = [
  { value: 'value_desc', label: 'Mayor valor' },
  { value: 'value_asc', label: 'Menor valor' },
  { value: 'pnl_desc', label: 'Mayor P / L' },
  { value: 'pnl_asc', label: 'Menor P / L' },
  { value: 'return_desc', label: 'Mayor rentabilidad' },
  { value: 'return_asc', label: 'Menor rentabilidad' },
  { value: 'annual_desc', label: 'Mayor rent. anual equiv.' },
  { value: 'annual_asc', label: 'Menor rent. anual equiv.' },
  { value: 'price_desc', label: 'Mayor precio' },
  { value: 'price_asc', label: 'Menor precio' },
  { value: 'oldest', label: 'Más antiguas' },
  { value: 'newest', label: 'Más recientes' },
  { value: 'name_asc', label: 'Nombre A–Z' },
  { value: 'name_desc', label: 'Nombre Z–A' },
  { value: 'type_asc', label: 'Tipo A–Z' },
  { value: 'type_desc', label: 'Tipo Z–A' },
  { value: 'source_asc', label: 'Fuente A–Z' },
  { value: 'source_desc', label: 'Fuente Z–A' },
]

function positionReturnMetrics(position: InversionPosicion) {
  if (!position.fecha_apertura) return null
  const openedAt = new Date(`${position.fecha_apertura}T00:00:00Z`).getTime()
  if (!Number.isFinite(openedAt)) return null

  const elapsedDays = Math.max(1, Math.floor((Date.now() - openedAt) / 86_400_000))
  const totalReturn = position.pnl_pct
  if (totalReturn === null || totalReturn <= -1) {
    return { elapsedDays, daily: null, monthly: null, annual: null }
  }

  const factor = 1 + totalReturn
  return {
    elapsedDays,
    daily: factor ** (1 / elapsedDays) - 1,
    monthly: factor ** (30.4375 / elapsedDays) - 1,
    annual: factor ** (365.25 / elapsedDays) - 1,
  }
}

function compareNullable(left: number | null, right: number | null, direction: 'asc' | 'desc') {
  if (left === null && right === null) return 0
  if (left === null) return 1
  if (right === null) return -1
  return direction === 'asc' ? left - right : right - left
}

function SortableTableHeader({
  label,
  current,
  ascending,
  descending,
  firstDirection = 'desc',
  align = 'left',
  onSort,
  title,
  className = '',
}: {
  label: string
  current: PositionSort
  ascending: PositionSort
  descending: PositionSort
  firstDirection?: 'asc' | 'desc'
  align?: 'left' | 'right'
  onSort: (sort: PositionSort) => void
  title?: string
  className?: string
}) {
  const isAscending = current === ascending
  const isDescending = current === descending
  const nextSort = isAscending
    ? descending
    : isDescending
      ? ascending
      : firstDirection === 'asc'
        ? ascending
        : descending

  return (
    <th
      aria-sort={isAscending ? 'ascending' : isDescending ? 'descending' : 'none'}
      className={`px-3 py-3 font-bold ${align === 'right' ? 'text-right' : ''} ${className}`}
    >
      <button
        type="button"
        onClick={() => onSort(nextSort)}
        title={title ?? `Ordenar por ${label}`}
        aria-label={`${label}: ${isAscending ? 'orden ascendente; cambiar a descendente' : isDescending ? 'orden descendente; cambiar a ascendente' : `ordenar ${firstDirection === 'asc' ? 'ascendente' : 'descendente'}`}`}
        className={`inline-flex w-full items-center gap-1 rounded-sm py-0.5 transition hover:text-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400/50 ${align === 'right' ? 'justify-end' : 'justify-start'} ${isAscending || isDescending ? 'text-slate-700' : ''}`}
      >
        <span>{label}</span>
        {isAscending
          ? <ArrowUp className="h-3 w-3" />
          : isDescending
            ? <ArrowDown className="h-3 w-3" />
            : <ChevronsUpDown className="h-3 w-3 opacity-45" />}
      </button>
    </th>
  )
}

function InvestmentTabs({ activeTab, onChange }: { activeTab: InvestmentTab; onChange: (tab: InvestmentTab) => void }) {
  return (
    <nav aria-label="Sección de inversiones" className="flex flex-wrap items-center gap-2 border-b border-white/10 py-3" role="tablist">
      <button
        type="button"
        role="tab"
        aria-selected={activeTab === 'portfolio'}
        onClick={() => onChange('portfolio')}
        className={`inline-flex items-center gap-2 rounded-lg px-3.5 py-2 text-xs font-semibold transition ${activeTab === 'portfolio' ? 'bg-[#c8f56a] text-[#172016] shadow-[0_8px_20px_rgba(200,245,106,.12)]' : 'text-slate-400 hover:bg-white/10 hover:text-slate-100'}`}
      >
        <Wallet className="h-3.5 w-3.5" /> Portfolio
      </button>
      <button
        type="button"
        role="tab"
        aria-selected={activeTab === 'buscador'}
        onClick={() => onChange('buscador')}
        className={`inline-flex items-center gap-2 rounded-lg px-3.5 py-2 text-xs font-semibold transition ${activeTab === 'buscador' ? 'bg-[#c8f56a] text-[#172016] shadow-[0_8px_20px_rgba(200,245,106,.12)]' : 'text-slate-400 hover:bg-white/10 hover:text-slate-100'}`}
      >
        <Search className="h-3.5 w-3.5" /> Buscar acciones IA
      </button>
    </nav>
  )
}

function InvestmentFrame({
  activeTab,
  onChange,
  statusLabel,
  children,
}: {
  activeTab: InvestmentTab
  onChange: (tab: InvestmentTab) => void
  statusLabel: string
  children: React.ReactNode
}) {
  return (
    <div className="-mx-4 -my-6 min-h-screen bg-[#0d1118] text-slate-100 sm:p-2 lg:p-4">
      <div className="mx-auto max-w-[1500px] px-4 pb-8 pt-6 sm:px-6 lg:px-8">
        <header className="flex flex-col gap-5 border-b border-white/10 pb-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2 text-xs text-slate-400">
            <span>Finanzas</span><span className="text-slate-600">/</span><span>Inversiones</span>
            {activeTab === 'buscador' && <><span className="text-slate-600">/</span><span className="font-medium text-slate-100">Buscar acciones</span></>}
          </div>
          <div className="flex items-center gap-3 text-xs text-slate-400">
            <span className="hidden items-center gap-2 sm:inline-flex"><span className="h-1.5 w-1.5 rounded-full bg-[#c8f56a]" />{statusLabel}</span>
            <div className="grid h-8 w-8 place-items-center rounded-full bg-[#e2ecd8] text-[10px] font-bold text-slate-800">FIN</div>
          </div>
        </header>
        <InvestmentTabs activeTab={activeTab} onChange={onChange} />
        {children}
      </div>
    </div>
  )
}

function formatEuro(value: number | null | undefined) {
  if (value === null || value === undefined || Number.isNaN(value)) return '—'
  return new Intl.NumberFormat('es-ES', {
    style: 'currency',
    currency: 'EUR',
    maximumFractionDigits: 2,
  }).format(value)
}

function formatCompactEuro(value: number) {
  return new Intl.NumberFormat('es-ES', {
    style: 'currency',
    currency: 'EUR',
    notation: 'compact',
    maximumFractionDigits: 1,
  }).format(value)
}

function formatPct(value: number | null | undefined) {
  if (value === null || value === undefined || Number.isNaN(value)) return '—'
  return `${value >= 0 ? '+' : ''}${(value * 100).toFixed(1)}%`
}

function formatQuantity(value: number) {
  return new Intl.NumberFormat('es-ES', { maximumFractionDigits: 6 }).format(value)
}

function formatDate(value: string | null | undefined) {
  if (!value) return '—'
  const date = new Date(value.includes('T') ? value : `${value}T12:00:00`)
  return new Intl.DateTimeFormat('es-ES', { day: '2-digit', month: 'short', year: 'numeric' }).format(date)
}

function formatDateTime(value: string | null | undefined) {
  if (!value) return '—'
  const date = new Date(value)
  return new Intl.DateTimeFormat('es-ES', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date)
}

function assetLabel(position: InversionPosicion) {
  if (position.activo.length <= 30) return position.activo
  return position.activo.replace(' UCITS ETF USD (Acc)', '').replace(' UCITS ETF USD Acc', '')
}

function getErrorMessage(payload: unknown, fallback: string) {
  if (!payload || typeof payload !== 'object') return fallback
  const error = (payload as { error?: unknown }).error
  if (typeof error === 'string') return error
  return fallback
}

type PositionsPayload = {
  positions: InversionPosicion[]
  updatedAt?: unknown
  updated?: unknown
  errors?: unknown
}

function hasPositionsPayload(payload: unknown): payload is PositionsPayload {
  return Boolean(payload && typeof payload === 'object' && Array.isArray((payload as { positions?: unknown }).positions))
}

function invalidApiResponseMessage(response: Response) {
  if (response.redirected || response.url.includes('/login')) {
    return 'Tu sesión ha caducado. Vuelve a iniciar sesión para consultar tus inversiones.'
  }
  return 'La respuesta de inversiones no contiene datos válidos.'
}

function sourceDotClass(status: string) {
  if (status === 'FALLBACK') return 'bg-[#d69035]'
  if (status === 'API_OK') return 'bg-[#168261]'
  return 'bg-[#9aa5ae]'
}

function ChartTooltip({
  active,
  payload,
  label,
  mode,
}: {
  active?: boolean
  payload?: Array<{ payload?: { activo: string; valor: number; pnl: number | null }; value?: number }>
  label?: string
  mode: ChartMode
}) {
  if (!active || !payload?.length || !payload[0]?.payload) return null
  const item = payload[0].payload
  const value = mode === 'valor' ? item.valor : item.pnl
  return (
    <div className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs shadow-lg">
      <p className="max-w-56 truncate font-semibold text-slate-900">{item.activo}</p>
      <p className="mt-1 tabular-nums text-slate-600">{mode === 'valor' ? formatEuro(value) : formatEuro(value)}</p>
      {mode === 'pnl' && <p className="mt-0.5 text-[10px] text-slate-400">{label}</p>}
    </div>
  )
}

function AllocationTooltip({
  active,
  payload,
}: {
  active?: boolean
  payload?: Array<{ payload?: { name: string; value: number; percent: number } }>
}) {
  if (!active || !payload?.length || !payload[0]?.payload) return null
  const item = payload[0].payload
  return (
    <div className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs shadow-lg">
      <p className="font-semibold text-slate-900">{item.name}</p>
      <p className="mt-1 tabular-nums text-slate-600">{formatEuro(item.value)}</p>
      <p className="text-[10px] text-slate-400">{(item.percent * 100).toFixed(1)}% del portfolio</p>
    </div>
  )
}

function ClosedPositionsPanel({ positions }: { positions: ClosedInvestmentPosition[] }) {
  const [limit, setLimit] = useState(8)
  if (positions.length === 0) return null

  const realisedResult = positions.reduce((sum, position) => sum + position.resultado_realizado, 0)
  const profitable = positions.filter((position) => position.resultado_realizado > 0).length
  const visible = positions.slice(0, limit)

  return (
    <section className="mt-3 overflow-hidden rounded-xl bg-[#f7f5ef] text-slate-900 shadow-[0_12px_30px_rgba(0,0,0,.14)]" id="closed-positions">
      <div className="flex flex-col gap-5 border-b border-slate-200 p-5 sm:flex-row sm:items-end sm:justify-between sm:p-6">
        <div>
          <p className="mb-2 text-[9px] font-bold uppercase tracking-[0.16em] text-slate-400">Historial / ciclos completados</p>
          <h2 className="text-lg font-semibold tracking-[-0.04em]">Posiciones cerradas</h2>
          <p className="mt-2 max-w-2xl text-[10px] leading-relaxed text-slate-500">
            Calculadas exclusivamente con compras, ventas, dividendos, costes e impuestos registrados. No se rellenan huecos ni se estiman operaciones.
          </p>
        </div>
        <div className="grid grid-cols-3 gap-5 text-left sm:text-right">
          <div><p className="text-[9px] uppercase tracking-[0.1em] text-slate-400">Ciclos</p><strong className="mt-1 block text-sm tabular-nums">{positions.length}</strong></div>
          <div><p className="text-[9px] uppercase tracking-[0.1em] text-slate-400">En positivo</p><strong className="mt-1 block text-sm tabular-nums">{profitable}</strong></div>
          <div><p className="text-[9px] uppercase tracking-[0.1em] text-slate-400">Resultado neto</p><strong className={`mt-1 block text-sm tabular-nums ${realisedResult >= 0 ? 'text-emerald-700' : 'text-red-600'}`}>{formatEuro(realisedResult)}</strong></div>
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[980px] border-collapse text-left">
          <thead>
            <tr className="border-b border-slate-200 text-[9px] uppercase tracking-[0.1em] text-slate-400">
              <th className="px-5 py-3 font-bold sm:px-6">Activo</th>
              <th className="px-3 py-3 font-bold">Periodo</th>
              <th className="px-3 py-3 text-right font-bold">Compras</th>
              <th className="px-3 py-3 text-right font-bold">Ventas</th>
              <th className="px-3 py-3 text-right font-bold">Ingresos</th>
              <th className="px-3 py-3 text-right font-bold">Costes</th>
              <th className="px-3 py-3 text-right font-bold">Resultado</th>
              <th className="px-3 py-3 pr-5 text-right font-bold sm:pr-6">Rentabilidad</th>
            </tr>
          </thead>
          <tbody>
            {visible.map((position) => {
              const income = position.dividendos + position.bonificaciones
              const costs = position.comisiones + position.impuestos
              return (
                <tr key={position.id} className="border-b border-slate-100 text-[11px] last:border-0 hover:bg-[#f0eee8]">
                  <td className="max-w-[280px] px-5 py-3 sm:px-6">
                    <p className="truncate font-semibold text-slate-900">{position.activo}</p>
                    <p className="mt-0.5 truncate text-[9px] text-slate-400">{position.ticker} · {position.custodia}</p>
                  </td>
                  <td className="whitespace-nowrap px-3 py-3 text-slate-600">
                    <p>{formatDate(position.fecha_apertura)} → {formatDate(position.fecha_cierre)}</p>
                    <p className="mt-0.5 inline-flex items-center gap-1 text-[9px] text-slate-400"><Clock3 className="h-3 w-3" />{position.dias_activa} días</p>
                  </td>
                  <td className="px-3 py-3 text-right tabular-nums text-slate-600">{formatEuro(position.importe_compras)}</td>
                  <td className="px-3 py-3 text-right tabular-nums text-slate-600">{formatEuro(position.importe_ventas)}</td>
                  <td className="px-3 py-3 text-right tabular-nums text-violet-700">{income > 0 ? formatEuro(income) : '—'}</td>
                  <td className="px-3 py-3 text-right tabular-nums text-slate-500">{costs > 0 ? formatEuro(costs) : '—'}</td>
                  <td className={`px-3 py-3 text-right font-semibold tabular-nums ${position.resultado_realizado >= 0 ? 'text-emerald-700' : 'text-red-600'}`}>{formatEuro(position.resultado_realizado)}</td>
                  <td className={`px-3 py-3 pr-5 text-right font-semibold tabular-nums sm:pr-6 ${position.resultado_realizado >= 0 ? 'text-emerald-700' : 'text-red-600'}`}>{formatPct(position.rentabilidad_pct)}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      <div className="flex flex-col gap-2 border-t border-slate-200 px-5 py-3 text-[10px] text-slate-400 sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <span>Mostrando {visible.length} de {positions.length} ciclos cerrados</span>
        {positions.length > 8 && (
          <button type="button" onClick={() => setLimit(limit >= positions.length ? 8 : positions.length)} className="font-semibold text-slate-600 hover:text-slate-900">
            {limit >= positions.length ? 'Mostrar menos' : 'Ver todas las posiciones cerradas'}
          </button>
        )}
      </div>
    </section>
  )
}

export function InvestmentPortfolio() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [data, setData] = useState<PortfolioData | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [lastPriceUpdate, setLastPriceUpdate] = useState<string | null>(null)
  const [updatingPrices, setUpdatingPrices] = useState(false)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [savingOperation, setSavingOperation] = useState(false)
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState('all')
  const [positionSort, setPositionSort] = useState<PositionSort>('value_desc')
  const [chartMode, setChartMode] = useState<ChartMode>('valor')
  const [dateDialogOpen, setDateDialogOpen] = useState(false)
  const [datePosition, setDatePosition] = useState<InversionPosicion | null>(null)
  const [openingDate, setOpeningDate] = useState('')
  const [savingDate, setSavingDate] = useState(false)
  const [operationType, setOperationType] = useState<OperationType>('Compra')
  const [selectedPosition, setSelectedPosition] = useState('new')
  const [fecha, setFecha] = useState('')
  const [activo, setActivo] = useState('')
  const [ticker, setTicker] = useState('')
  const [tipoActivo, setTipoActivo] = useState('ETF')
  const [custodia, setCustodia] = useState('')
  const [cantidad, setCantidad] = useState('')
  const [precio, setPrecio] = useState('')
  const [notas, setNotas] = useState('')
  const activeTab: InvestmentTab = searchParams.get('tab') === 'buscador' ? 'buscador' : 'portfolio'

  function cambiarPestana(tab: InvestmentTab) {
    router.replace(tab === 'buscador' ? '/inversiones?tab=buscador' : '/inversiones', { scroll: true })
  }

  async function cargarPortfolio() {
    setLoading(true)
    setLoadError(null)
    try {
      const response = await fetch('/api/inversiones', { cache: 'no-store' })
      const payload = await response.json().catch(() => null)
      if (!response.ok) throw new Error(getErrorMessage(payload, 'No se pudo cargar el portfolio'))
      if (!hasPositionsPayload(payload)) throw new Error(invalidApiResponseMessage(response))
      setData(payload as PortfolioData)
    } catch (error) {
      const message = error instanceof Error ? error.message : 'No se pudo cargar el portfolio'
      setLoadError(message)
      toast.error(message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void cargarPortfolio()
  }, [])

  const positions = data?.positions ?? []
  const operations = data?.operations ?? []
  const closedPositions = data?.closedPositions ?? []
  const portfolioLastUpdated = useMemo(() => {
    const timestamps = positions
      .map((position) => position.updated_at ?? position.snapshot_at)
      .filter((value): value is string => Boolean(value))
      .map((value) => new Date(value).getTime())
      .filter(Number.isFinite)
    return timestamps.length > 0 ? new Date(Math.max(...timestamps)).toISOString() : null
  }, [positions])

  const summary = useMemo(() => {
    const totalValue = positions.reduce((sum, position) => sum + (position.valor_actual ?? 0), 0)
    const knownPositions = positions.filter((position) => position.coste !== null)
    const knownCost = knownPositions.reduce((sum, position) => sum + (position.coste ?? 0), 0)
    const knownPnl = knownPositions.reduce((sum, position) => sum + (position.pnl ?? 0), 0)
    const byType = positions.reduce<Record<string, number>>((acc, position) => {
      const type = position.tipo.includes('Staking') ? 'Staking' : position.tipo === 'ETF' ? 'ETF' : 'Crypto'
      acc[type] = (acc[type] ?? 0) + (position.valor_actual ?? 0)
      return acc
    }, {})
    return {
      totalValue,
      knownCost,
      knownPnl,
      knownReturn: knownCost > 0 ? knownPnl / knownCost : null,
      byType,
      fallbackCount: positions.filter((position) => position.estado_fuente === 'FALLBACK').length,
      missingCostCount: positions.filter((position) => position.coste === null).length,
      apiOkCount: positions.filter((position) => position.estado_fuente === 'API_OK').length,
    }
  }, [positions])

  const filteredPositions = useMemo(() => {
    const query = search.trim().toLowerCase()
    const filtered = positions.filter((position) => {
      const matchesQuery = !query || [position.activo, position.ticker, position.custodia, position.tipo].some((value) => value.toLowerCase().includes(query))
      const matchesFilter = filter === 'all'
        || (filter === 'fallback' && position.estado_fuente === 'FALLBACK')
        || position.tipo === filter
      return matchesQuery && matchesFilter
    })

    return filtered.toSorted((left, right) => {
      if (positionSort === 'name_asc') return left.activo.localeCompare(right.activo, 'es')
      if (positionSort === 'name_desc') return right.activo.localeCompare(left.activo, 'es')
      if (positionSort === 'type_asc') return `${left.tipo} ${left.custodia}`.localeCompare(`${right.tipo} ${right.custodia}`, 'es')
      if (positionSort === 'type_desc') return `${right.tipo} ${right.custodia}`.localeCompare(`${left.tipo} ${left.custodia}`, 'es')
      if (positionSort === 'price_desc') return compareNullable(left.precio_actual, right.precio_actual, 'desc')
      if (positionSort === 'price_asc') return compareNullable(left.precio_actual, right.precio_actual, 'asc')
      if (positionSort === 'value_desc') return compareNullable(left.valor_actual, right.valor_actual, 'desc')
      if (positionSort === 'value_asc') return compareNullable(left.valor_actual, right.valor_actual, 'asc')
      if (positionSort === 'pnl_desc') return compareNullable(left.pnl, right.pnl, 'desc')
      if (positionSort === 'pnl_asc') return compareNullable(left.pnl, right.pnl, 'asc')
      if (positionSort === 'return_desc') return compareNullable(left.pnl_pct, right.pnl_pct, 'desc')
      if (positionSort === 'return_asc') return compareNullable(left.pnl_pct, right.pnl_pct, 'asc')
      if (positionSort === 'annual_desc' || positionSort === 'annual_asc') {
        const leftAnnual = positionReturnMetrics(left)?.annual ?? null
        const rightAnnual = positionReturnMetrics(right)?.annual ?? null
        return compareNullable(leftAnnual, rightAnnual, positionSort === 'annual_asc' ? 'asc' : 'desc')
      }
      if (positionSort === 'source_asc') return left.estado_fuente.localeCompare(right.estado_fuente, 'es')
      if (positionSort === 'source_desc') return right.estado_fuente.localeCompare(left.estado_fuente, 'es')

      const leftDate = left.fecha_apertura ? new Date(`${left.fecha_apertura}T00:00:00Z`).getTime() : null
      const rightDate = right.fecha_apertura ? new Date(`${right.fecha_apertura}T00:00:00Z`).getTime() : null
      return compareNullable(leftDate, rightDate, positionSort === 'oldest' ? 'asc' : 'desc')
    })
  }, [filter, positionSort, positions, search])

  const chartData = useMemo(() => {
    return [...positions]
      .sort((a, b) => (b.valor_actual ?? 0) - (a.valor_actual ?? 0))
      .map((position) => ({
        activo: assetLabel(position),
        ticker: position.price_ticker || position.ticker,
        valor: position.valor_actual ?? 0,
        pnl: position.pnl,
      }))
  }, [positions])

  const allocationData = useMemo(() => {
    return Object.entries(summary.byType).map(([name, value]) => ({
      name,
      value,
      percent: summary.totalValue > 0 ? value / summary.totalValue : 0,
      color: TYPE_COLORS[name] ?? TYPE_COLORS.Otro,
    }))
  }, [summary.byType, summary.totalValue])


  function abrirDialog() {
    setFecha(new Date().toISOString().slice(0, 10))
    setDialogOpen(true)
  }

  function abrirFechaPosicion(position: InversionPosicion) {
    setDatePosition(position)
    setOpeningDate(position.fecha_apertura ?? '')
    setDateDialogOpen(true)
  }

  async function guardarFechaPosicion() {
    if (!datePosition || !openingDate) {
      toast.error('Indica la fecha real de apertura')
      return
    }

    setSavingDate(true)
    try {
      const response = await fetch(`/api/inversiones/${datePosition.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fecha_apertura: openingDate }),
      })
      const payload = await response.json().catch(() => null)
      if (!response.ok) throw new Error(getErrorMessage(payload, 'No se pudo guardar la fecha'))
      if (!payload || typeof payload !== 'object' || typeof (payload as { id?: unknown }).id !== 'number') {
        throw new Error(invalidApiResponseMessage(response))
      }

      const updated = payload as InversionPosicion
      setData((current) => current
        ? { ...current, positions: current.positions.map((position) => position.id === updated.id ? updated : position) }
        : current)
      setDateDialogOpen(false)
      setDatePosition(null)
      toast.success('Fecha de apertura actualizada')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'No se pudo guardar la fecha')
    } finally {
      setSavingDate(false)
    }
  }

  function resetOperation() {
    setOperationType('Compra')
    setSelectedPosition('new')
    setFecha(new Date().toISOString().slice(0, 10))
    setActivo('')
    setTicker('')
    setTipoActivo('ETF')
    setCustodia('')
    setCantidad('')
    setPrecio('')
    setNotas('')
  }

  function seleccionarPosicion(value: string) {
    setSelectedPosition(value)
    if (value === 'new') {
      setActivo('')
      setTicker('')
      setCustodia('')
      setCantidad('')
      setPrecio('')
      return
    }
    const position = positions.find((item) => String(item.id) === value)
    if (!position) return
    setActivo(position.activo)
    setTicker(position.price_ticker || position.ticker)
    setTipoActivo(position.tipo as typeof tipoActivo)
    setCustodia(position.custodia)
    setPrecio(position.precio_actual?.toString() ?? '')
  }

  function handleOperationType(value: OperationType) {
    setOperationType(value)
    if (value === 'Venta' && selectedPosition === 'new' && positions[0]) {
      seleccionarPosicion(String(positions[0].id))
    }
  }

  async function guardarOperacion(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const quantity = Number(cantidad)
    const unitPrice = Number(precio)
    if (!fecha || !activo || !ticker || !custodia || !Number.isFinite(quantity) || quantity <= 0 || !Number.isFinite(unitPrice) || unitPrice < 0) {
      toast.error('Completa activo, custodia, cantidad y precio')
      return
    }

    setSavingOperation(true)
    try {
      const response = await fetch('/api/inversiones', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fecha,
          tipo: operationType,
          activo,
          ticker,
          tipo_activo: tipoActivo,
          custodia,
          cantidad: quantity,
          precio_unitario: unitPrice,
          notas: notas || undefined,
        }),
      })
      const payload = await response.json().catch(() => null)
      if (!response.ok) throw new Error(getErrorMessage(payload, 'No se pudo guardar la operación'))
      if (!hasPositionsPayload(payload)) throw new Error(invalidApiResponseMessage(response))
      setData(payload as PortfolioData)
      setDialogOpen(false)
      resetOperation()
      toast.success(`${operationType} registrada y añadida al historial`)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'No se pudo guardar la operación')
    } finally {
      setSavingOperation(false)
    }
  }

  async function actualizarPrecios() {
    setUpdatingPrices(true)
    try {
      const response = await fetch('/api/inversiones/actualizar-precios', { method: 'POST' })
      const payload = await response.json().catch(() => null)
      if (!response.ok) throw new Error(getErrorMessage(payload, 'No se pudieron actualizar los precios'))
      if (!hasPositionsPayload(payload)) throw new Error(invalidApiResponseMessage(response))
      setData((current) => current ? { ...current, positions: payload.positions } : current)
      if (typeof payload.updatedAt === 'string') setLastPriceUpdate(payload.updatedAt)
      const updated = typeof payload.updated === 'number' ? payload.updated : 0
      const errors = Array.isArray(payload.errors) ? payload.errors.filter((error: unknown): error is string => typeof error === 'string') : []
      if (errors.length > 0) {
        toast.warning(`${updated} precios actualizados · ${errors.length} fuentes requieren revisión`)
      } else {
        toast.success(updated > 0 ? `${updated} precios actualizados · cripto CoinGecko + ETFs Yahoo/Xetra` : 'No hay precios nuevos que actualizar')
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'No se pudieron actualizar los precios')
    } finally {
      setUpdatingPrices(false)
    }
  }

  function exportarOperaciones() {
    const blob = new Blob([JSON.stringify(operations, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = `finanzas-inversiones-${new Date().toISOString().slice(0, 10)}.json`
    anchor.click()
    URL.revokeObjectURL(url)
    toast.success('Historial exportado')
  }

  if (activeTab === 'buscador') {
    return (
      <InvestmentFrame activeTab={activeTab} onChange={cambiarPestana} statusLabel="Investigación integrada">
        <StockFinder embedded />
      </InvestmentFrame>
    )
  }

  if (loading) {
    return (
      <InvestmentFrame activeTab={activeTab} onChange={cambiarPestana} statusLabel="Cargando cartera…">
        <div className="mx-auto animate-pulse space-y-6 py-8">
          <div className="h-6 w-44 rounded bg-slate-800" />
          <div className="h-20 w-96 rounded bg-slate-800" />
          <div className="grid gap-3 md:grid-cols-4">{[1, 2, 3, 4].map((item) => <div key={item} className="h-32 rounded-xl bg-slate-800" />)}</div>
          <div className="h-96 rounded-xl bg-slate-800" />
        </div>
      </InvestmentFrame>
    )
  }

  if (loadError) {
    return (
      <InvestmentFrame activeTab={activeTab} onChange={cambiarPestana} statusLabel="No se pudieron cargar los datos">
        <div className="mx-auto flex min-h-[70vh] max-w-[620px] items-center justify-center">
          <div className="w-full rounded-2xl border border-white/10 bg-[#151b25] p-7 shadow-2xl sm:p-9">
            <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#c8f56a]">Finanzas / Inversiones</p>
            <h1 className="mt-3 text-2xl font-semibold tracking-[-0.04em]">No se pudo cargar tu cartera</h1>
            <p className="mt-3 text-sm leading-relaxed text-slate-400">{loadError}</p>
            <Button className="mt-6 bg-[#c8f56a] text-[#172016] hover:bg-[#d8fb83]" onClick={() => void cargarPortfolio()}>
              <RefreshCw />Reintentar
            </Button>
            {loadError.includes('sesión') && <Button variant="outline" className="mt-2 border-white/20 bg-transparent text-slate-100 hover:bg-white/10 hover:text-white" onClick={() => window.location.assign('/login?callbackUrl=/inversiones')}>
              Ir al inicio de sesión
            </Button>}
          </div>
        </div>
      </InvestmentFrame>
    )
  }

  const qualityScore = positions.length > 0 ? Math.round((summary.apiOkCount / positions.length) * 10) : 0
  const qualityItems = [
    {
      ok: summary.fallbackCount === 0,
      title: summary.fallbackCount === 0 ? 'Todos los precios tienen fuente activa' : `${summary.fallbackCount} precios en fallback`,
      detail: summary.fallbackCount === 0 ? 'No hay posiciones reteniendo un último valor.' : 'Se muestra el último precio válido hasta que vuelva la API.',
      tag: summary.fallbackCount === 0 ? 'OK' : 'Revisar',
    },
    {
      ok: summary.missingCostCount === 0,
      title: summary.missingCostCount === 0 ? 'Coste de compra completo' : `${summary.missingCostCount} posiciones sin coste`,
      detail: summary.missingCostCount === 0 ? 'La rentabilidad se puede comparar en toda la cartera.' : 'El P/L conocido no incluye esas posiciones.',
      tag: summary.missingCostCount === 0 ? 'OK' : 'Parcial',
    },
    {
      ok: true,
      title: 'ETFs con último cierre disponible',
      detail: 'El precio puede diferir del broker o de la cotización intradía.',
      tag: 'Contexto',
    },
  ]

  return (
    <InvestmentFrame activeTab={activeTab} onChange={cambiarPestana} statusLabel="Cartera guardada en la app">
        <section className="flex flex-col gap-7 py-8 lg:flex-row lg:items-end lg:justify-between" id="inversiones">
          <div>
            <p className="mb-3 text-[10px] font-bold uppercase tracking-[0.18em] text-slate-500">Portfolio / visión general</p>
            <h1 className="max-w-2xl text-4xl font-medium leading-[0.98] tracking-[-0.06em] text-slate-50 sm:text-5xl lg:text-6xl">Tu patrimonio<br /><span className="text-[#c8f56a]">en movimiento.</span></h1>
            <p className="mt-4 max-w-xl text-sm text-slate-400">Una lectura clara de tus posiciones, su valor actual y la calidad de cada precio.</p>
          </div>
          <div className="flex flex-col gap-4 lg:items-end">
            <div className="text-left lg:text-right"><p className="text-[10px] uppercase tracking-[0.12em] text-slate-500">Última actualización</p><p className="mt-1 text-xs font-medium text-slate-200">{formatDateTime(lastPriceUpdate ?? portfolioLastUpdated)}</p><p className="mt-1 text-[10px] text-slate-500">{lastPriceUpdate ? 'CoinGecko + Yahoo/Xetra' : 'Precios y posiciones guardados en la app'}</p>{lastPriceUpdate && <p className="mt-1 text-[10px] text-slate-500">ETFs: último cierre de mercado como referencia gratuita.</p>}</div>
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" size="sm" className="border-white/20 bg-transparent text-slate-100 hover:bg-white/10 hover:text-white" onClick={actualizarPrecios} disabled={updatingPrices}><RefreshCw className={updatingPrices ? 'animate-spin' : ''} />{updatingPrices ? 'Actualizando…' : 'Actualizar precios'}</Button>
              <Button size="sm" className="bg-[#c8f56a] text-[#172016] hover:bg-[#d8fb83]" onClick={abrirDialog}><Plus />Registrar operación</Button>
            </div>
          </div>
        </section>

        <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-4" aria-label="Resumen del portfolio">
          <div className="rounded-xl bg-[#c8f56a] p-5 text-[#172016] shadow-[0_12px_30px_rgba(0,0,0,.14)] md:col-span-2 xl:col-span-1"><div className="flex items-center justify-between text-xs font-semibold text-[#536a38]"><span>Valor actual</span><CircleDollarSign className="h-5 w-5" /></div><p className="mt-5 text-4xl font-semibold tracking-[-0.06em] tabular-nums">{formatEuro(summary.totalValue)}</p><p className="mt-4 text-[10px] text-[#617946]">{positions.length} posiciones · EUR · cartera de la app</p></div>
          <div className="rounded-xl bg-[#f7f5ef] p-5 text-slate-900 shadow-[0_12px_30px_rgba(0,0,0,.14)]"><div className="flex items-center justify-between text-xs font-semibold text-slate-500"><span>Coste conocido</span><Wallet className="h-4 w-4" /></div><p className="mt-5 text-3xl font-semibold tracking-[-0.06em] tabular-nums">{formatEuro(summary.knownCost)}</p><p className="mt-4 text-[10px] text-slate-400">Excluye posiciones sin coste</p></div>
          <div className="rounded-xl bg-[#f7f5ef] p-5 text-slate-900 shadow-[0_12px_30px_rgba(0,0,0,.14)]"><div className="flex items-center justify-between text-xs font-semibold text-slate-500"><span>P / L conocido</span><span className={summary.knownPnl >= 0 ? 'text-emerald-700' : 'text-red-600'}>{summary.knownPnl >= 0 ? 'ganancia' : 'pérdida'}</span></div><p className={`mt-5 text-3xl font-semibold tracking-[-0.06em] tabular-nums ${summary.knownPnl >= 0 ? 'text-emerald-700' : 'text-red-600'}`}>{summary.knownPnl >= 0 ? '+' : ''}{formatEuro(summary.knownPnl)}</p><p className="mt-4 text-[10px] text-slate-400">Sobre coste conocido</p></div>
          <div className="rounded-xl bg-[#e5edde] p-5 text-slate-900 shadow-[0_12px_30px_rgba(0,0,0,.14)]"><div className="flex items-center justify-between text-xs font-semibold text-slate-500"><span>Rentabilidad</span><ArrowUpRight className="h-4 w-4 text-emerald-700" /></div><p className="mt-5 text-3xl font-semibold tracking-[-0.06em] tabular-nums text-emerald-700">{formatPct(summary.knownReturn)}</p><p className="mt-4 text-[10px] text-slate-500">Rendimiento comparable</p></div>
        </section>

        <section className="mt-3 grid gap-3">
          <div className="min-w-0 overflow-hidden rounded-xl bg-[#f7f5ef] text-slate-900 shadow-[0_12px_30px_rgba(0,0,0,.14)]" id="positions-panel">
            <div className="flex flex-col gap-4 border-b border-slate-200 p-5 sm:p-6 xl:flex-row xl:items-end xl:justify-between">
              <div>
                <p className="mb-2 text-[9px] font-bold uppercase tracking-[0.16em] text-slate-400">Posiciones / {positions.length} activos</p>
                <h2 className="text-lg font-semibold tracking-[-0.04em]">Tu cartera</h2>
                <p className="mt-1 text-[10px] text-slate-400">Ordena y compara valor, beneficio y rentabilidad temporal.</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <label className="flex h-8 flex-1 items-center gap-2 rounded-md border border-slate-200 bg-[#eeece5] px-2.5 text-slate-400 sm:flex-none">
                  <Search className="h-3.5 w-3.5" />
                  <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar activo" className="w-full bg-transparent text-[11px] text-slate-900 outline-none placeholder:text-slate-400 sm:w-28" />
                </label>
                <div className="relative">
                  <select aria-label="Filtrar posiciones" value={filter} onChange={(event) => setFilter(event.target.value)} className="h-8 appearance-none rounded-md border border-slate-200 bg-[#eeece5] pl-2.5 pr-7 text-[10px] text-slate-600 outline-none">
                    <option value="all">Todos</option>
                    <option value="Crypto">Crypto</option>
                    <option value="ETF">ETF</option>
                    <option value="fallback">Fallback</option>
                  </select>
                  <ChevronDown className="pointer-events-none absolute right-2 top-2 h-3.5 w-3.5 text-slate-400" />
                </div>
                <div className="relative">
                  <select aria-label="Ordenar posiciones" value={positionSort} onChange={(event) => setPositionSort(event.target.value as PositionSort)} className="h-8 appearance-none rounded-md border border-slate-200 bg-[#eeece5] pl-2.5 pr-7 text-[10px] font-medium text-slate-600 outline-none">
                    {POSITION_SORT_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                  </select>
                  <ChevronDown className="pointer-events-none absolute right-2 top-2 h-3.5 w-3.5 text-slate-400" />
                </div>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[1160px] border-collapse text-left">
                <thead>
                  <tr className="border-b border-slate-200 text-[9px] uppercase tracking-[0.1em] text-slate-400">
                    <SortableTableHeader label="Activo" current={positionSort} ascending="name_asc" descending="name_desc" firstDirection="asc" onSort={setPositionSort} className="pl-5 sm:pl-6" />
                    <SortableTableHeader label="Tipo / custodia" current={positionSort} ascending="type_asc" descending="type_desc" firstDirection="asc" onSort={setPositionSort} />
                    <SortableTableHeader label="Precio" current={positionSort} ascending="price_asc" descending="price_desc" onSort={setPositionSort} align="right" />
                    <SortableTableHeader label="Valor actual" current={positionSort} ascending="value_asc" descending="value_desc" onSort={setPositionSort} align="right" />
                    <SortableTableHeader label="P / L" current={positionSort} ascending="pnl_asc" descending="pnl_desc" onSort={setPositionSort} align="right" title="Ordenar por beneficio o pérdida en euros" />
                    <SortableTableHeader label="Desde / antigüedad" current={positionSort} ascending="oldest" descending="newest" onSort={setPositionSort} title="Ordenar por fecha de apertura" />
                    <SortableTableHeader label="Rent. equiv. D / M / A" current={positionSort} ascending="annual_asc" descending="annual_desc" onSort={setPositionSort} title="Ordenar por rentabilidad anual equivalente" />
                    <SortableTableHeader label="Fuente" current={positionSort} ascending="source_asc" descending="source_desc" firstDirection="asc" onSort={setPositionSort} className="pr-5 sm:pr-6" />
                  </tr>
                </thead>
                <tbody>
                  {filteredPositions.map((position) => {
                    const metrics = positionReturnMetrics(position)
                    return (
                      <tr key={position.id} className="border-b border-slate-100 text-[11px] last:border-0 hover:bg-[#f0eee8]">
                        <td className="px-5 py-3 sm:px-6">
                          <div className="flex min-w-[210px] items-center gap-2.5">
                            <span className="grid h-7 w-7 shrink-0 place-items-center rounded-md text-[9px] font-bold" style={{ backgroundColor: `${TYPE_COLORS[position.tipo] ?? TYPE_COLORS.Otro}33`, color: position.tipo === 'Crypto' ? '#587c2a' : '#5963ba' }}>{(position.price_ticker || position.ticker).slice(0, 4)}</span>
                            <div className="min-w-0">
                              <p className="max-w-[220px] truncate font-semibold text-slate-900">{assetLabel(position)}</p>
                              <p className="mt-0.5 truncate text-[9px] text-slate-400">{position.price_ticker || position.ticker} · {formatQuantity(position.cantidad)}</p>
                            </div>
                          </div>
                        </td>
                        <td className="max-w-[140px] px-3 py-3">
                          <p className="whitespace-nowrap text-slate-600">{position.tipo}</p>
                          <p className="mt-0.5 truncate text-[9px] text-slate-400">{position.custodia}</p>
                        </td>
                        <td className="whitespace-nowrap px-3 py-3 text-right tabular-nums font-semibold text-slate-900">{formatEuro(position.precio_actual)}</td>
                        <td className="whitespace-nowrap px-3 py-3 text-right tabular-nums font-semibold text-slate-900">{formatEuro(position.valor_actual)}</td>
                        <td className={`whitespace-nowrap px-3 py-3 text-right tabular-nums font-semibold ${position.pnl === null ? 'text-slate-400' : position.pnl >= 0 ? 'text-emerald-700' : 'text-red-600'}`}>
                          <p>{position.pnl === null ? '—' : `${position.pnl >= 0 ? '+' : ''}${formatEuro(position.pnl)}`}</p>
                          <p className="mt-0.5 text-[9px] opacity-70">{formatPct(position.pnl_pct)}</p>
                        </td>
                        <td className="px-3 py-3">
                          {position.fecha_apertura && metrics ? (
                            <button type="button" onClick={() => abrirFechaPosicion(position)} className="group/date text-left" title="Editar fecha de apertura">
                              <span className="inline-flex items-center gap-1.5 whitespace-nowrap font-medium text-slate-700 group-hover/date:text-slate-950"><CalendarDays className="h-3.5 w-3.5" />{formatDate(position.fecha_apertura)}</span>
                              <span className="mt-1 flex items-center gap-1 text-[9px] text-slate-400"><Clock3 className="h-3 w-3" />{metrics.elapsedDays} {metrics.elapsedDays === 1 ? 'día' : 'días'} activa</span>
                            </button>
                          ) : (
                            <button type="button" onClick={() => abrirFechaPosicion(position)} className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-md border border-dashed border-slate-300 px-2 py-1.5 text-[9px] font-semibold text-slate-500 hover:border-slate-500 hover:text-slate-900">
                              <CalendarDays className="h-3 w-3" />Añadir fecha
                            </button>
                          )}
                        </td>
                        <td className="px-3 py-3">
                          {metrics && metrics.daily !== null ? (
                            <div className="grid min-w-[175px] grid-cols-3 gap-1 text-center">
                              {[['D', metrics.daily], ['M', metrics.monthly], ['A', metrics.annual]].map(([label, value]) => (
                                <div key={String(label)} className="rounded bg-[#eeece5] px-1.5 py-1">
                                  <p className="text-[8px] font-bold text-slate-400">{label}</p>
                                  <p className={`mt-0.5 tabular-nums text-[9px] font-semibold ${(value as number) >= 0 ? 'text-emerald-700' : 'text-red-600'}`}>{formatPct(value as number)}</p>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <span className="text-[9px] text-slate-400">{position.fecha_apertura ? 'Coste o retorno pendiente' : 'Requiere fecha real'}</span>
                          )}
                        </td>
                        <td className="px-3 py-3 pr-5 sm:pr-6">
                          <span className="inline-flex items-center gap-1.5 whitespace-nowrap text-[9px] text-slate-500"><span className={`h-1.5 w-1.5 rounded-full ${sourceDotClass(position.estado_fuente)}`} />{position.estado_fuente === 'FALLBACK' ? 'Fallback' : position.estado_fuente === 'API_OK' ? 'API OK' : 'Manual'}</span>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
            <div className="flex items-center justify-between border-t border-slate-200 px-5 py-3 text-[10px] text-slate-400 sm:px-6">
              <span>Mostrando {filteredPositions.length} de {positions.length} posiciones</span>
              <button type="button" onClick={abrirDialog} className="inline-flex items-center gap-1 font-semibold text-slate-600 hover:text-slate-900"><Plus className="h-3 w-3" />Añadir operación</button>
            </div>
          </div>

          <div className="flex flex-col rounded-xl bg-[#f7f5ef] p-5 text-slate-900 shadow-[0_12px_30px_rgba(0,0,0,.14)] sm:p-6" id="quality-panel"><div className="flex items-start justify-between"><div><p className="mb-2 text-[9px] font-bold uppercase tracking-[0.16em] text-slate-400">Control / confianza</p><h2 className="text-lg font-semibold tracking-[-0.04em]">Calidad de datos</h2></div><span className="text-xs font-bold tabular-nums text-amber-600">{qualityScore} / 10</span></div><p className="mt-4 text-[11px] leading-relaxed text-slate-500">La cartera está disponible, pero hay precios que conviene revisar antes de tomar decisiones.</p><div className="mt-5 grid gap-3 md:grid-cols-3">{qualityItems.map((item) => <div key={item.title} className="grid grid-cols-[14px_1fr_auto] items-start gap-2.5 border-b border-slate-200 pb-3 md:border-b-0 md:border-r md:pb-0 md:pr-3 md:last:border-r-0"><span className="mt-0.5">{item.ok ? <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" /> : <AlertTriangle className="h-3.5 w-3.5 text-amber-600" />}</span><div><p className="text-[10px] font-semibold text-slate-900">{item.title}</p><p className="mt-1 text-[9px] leading-relaxed text-slate-400">{item.detail}</p></div><span className="text-[9px] text-slate-400">{item.tag}</span></div>)}</div><div className="mt-5 flex justify-end"><Button variant="outline" size="sm" className="border-slate-200 bg-transparent text-slate-700 hover:bg-white" onClick={actualizarPrecios} disabled={updatingPrices}><RefreshCw className={updatingPrices ? 'animate-spin' : ''} />{updatingPrices ? 'Consultando…' : 'Volver a consultar APIs'}</Button></div></div>
        </section>

        <ClosedPositionsPanel positions={closedPositions} />

        <section className="mt-3 grid gap-3 xl:grid-cols-[minmax(0,1.7fr)_minmax(320px,.8fr)]">
          <div className="min-w-0 rounded-xl bg-[#f7f5ef] p-5 text-slate-900 shadow-[0_12px_30px_rgba(0,0,0,.14)] sm:p-6">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between"><div><p className="mb-2 text-[9px] font-bold uppercase tracking-[0.16em] text-slate-400">Mercado / valor</p><h2 className="text-lg font-semibold tracking-[-0.04em]">Mapa de tu cartera</h2></div><div className="flex rounded-md border border-slate-200 bg-[#eeece5] p-1"><button type="button" onClick={() => setChartMode('valor')} className={`rounded px-3 py-1.5 text-[10px] font-semibold ${chartMode === 'valor' ? 'bg-slate-900 text-white' : 'text-slate-500 hover:text-slate-900'}`}>Valor actual</button><button type="button" onClick={() => setChartMode('pnl')} className={`rounded px-3 py-1.5 text-[10px] font-semibold ${chartMode === 'pnl' ? 'bg-slate-900 text-white' : 'text-slate-500 hover:text-slate-900'}`}>P / L</button></div></div>
            <div className="mt-6 flex items-end justify-between"><div><p className="text-2xl font-semibold tracking-[-0.05em] tabular-nums">{chartMode === 'valor' ? formatEuro(summary.totalValue) : formatEuro(summary.knownPnl)}</p><p className="mt-1 text-[10px] text-slate-400">{chartMode === 'valor' ? 'valor actual por posición' : 'solo posiciones con coste conocido'}</p></div><div className="flex items-center gap-2 text-[10px] text-slate-400"><BarChart3 className="h-3.5 w-3.5" /> hover para inspeccionar</div></div>
            <div className="mt-4 h-[290px] w-full min-w-0"><ResponsiveContainer width="100%" height="100%"><BarChart data={chartData} margin={{ top: 8, right: 8, bottom: 8, left: 8 }}><CartesianGrid vertical={false} stroke="#e3e1d9" strokeDasharray="3 3" /><XAxis dataKey="ticker" axisLine={false} tickLine={false} tick={{ fill: '#88939d', fontSize: 9 }} interval={0} angle={-22} textAnchor="end" height={52} /><YAxis axisLine={false} tickLine={false} tick={{ fill: '#88939d', fontSize: 9 }} tickFormatter={(value) => value >= 1000 ? `${(value / 1000).toFixed(0)}k` : `${value}`} width={34} /><Tooltip content={<ChartTooltip mode={chartMode} />} cursor={{ fill: '#f0eee8' }} /><Bar dataKey={chartMode === 'valor' ? 'valor' : 'pnl'} radius={[4, 4, 0, 0]}>{chartData.map((entry) => <Cell key={`${entry.ticker}-${entry.activo}`} fill={chartMode === 'pnl' ? (entry.pnl !== null && entry.pnl < 0 ? '#c75253' : '#168261') : '#7e8bff'} />)}</Bar></BarChart></ResponsiveContainer></div>
            <div className="flex flex-wrap items-center gap-2 border-t border-slate-200 pt-3 text-[10px] text-slate-400"><span className="h-1.5 w-1.5 rounded-full bg-[#7e8bff]" /> Datos calculados desde la cartera actual <span className="ml-auto">Recharts · interacción local</span></div>
          </div>

          <div className="rounded-xl bg-[#f7f5ef] p-5 text-slate-900 shadow-[0_12px_30px_rgba(0,0,0,.14)] sm:p-6"><div className="flex items-start justify-between"><div><p className="mb-2 text-[9px] font-bold uppercase tracking-[0.16em] text-slate-400">Composición</p><h2 className="text-lg font-semibold tracking-[-0.04em]">Dónde está tu dinero</h2></div><button type="button" onClick={() => document.getElementById('quality-panel')?.scrollIntoView({ behavior: 'smooth' })} className="text-[10px] font-semibold text-slate-500 hover:text-slate-900">Ver calidad →</button></div><div className="mt-3 h-[230px] w-full min-w-0"><ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={allocationData} dataKey="value" nameKey="name" innerRadius={67} outerRadius={95} paddingAngle={3} stroke="none">{allocationData.map((entry) => <Cell key={entry.name} fill={entry.color} />)}</Pie><Tooltip content={<AllocationTooltip />} /></PieChart></ResponsiveContainer><div className="pointer-events-none relative -mt-[154px] flex flex-col items-center text-center"><span className="text-xl font-semibold tracking-[-0.06em]">{formatCompactEuro(summary.totalValue)}</span><span className="mt-1 text-[10px] text-slate-400">total</span></div></div><div className="mt-5 grid gap-2.5">{allocationData.map((item) => <div key={item.name} className="grid grid-cols-[8px_1fr_auto_auto] items-center gap-2 text-[11px]"><span className="h-2 w-2 rounded-full" style={{ backgroundColor: item.color }} /><span className="text-slate-600">{item.name}</span><strong className="tabular-nums text-slate-900">{formatEuro(item.value)}</strong><span className="tabular-nums text-slate-400">{(item.percent * 100).toFixed(1)}%</span></div>)}</div><div className="mt-5 flex gap-2 border-t border-slate-200 pt-3 text-[10px] text-slate-500"><AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-600" />La cripto representa una parte relevante del total.</div></div>
        </section>

        <section className="mt-3 overflow-hidden rounded-xl bg-[#f7f5ef] text-slate-900 shadow-[0_12px_30px_rgba(0,0,0,.14)]" id="activity-panel"><div className="flex flex-col gap-3 border-b border-slate-200 p-5 sm:flex-row sm:items-end sm:justify-between sm:p-6"><div><p className="mb-2 text-[9px] font-bold uppercase tracking-[0.16em] text-slate-400">Registro / historial</p><h2 className="text-lg font-semibold tracking-[-0.04em]">Actividad reciente</h2><p className="mt-2 max-w-2xl text-[10px] leading-relaxed text-slate-500">Conserva el histórico inicial y añade automáticamente cada compra, venta, dividendo, aportación o traspaso que registres desde la app.</p></div><div className="flex items-center justify-between gap-5 text-[10px] text-slate-400 sm:justify-end"><span>{operations.length} movimientos</span><button type="button" onClick={exportarOperaciones} className="inline-flex items-center gap-1 font-semibold text-slate-600 hover:text-slate-900"><Download className="h-3 w-3" />Exportar JSON</button></div></div><div className="overflow-x-auto"><table className="w-full min-w-[740px] border-collapse text-left"><thead><tr className="border-b border-slate-200 text-[9px] uppercase tracking-[0.1em] text-slate-400"><th className="px-5 py-3 font-bold sm:px-6">Fecha</th><th className="px-3 py-3 font-bold">Tipo</th><th className="px-3 py-3 font-bold">Activo</th><th className="px-3 py-3 font-bold">Custodia</th><th className="px-3 py-3 text-right font-bold">Cantidad</th><th className="px-3 py-3 text-right font-bold">Importe</th><th className="px-3 py-3 pr-5 font-bold sm:pr-6">Nota</th></tr></thead><tbody>{operations.slice(0, 8).map((operation) => <tr key={operation.id} className="border-b border-slate-100 text-[11px] last:border-0 hover:bg-[#f0eee8]"><td className="whitespace-nowrap px-5 py-3 text-slate-500 sm:px-6">{formatDate(operation.fecha)}</td><td className="px-3 py-3"><span className={`font-semibold ${operation.tipo === 'Compra' ? 'text-emerald-700' : operation.tipo === 'Venta' ? 'text-red-600' : 'text-slate-500'}`}>{operation.tipo}</span></td><td className="max-w-[240px] truncate px-3 py-3 font-medium text-slate-900">{operation.activo}</td><td className="px-3 py-3 text-slate-500">{operation.custodia}</td><td className="px-3 py-3 text-right tabular-nums text-slate-700">{formatQuantity(operation.cantidad)}</td><td className="px-3 py-3 text-right tabular-nums font-semibold text-slate-900">{formatEuro(operation.importe)}</td><td className="max-w-[280px] truncate px-3 py-3 pr-5 text-slate-400 sm:pr-6">{operation.notas || '—'}</td></tr>)}</tbody></table></div>{operations.length === 0 && <div className="flex flex-col gap-1 p-6 text-[11px] text-slate-400"><strong className="text-slate-900">Aún no hay operaciones.</strong><span>Registra una compra, venta, dividendo o traspaso para construir tu historial.</span></div>}</section>

        <footer className="flex flex-col gap-1 py-5 text-[10px] text-slate-500 sm:flex-row sm:items-center sm:justify-between"><span>FIN · cartera gestionada en la app · no es asesoramiento financiero</span><span className="inline-flex items-center gap-1.5"><ShieldCheck className="h-3 w-3" />Operaciones persistidas en tu cuenta</span></footer>

      <Dialog open={dateDialogOpen} onOpenChange={(open) => { setDateDialogOpen(open); if (!open) setDatePosition(null) }}>
        <DialogContent className="border-slate-200 bg-[#f7f5ef] text-slate-900 sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="tracking-[-0.04em]">Fecha de apertura</DialogTitle>
            <DialogDescription>
              Indica cuándo abriste {datePosition ? assetLabel(datePosition) : 'esta posición'} para calcular su antigüedad y rentabilidad temporal.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={(event) => { event.preventDefault(); void guardarFechaPosicion() }} className="grid gap-4">
            <div className="grid gap-2">
              <Label htmlFor="position-opening-date">Fecha real de la primera compra</Label>
              <Input id="position-opening-date" type="date" max={new Date().toISOString().slice(0, 10)} value={openingDate} onInput={(event) => setOpeningDate(event.currentTarget.value)} required />
            </div>
            <div className="flex gap-2 rounded-md bg-[#eeece5] px-3 py-2.5 text-[10px] leading-relaxed text-slate-500">
              <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              Las tasas diaria, mensual y anual son equivalencias compuestas del retorno actual durante ese periodo; no predicen rentabilidad futura.
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setDateDialogOpen(false)}>Cancelar</Button>
              <Button type="button" onClick={() => void guardarFechaPosicion()} className="bg-slate-900 text-white hover:bg-slate-700" disabled={savingDate}>{savingDate ? 'Guardando…' : 'Guardar fecha'}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={dialogOpen} onOpenChange={(open) => { setDialogOpen(open); if (!open) resetOperation() }}>
        <DialogContent className="max-h-[calc(100dvh-1rem)] w-[calc(100vw-1rem)] max-w-lg overflow-x-hidden overflow-y-auto overscroll-contain border-slate-200 bg-[#f7f5ef] p-4 text-slate-900 sm:w-full sm:p-6">
          <DialogHeader><DialogTitle className="tracking-[-0.04em]">Registrar operación</DialogTitle><DialogDescription>Guarda una compra, venta o movimiento para conservar el historial del portfolio.</DialogDescription></DialogHeader>
          <form onSubmit={guardarOperacion} className="grid min-w-0 gap-4">
            <div className="grid min-w-0 gap-3 sm:grid-cols-2"><div className="grid min-w-0 gap-2"><Label htmlFor="operation-type">Tipo</Label><select id="operation-type" value={operationType} onChange={(event) => handleOperationType(event.target.value as OperationType)} className="h-9 w-full min-w-0 rounded-md border border-slate-200 bg-white px-3 text-sm outline-none focus:border-slate-500"><option value="Compra">Compra</option><option value="Venta">Venta</option><option value="Dividendo">Dividendo</option><option value="Aportación">Aportación</option><option value="Traspaso">Traspaso</option></select></div><div className="grid min-w-0 gap-2"><Label htmlFor="operation-date">Fecha</Label><Input id="operation-date" type="date" value={fecha} onChange={(event) => setFecha(event.target.value)} required /></div></div>
            <div className="grid min-w-0 gap-2"><Label htmlFor="operation-position">Posición existente</Label><select id="operation-position" value={selectedPosition} onChange={(event) => seleccionarPosicion(event.target.value)} className="h-9 w-full min-w-0 max-w-full truncate rounded-md border border-slate-200 bg-white px-3 text-sm outline-none focus:border-slate-500"><option value="new">Nueva posición</option>{positions.map((position) => <option key={position.id} value={position.id}>{position.price_ticker || position.ticker} · {assetLabel(position)} · {position.custodia}</option>)}</select></div>
            <div className="grid min-w-0 gap-3 sm:grid-cols-[minmax(0,1.4fr)_minmax(0,.6fr)]"><div className="grid min-w-0 gap-2"><Label htmlFor="operation-asset">Activo</Label><Input id="operation-asset" value={activo} onChange={(event) => setActivo(event.target.value)} placeholder="Nombre del activo" required /></div><div className="grid min-w-0 gap-2"><Label htmlFor="operation-ticker">Ticker</Label><Input id="operation-ticker" value={ticker} onChange={(event) => setTicker(event.target.value)} placeholder="BTC, SXR8…" required /></div></div>
            <div className="grid min-w-0 gap-3 sm:grid-cols-2"><div className="grid min-w-0 gap-2"><Label htmlFor="operation-type-asset">Tipo de activo</Label><select id="operation-type-asset" value={tipoActivo} onChange={(event) => setTipoActivo(event.target.value)} className="h-9 w-full min-w-0 rounded-md border border-slate-200 bg-white px-3 text-sm outline-none focus:border-slate-500"><option value="Crypto">Crypto</option><option value="Crypto / Staking">Crypto / Staking</option><option value="ETF">ETF</option><option value="Acción">Acción</option><option value="Fondo">Fondo</option><option value="Otro">Otro</option></select></div><div className="grid min-w-0 gap-2"><Label htmlFor="operation-custody">Custodia / broker</Label><Input id="operation-custody" list="broker-suggestions" value={custodia} onChange={(event) => setCustodia(event.target.value)} placeholder="Trade Republic, XTB…" required /><datalist id="broker-suggestions"><option value="Trade Republic" /><option value="XTB" /><option value="Cold wallet" /><option value="Otro" /></datalist><p className="text-[9px] leading-relaxed text-slate-400">Indica dónde está custodiada; la cotización se actualiza por proveedor de mercado.</p></div></div>
            <div className="grid min-w-0 gap-3 sm:grid-cols-2"><div className="grid min-w-0 gap-2"><Label htmlFor="operation-quantity">Cantidad</Label><Input id="operation-quantity" type="number" min="0" step="any" value={cantidad} onChange={(event) => setCantidad(event.target.value)} placeholder="0,00" required /></div><div className="grid min-w-0 gap-2"><Label htmlFor="operation-price">Precio unitario (€)</Label><Input id="operation-price" type="number" min="0" step="any" value={precio} onChange={(event) => setPrecio(event.target.value)} placeholder="0,00" required /></div></div>
            <div className="grid min-w-0 gap-2"><Label htmlFor="operation-notes">Nota <span className="font-normal text-slate-400">(opcional)</span></Label><textarea id="operation-notes" value={notas} onChange={(event) => setNotas(event.target.value)} rows={3} placeholder="Comisión, motivo, referencia…" className="min-w-0 resize-y rounded-md border border-slate-200 bg-white px-3 py-2 text-sm outline-none placeholder:text-slate-400 focus:border-slate-500" /></div>
            <div className="flex min-w-0 gap-2 rounded-md bg-[#eeece5] px-3 py-2.5 text-[10px] leading-relaxed text-slate-500"><Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-slate-400" /><span className="min-w-0">La operación queda guardada en tu cuenta. No envía órdenes al broker.</span></div>
            <DialogFooter><Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button><Button type="submit" className="bg-slate-900 text-white hover:bg-slate-700" disabled={savingOperation}>{savingOperation ? 'Guardando…' : 'Guardar operación'}</Button></DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </InvestmentFrame>
  )
}
