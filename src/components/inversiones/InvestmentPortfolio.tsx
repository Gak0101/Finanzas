'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import {
  ArrowDown,
  ArrowUp,
  CalendarDays,
  ChevronDown,
  ChevronsUpDown,
  CircleDollarSign,
  CircleAlert,
  CheckCircle2,
  Clock3,
  Copy,
  Download,
  BriefcaseBusiness,
  Eye,
  EyeOff,
  Info,
  Loader2,
  Plus,
  RefreshCw,
  Search,
  ShieldCheck,
  Trash2,
  Wallet,
} from 'lucide-react'
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
import type { InversionAlerta, InversionOperacion, InversionPosicion } from '@/lib/db/schema'
import type { ClosedInvestmentPosition } from '@/lib/inversiones/history'
import { calculateClosedInvestmentPositions } from '@/lib/inversiones/history'
import { calculateInvestmentAnalytics, type InvestmentAnalytics } from '@/lib/inversiones/analytics'
import type { InvestmentCashSnapshot } from '@/lib/inversiones/cash'
import { StockFinder } from '@/components/buscador-acciones/StockFinder'
import { InvestmentAnalyticsPanel } from '@/components/inversiones/InvestmentAnalyticsPanel'
import { MarketHoursPanel } from '@/components/inversiones/MarketHoursPanel'
import { InvestmentNotificationAlerts } from '@/components/inversiones/InvestmentNotificationAlerts'
import { PositionDetailDialog, type PositionMetadataChanges } from '@/components/inversiones/PositionDetailDialog'
import { InvestmentPrivacyProvider, useInvestmentPrivacy } from '@/components/inversiones/InvestmentPrivacy'
import { Slide } from '@/components/animate-ui/primitives/effects/slide'
import { Fade } from '@/components/animate-ui/primitives/effects/fade'
import { RippleButton, RippleButtonRipples } from '@/components/animate-ui/components/buttons/ripple'
import { Magnetic } from '@/components/animate-ui/primitives/effects/magnetic'
import { SlidingNumber } from '@/components/animate-ui/primitives/texts/sliding-number'
import { Shine } from '@/components/animate-ui/primitives/effects/shine'
import { Tilt, TiltContent } from '@/components/animate-ui/primitives/effects/tilt'
import { inferIsin } from '@/lib/inversiones/instrumentIdentity'
import {
  buildDemoPortfolioData,
  DEFAULT_DEMO_PORTFOLIO,
  DEMO_PORTFOLIO_STORAGE_KEY,
  type DemoPortfolioConfig,
  type DemoPortfolioData,
} from '@/lib/inversiones/demoPortfolio'

type PortfolioData = {
  positions: InversionPosicion[]
  operations: InversionOperacion[]
  notificationAlerts: InversionAlerta[]
  closedPositions: ClosedInvestmentPosition[]
  analytics: InvestmentAnalytics
  cash: InvestmentCashSnapshot
}

type OperationType = 'Compra' | 'Venta' | 'Dividendo' | 'Aportación' | 'Traspaso'
type InvestmentFundingSource = 'saldo_existente' | 'capital_nuevo'
type ActivityFilter = 'all' | 'Venta' | 'Compra' | 'income'
type InvestmentTab = 'portfolio' | 'buscador'
type OperationAssetSearchResult = {
  key: string
  activo: string
  ticker: string
  tipo_activo: string
  price_ticker: string
  crypto_id: string | null
  market_symbol: string | null
  exchange: string | null
  isin: string | null
  precio_actual: number | null
  divisa: string | null
  precio_actual_as_of: string | null
  poseido: boolean
  posicion_id: number | null
}
type ScenarioPriceUpdate = {
  id: number
  price: number
  sourceUrl: string
  provider: string
  asOf?: string
  nativePrice: number
  nativeCurrency?: string
}
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
const QUANTITY_EPSILON = 1e-7

function operationTimestamp(operation: InversionOperacion) {
  const timestamp = new Date(operation.fecha_hora ?? `${operation.fecha}T00:00:00.000Z`).getTime()
  return Number.isFinite(timestamp) ? timestamp : operation.id
}

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

function formatOperationSearchPrice(value: number | null, currency: string | null) {
  if (value === null || !Number.isFinite(value)) return 'Precio no disponible'
  const formatted = new Intl.NumberFormat('es-ES', {
    minimumFractionDigits: value < 1 ? 4 : 2,
    maximumFractionDigits: value < 1 ? 6 : 2,
  }).format(value)
  const symbol = currency === 'EUR' ? '€' : currency === 'USD' ? '$' : currency === 'GBP' ? '£' : currency || ''
  return symbol ? `${formatted} ${symbol}` : formatted
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
  const { valuesVisible, toggleValues } = useInvestmentPrivacy()

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
            <button
              type="button"
              onClick={toggleValues}
              aria-pressed={!valuesVisible}
              aria-label={valuesVisible ? 'Ocultar valores de inversión' : 'Mostrar valores de inversión'}
              title={valuesVisible ? 'Ocultar valores' : 'Mostrar valores'}
              className="inline-flex items-center gap-1.5 rounded-md border border-white/15 px-2.5 py-1.5 text-[10px] font-semibold text-slate-300 transition hover:border-[#c8f56a]/60 hover:text-[#c8f56a]"
            >
              {valuesVisible ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
              <span className="hidden sm:inline">{valuesVisible ? 'Ocultar valores' : 'Mostrar valores'}</span>
            </button>
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

function AnimatedEuro({ value, className }: { value: number | null | undefined; className?: string }) {
  if (value === null || value === undefined || Number.isNaN(value)) return <span className={className}>—</span>
  return (
    <span className={`inline-flex items-baseline tabular-nums ${className ?? ''}`}>
      <SlidingNumber number={value} decimalSeparator="," decimalPlaces={2} thousandSeparator="." />
      <span className="ml-1 text-[0.62em] font-medium">€</span>
    </span>
  )
}

function PriceUpdateToast({ title, message, warning = false }: { title: string; message: string; warning?: boolean }) {
  return (
    <Shine enable enableOnHover enableOnTap asChild color={warning ? '#fbbf24' : '#c8f56a'} opacity={0.35} className="w-[min(100vw-2rem,390px)] rounded-2xl">
      <div className={`flex items-start gap-3 rounded-2xl border px-4 py-3.5 shadow-[0_18px_45px_rgba(15,23,42,0.24)] ${warning ? 'border-amber-200 bg-[#fff8e6] text-amber-950' : 'border-emerald-200 bg-[#effff4] text-emerald-950'}`}>
        <span className={`mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-full ${warning ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700'}`}>
          {warning ? <CircleAlert className="h-4 w-4" /> : <CheckCircle2 className="h-4 w-4" />}
        </span>
        <span className="min-w-0">
          <strong className="block text-sm font-semibold leading-tight">{title}</strong>
          <span className="mt-1 block text-xs leading-relaxed opacity-80">{message}</span>
          <span className="mt-2 inline-flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.12em] opacity-60">Datos de mercado sincronizados</span>
        </span>
      </div>
    </Shine>
  )
}

function formatCashAmount(value: number, currency: string) {
  const safeCurrency = /^[A-Z]{3}$/.test(currency) ? currency : 'EUR'
  return new Intl.NumberFormat('es-ES', {
    style: 'currency',
    currency: safeCurrency,
    maximumFractionDigits: 2,
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

type CashAdjustmentPayload = {
  cash: InvestmentCashSnapshot
  adjusted: boolean
  detail: {
    custodia: string
    divisa: string
    saldoAnterior: number
    saldoObjetivo: number
    importe: number
  }
}

function hasCashAdjustmentPayload(payload: unknown): payload is CashAdjustmentPayload {
  if (!payload || typeof payload !== 'object') return false
  const candidate = payload as Partial<CashAdjustmentPayload>
  return Boolean(
    typeof candidate.adjusted === 'boolean'
    && candidate.detail
    && typeof candidate.detail.custodia === 'string'
    && typeof candidate.detail.divisa === 'string'
    && typeof candidate.detail.saldoAnterior === 'number'
    && typeof candidate.detail.saldoObjetivo === 'number'
    && typeof candidate.detail.importe === 'number'
    && candidate.cash
    && typeof candidate.cash.totalEur === 'number'
    && Array.isArray(candidate.cash.balances),
  )
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
  if (status === 'REFERENCE') return 'bg-[#7e8bff]'
  return 'bg-[#9aa5ae]'
}

function positionIsin(position: InversionPosicion) {
  return position.isin || inferIsin(position.ticker, position.market_symbol)
}

async function copiarIsin(isin: string) {
  try {
    if (!navigator.clipboard) throw new Error('Portapapeles no disponible')
    await navigator.clipboard.writeText(isin)
    toast.success('ISIN copiado')
  } catch {
    toast.error('No se pudo copiar el ISIN')
  }
}

function ClosedPositionsPanel({ positions }: { positions: ClosedInvestmentPosition[] }) {
  const [limit, setLimit] = useState(8)
  if (positions.length === 0) {
    return (
      <section className="mt-3 rounded-xl bg-[#f7f5ef] p-5 text-slate-900 shadow-[0_12px_30px_rgba(0,0,0,.14)] sm:p-6" id="closed-positions">
        <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-400">Historial / cierres completos</p>
        <h2 className="mt-2 text-lg font-semibold tracking-[-0.04em]">Todavía no hay cierres completos</h2>
        <p className="mt-2 text-[11px] leading-relaxed text-slate-500">Cuando una venta deje una posición a cero, aparecerá aquí el ciclo completo con compras, ventas, resultado y rentabilidad.</p>
      </section>
    )
  }

  const realisedResult = positions.reduce((sum, position) => sum + position.resultado_realizado, 0)
  const profitable = positions.filter((position) => position.resultado_realizado > 0).length
  const visible = positions.slice(0, limit)

  return (
    <section className="mt-3 overflow-hidden rounded-xl bg-[#f7f5ef] text-slate-900 shadow-[0_12px_30px_rgba(0,0,0,.14)]" id="closed-positions">
      <div className="flex flex-col gap-5 border-b border-slate-200 p-5 sm:flex-row sm:items-end sm:justify-between sm:p-6">
        <div>
          <p className="mb-2 text-[9px] font-bold uppercase tracking-[0.16em] text-slate-400">Historial / cierres completos</p>
          <h2 className="text-lg font-semibold tracking-[-0.04em]">Cierres completos</h2>
          <p className="mt-2 max-w-2xl text-[10px] leading-relaxed text-slate-500">
            Una fila agrupa un ciclo entero: desde las compras hasta vender todas las unidades. Es el resumen de la inversión cerrada, no una operación aislada.
          </p>
        </div>
        <div className="grid grid-cols-3 gap-5 text-left sm:text-right">
          <div><p className="text-[9px] uppercase tracking-[0.1em] text-slate-400">Ciclos cerrados</p><strong className="mt-1 block text-sm tabular-nums">{positions.length}</strong></div>
          <div><p className="text-[9px] uppercase tracking-[0.1em] text-slate-400">Ciclos en positivo</p><strong className="mt-1 block text-sm tabular-nums">{profitable}</strong></div>
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
              <th className="px-3 py-3 text-right font-bold">Resultado neto</th>
              <th className="px-3 py-3 pr-5 text-right font-bold sm:pr-6">Rentabilidad del ciclo</th>
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

type PortfolioOption = {
  id: string
  name: string
  kind: 'real' | 'demo'
}

function PortfolioSwitcher({
  options,
  activeId,
  activeOption,
  onChange,
  onCreate,
  onRemove,
}: {
  options: PortfolioOption[]
  activeId: string
  activeOption: PortfolioOption
  onChange: (id: string) => void
  onCreate: () => void
  onRemove: (() => void) | null
}) {
  return (
    <section className="mb-4 flex flex-col gap-4 rounded-xl border border-white/10 bg-[#151b25] p-4 shadow-[0_12px_30px_rgba(0,0,0,.16)] sm:flex-row sm:items-center sm:justify-between sm:p-5" aria-label="Carteras de inversión">
      <div className="flex min-w-0 items-center gap-3">
        <div className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-[#c8f56a] text-[#172016]"><BriefcaseBusiness className="h-5 w-5" /></div>
        <div className="min-w-0">
          <p className="text-[9px] font-bold uppercase tracking-[0.16em] text-[#c8f56a]">Carteras</p>
          <div className="mt-1 flex flex-wrap items-center gap-2">
            <label htmlFor="investment-portfolio-selector" className="sr-only">Seleccionar cartera</label>
            <select
              id="investment-portfolio-selector"
              aria-label="Seleccionar cartera"
              value={activeId}
              onChange={(event) => onChange(event.target.value)}
              className="max-w-full rounded-md border border-white/15 bg-[#10161f] px-2.5 py-1.5 text-sm font-semibold text-slate-100 outline-none focus:border-[#c8f56a]"
            >
              {options.map((option) => <option key={option.id} value={option.id}>{option.name}{option.kind === 'demo' ? ' · Escenario' : ''}</option>)}
            </select>
            <span className={`rounded-full px-2 py-1 text-[9px] font-bold uppercase tracking-[0.08em] ${activeOption.kind === 'demo' ? 'bg-[#e7a35e]/20 text-[#f1bc7d]' : 'bg-[#c8f56a]/15 text-[#c8f56a]'}`}>
              {activeOption.kind === 'demo' ? 'Escenario' : 'Principal'}
            </span>
          </div>
          <p className="mt-1 text-[10px] text-slate-500">{activeOption.kind === 'demo' ? 'Vista local independiente de la cartera principal.' : 'Cartera persistida en tu cuenta.'}</p>
        </div>
      </div>
      <div className="flex shrink-0 flex-wrap gap-2 sm:justify-end">
        {onRemove ? <Button type="button" size="sm" variant="outline" className="border-white/15 bg-transparent text-slate-300 hover:bg-red-500/10 hover:text-red-200" onClick={onRemove}><Trash2 />Eliminar escenario</Button> : null}
        <Button type="button" size="sm" className="bg-[#c8f56a] text-[#172016] hover:bg-[#d8fb83]" onClick={onCreate}><Plus />Nueva cartera</Button>
      </div>
    </section>
  )
}

export function InvestmentPortfolio() {
  return (
    <InvestmentPrivacyProvider>
      <InvestmentPortfolioContent />
    </InvestmentPrivacyProvider>
  )
}

function InvestmentPortfolioContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [data, setData] = useState<PortfolioData | null>(null)
  const [demoPortfolios, setDemoPortfolios] = useState<DemoPortfolioConfig[]>([DEFAULT_DEMO_PORTFOLIO])
  const [demoPortfoliosHydrated, setDemoPortfoliosHydrated] = useState(false)
  const [scenarioDataOverrides, setScenarioDataOverrides] = useState<Record<string, DemoPortfolioData>>({})
  const [activePortfolioId, setActivePortfolioId] = useState('real')
  const [portfolioDialogOpen, setPortfolioDialogOpen] = useState(false)
  const [newPortfolioName, setNewPortfolioName] = useState('Nueva cartera Growth')
  const [newPortfolioCapital, setNewPortfolioCapital] = useState('20000')
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [lastPriceUpdate, setLastPriceUpdate] = useState<string | null>(null)
  const [updatingPrices, setUpdatingPrices] = useState(false)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [savingOperation, setSavingOperation] = useState(false)
  const [cashAdjustmentDialogOpen, setCashAdjustmentDialogOpen] = useState(false)
  const [savingCashAdjustment, setSavingCashAdjustment] = useState(false)
  const [cashAdjustmentCustodia, setCashAdjustmentCustodia] = useState('')
  const [cashAdjustmentDivisa, setCashAdjustmentDivisa] = useState('EUR')
  const [cashAdjustmentTarget, setCashAdjustmentTarget] = useState('')
  const [cashAdjustmentDate, setCashAdjustmentDate] = useState('')
  const [cashAdjustmentDescription, setCashAdjustmentDescription] = useState('')
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState('all')
  const [activityFilter, setActivityFilter] = useState<ActivityFilter>('all')
  const [positionSort, setPositionSort] = useState<PositionSort>('value_desc')
  const [dateDialogOpen, setDateDialogOpen] = useState(false)
  const [datePosition, setDatePosition] = useState<InversionPosicion | null>(null)
  const [openingDate, setOpeningDate] = useState('')
  const [savingDate, setSavingDate] = useState(false)
  const [operationType, setOperationType] = useState<OperationType>('Compra')
  const [fundingSource, setFundingSource] = useState<InvestmentFundingSource>('saldo_existente')
  const [selectedPosition, setSelectedPosition] = useState('new')
  const [fecha, setFecha] = useState('')
  const [activo, setActivo] = useState('')
  const [ticker, setTicker] = useState('')
  const [operationAssetResults, setOperationAssetResults] = useState<OperationAssetSearchResult[]>([])
  const [searchingOperationAsset, setSearchingOperationAsset] = useState(false)
  const [selectedOperationAsset, setSelectedOperationAsset] = useState<OperationAssetSearchResult | null>(null)
  const [operationPriceTicker, setOperationPriceTicker] = useState('')
  const [operationMarketSymbol, setOperationMarketSymbol] = useState<string | null>(null)
  const [operationCryptoId, setOperationCryptoId] = useState<string | null>(null)
  const [operationIsin, setOperationIsin] = useState('')
  const [tipoActivo, setTipoActivo] = useState('ETF')
  const [custodia, setCustodia] = useState('')
  const [cantidad, setCantidad] = useState('')
  const [precio, setPrecio] = useState('')
  const [notas, setNotas] = useState('')
  const [comision, setComision] = useState('')
  const [impuesto, setImpuesto] = useState('')
  const [operationCurrency, setOperationCurrency] = useState('EUR')
  const [detailPositionId, setDetailPositionId] = useState<number | null>(null)
  const activeTab: InvestmentTab = searchParams.get('tab') === 'buscador' ? 'buscador' : 'portfolio'

  function cambiarPestana(tab: InvestmentTab) {
    router.replace(tab === 'buscador' ? '/inversiones?tab=buscador' : '/inversiones', { scroll: true })
  }

  function crearDemoPortfolio() {
    const name = newPortfolioName.trim() || 'Cartera Growth personalizada'
    const capital = Number(newPortfolioCapital)
    if (!name || !Number.isFinite(capital) || capital <= 0) {
      toast.error('Indica un nombre y un capital positivo')
      return
    }

    const id = typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID()
      : `demo-${Date.now()}`
    const portfolio: DemoPortfolioConfig = {
      id,
      name,
      capital,
      createdAt: new Date().toISOString(),
    }
    setDemoPortfolios((current) => [...current, portfolio])
    setActivePortfolioId(portfolio.id)
    setPortfolioDialogOpen(false)
    toast.success('Cartera creada')
  }

  function eliminarDemoPortfolio() {
    if (!activeDemoPortfolio || activeDemoPortfolio.id === DEFAULT_DEMO_PORTFOLIO.id) return
    setDemoPortfolios((current) => current.filter((portfolio) => portfolio.id !== activeDemoPortfolio.id))
    setActivePortfolioId('real')
    toast.success('Cartera eliminada de este navegador')
  }

  async function cargarPortfolio(showLoading = true) {
    if (showLoading) setLoading(true)
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
      if (showLoading) setLoading(false)
    }
  }

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(DEMO_PORTFOLIO_STORAGE_KEY)
      const parsed = stored ? JSON.parse(stored) as unknown : []
      const saved = Array.isArray(parsed)
        ? parsed.filter((item): item is DemoPortfolioConfig => Boolean(
          item
          && typeof item === 'object'
          && typeof (item as DemoPortfolioConfig).id === 'string'
          && typeof (item as DemoPortfolioConfig).name === 'string'
          && Number.isFinite((item as DemoPortfolioConfig).capital)
          && ((item as DemoPortfolioConfig).targetReturnPct === undefined || Number.isFinite((item as DemoPortfolioConfig).targetReturnPct)),
        ))
        : []
      setDemoPortfolios([DEFAULT_DEMO_PORTFOLIO, ...saved.filter((item) => item.id !== DEFAULT_DEMO_PORTFOLIO.id && item.id !== 'demo-100k')])
    } catch {
      setDemoPortfolios([DEFAULT_DEMO_PORTFOLIO])
    } finally {
      setDemoPortfoliosHydrated(true)
    }
  }, [])

  useEffect(() => {
    if (!demoPortfoliosHydrated) return
    try {
      const customPortfolios = demoPortfolios.filter((portfolio) => portfolio.id !== DEFAULT_DEMO_PORTFOLIO.id)
      window.localStorage.setItem(DEMO_PORTFOLIO_STORAGE_KEY, JSON.stringify(customPortfolios))
    } catch {
      // Las carteras demo son una comodidad local y no deben romper la pantalla.
    }
  }, [demoPortfolios, demoPortfoliosHydrated])

  useEffect(() => {
    void cargarPortfolio()
  }, [])

  useEffect(() => {
    const query = activo.trim()
    if (!dialogOpen || selectedPosition !== 'new' || selectedOperationAsset || query.length < 2) {
      setOperationAssetResults([])
      setSearchingOperationAsset(false)
      return
    }

    const controller = new AbortController()
    const timer = window.setTimeout(async () => {
      setSearchingOperationAsset(true)
      try {
        const response = await fetch(`/api/inversiones/alertas/buscar-activo?q=${encodeURIComponent(query)}`, { cache: 'no-store', signal: controller.signal })
        const payload = await response.json().catch(() => null) as { results?: OperationAssetSearchResult[]; error?: string } | null
        if (!response.ok) throw new Error(payload?.error || 'No se pudo buscar el activo')
        setOperationAssetResults(payload?.results ?? [])
      } catch (error) {
        if (!controller.signal.aborted) toast.error(error instanceof Error ? error.message : 'No se pudo buscar el activo')
      } finally {
        if (!controller.signal.aborted) setSearchingOperationAsset(false)
      }
    }, 280)

    return () => {
      window.clearTimeout(timer)
      controller.abort()
    }
  }, [activo, dialogOpen, selectedOperationAsset, selectedPosition])

  const activeDemoPortfolio = demoPortfolios.find((portfolio) => portfolio.id === activePortfolioId) ?? null
  const isDemoPortfolio = activeDemoPortfolio !== null
  const demoData = useMemo(() => activeDemoPortfolio ? buildDemoPortfolioData(activeDemoPortfolio) : null, [activeDemoPortfolio])
  const activeDemoData = activeDemoPortfolio ? scenarioDataOverrides[activeDemoPortfolio.id] ?? demoData : null
  const activeData = isDemoPortfolio ? activeDemoData : data
  const activeOption: PortfolioOption = activeDemoPortfolio
    ? { id: activeDemoPortfolio.id, name: activeDemoPortfolio.name, kind: 'demo' }
    : { id: 'real', name: 'Cartera principal', kind: 'real' }
  const portfolioOptions: PortfolioOption[] = [
    { id: 'real', name: 'Cartera principal', kind: 'real' },
    ...demoPortfolios.map((portfolio) => ({ id: portfolio.id, name: portfolio.name, kind: 'demo' as const })),
  ]
  const positions = activeData?.positions ?? []
  const operations = activeData?.operations ?? []
  const notificationAlerts = activeData?.notificationAlerts ?? []
  const closedPositions = activeData?.closedPositions ?? []
  const analytics = activeData?.analytics ?? null
  const cash = isDemoPortfolio ? null : data?.cash ?? null
  const availableCashForOperation = cash?.balances.find((balance) => balance.custodia === custodia && balance.divisa === operationCurrency)?.saldo ?? 0
  const cashSummary = cash?.balances.map((balance) => `${balance.custodia}: ${formatCashAmount(balance.saldo, balance.divisa)}`).join(' · ')
  const cashCustodyOptions = useMemo(() => [...new Set(cash?.balances.map((balance) => balance.custodia) ?? [])], [cash?.balances])
  const cashCurrencyOptions = useMemo(() => [...new Set(['EUR', ...(cash?.balances.map((balance) => balance.divisa) ?? [])])], [cash?.balances])
  const cashAdjustmentCurrentBalance = cash?.balances.find((balance) => balance.custodia === cashAdjustmentCustodia.trim() && balance.divisa === cashAdjustmentDivisa.trim().toUpperCase())?.saldo ?? 0
  const detailPosition = positions.find((position) => position.id === detailPositionId) ?? null
  const detailAnalytics = analytics?.positionAnalytics.find((item) => item.positionId === detailPositionId) ?? null
  const positionAnalyticsById = useMemo(
    () => new Map((analytics?.positionAnalytics ?? []).map((item) => [item.positionId, item])),
    [analytics?.positionAnalytics],
  )
  const portfolioLastUpdated = useMemo(() => {
    const timestamps = positions
      .map((position) => position.updated_at ?? position.snapshot_at)
      .filter((value): value is string => Boolean(value))
      .map((value) => new Date(value).getTime())
      .filter(Number.isFinite)
    return timestamps.length > 0 ? new Date(Math.max(...timestamps)).toISOString() : null
  }, [positions])

  function updateScenarioData(change: (current: DemoPortfolioData) => DemoPortfolioData) {
    if (!activeDemoPortfolio) return
    setScenarioDataOverrides((current) => {
      const base = current[activeDemoPortfolio.id] ?? buildDemoPortfolioData(activeDemoPortfolio)
      return { ...current, [activeDemoPortfolio.id]: change(base) }
    })
  }

  function recalculateScenarioData(
    current: DemoPortfolioData,
    nextPositions = current.positions,
    nextOperations = current.operations,
    nextAlerts = current.notificationAlerts,
    nextSnapshots = current.snapshots,
  ): DemoPortfolioData {
    return {
      ...current,
      positions: nextPositions,
      operations: nextOperations,
      notificationAlerts: nextAlerts,
      closedPositions: calculateClosedInvestmentPositions(nextOperations, nextPositions),
      snapshots: nextSnapshots,
      analytics: calculateInvestmentAnalytics(nextPositions, nextOperations, nextSnapshots),
    }
  }

  async function guardarMetadataEscenario(positionId: number, changes: PositionMetadataChanges): Promise<InversionPosicion> {
    const currentPosition = positions.find((position) => position.id === positionId)
    if (!currentPosition) throw new Error('No se encontró la posición del escenario')

    const updated = { ...currentPosition, ...changes, updated_at: new Date().toISOString() }
    updateScenarioData((current) => recalculateScenarioData(
      current,
      current.positions.map((position) => position.id === positionId ? updated : position),
    ))
    return updated
  }

  function aplicarPreciosEscenario(updates: ScenarioPriceUpdate[]) {
    if (!isDemoPortfolio || updates.length === 0) return
    const updatesById = new Map(updates.map((update) => [update.id, update]))
    const now = new Date().toISOString()
    updateScenarioData((current) => {
      const nextPositionsWithoutWeights = current.positions.map((position) => {
        const update = updatesById.get(position.id)
        if (!update || !Number.isFinite(update.price) || update.price <= 0) return position
        const value = position.cantidad * update.price
        const cost = position.coste
        const pnl = cost === null ? null : value - cost
        return {
          ...position,
          precio_actual: update.price,
          precio_actual_nativo: update.nativeCurrency ? update.nativePrice : null,
          divisa_nativa: update.nativeCurrency ?? null,
          valor_actual: value,
          pnl,
          pnl_pct: cost !== null && cost > 0 && pnl !== null ? pnl / cost : null,
          fuente: 'Referencia de mercado',
          estado_fuente: 'REFERENCE',
          ultimo_valido: update.price,
          proveedor: update.provider,
          fuente_url: update.sourceUrl,
          snapshot_at: update.asOf ?? now,
          updated_at: now,
        }
      })
      const totalValue = nextPositionsWithoutWeights.reduce((sum, position) => sum + (position.valor_actual ?? 0), 0)
      const nextPositions = nextPositionsWithoutWeights.map((position) => ({
        ...position,
        peso: totalValue > 0 ? (position.valor_actual ?? 0) / totalValue : 0,
      }))
      const latestSnapshotDate = current.snapshots.map((snapshot) => snapshot.fecha_valoracion).toSorted().at(-1)
      const nextSnapshots = current.snapshots.map((snapshot) => {
        if (!latestSnapshotDate || snapshot.fecha_valoracion !== latestSnapshotDate) return snapshot
        const position = nextPositions.find((item) => item.id === snapshot.posicion_id)
        const update = position ? updatesById.get(position.id) : null
        if (!position || !update) return snapshot
        return {
          ...snapshot,
          cantidad: position.cantidad,
          coste_eur: position.coste,
          precio_eur: position.precio_actual,
          valor_eur: position.valor_actual,
          pnl_no_realizado_eur: position.pnl,
          precio_as_of: update.asOf ?? now,
          proveedor: update.provider,
          estado_precio: 'reference',
          updated_at: now,
        }
      })
      return recalculateScenarioData(current, nextPositions, current.operations, current.notificationAlerts, nextSnapshots)
    })
  }

  const summary = useMemo(() => {
    const totalValue = positions.reduce((sum, position) => sum + (position.valor_actual ?? 0), 0)
    const knownPositions = positions.filter((position) => position.coste !== null)
    const knownCost = knownPositions.reduce((sum, position) => sum + (position.coste ?? 0), 0)
    const knownPnl = knownPositions.reduce((sum, position) => sum + (position.pnl ?? 0), 0)
    const byType = positions.reduce<Record<string, number>>((acc, position) => {
      const rawType = position.tipo.trim()
      const type = rawType.toLocaleLowerCase('es').includes('crypto') ? 'Crypto' : rawType || 'Sin clasificar'
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

  const operationMetricsById = useMemo(
    () => new Map((analytics?.operationAnalytics ?? []).map((metric) => [metric.operationId, metric])),
    [analytics?.operationAnalytics],
  )
  const visibleOperations = useMemo(() => operations
    .filter((operation) => {
      if (activityFilter === 'all') return true
      if (activityFilter === 'income') return ['Dividendo', 'Bonificación', 'Aportación', 'Traspaso'].includes(operation.tipo)
      return operation.tipo === activityFilter
    })
    .slice(0, 12), [activityFilter, operations])

  function abrirAjusteEfectivo() {
    if (isDemoPortfolio) return

    const defaultBalance = cash?.balances.find((balance) => balance.divisa === 'EUR') ?? cash?.balances[0]
    setCashAdjustmentCustodia(defaultBalance?.custodia ?? '')
    setCashAdjustmentDivisa(defaultBalance?.divisa ?? 'EUR')
    setCashAdjustmentTarget(String(defaultBalance?.saldo ?? 0))
    setCashAdjustmentDate(new Date().toISOString().slice(0, 10))
    setCashAdjustmentDescription('')
    setCashAdjustmentDialogOpen(true)
  }

  async function guardarAjusteEfectivo() {
    if (isDemoPortfolio) return

    const selectedCustodia = cashAdjustmentCustodia.trim()
    const selectedDivisa = cashAdjustmentDivisa.trim().toUpperCase()
    const target = Number(cashAdjustmentTarget)

    if (!selectedCustodia) {
      toast.error('Indica la custodia del efectivo')
      return
    }
    if (!/^[A-Z]{3}$/.test(selectedDivisa)) {
      toast.error('Indica una divisa de tres letras, por ejemplo EUR')
      return
    }
    if (!cashAdjustmentDate) {
      toast.error('Indica la fecha del ajuste')
      return
    }
    if (!Number.isFinite(target) || target < 0) {
      toast.error('El saldo objetivo debe ser un número igual o mayor que cero')
      return
    }

    setSavingCashAdjustment(true)
    try {
      const response = await fetch('/api/inversiones/efectivo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          custodia: selectedCustodia,
          divisa: selectedDivisa,
          fecha: cashAdjustmentDate,
          saldo_objetivo: target,
          descripcion: cashAdjustmentDescription.trim() || undefined,
        }),
      })
      const payload = await response.json().catch(() => null)
      if (!response.ok) throw new Error(getErrorMessage(payload, 'No se pudo ajustar el saldo de efectivo'))
      if (!hasCashAdjustmentPayload(payload)) throw new Error(invalidApiResponseMessage(response))

      setData((current) => current ? { ...current, cash: payload.cash } : current)
      setCashAdjustmentDialogOpen(false)
      if (payload.adjusted) {
        toast.success(`Saldo ajustado a ${formatCashAmount(payload.detail.saldoObjetivo, payload.detail.divisa)} en ${payload.detail.custodia}`)
      } else {
        toast.success('El saldo ya coincidía con el objetivo; no se creó ningún movimiento')
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'No se pudo ajustar el saldo de efectivo')
    } finally {
      setSavingCashAdjustment(false)
    }
  }

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

    if (isDemoPortfolio) {
      const updated = { ...datePosition, fecha_apertura: openingDate, updated_at: new Date().toISOString() }
      updateScenarioData((current) => recalculateScenarioData(current, current.positions.map((position) => position.id === updated.id ? updated : position)))
      setDateDialogOpen(false)
      setDatePosition(null)
      toast.success('Fecha de apertura actualizada en el escenario')
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
    setFundingSource('saldo_existente')
    setSelectedPosition('new')
    setFecha(new Date().toISOString().slice(0, 10))
    setActivo('')
    setTicker('')
    setOperationAssetResults([])
    setSearchingOperationAsset(false)
    setSelectedOperationAsset(null)
    setOperationPriceTicker('')
    setOperationMarketSymbol(null)
    setOperationCryptoId(null)
    setOperationIsin('')
    setTipoActivo('ETF')
    setCustodia('')
    setCantidad('')
    setPrecio('')
    setNotas('')
    setComision('')
    setImpuesto('')
    setOperationCurrency('EUR')
  }

  function seleccionarPosicion(value: string) {
    setSelectedPosition(value)
    if (value === 'new') {
      setActivo('')
      setTicker('')
      setSelectedOperationAsset(null)
      setOperationAssetResults([])
      setOperationPriceTicker('')
      setOperationMarketSymbol(null)
      setOperationCryptoId(null)
      setOperationIsin('')
      setCustodia('')
      setCantidad('')
      setPrecio('')
      setOperationCurrency('EUR')
      return
    }
    const position = positions.find((item) => String(item.id) === value)
    if (!position) return
    setActivo(position.activo)
    setTicker(position.price_ticker || position.ticker)
    setSelectedOperationAsset(null)
    setOperationAssetResults([])
    setOperationPriceTicker(position.price_ticker || position.ticker)
    setOperationMarketSymbol(position.market_symbol)
    setOperationCryptoId(position.crypto_id)
    setOperationIsin(position.isin || '')
    setTipoActivo(position.tipo as typeof tipoActivo)
    setCustodia(position.custodia)
    setPrecio(position.precio_actual?.toString() ?? '')
    setOperationCurrency(position.divisa || 'EUR')
  }

  function handleOperationAssetChange(value: string) {
    setActivo(value)
    setTicker('')
    setSelectedPosition('new')
    setSelectedOperationAsset(null)
    setOperationPriceTicker('')
    setOperationMarketSymbol(null)
    setOperationCryptoId(null)
    setOperationIsin('')
    setOperationCurrency('EUR')
  }

  function chooseOperationAsset(result: OperationAssetSearchResult) {
    if (result.posicion_id !== null) seleccionarPosicion(String(result.posicion_id))
    else setSelectedPosition('new')
    setSelectedOperationAsset(result)
    setOperationAssetResults([])
    setActivo(result.activo)
    setTicker(result.price_ticker || result.ticker)
    setOperationPriceTicker(result.price_ticker || result.ticker)
    setOperationMarketSymbol(result.market_symbol)
    setOperationCryptoId(result.crypto_id)
    setOperationIsin(result.isin || '')
    setTipoActivo(result.tipo_activo)
    setOperationCurrency((result.divisa || 'EUR').toUpperCase())
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
    const fee = comision === '' ? 0 : Number(comision)
    const tax = impuesto === '' ? 0 : Number(impuesto)
    if (!fecha || !activo || !ticker || !custodia || !Number.isFinite(quantity) || quantity <= 0 || !Number.isFinite(unitPrice) || unitPrice < 0 || !Number.isFinite(fee) || fee < 0 || !Number.isFinite(tax) || tax < 0) {
      toast.error('Completa activo, custodia, cantidad y precio')
      return
    }

    if (isDemoPortfolio) {
      const selectedScenarioPosition = selectedPosition === 'new' ? null : positions.find((position) => String(position.id) === selectedPosition) ?? null
      if (operationType === 'Venta' && (!selectedScenarioPosition || quantity > selectedScenarioPosition.cantidad)) {
        toast.error('La venta debe corresponder a una posición del escenario y no superar su cantidad')
        return
      }
      const now = new Date().toISOString()
      const operation: InversionOperacion = {
        id: 93_000 + Math.floor(Date.now() / 1000),
        usuario_id: 0,
        fecha,
        fecha_hora: now,
        tipo: operationType,
        origen_fondos: operationType === 'Compra' ? fundingSource : null,
        tipo_externo: null,
        activo,
        ticker,
        tipo_activo: tipoActivo,
        custodia,
        cantidad: quantity,
        precio_unitario: unitPrice,
        importe: quantity * unitPrice,
        comision: fee,
        impuesto: tax,
        divisa: operationCurrency,
        fuente: 'Escenario local',
        external_id: null,
        descripcion: 'Movimiento añadido a la vista de escenario',
        notas: notas || null,
        created_at: now,
      }
      let nextPositions = positions.flatMap((position) => {
        if (!selectedScenarioPosition || position.id !== selectedScenarioPosition.id || operationType === 'Dividendo') return [position]
        const currentQuantity = position.cantidad
        const currentCost = position.coste ?? 0
        const averageCost = currentQuantity > 0 ? currentCost / currentQuantity : unitPrice
        const nextQuantity = operationType === 'Compra' ? currentQuantity + quantity : currentQuantity - quantity
        const nextCost = operationType === 'Compra'
          ? currentCost + quantity * unitPrice + fee + tax
          : Math.max(0, currentCost - quantity * averageCost)
        const nextValue = (position.precio_actual ?? unitPrice) * nextQuantity
        const nextPnl = nextValue - nextCost
        const updated = {
          ...position,
          cantidad: nextQuantity,
          coste: nextCost,
          precio_compra: nextQuantity > 0 ? nextCost / nextQuantity : null,
          valor_actual: nextValue,
          pnl: nextPnl,
          pnl_pct: nextCost > 0 ? nextPnl / nextCost : null,
          updated_at: now,
        }
        return nextQuantity > QUANTITY_EPSILON ? [updated] : []
      })

      if (!selectedScenarioPosition && operationType === 'Compra') {
        const currentPrice = unitPrice
        const positionCost = quantity * unitPrice + fee + tax
        const currentValue = quantity * currentPrice
        const inferredIsin = operationIsin || selectedOperationAsset?.isin || inferIsin(ticker, operationPriceTicker, operationMarketSymbol)
        nextPositions = [...nextPositions, {
          id: 94_000 + Math.floor(Date.now() / 1000),
          usuario_id: 0,
          custodia,
          broker: 'Escenario',
          activo,
          tipo: tipoActivo,
          ticker,
          isin: inferredIsin || null,
          price_ticker: operationPriceTicker || ticker,
          crypto_id: operationCryptoId,
          cantidad: quantity,
          precio_compra: unitPrice,
          coste: positionCost,
          objetivo_peso_pct: null,
          precio_actual: currentPrice,
          precio_actual_nativo: null,
          divisa_nativa: null,
          valor_actual: currentValue,
          pnl: currentValue - positionCost,
          pnl_pct: positionCost > 0 ? (currentValue - positionCost) / positionCost : null,
          peso: 0,
          fuente: 'Escenario local',
          estado_fuente: 'REFERENCE',
          ultimo_valido: currentPrice,
          fallback_map: null,
          proveedor: selectedOperationAsset ? 'Búsqueda de mercado · referencia' : null,
          fuente_url: `https://finance.yahoo.com/quote/${encodeURIComponent(ticker)}/history/`,
          nota: 'Posición añadida localmente al escenario.',
          snapshot_at: now,
          fecha_apertura: fecha,
          hoja_origen: activeDemoPortfolio?.name ?? 'Escenario local',
          fila_origen: null,
          incluido_resumen: true,
          divisa: operationCurrency,
          sector: null,
          pais: null,
          objetivo_precio: null,
          alerta_subida_pct: null,
          alerta_caida_pct: null,
          market_symbol: operationMarketSymbol,
          created_at: now,
          updated_at: now,
        }]
      }

      const totalScenarioValue = nextPositions.reduce((sum, position) => sum + (position.valor_actual ?? 0), 0)
      nextPositions = nextPositions.map((position) => ({
        ...position,
        peso: totalScenarioValue > 0 ? (position.valor_actual ?? 0) / totalScenarioValue : 0,
      }))
      updateScenarioData((current) => recalculateScenarioData(current, nextPositions, [...current.operations, operation]))
      setDialogOpen(false)
      resetOperation()
      toast.success(operationType === 'Venta' ? 'Venta añadida · revisa el capital liberado y el resultado arriba' : `${operationType} añadida al historial del escenario`)
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
          origen_fondos: operationType === 'Compra' ? fundingSource : undefined,
          activo,
          ticker,
          tipo_activo: tipoActivo,
          custodia,
          cantidad: quantity,
          precio_unitario: unitPrice,
          comision: fee,
          impuesto: tax,
          divisa: operationCurrency,
          notas: notas || undefined,
          price_ticker: operationPriceTicker || ticker,
          market_symbol: operationMarketSymbol || undefined,
          crypto_id: operationCryptoId || undefined,
          isin: operationIsin || undefined,
        }),
      })
      const payload = await response.json().catch(() => null)
      if (!response.ok) throw new Error(getErrorMessage(payload, 'No se pudo guardar la operación'))
      if (!hasPositionsPayload(payload)) throw new Error(invalidApiResponseMessage(response))
      const returnedPayload = payload as PortfolioData & { operation?: InversionOperacion }
      setData(returnedPayload)
      setDialogOpen(false)
      resetOperation()
      if (operationType === 'Venta' && returnedPayload.operation) {
        const metric = returnedPayload.analytics.operationAnalytics.find((item) => item.operationId === returnedPayload.operation?.id)
        const released = metric?.netCash === null || metric?.netCash === undefined ? null : formatEuro(metric.netCash)
        const result = metric?.realisedPnlNet === null || metric?.realisedPnlNet === undefined ? null : formatEuro(metric.realisedPnlNet)
        toast.success(`Venta registrada${released ? ` · ${released} liberados` : ''}${result ? ` · resultado neto ${result}` : ''}`)
      } else {
        toast.success(operationType === 'Compra'
          ? `Compra registrada · ${fundingSource === 'capital_nuevo' ? 'capital nuevo aplicado' : 'saldo disponible descontado'}`
          : `${operationType} registrada y añadida al historial`)
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'No se pudo guardar la operación')
    } finally {
      setSavingOperation(false)
    }
  }

  function actualizarPosicionLocal(updated: InversionPosicion) {
    if (isDemoPortfolio) {
      updateScenarioData((current) => recalculateScenarioData(current, current.positions.map((position) => position.id === updated.id ? updated : position)))
      return
    }
    setData((current) => current
      ? { ...current, positions: current.positions.map((position) => position.id === updated.id ? updated : position) }
      : current)
  }

  function abrirDetallePosition(positionId: number) {
    setDetailPositionId(positionId)
  }

  function abrirOperacionRapida(type: 'Compra' | 'Venta' | 'Dividendo', position: InversionPosicion) {
    setDetailPositionId(null)
    setOperationType(type)
    setFecha(new Date().toISOString().slice(0, 10))
    seleccionarPosicion(String(position.id))
    setCantidad(type === 'Compra' && position.coste === null ? position.cantidad.toString() : '')
    setDialogOpen(true)
  }

  async function actualizarPrecios() {
    if (isDemoPortfolio) {
      setUpdatingPrices(true)
      try {
        const response = await fetch('/api/inversiones/referencia-precios', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            assets: positions.map((position) => ({
              id: position.id,
              tipo_activo: position.tipo,
              ticker: position.ticker,
              crypto_id: position.crypto_id,
            })),
          }),
        })
        const payload = await response.json().catch(() => null) as {
          updates?: Array<{ id: number; price: number; nativePrice: number; nativeCurrency?: string; sourceUrl: string; provider: string; asOf?: string }>
          errors?: Array<{ id: number; error: string }>
          error?: string
        } | null
        if (!response.ok) throw new Error(getErrorMessage(payload, 'No se pudieron consultar las referencias de mercado'))

        aplicarPreciosEscenario(payload?.updates ?? [])

        const updatedCount = payload?.updates?.length ?? 0
        const errorCount = payload?.errors?.length ?? 0
        toast.custom(() => (
          <PriceUpdateToast
            title={errorCount > 0 ? 'Actualización parcial' : 'Precios actualizados'}
            message={errorCount > 0 ? `${updatedCount} precios listos · ${errorCount} pendientes` : `${updatedCount} precios actualizados con referencia de mercado`}
            warning={errorCount > 0}
          />
        ), { duration: 5200, unstyled: true })
      } catch (error) {
        toast.error(error instanceof Error ? error.message : 'No se pudieron actualizar las referencias')
      } finally {
        setUpdatingPrices(false)
      }
      return
    }
    setUpdatingPrices(true)
    try {
      const response = await fetch('/api/inversiones/actualizar-precios', { method: 'POST' })
      const payload = await response.json().catch(() => null)
      if (!response.ok) throw new Error(getErrorMessage(payload, 'No se pudieron actualizar los precios'))
      if (!hasPositionsPayload(payload)) throw new Error(invalidApiResponseMessage(response))
      setData((current) => current ? { ...current, positions: payload.positions } : current)
      await cargarPortfolio(false)
      if (typeof payload.updatedAt === 'string') setLastPriceUpdate(payload.updatedAt)
      const updated = typeof payload.updated === 'number' ? payload.updated : 0
      const errors = Array.isArray(payload.errors) ? payload.errors.filter((error: unknown): error is string => typeof error === 'string') : []
      if (errors.length > 0) {
        toast.custom(() => <PriceUpdateToast title="Actualización parcial" message={`${updated} precios listos · ${errors.length} fuentes requieren revisión`} warning />, { duration: 5200, unstyled: true })
      } else if (updated > 0) {
        toast.custom(() => <PriceUpdateToast title="Precios actualizados" message={`${updated} precios · cripto CoinGecko + ETFs Yahoo/Xetra`} />, { duration: 5200, unstyled: true })
      } else {
        toast.info('No hay precios nuevos que actualizar')
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

  return (
    <InvestmentFrame activeTab={activeTab} onChange={cambiarPestana} statusLabel={isDemoPortfolio ? 'Escenario local' : 'Cartera guardada en la app'}>
        <PortfolioSwitcher
          options={portfolioOptions}
          activeId={activePortfolioId}
          activeOption={activeOption}
          onChange={setActivePortfolioId}
          onCreate={() => setPortfolioDialogOpen(true)}
          onRemove={activeDemoPortfolio && activeDemoPortfolio.id !== DEFAULT_DEMO_PORTFOLIO.id ? eliminarDemoPortfolio : null}
        />
        <section className="flex flex-col gap-7 py-8 lg:flex-row lg:items-end lg:justify-between" id="inversiones">
          <div>
            <p className="mb-3 text-[10px] font-bold uppercase tracking-[0.18em] text-slate-500">Portfolio / visión general</p>
            <h1 className="max-w-2xl text-4xl font-medium leading-[0.98] tracking-[-0.06em] text-slate-50 sm:text-5xl lg:text-6xl">Tu cartera de inversión<br /><span className="text-[#c8f56a]">en movimiento.</span></h1>
            <p className="mt-4 max-w-xl text-sm text-slate-400">Valor actual, resultado de la cartera abierta, histórico y trazabilidad de cada posición.</p>
          </div>
          <div className="flex flex-col gap-4 lg:items-end">
              <div className="text-left lg:text-right"><p className="text-[10px] uppercase tracking-[0.12em] text-slate-500">Última actualización</p><p className="mt-1 text-xs font-medium text-slate-200">{formatDateTime(isDemoPortfolio ? portfolioLastUpdated : lastPriceUpdate ?? portfolioLastUpdated)}</p><p className="mt-1 text-[10px] text-slate-500">{isDemoPortfolio ? 'Precios de referencia: Yahoo Finance · último cierre disponible' : lastPriceUpdate ? 'CoinGecko + Yahoo/Xetra' : 'Precios y posiciones guardados en la app'}</p>{lastPriceUpdate && !isDemoPortfolio && <p className="mt-1 text-[10px] text-slate-500">ETFs: último cierre de mercado como referencia gratuita.</p>}</div>
            <div className="flex flex-wrap gap-2">
              <Magnetic onlyOnHover strength={0.14} range={90}><RippleButton variant="outline" size="sm" className="border-white/20 bg-transparent text-slate-100 hover:bg-white/10 hover:text-white" onClick={() => void actualizarPrecios()} disabled={updatingPrices}><RefreshCw className={updatingPrices ? 'animate-spin' : ''} />{updatingPrices ? 'Actualizando…' : 'Actualizar precios'}<RippleButtonRipples color="#c8f56a" /></RippleButton></Magnetic>
              <Magnetic onlyOnHover strength={0.14} range={90}><RippleButton size="sm" className="bg-[#c8f56a] text-[#172016] hover:bg-[#d8fb83]" onClick={abrirDialog}><Plus />Registrar operación<RippleButtonRipples color="#172016" /></RippleButton></Magnetic>
            </div>
          </div>
        </section>

        <MarketHoursPanel positions={positions} compact />

        <Fade inView inViewOnce className="grid gap-3 md:grid-cols-2 xl:grid-cols-4" aria-label="Resumen del portfolio">
          <Tilt maxTilt={6} perspective={1000} className="h-full">
            <TiltContent className="h-full">
              <Shine asChild enableOnHover enableOnTap color="#ffffff" opacity={0.3} className="h-full rounded-xl">
                <div className="h-full rounded-xl bg-[#c8f56a] p-5 text-[#172016] shadow-[0_16px_34px_rgba(0,0,0,.18)] md:col-span-2 xl:col-span-1"><div className="flex items-center justify-between text-xs font-semibold text-[#536a38]"><span>Valor actual</span><CircleDollarSign className="h-5 w-5" /></div><p className="mt-5 text-4xl font-semibold tracking-[-0.06em] tabular-nums"><AnimatedEuro value={analytics?.performance.totalValue ?? summary.totalValue} /></p><p className="mt-4 text-[10px] text-[#617946]">{positions.length} posiciones · valoración en EUR</p></div>
              </Shine>
            </TiltContent>
          </Tilt>
          <Tilt maxTilt={6} perspective={1000} className="h-full">
            <TiltContent className="h-full">
              <Shine asChild enableOnHover enableOnTap color="#c8f56a" opacity={0.25} className="h-full rounded-xl">
                <div className="h-full rounded-xl bg-[#f7f5ef] p-5 text-slate-900 shadow-[0_16px_34px_rgba(0,0,0,.14)]"><div className="flex items-center justify-between gap-2 text-xs font-semibold text-slate-500"><span>Efectivo disponible</span><div className="flex items-center gap-2">{!isDemoPortfolio && <Button type="button" variant="outline" size="sm" className="h-7 border-slate-300 bg-transparent px-2 text-[10px] text-slate-700 hover:bg-slate-100" onClick={abrirAjusteEfectivo}>Ajustar saldo</Button>}<Wallet className="h-4 w-4" /></div></div><p className="mt-5 text-3xl font-semibold tracking-[-0.06em] tabular-nums">{isDemoPortfolio ? '—' : <AnimatedEuro value={cash?.totalEur ?? 0} />}</p><p className="mt-4 text-[10px] leading-relaxed text-slate-400">{isDemoPortfolio ? 'Escenario local · sin ledger persistido' : cashSummary || 'Sin movimientos de efectivo registrados'}</p></div>
              </Shine>
            </TiltContent>
          </Tilt>
          <Tilt maxTilt={6} perspective={1000} className="h-full">
            <TiltContent className="h-full">
              <Shine asChild enableOnHover enableOnTap color="#c8f56a" opacity={0.25} className="h-full rounded-xl">
                <div className="h-full rounded-xl bg-[#e5edde] p-5 text-slate-900 shadow-[0_16px_34px_rgba(15,23,42,0.16)]"><div className="flex items-center justify-between text-xs font-semibold text-slate-500"><span>Resultado cartera abierta</span><span className={(analytics?.performance.unrealisedPnl ?? summary.knownPnl) >= 0 ? 'text-emerald-700' : 'text-red-600'}>{(analytics?.performance.unrealisedPnl ?? summary.knownPnl) >= 0 ? 'ganancia' : 'pérdida'}</span></div><p className={`mt-5 text-3xl font-semibold tracking-[-0.06em] tabular-nums ${(analytics?.performance.unrealisedPnl ?? summary.knownPnl) >= 0 ? 'text-emerald-700' : 'text-red-600'}`}><AnimatedEuro value={analytics?.performance.unrealisedPnl ?? summary.knownPnl} /></p><p className="mt-4 text-[10px] text-slate-500">Solo posiciones actuales · {formatPct(analytics?.performance.currentReturnPct ?? summary.knownReturn)}</p></div>
              </Shine>
            </TiltContent>
          </Tilt>
          <Tilt maxTilt={6} perspective={1000} className="h-full">
            <TiltContent className="h-full">
              <Shine asChild enableOnHover enableOnTap color="#c8f56a" opacity={0.25} className="h-full rounded-xl">
                <div className="h-full rounded-xl bg-[#f7f5ef] p-5 text-slate-900 shadow-[0_16px_34px_rgba(0,0,0,.14)]"><div className="flex items-center justify-between gap-2 text-xs font-semibold text-slate-500"><span>Resultado realizado</span><span className={(analytics?.performance.historicalNetResult ?? 0) >= 0 ? 'text-emerald-700' : 'text-red-600'}>{(analytics?.performance.historicalNetResult ?? 0) >= 0 ? 'ganancia' : 'pérdida'}</span></div><p className={`mt-5 text-3xl font-semibold tracking-[-0.06em] tabular-nums ${(analytics?.performance.historicalNetResult ?? 0) >= 0 ? 'text-emerald-700' : 'text-red-600'}`}><AnimatedEuro value={analytics?.performance.historicalNetResult ?? 0} /></p><p className="mt-4 text-[10px] text-slate-400">Ventas realizadas + ingresos − comisiones e impuestos</p></div>
              </Shine>
            </TiltContent>
          </Tilt>
        </Fade>

        <InvestmentNotificationAlerts
          rules={notificationAlerts}
          positions={positions}
          portfolioReturnPct={analytics?.performance.currentReturnPct ?? summary.knownReturn}
          scenarioMode={isDemoPortfolio}
          onScenarioPriceRefresh={isDemoPortfolio ? async (positionId, update) => aplicarPreciosEscenario([{ id: positionId, ...update }]) : undefined}
          onScenarioRulesChange={isDemoPortfolio ? async (nextRules) => {
            updateScenarioData((current) => recalculateScenarioData(current, current.positions, current.operations, nextRules))
          } : undefined}
          onChanged={() => cargarPortfolio(false)}
        />

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
            <div className="grid gap-2 p-4 lg:hidden">
              {filteredPositions.map((position, index) => {
                const isin = positionIsin(position)
                const positionAnalytics = positionAnalyticsById.get(position.id)
                return <Slide key={position.id} inView inViewOnce delay={Math.min(index * 45, 360)} className="w-full">
                  <Tilt maxTilt={4} perspective={900} className="w-full">
                    <Shine asChild enableOnHover enableOnTap color="#c8f56a" opacity={0.22} className="rounded-2xl">
                      <div
                        role="button"
                        tabIndex={0}
                        aria-label={`Abrir detalle de ${assetLabel(position)}`}
                        onClick={() => abrirDetallePosition(position.id)}
                        onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); abrirDetallePosition(position.id) } }}
                        className="relative cursor-pointer overflow-hidden rounded-2xl border border-slate-200 bg-[#eeece5] p-4 text-left shadow-[0_8px_24px_rgba(15,23,42,0.07)] transition duration-300 hover:-translate-y-0.5 hover:border-[#90b85f] hover:shadow-[0_14px_30px_rgba(15,23,42,0.12)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#90b85f]"
                      >
                        <span className="absolute inset-y-0 left-0 w-1" style={{ backgroundColor: TYPE_COLORS[position.tipo] ?? TYPE_COLORS.Otro }} />
                        <div className="flex items-start justify-between gap-3 pl-1">
                          <span className="min-w-0">
                            <span className="block truncate text-sm font-semibold tracking-[-0.02em] text-slate-900">{assetLabel(position)}</span>
                            <span className="mt-1 block truncate text-[11px] text-slate-500">{position.price_ticker || position.ticker} · {position.tipo} · {position.custodia}</span>
                            {isin ? <span className="mt-1 inline-flex max-w-full items-center gap-1 text-[10px] text-slate-500"><span className="truncate">ISIN {isin}</span><button type="button" title="Copiar ISIN" aria-label={`Copiar ISIN ${isin}`} className="shrink-0 rounded p-0.5 text-slate-400 hover:bg-white hover:text-slate-800" onClick={(event) => { event.stopPropagation(); void copiarIsin(isin) }}><Copy className="h-3 w-3" /></button></span> : <span className="mt-1 block text-[10px] text-slate-400">ISIN pendiente</span>}
                          </span>
                          <span className="shrink-0 text-right"><span className="block text-[9px] font-bold uppercase tracking-[0.1em] text-slate-400">Valor actual</span><strong className="mt-1 block text-base tabular-nums text-slate-900">{formatEuro(position.valor_actual)}</strong></span>
                        </div>
                        <div className="mt-4 grid grid-cols-2 gap-2 border-y border-slate-200/80 py-3 pl-1">
                          <span className="min-w-0"><span className="block text-[9px] font-bold uppercase tracking-[0.1em] text-slate-400">Precio actual</span><span className="mt-1 block truncate text-[11px] font-semibold tabular-nums text-slate-700">{formatEuro(position.precio_actual)}</span></span>
                          <span className="min-w-0 text-right"><span className="block text-[9px] font-bold uppercase tracking-[0.1em] text-slate-400">Resultado total</span><span className={`mt-1 block truncate text-[11px] font-semibold tabular-nums ${positionAnalytics?.totalNetResult === null || positionAnalytics?.totalNetResult === undefined ? 'text-slate-400' : positionAnalytics.totalNetResult >= 0 ? 'text-emerald-700' : 'text-red-600'}`}>{positionAnalytics?.totalNetResult === null || positionAnalytics?.totalNetResult === undefined ? 'Pendiente' : `${formatEuro(positionAnalytics.totalNetResult)} · ${formatPct(positionAnalytics.totalReturnPct)}`}</span></span>
                        </div>
                        <div className="flex items-end justify-between gap-3 pl-1 pt-3"><span className="text-[10px] text-slate-400">{position.fecha_apertura ? `Desde ${formatDate(position.fecha_apertura)}` : 'Fecha de compra pendiente'}</span><span className={`text-right text-[10px] tabular-nums ${position.pnl === null ? 'text-slate-400' : position.pnl >= 0 ? 'text-emerald-700/80' : 'text-red-600/80'}`}>{position.pnl === null ? 'Resultado abierto pendiente' : `Resultado abierto: ${formatEuro(position.pnl)} · ${formatPct(position.pnl_pct)}`}</span></div>
                      </div>
                    </Shine>
                  </Tilt>
                </Slide>
              })}
              {filteredPositions.length === 0 ? (
                <div className="rounded-lg border border-dashed border-slate-300 p-5 text-center text-[11px] text-slate-500">
                  No hay posiciones que coincidan. <button type="button" className="font-semibold text-slate-900" onClick={() => { setSearch(''); setFilter('all') }}>Limpiar filtros</button>
                </div>
              ) : null}
            </div>
            <div className="hidden overflow-x-auto lg:block">
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
                    const isin = positionIsin(position)
                    const positionAnalytics = positionAnalyticsById.get(position.id)
                    return (
                      <tr
                        key={position.id}
                        tabIndex={0}
                        aria-label={`Abrir detalle de ${assetLabel(position)}`}
                        onClick={() => abrirDetallePosition(position.id)}
                        onKeyDown={(event) => { if (event.key === 'Enter') abrirDetallePosition(position.id) }}
                        className="cursor-pointer border-b border-slate-100 text-[11px] outline-none last:border-0 hover:bg-[#f0eee8] focus-visible:bg-[#e9e7df]"
                      >
                        <td className="px-5 py-3 sm:px-6">
                          <div className="flex min-w-[210px] items-center gap-2.5">
                            <span className="grid h-7 w-7 shrink-0 place-items-center rounded-md text-[9px] font-bold" style={{ backgroundColor: `${TYPE_COLORS[position.tipo] ?? TYPE_COLORS.Otro}33`, color: position.tipo === 'Crypto' ? '#587c2a' : '#5963ba' }}>{(position.price_ticker || position.ticker).slice(0, 4)}</span>
                            <div className="min-w-0">
                              <p className="max-w-[220px] truncate font-semibold text-slate-900">{assetLabel(position)}</p>
                              <p className="mt-0.5 truncate text-[9px] text-slate-400">{position.price_ticker || position.ticker} · {formatQuantity(position.cantidad)}</p>
                              {isin ? <p className="mt-0.5 inline-flex max-w-full items-center gap-1 text-[9px] text-slate-500"><span className="truncate">ISIN {isin}</span><button type="button" title="Copiar ISIN" aria-label={`Copiar ISIN ${isin}`} className="shrink-0 rounded p-0.5 text-slate-400 hover:bg-white hover:text-slate-800" onClick={(event) => { event.stopPropagation(); void copiarIsin(isin) }}><Copy className="h-3 w-3" /></button></p> : <p className="mt-0.5 text-[9px] text-slate-400">ISIN pendiente</p>}
                            </div>
                          </div>
                        </td>
                        <td className="max-w-[140px] px-3 py-3">
                          <p className="whitespace-nowrap text-slate-600">{position.tipo}</p>
                          <p className="mt-0.5 truncate text-[9px] text-slate-400">{position.custodia}</p>
                        </td>
                        <td className="whitespace-nowrap px-3 py-3 text-right tabular-nums font-semibold text-slate-900">{formatEuro(position.precio_actual)}</td>
                        <td className="whitespace-nowrap px-3 py-3 text-right tabular-nums font-semibold text-slate-900">{formatEuro(position.valor_actual)}</td>
                        <td className="whitespace-nowrap px-3 py-3 text-right tabular-nums">
                          <p className={`font-semibold ${positionAnalytics?.totalNetResult === null || positionAnalytics?.totalNetResult === undefined ? 'text-slate-400' : positionAnalytics.totalNetResult >= 0 ? 'text-emerald-700' : 'text-red-600'}`}>{positionAnalytics?.totalNetResult === null || positionAnalytics?.totalNetResult === undefined ? '—' : `${positionAnalytics.totalNetResult >= 0 ? '+' : ''}${formatEuro(positionAnalytics.totalNetResult)}`}</p>
                          <p className={`mt-0.5 text-[9px] font-semibold ${positionAnalytics?.totalReturnPct === null || positionAnalytics?.totalReturnPct === undefined ? 'text-slate-400' : positionAnalytics.totalReturnPct >= 0 ? 'text-emerald-700' : 'text-red-600'}`}>Total histórico {formatPct(positionAnalytics?.totalReturnPct)}</p>
                          <p className={`mt-0.5 text-[9px] font-normal ${position.pnl === null ? 'text-slate-400' : position.pnl >= 0 ? 'text-emerald-700/80' : 'text-red-600/80'}`}>Abierta {position.pnl === null ? '—' : `${position.pnl >= 0 ? '+' : ''}${formatEuro(position.pnl)} · ${formatPct(position.pnl_pct)}`}</p>
                        </td>
                        <td className="px-3 py-3">
                          {position.fecha_apertura && metrics ? (
                            <button type="button" onClick={(event) => { event.stopPropagation(); abrirFechaPosicion(position) }} className="group/date text-left" title="Editar fecha de apertura">
                              <span className="inline-flex items-center gap-1.5 whitespace-nowrap font-medium text-slate-700 group-hover/date:text-slate-950"><CalendarDays className="h-3.5 w-3.5" />{formatDate(position.fecha_apertura)}</span>
                              <span className="mt-1 flex items-center gap-1 text-[9px] text-slate-400"><Clock3 className="h-3 w-3" />{metrics.elapsedDays} {metrics.elapsedDays === 1 ? 'día' : 'días'} activa</span>
                            </button>
                          ) : (
                            <button type="button" onClick={(event) => { event.stopPropagation(); abrirFechaPosicion(position) }} className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-md border border-dashed border-slate-300 px-2 py-1.5 text-[9px] font-semibold text-slate-500 hover:border-slate-500 hover:text-slate-900">
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
                          <span className="inline-flex items-center gap-1.5 whitespace-nowrap text-[9px] text-slate-500"><span className={`h-1.5 w-1.5 rounded-full ${sourceDotClass(position.estado_fuente)}`} />{position.estado_fuente === 'FALLBACK' ? 'Fallback' : position.estado_fuente === 'API_OK' ? 'API OK' : position.estado_fuente === 'REFERENCE' ? 'Referencia' : 'Manual'}</span>
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

        </section>

        {analytics ? (
          <InvestmentAnalyticsPanel
            analytics={analytics}
            positions={positions}
            closedPositions={closedPositions}
            onRefresh={() => void actualizarPrecios()}
            onOpenPosition={abrirDetallePosition}
          />
        ) : null}

        <ClosedPositionsPanel positions={closedPositions} />

        <section className="mt-3 overflow-hidden rounded-xl bg-[#f7f5ef] text-slate-900 shadow-[0_12px_30px_rgba(0,0,0,.14)]" id="activity-panel">
          <div className="flex flex-col gap-4 border-b border-slate-200 p-5 sm:p-6 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="mb-2 text-[9px] font-bold uppercase tracking-[0.16em] text-slate-400">Registro / operaciones individuales</p>
              <h2 className="text-lg font-semibold tracking-[-0.04em]">Movimientos individuales</h2>
              <p className="mt-2 max-w-2xl text-[10px] leading-relaxed text-slate-500">Una fila es una operación. En las ventas verás el dinero neto recibido, el resultado neto y la rentabilidad sobre el coste medio de las unidades vendidas.</p>
              <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1.5 text-[10px] text-slate-500">
                <span className="inline-flex items-center gap-1.5"><Info className="h-3 w-3 text-slate-400" />Flujo neto = efectivo que entra o sale</span>
                <span className="inline-flex items-center gap-1.5"><Info className="h-3 w-3 text-slate-400" />Rentabilidad = resultado neto ÷ coste vendido</span>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2 text-[10px] text-slate-400 lg:justify-end">
              <span>{operations.length} movimientos</span>
              <select aria-label="Filtrar movimientos" value={activityFilter} onChange={(event) => setActivityFilter(event.target.value as ActivityFilter)} className="h-8 rounded-md border border-slate-200 bg-[#eeece5] px-2.5 text-[10px] font-medium text-slate-600 outline-none">
                <option value="all">Todos</option>
                <option value="Venta">Ventas</option>
                <option value="Compra">Compras</option>
                <option value="income">Ingresos y aportaciones</option>
              </select>
              <button type="button" onClick={exportarOperaciones} className="inline-flex items-center gap-1 font-semibold text-slate-600 hover:text-slate-900"><Download className="h-3 w-3" />Exportar JSON</button>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1160px] border-collapse text-left">
              <thead><tr className="border-b border-slate-200 text-[9px] uppercase tracking-[0.1em] text-slate-400"><th className="px-5 py-3 font-bold sm:px-6">Fecha</th><th className="px-3 py-3 font-bold">Tipo</th><th className="px-3 py-3 font-bold">Activo</th><th className="px-3 py-3 font-bold">Custodia</th><th className="px-3 py-3 text-right font-bold">Cantidad</th><th className="px-3 py-3 text-right font-bold">Importe operación</th><th className="px-3 py-3 text-right font-bold">Flujo neto</th><th className="px-3 py-3 text-right font-bold">Coste vendido</th><th className="px-3 py-3 text-right font-bold">Resultado neto</th><th className="px-3 py-3 text-right font-bold">Rentabilidad</th><th className="px-3 py-3 pr-5 font-bold sm:pr-6">Nota</th></tr></thead>
              <tbody>
                {visibleOperations.map((operation) => {
                  const metric = operationMetricsById.get(operation.id)
                  const result = metric?.realisedPnlNet
                  return <tr key={operation.id} className="border-b border-slate-100 text-[11px] last:border-0 hover:bg-[#f0eee8]">
                    <td className="whitespace-nowrap px-5 py-3 text-slate-500 sm:px-6">{formatDate(operation.fecha)}</td>
                    <td className="px-3 py-3"><span className={`font-semibold ${operation.tipo === 'Compra' ? 'text-emerald-700' : operation.tipo === 'Venta' ? 'text-red-600' : 'text-slate-500'}`}>{operation.tipo}</span></td>
                    <td className="max-w-[240px] truncate px-3 py-3 font-medium text-slate-900">{operation.activo}</td>
                    <td className="px-3 py-3 text-slate-500">{operation.custodia}</td>
                    <td className="px-3 py-3 text-right tabular-nums text-slate-700">{formatQuantity(operation.cantidad)}</td>
                    <td className="px-3 py-3 text-right tabular-nums font-semibold text-slate-900">{formatEuro(operation.importe)}</td>
                    <td className={`px-3 py-3 text-right tabular-nums ${operation.tipo === 'Venta' ? 'font-semibold text-emerald-700' : 'text-slate-500'}`}>{metric?.netCash === null || metric?.netCash === undefined ? '—' : formatEuro(metric.netCash)}</td>
                    <td className="px-3 py-3 text-right tabular-nums text-slate-500">{operation.tipo === 'Venta' && metric?.assignedCost !== null && metric?.assignedCost !== undefined ? formatEuro(metric.assignedCost) : '—'}</td>
                    <td className={`px-3 py-3 text-right font-semibold tabular-nums ${result === null || result === undefined ? 'text-slate-400' : result >= 0 ? 'text-emerald-700' : 'text-red-600'}`}>{result === null || result === undefined ? '—' : formatEuro(result)}</td>
                    <td className={`px-3 py-3 text-right font-semibold tabular-nums ${result === null || result === undefined || metric?.assignedCost === null || metric?.assignedCost === undefined || metric.assignedCost <= 0 ? 'text-slate-400' : result >= 0 ? 'text-emerald-700' : 'text-red-600'}`}>{result === null || result === undefined || metric?.assignedCost === null || metric?.assignedCost === undefined || metric.assignedCost <= 0 ? '—' : formatPct(result / metric.assignedCost)}</td>
                    <td className="max-w-[280px] truncate px-3 py-3 pr-5 text-slate-400 sm:pr-6">{operation.notas || '—'}</td>
                  </tr>
                })}
              </tbody>
            </table>
          </div>
          {operations.length === 0 ? <div className="flex flex-col gap-1 p-6 text-[11px] text-slate-400"><strong className="text-slate-900">Aún no hay operaciones.</strong><span>Registra una compra, venta, dividendo o traspaso para construir tu historial.</span></div> : visibleOperations.length === 0 ? <div className="p-6 text-[11px] text-slate-500">No hay movimientos de este tipo.</div> : <div className="border-t border-slate-200 px-5 py-3 text-[10px] text-slate-400 sm:px-6">Mostrando {visibleOperations.length} movimientos filtrados · en ventas, el porcentaje usa el coste medio asignado a las unidades vendidas.</div>}
        </section>

        <footer className="flex flex-col gap-1 py-5 text-[10px] text-slate-500 sm:flex-row sm:items-center sm:justify-between"><span>FIN · {isDemoPortfolio ? 'escenario local · precios de referencia' : 'cartera gestionada en la app'} · no es asesoramiento financiero</span><span className="inline-flex items-center gap-1.5"><ShieldCheck className="h-3 w-3" />{isDemoPortfolio ? 'Cambios locales en este escenario' : 'Operaciones persistidas en tu cuenta'}</span></footer>

      <PositionDetailDialog
          position={detailPosition}
          analytics={detailAnalytics}
          operations={operations}
          open={detailPosition !== null}
          onOpenChange={(open) => { if (!open) setDetailPositionId(null) }}
          onUpdated={(updated) => { actualizarPosicionLocal(updated); if (!isDemoPortfolio) void cargarPortfolio(false) }}
          onStartOperation={abrirOperacionRapida}
          onSaveMetadata={isDemoPortfolio ? guardarMetadataEscenario : undefined}
        />

      {!isDemoPortfolio && <Dialog open={cashAdjustmentDialogOpen} onOpenChange={setCashAdjustmentDialogOpen}>
        <DialogContent className="border-slate-200 bg-[#f7f5ef] text-slate-900 sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="tracking-[-0.04em]">Ajustar saldo de efectivo</DialogTitle>
            <DialogDescription>
              Reconcilia el saldo de una custodia y divisa sin crear ni modificar operaciones de inversión.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={(event) => { event.preventDefault(); void guardarAjusteEfectivo() }} className="grid gap-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="grid gap-2">
                <Label htmlFor="cash-adjustment-custody">Custodia</Label>
                <Input id="cash-adjustment-custody" list="cash-adjustment-custody-options" value={cashAdjustmentCustodia} onChange={(event) => setCashAdjustmentCustodia(event.target.value)} placeholder="Trade Republic, XTB…" required />
                <datalist id="cash-adjustment-custody-options">{cashCustodyOptions.map((option) => <option key={option} value={option} />)}</datalist>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="cash-adjustment-currency">Divisa</Label>
                <Input id="cash-adjustment-currency" list="cash-adjustment-currency-options" value={cashAdjustmentDivisa} onChange={(event) => setCashAdjustmentDivisa(event.target.value.toUpperCase())} placeholder="EUR" maxLength={3} required />
                <datalist id="cash-adjustment-currency-options">{cashCurrencyOptions.map((option) => <option key={option} value={option} />)}</datalist>
              </div>
            </div>
            <div className="flex items-center justify-between gap-3 rounded-lg bg-[#eeece5] px-3 py-2.5 text-[10px] text-slate-500">
              <span>Saldo actual en la combinación seleccionada</span>
              <strong className="text-sm tabular-nums text-slate-800">{formatCashAmount(cashAdjustmentCurrentBalance, cashAdjustmentDivisa)}</strong>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="cash-adjustment-target">Saldo objetivo</Label>
              <Input id="cash-adjustment-target" type="number" min="0" step="any" value={cashAdjustmentTarget} onChange={(event) => setCashAdjustmentTarget(event.target.value)} placeholder="0,00" required />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="cash-adjustment-date">Fecha</Label>
              <Input id="cash-adjustment-date" type="date" value={cashAdjustmentDate} onChange={(event) => setCashAdjustmentDate(event.target.value)} required />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="cash-adjustment-description">Nota <span className="font-normal text-slate-400">(opcional)</span></Label>
              <textarea id="cash-adjustment-description" value={cashAdjustmentDescription} onChange={(event) => setCashAdjustmentDescription(event.target.value)} maxLength={500} rows={3} placeholder="Motivo de la conciliación…" className="resize-y rounded-md border border-slate-200 bg-white px-3 py-2 text-sm outline-none placeholder:text-slate-400 focus:border-slate-500" />
            </div>
            <div className="flex gap-2 rounded-md bg-[#eeece5] px-3 py-2.5 text-[10px] leading-relaxed text-slate-500"><Info className="mt-0.5 h-3.5 w-3.5 shrink-0" /><span>Solo se registra la diferencia necesaria en el libro de efectivo. Si no hay diferencia relevante, no se crea ningún movimiento.</span></div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setCashAdjustmentDialogOpen(false)}>Cancelar</Button>
              <Button type="submit" className="bg-slate-900 text-white hover:bg-slate-700" disabled={savingCashAdjustment}>{savingCashAdjustment ? 'Guardando…' : 'Guardar ajuste'}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>}

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

      <Dialog open={portfolioDialogOpen} onOpenChange={setPortfolioDialogOpen}>
        <DialogContent className="border-slate-200 bg-[#f7f5ef] text-slate-900 sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="tracking-[-0.04em]">Nueva cartera</DialogTitle>
            <DialogDescription>
              Crea una vista local independiente para comparar una cartera. La cartera principal y las alertas de n8n no se modificarán.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={(event) => { event.preventDefault(); crearDemoPortfolio() }} className="grid gap-4">
            <div className="grid gap-2">
              <Label htmlFor="demo-portfolio-name">Nombre</Label>
              <Input id="demo-portfolio-name" value={newPortfolioName} onChange={(event) => setNewPortfolioName(event.target.value)} placeholder="Mi cartera de crecimiento" required />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="demo-portfolio-capital">Capital inicial (€)</Label>
              <Input id="demo-portfolio-capital" type="number" min="1" step="1000" value={newPortfolioCapital} onChange={(event) => setNewPortfolioCapital(event.target.value)} required />
            </div>
            <div className="rounded-lg bg-[#eeece5] px-3 py-2.5 text-[10px] leading-relaxed text-slate-500">
              El resultado se calcula con el histórico de mercado de las posiciones de referencia.
            </div>
            <div className="rounded-lg border border-[#e7a35e]/35 bg-[#fff3df] px-3 py-2.5 text-[10px] leading-relaxed text-[#795329]">
              La vista es independiente; sus cambios se guardan solo en este navegador y no modifican tu cartera principal ni las alertas de n8n.
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setPortfolioDialogOpen(false)}>Cancelar</Button>
              <Button type="button" onClick={crearDemoPortfolio} className="bg-slate-900 text-white hover:bg-slate-700"><BriefcaseBusiness />Crear cartera</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={dialogOpen} onOpenChange={(open) => { setDialogOpen(open); if (!open) resetOperation() }}>
        <DialogContent className="max-h-[calc(100dvh-1rem)] w-[calc(100vw-1rem)] max-w-lg grid-rows-[auto_minmax(0,1fr)] overflow-hidden border-slate-200 bg-[#f7f5ef] p-4 text-slate-900 sm:max-h-[90vh] sm:w-full sm:p-6">
          <DialogHeader><DialogTitle className="tracking-[-0.04em]">Registrar operación</DialogTitle><DialogDescription>Guarda una compra, venta o movimiento para conservar el historial del portfolio.</DialogDescription></DialogHeader>
          <form onSubmit={guardarOperacion} className="min-h-0 overflow-y-auto overscroll-contain pr-1 sm:pr-2">
            <div className="grid min-w-0 gap-4 pb-1">
              <div className="grid min-w-0 gap-3 sm:grid-cols-2">
                <div className="grid min-w-0 gap-2"><Label htmlFor="operation-type">Tipo</Label><select id="operation-type" value={operationType} onChange={(event) => handleOperationType(event.target.value as OperationType)} className="h-10 w-full min-w-0 rounded-md border border-slate-200 bg-white px-3 text-base outline-none focus:border-slate-500 sm:text-sm"><option value="Compra">Compra</option><option value="Venta">Venta</option><option value="Dividendo">Dividendo</option><option value="Aportación">Aportación</option><option value="Traspaso">Traspaso</option></select></div>
                <div className="grid min-w-0 gap-2"><Label htmlFor="operation-date">Fecha</Label><Input id="operation-date" type="date" value={fecha} onChange={(event) => setFecha(event.target.value)} className="h-10 text-base sm:text-sm" required /></div>
              </div>
              <div className="grid min-w-0 gap-2"><Label htmlFor="operation-position">Posición existente</Label><select id="operation-position" value={selectedPosition} onChange={(event) => seleccionarPosicion(event.target.value)} className="h-10 w-full min-w-0 max-w-full truncate rounded-md border border-slate-200 bg-white px-3 text-base outline-none focus:border-slate-500 sm:text-sm"><option value="new">Nueva posición</option>{positions.map((position) => <option key={position.id} value={position.id}>{assetLabel(position)} · {position.price_ticker || position.ticker}</option>)}</select><p className="text-[9px] leading-relaxed text-slate-400">Si no existe todavía, escribe el nombre del activo y selecciona su mercado.</p></div>
              <div className="grid min-w-0 gap-3 sm:grid-cols-[minmax(0,1.4fr)_minmax(0,.6fr)]">
                <div className="grid min-w-0 gap-2">
                  <Label htmlFor="operation-asset">Activo / mercado</Label>
                  <div className="relative min-w-0">
                    <Search className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-slate-400" />
                    <Input id="operation-asset" value={activo} onChange={(event) => handleOperationAssetChange(event.target.value)} placeholder="Busca empresa, ETF o crypto…" autoComplete="off" readOnly={Boolean(selectedOperationAsset)} role="combobox" aria-autocomplete="list" aria-controls="operation-asset-results" aria-expanded={operationAssetResults.length > 0} className="h-10 w-full min-w-0 pl-9 pr-10 text-base sm:text-sm" required />
                    {searchingOperationAsset ? <Loader2 className="absolute right-3 top-3 h-4 w-4 animate-spin text-slate-400" /> : null}
                    {operationAssetResults.length > 0 ? <div id="operation-asset-results" role="listbox" className="absolute left-0 right-0 top-full z-30 mt-1 max-h-64 overflow-y-auto rounded-md border border-slate-200 bg-white p-1 shadow-xl">
                      {operationAssetResults.map((result) => <button type="button" role="option" key={result.key} className="flex w-full min-w-0 items-start justify-between gap-3 rounded px-3 py-2.5 text-left hover:bg-slate-50 focus:bg-slate-50 focus:outline-none" onClick={() => chooseOperationAsset(result)}>
                        <span className="min-w-0"><span className="block truncate text-xs font-semibold text-slate-800">{result.activo}</span><span className="mt-0.5 block truncate text-[10px] text-slate-500">{result.price_ticker || result.ticker} · {result.exchange || result.market_symbol || (result.tipo_activo.includes('Crypto') ? 'CoinGecko' : 'Mercado no identificado')}</span><span className="mt-0.5 block text-[10px] text-slate-400">{formatOperationSearchPrice(result.precio_actual, result.divisa)}{result.isin ? ` · ISIN ${result.isin}` : ''}</span></span>
                        <span className={`shrink-0 rounded-full px-2 py-0.5 text-[9px] font-semibold ${result.poseido ? 'bg-[#e7f2d4] text-[#31531d]' : 'bg-slate-100 text-slate-500'}`}>{result.poseido ? 'En cartera' : result.tipo_activo}</span>
                      </button>)}
                    </div> : null}
                  </div>
                  {selectedOperationAsset ? <div className="flex min-w-0 items-center justify-between gap-3 rounded-md border border-[#c7dda7] bg-[#e7f2d4] px-3 py-2.5"><div className="min-w-0"><p className="text-[9px] font-bold uppercase tracking-[0.12em] text-[#52783a]">Mercado seleccionado</p><p className="truncate text-xs font-semibold text-[#31531d]">{selectedOperationAsset.price_ticker || selectedOperationAsset.ticker} · {selectedOperationAsset.exchange || selectedOperationAsset.market_symbol || (selectedOperationAsset.tipo_activo.includes('Crypto') ? 'CoinGecko' : 'Mercado no identificado')}</p></div><Button type="button" size="sm" variant="outline" className="shrink-0 border-[#90b85f] bg-transparent text-[#31531d] hover:bg-[#dceec0]" onClick={() => handleOperationAssetChange('')}>Cambiar</Button></div> : <p className="text-[9px] leading-relaxed text-slate-400">Escribe al menos 2 caracteres; aparecerán cotizaciones de distintos mercados y el ticker se rellenará al elegir una.</p>}
                </div>
                <div className="grid min-w-0 gap-2"><Label htmlFor="operation-ticker">Ticker {selectedOperationAsset ? <span className="font-normal text-slate-400">(automático)</span> : null}</Label><Input id="operation-ticker" value={ticker} onChange={(event) => { setTicker(event.target.value.toUpperCase()); setSelectedOperationAsset(null); setOperationPriceTicker(''); setOperationMarketSymbol(null); setOperationCryptoId(null); setOperationIsin('') }} placeholder="BTC, SXR8…" readOnly={Boolean(selectedOperationAsset)} className="h-10 w-full min-w-0 text-base sm:text-sm" required /><p className="text-[9px] leading-relaxed text-slate-400">{selectedOperationAsset ? 'Se conservará el símbolo del mercado elegido.' : 'Puedes escribirlo manualmente si no aparece ninguna coincidencia.'}</p></div>
              </div>
              <div className="grid min-w-0 gap-3 sm:grid-cols-2"><div className="grid min-w-0 gap-2"><Label htmlFor="operation-type-asset">Tipo de activo</Label><select id="operation-type-asset" value={tipoActivo} onChange={(event) => setTipoActivo(event.target.value)} className="h-10 w-full min-w-0 rounded-md border border-slate-200 bg-white px-3 text-base outline-none focus:border-slate-500 sm:text-sm"><option value="Crypto">Crypto</option><option value="Crypto / Staking">Crypto / Staking</option><option value="ETF">ETF</option><option value="Acción">Acción</option><option value="Fondo">Fondo</option><option value="Otro">Otro</option></select></div><div className="grid min-w-0 gap-2"><Label htmlFor="operation-custody">Custodia / broker</Label><Input id="operation-custody" list="broker-suggestions" value={custodia} onChange={(event) => setCustodia(event.target.value)} placeholder="Trade Republic, XTB…" className="h-10 text-base sm:text-sm" required /><datalist id="broker-suggestions"><option value="Trade Republic" /><option value="XTB" /><option value="Cold wallet" /><option value="Otro" /></datalist><p className="text-[9px] leading-relaxed text-slate-400">Indica dónde está custodiada; la cotización se actualiza por proveedor de mercado.</p></div></div>
              <div className="grid min-w-0 gap-2"><Label>Divisa de liquidación</Label><div className="flex h-10 items-center rounded-md border border-slate-200 bg-[#eeece5] px-3 text-sm font-semibold text-slate-700">{operationCurrency}</div><p className="text-[9px] leading-relaxed text-slate-400">El efectivo se registra separado por custodia y divisa.</p></div>
              {operationType === 'Compra' ? <fieldset className="grid gap-2 rounded-lg border border-slate-200 bg-white/70 p-3"><legend className="px-1 text-[10px] font-bold uppercase tracking-[0.12em] text-slate-500">Origen de fondos</legend><label className={`flex cursor-pointer items-start gap-3 rounded-md border px-3 py-2.5 ${fundingSource === 'saldo_existente' ? 'border-[#90b85f] bg-[#e7f2d4]' : 'border-slate-200'}`}><input type="radio" name="investment-funding-source" value="saldo_existente" checked={fundingSource === 'saldo_existente'} onChange={() => setFundingSource('saldo_existente')} className="mt-0.5" /><span className="min-w-0"><span className="block text-xs font-semibold text-slate-800">Usar efectivo disponible</span><span className="mt-0.5 block text-[10px] leading-relaxed text-slate-500">{custodia ? `${formatCashAmount(availableCashForOperation, operationCurrency)} disponibles en ${custodia}` : 'Indica la custodia para consultar el saldo disponible.'}</span><span className="mt-0.5 block text-[10px] text-slate-400">Se descontará el coste total, incluida comisión e impuesto.</span></span></label><label className={`flex cursor-pointer items-start gap-3 rounded-md border px-3 py-2.5 ${fundingSource === 'capital_nuevo' ? 'border-[#e7a35e] bg-[#fff3df]' : 'border-slate-200'}`}><input type="radio" name="investment-funding-source" value="capital_nuevo" checked={fundingSource === 'capital_nuevo'} onChange={() => setFundingSource('capital_nuevo')} className="mt-0.5" /><span className="min-w-0"><span className="block text-xs font-semibold text-slate-800">Registrar capital nuevo</span><span className="mt-0.5 block text-[10px] leading-relaxed text-slate-500">Crea una entrada de capital por el coste total y después registra el débito de la compra.</span></span></label></fieldset> : null}
              <div className="grid min-w-0 gap-3 sm:grid-cols-2"><div className="grid min-w-0 gap-2"><Label htmlFor="operation-quantity">Cantidad</Label><Input id="operation-quantity" type="number" min="0" step="any" value={cantidad} onChange={(event) => setCantidad(event.target.value)} placeholder="0,00" className="h-10 text-base sm:text-sm" required /></div><div className="grid min-w-0 gap-2"><Label htmlFor="operation-price">Precio unitario ({operationCurrency})</Label><Input id="operation-price" type="number" min="0" step="any" value={precio} onChange={(event) => setPrecio(event.target.value)} placeholder="0,00" className="h-10 text-base sm:text-sm" required /></div></div>
              <div className="grid min-w-0 gap-3 sm:grid-cols-2"><div className="grid min-w-0 gap-2"><Label htmlFor="operation-fee">Comisión ({operationCurrency}) <span className="font-normal text-slate-400">(opcional)</span></Label><Input id="operation-fee" type="number" min="0" step="any" value={comision} onChange={(event) => setComision(event.target.value)} placeholder="0,00" className="h-10 text-base sm:text-sm" /></div><div className="grid min-w-0 gap-2"><Label htmlFor="operation-tax">Impuesto / retención ({operationCurrency}) <span className="font-normal text-slate-400">(opcional)</span></Label><Input id="operation-tax" type="number" min="0" step="any" value={impuesto} onChange={(event) => setImpuesto(event.target.value)} placeholder="0,00" className="h-10 text-base sm:text-sm" /></div></div>
              <div className="grid min-w-0 gap-2"><Label htmlFor="operation-notes">Nota <span className="font-normal text-slate-400">(opcional)</span></Label><textarea id="operation-notes" value={notas} onChange={(event) => setNotas(event.target.value)} rows={3} placeholder="Comisión, motivo, referencia…" className="min-w-0 resize-y rounded-md border border-slate-200 bg-white px-3 py-2 text-base outline-none placeholder:text-slate-400 focus:border-slate-500 sm:text-sm" /></div>
              <div className="flex min-w-0 gap-2 rounded-md bg-[#eeece5] px-3 py-2.5 text-[10px] leading-relaxed text-slate-500"><Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-slate-400" /><span className="min-w-0">La operación queda guardada en tu cuenta. No envía órdenes al broker.</span></div>
              <DialogFooter className="sticky bottom-0 -mx-1 mt-1 border-t border-slate-200 bg-[#f7f5ef] px-1 pt-3 sm:static sm:mx-0 sm:mt-0 sm:border-0 sm:bg-transparent sm:px-0 sm:pt-0"><Button type="button" variant="outline" className="w-full sm:w-auto" onClick={() => setDialogOpen(false)}>Cancelar</Button><Button type="submit" className="w-full bg-slate-900 text-white hover:bg-slate-700 sm:w-auto" disabled={savingOperation}>{savingOperation ? 'Guardando…' : 'Guardar operación'}</Button></DialogFooter>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </InvestmentFrame>
  )
}
