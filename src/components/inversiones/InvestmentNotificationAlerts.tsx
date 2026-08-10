'use client'

import { useEffect, useMemo, useState } from 'react'
import {
  BellRing,
  CheckCircle2,
  CircleAlert,
  Clock3,
  Copy,
  Loader2,
  MapPin,
  Mail,
  Pencil,
  Plus,
  Search,
  Send,
  Trash2,
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
import type { InversionAlerta, InversionPosicion } from '@/lib/db/schema'
import { exchangeLabelFromSymbol, inferIsin } from '@/lib/inversiones/instrumentIdentity'

type AssetSearchResult = {
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
  alerta_configurada?: boolean
}

type Props = {
  rules: InversionAlerta[]
  positions: InversionPosicion[]
  portfolioReturnPct: number | null
  onChanged: () => Promise<void>
}

type AssetIntent = 'position' | 'watchlist'

function percentInput(value: number | null) {
  return value === null ? '' : (value * 100).toFixed(1).replace(/\.0$/, '')
}

function formatPercent(value: number | null | undefined) {
  if (value === null || value === undefined || !Number.isFinite(value)) return '—'
  return `${value >= 0 ? '+' : ''}${(value * 100).toFixed(1)}%`
}

function formatPortfolioMovement(value: number | null | undefined) {
  if (value === null || value === undefined || !Number.isFinite(value)) return 'Rentabilidad pendiente de actualizar'
  const percentage = `${Math.abs(value * 100).toFixed(1).replace('.', ',')}%`
  return `Tu cartera ha ${value >= 0 ? 'subido' : 'bajado'} un ${percentage}`
}

function formatAssetPrice(value: number | null | undefined, currency: string | null | undefined) {
  if (value === null || value === undefined || !Number.isFinite(value)) return 'Precio no disponible'
  const formatted = new Intl.NumberFormat('es-ES', {
    minimumFractionDigits: value < 1 ? 4 : 2,
    maximumFractionDigits: value < 1 ? 6 : 2,
  }).format(value)
  const currencyLabel = currency === 'EUR' ? '€' : currency === 'USD' ? '$' : currency === 'GBP' ? '£' : currency || ''
  return currencyLabel ? `${formatted} ${currencyLabel}` : formatted
}

function formatReferencePrice(value: number) {
  return value < 1 ? value.toFixed(6).replace(/0+$/, '').replace(/\.$/, '') : value.toFixed(2)
}

function formatAssetDate(value: string | null | undefined) {
  if (!value) return null
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return null
  return new Intl.DateTimeFormat('es-ES', { dateStyle: 'short', timeStyle: 'short' }).format(date)
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

function ruleChannels(rule: InversionAlerta) {
  const channels = [rule.canal_telegram ? 'Telegram' : null, rule.canal_email ? 'email' : null].filter(Boolean)
  return channels.length > 0 ? channels.join(' + ') : 'Sin canal'
}

function channelButtonClass(active: boolean) {
  return active
    ? 'border-[#90b85f] bg-[#e7f2d4] text-[#31531d]'
    : 'border-slate-200 bg-white text-slate-500 hover:bg-slate-50'
}

export function InvestmentNotificationAlerts({ rules, positions, portfolioReturnPct, onChanged }: Props) {
  const [dialogOpen, setDialogOpen] = useState(false)
  const [scope, setScope] = useState<'cartera' | 'activo'>('cartera')
  const [assetIntent, setAssetIntent] = useState<AssetIntent>('position')
  const [editingRule, setEditingRule] = useState<InversionAlerta | null>(null)
  const [rise, setRise] = useState('')
  const [drop, setDrop] = useState('10')
  const [rearm, setRearm] = useState('1')
  const [telegram, setTelegram] = useState(true)
  const [email, setEmail] = useState(true)
  const [active, setActive] = useState(true)
  const [referencePrice, setReferencePrice] = useState('')
  const [targetPrice, setTargetPrice] = useState('')
  const [isin, setIsin] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<AssetSearchResult[]>([])
  const [selectedAsset, setSelectedAsset] = useState<AssetSearchResult | null>(null)
  const [searching, setSearching] = useState(false)
  const [saving, setSaving] = useState(false)
  const [busyRuleId, setBusyRuleId] = useState<number | null>(null)

  const portfolioRule = useMemo(() => rules.find((rule) => rule.alcance === 'cartera') ?? null, [rules])
  const assetRules = useMemo(() => rules.filter((rule) => rule.alcance === 'activo'), [rules])
  const positionById = useMemo(() => new Map(positions.map((position) => [position.id, position])), [positions])

  useEffect(() => {
    if (!dialogOpen || scope !== 'activo' || editingRule || searchQuery.trim().length < 2) {
      setSearchResults([])
      setSearching(false)
      return
    }

    const controller = new AbortController()
    const timer = window.setTimeout(async () => {
      setSearching(true)
      try {
        const response = await fetch(`/api/inversiones/alertas/buscar-activo?q=${encodeURIComponent(searchQuery.trim())}`, { cache: 'no-store', signal: controller.signal })
        const payload = await response.json().catch(() => null) as { results?: AssetSearchResult[]; error?: string } | null
        if (!response.ok) throw new Error(payload?.error || 'No se pudo buscar el activo')
        const results = payload?.results ?? []
        setSearchResults(results.filter((result) => assetIntent === 'position' ? result.poseido : !result.poseido))
      } catch (error) {
        if (!controller.signal.aborted) toast.error(error instanceof Error ? error.message : 'No se pudo buscar el activo')
      } finally {
        if (!controller.signal.aborted) setSearching(false)
      }
    }, 280)
    return () => {
      window.clearTimeout(timer)
      controller.abort()
    }
  }, [assetIntent, dialogOpen, editingRule, scope, searchQuery])

  function resetForm() {
    setEditingRule(null)
    setScope('cartera')
    setAssetIntent('position')
    setRise('')
    setDrop('10')
    setRearm('1')
    setTelegram(true)
    setEmail(true)
    setActive(true)
    setReferencePrice('')
    setTargetPrice('')
    setIsin('')
    setSearchQuery('')
    setSearchResults([])
    setSelectedAsset(null)
  }

  function openPortfolioRule(rule: InversionAlerta | null) {
    resetForm()
    setScope('cartera')
    if (rule) {
      setEditingRule(rule)
      setRise(percentInput(rule.umbral_subida_pct))
      setDrop(percentInput(rule.umbral_caida_pct))
      setRearm(percentInput(rule.rearmar_pct))
      setTelegram(rule.canal_telegram)
      setEmail(rule.canal_email)
      setActive(rule.activa)
    }
    setDialogOpen(true)
  }

  function openAssetRule(rule: InversionAlerta | null, intent: AssetIntent = rule?.posicion_id ? 'position' : 'watchlist') {
    resetForm()
    setScope('activo')
    setAssetIntent(intent)
    if (rule) {
      const position = rule.posicion_id ? positionById.get(rule.posicion_id) : null
      setAssetIntent(position ? 'position' : 'watchlist')
      setEditingRule(rule)
      setRise(percentInput(rule.umbral_subida_pct))
      setDrop(percentInput(rule.umbral_caida_pct))
      setRearm(percentInput(rule.rearmar_pct))
      setTelegram(rule.canal_telegram)
      setEmail(rule.canal_email)
      setActive(rule.activa)
      setReferencePrice(rule.precio_referencia === null ? '' : String(rule.precio_referencia))
      setTargetPrice(rule.precio_objetivo === null ? '' : String(rule.precio_objetivo))
      setIsin(rule.isin || position?.isin || inferIsin(position?.ticker, position?.market_symbol, rule.market_symbol) || '')
      setSelectedAsset({
        key: rule.posicion_id ? `position:${rule.posicion_id}` : `alert:${rule.id}`,
        activo: position?.activo || rule.activo || rule.ticker || 'Activo vigilado',
        ticker: position?.ticker || rule.ticker || rule.price_ticker || '',
        tipo_activo: position?.tipo || rule.tipo_activo || 'Acción',
        price_ticker: position?.price_ticker || rule.price_ticker || rule.ticker || '',
        crypto_id: position?.crypto_id || rule.crypto_id,
        market_symbol: position?.market_symbol || rule.market_symbol,
        exchange: exchangeLabelFromSymbol(position?.market_symbol) || null,
        isin: rule.isin || position?.isin || inferIsin(position?.ticker, position?.market_symbol, rule.market_symbol),
        precio_actual: position?.precio_actual ?? rule.precio_actual,
        divisa: position?.divisa || 'EUR',
        precio_actual_as_of: position?.snapshot_at || rule.ultima_comprobacion_at,
        poseido: Boolean(position),
        posicion_id: rule.posicion_id,
      })
    }
    setDialogOpen(true)
  }

  function chooseAsset(result: AssetSearchResult) {
    setSelectedAsset(result)
    setIsin(result.isin || '')
    if (!result.poseido && result.precio_actual !== null && (result.divisa || 'EUR') === 'EUR') {
      setReferencePrice(formatReferencePrice(result.precio_actual))
    } else {
      setReferencePrice('')
    }
    setSearchQuery('')
    setSearchResults([])
  }

  async function saveRule(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const risePct = rise.trim() === '' ? null : Number(rise) / 100
    const dropPct = drop.trim() === '' ? null : Number(drop) / 100
    const rearmPct = rearm.trim() === '' ? 0.01 : Number(rearm) / 100
    const targetPriceValue = targetPrice.trim() === '' ? null : Number(targetPrice)
    if ((risePct === null && dropPct === null && targetPriceValue === null) || [risePct, dropPct, rearmPct, targetPriceValue].some((value) => value !== null && (!Number.isFinite(value) || value <= 0))) {
      toast.error('Indica una alerta porcentual o un precio objetivo válido')
      return
    }
    if (scope === 'cartera' && targetPriceValue !== null) {
      toast.error('El precio objetivo solo está disponible para activos')
      return
    }
    if (!telegram && !email) {
      toast.error('Selecciona Telegram, email o ambos')
      return
    }
    if (scope === 'activo' && !selectedAsset) {
      toast.error('Busca y selecciona un activo para vigilar')
      return
    }
    if (scope === 'activo' && selectedAsset && ((assetIntent === 'position') !== selectedAsset.poseido)) {
      toast.error(assetIntent === 'position' ? 'Selecciona una posición que ya esté en tu cartera' : 'Selecciona un activo que no esté en tu cartera')
      return
    }

    setSaving(true)
    try {
      const body = scope === 'cartera'
        ? { alcance: 'cartera', umbral_subida_pct: risePct, umbral_caida_pct: dropPct, rearmar_pct: rearmPct, canal_telegram: telegram, canal_email: email, activa: active }
        : {
            alcance: 'activo',
            posicion_id: selectedAsset?.posicion_id,
            activo: selectedAsset?.activo,
            ticker: selectedAsset?.ticker,
            tipo_activo: selectedAsset?.tipo_activo,
            price_ticker: selectedAsset?.price_ticker,
             crypto_id: selectedAsset?.crypto_id,
             market_symbol: selectedAsset?.market_symbol,
             isin: isin.trim() || undefined,
             precio_referencia: referencePrice.trim() === '' ? undefined : Number(referencePrice),
             precio_objetivo: targetPriceValue,
            umbral_subida_pct: risePct,
            umbral_caida_pct: dropPct,
            rearmar_pct: rearmPct,
            canal_telegram: telegram,
            canal_email: email,
            activa: active,
          }
      const response = await fetch(editingRule ? `/api/inversiones/alertas/${editingRule.id}` : '/api/inversiones/alertas', {
        method: editingRule ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editingRule
          ? { umbral_subida_pct: risePct, umbral_caida_pct: dropPct, rearmar_pct: rearmPct, canal_telegram: telegram, canal_email: email, activa: active, ...(scope === 'activo' ? { isin: isin.trim() || null, precio_objetivo: targetPriceValue } : {}) }
          : body),
      })
      const payload = await response.json().catch(() => null) as { error?: string } | null
      if (!response.ok) throw new Error(payload?.error || 'No se pudo guardar la alerta')
      setDialogOpen(false)
      resetForm()
      await onChanged()
      toast.success('Alerta guardada; queda pendiente de la próxima comprobación')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'No se pudo guardar la alerta')
    } finally {
      setSaving(false)
    }
  }

  async function updateRule(rule: InversionAlerta, changes: Record<string, boolean>) {
    setBusyRuleId(rule.id)
    try {
      const response = await fetch(`/api/inversiones/alertas/${rule.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(changes),
      })
      const payload = await response.json().catch(() => null) as { error?: string } | null
      if (!response.ok) throw new Error(payload?.error || 'No se pudo actualizar la alerta')
      await onChanged()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'No se pudo actualizar la alerta')
    } finally {
      setBusyRuleId(null)
    }
  }

  async function removeRule(rule: InversionAlerta) {
    if (!window.confirm('¿Eliminar esta alerta externa?')) return
    setBusyRuleId(rule.id)
    try {
      const response = await fetch(`/api/inversiones/alertas/${rule.id}`, { method: 'DELETE' })
      const payload = await response.json().catch(() => null) as { error?: string } | null
      if (!response.ok) throw new Error(payload?.error || 'No se pudo eliminar la alerta')
      await onChanged()
      toast.success('Alerta eliminada')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'No se pudo eliminar la alerta')
    } finally {
      setBusyRuleId(null)
    }
  }

  return (
    <section className="rounded-xl bg-[#f7f5ef] p-5 text-slate-900 shadow-[0_12px_30px_rgba(0,0,0,.14)] sm:p-6" id="external-alerts">
      <div className="flex flex-col gap-4 border-b border-slate-200 pb-5 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="mb-2 flex items-center gap-2 text-[9px] font-bold uppercase tracking-[0.16em] text-slate-400"><BellRing className="h-3.5 w-3.5" /> Automatización externa</p>
          <h2 className="text-lg font-semibold tracking-[-0.04em]">Alertas por Telegram y email</h2>
          <p className="mt-2 max-w-2xl text-[11px] leading-relaxed text-slate-500">Automatismo a través de n8n.</p>
        </div>
        <Button type="button" size="sm" className="bg-slate-900 text-white hover:bg-slate-700" onClick={() => openAssetRule(null, 'position')}><Plus />Nueva alerta de posición</Button>
      </div>

      <div className="mt-5 grid gap-3 lg:grid-cols-2">
        <div className={`rounded-lg border p-4 ${portfolioReturnPct !== null && portfolioReturnPct < 0 ? 'border-rose-200 bg-[#fff1f0]' : 'border-emerald-200 bg-[#eef6e5]'}`}>
          <div className="flex items-start justify-between gap-3">
            <div><p className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-400">Cartera completa</p><p className="mt-1 text-sm font-semibold">Rentabilidad de tu cartera</p></div>
            <span className={`rounded-full px-2 py-1 text-[10px] font-semibold ${portfolioRule?.activa ? 'bg-[#e7f2d4] text-[#31531d]' : 'bg-slate-100 text-slate-500'}`}>{portfolioRule?.activa ? 'Activa' : 'Sin configurar'}</span>
          </div>
          <div className="mt-4 flex items-end justify-between gap-4"><div><p className={`text-3xl font-semibold tracking-[-0.05em] tabular-nums ${portfolioReturnPct !== null && portfolioReturnPct < 0 ? 'text-red-600' : 'text-emerald-700'}`}>{formatPercent(portfolioReturnPct)}</p><p className={`mt-1 text-[11px] font-semibold ${portfolioReturnPct !== null && portfolioReturnPct < 0 ? 'text-red-700' : 'text-emerald-800'}`}>{formatPortfolioMovement(portfolioReturnPct)}</p></div><Button type="button" size="sm" variant="outline" className="border-slate-200 bg-transparent text-slate-700 hover:bg-white" onClick={() => openPortfolioRule(portfolioRule)}><Pencil />{portfolioRule ? 'Editar' : 'Configurar'}</Button></div>
          {portfolioRule ? <p className="mt-4 flex items-center gap-1.5 text-[10px] text-slate-500"><Send className="h-3.5 w-3.5 text-[#5d8236]" />Avisar cuando suba {percentInput(portfolioRule.umbral_subida_pct) || '—'}% o baje {percentInput(portfolioRule.umbral_caida_pct) || '—'}% · {ruleChannels(portfolioRule)}</p> : <p className="mt-4 text-[10px] text-slate-400">Configura cuándo quieres recibir el aviso.</p>}
        </div>

        <div className="rounded-lg border border-slate-200 bg-white p-4">
          <div className="flex items-start justify-between gap-3"><div><p className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-400">Activos vigilados</p><p className="mt-1 text-sm font-semibold">Posiciones y watchlist</p></div><span className="text-3xl font-semibold tracking-[-0.05em] tabular-nums">{assetRules.length}</span></div>
          <p className="mt-3 text-[10px] leading-relaxed text-slate-500">Configura avisos para posiciones de tu cartera o crea un seguimiento de activos que todavía no tienes.</p>
          <div className="mt-4 flex items-center justify-between gap-3"><span className="flex items-center gap-1.5 text-[10px] text-slate-500"><Mail className="h-3.5 w-3.5 text-[#5d8236]" />Canales por regla</span><Button type="button" size="sm" variant="outline" className="border-slate-200 bg-transparent text-slate-700 hover:bg-slate-50" onClick={() => openAssetRule(null, 'watchlist')}><Plus />Añadir seguimiento</Button></div>
        </div>
      </div>

      {assetRules.length > 0 ? <div className="mt-4 grid gap-2">
        {assetRules.map((rule) => {
          const position = rule.posicion_id ? positionById.get(rule.posicion_id) : null
          const name = position?.activo || rule.activo || rule.ticker || 'Activo vigilado'
          const ticker = position?.price_ticker || position?.ticker || rule.price_ticker || rule.ticker || '—'
          const isBusy = busyRuleId === rule.id
          return <div key={rule.id} className="flex flex-col gap-3 rounded-lg border border-slate-200 bg-white p-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><p className="truncate text-sm font-semibold">{name}</p><span className="rounded bg-slate-100 px-1.5 py-0.5 text-[9px] font-semibold text-slate-500">{ticker}</span><span className={`rounded-full px-2 py-0.5 text-[9px] font-semibold ${rule.activa ? 'bg-[#e7f2d4] text-[#31531d]' : 'bg-slate-100 text-slate-500'}`}>{position ? 'En cartera' : 'No poseído'}</span></div><p className="mt-1 text-[10px] text-slate-500">Subida {percentInput(rule.umbral_subida_pct) || '—'}% · caída {percentInput(rule.umbral_caida_pct) || '—'}%{rule.precio_objetivo !== null ? ` · objetivo ${formatAssetPrice(rule.precio_objetivo, 'EUR')}` : ''} · {ruleChannels(rule)}</p><p className="mt-1 flex items-center gap-1.5 text-[10px] text-slate-400">{rule.ultimo_error ? <><CircleAlert className="h-3.5 w-3.5 text-amber-600" />{rule.ultimo_error}</> : rule.ultima_comprobacion_at ? <><CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />Última comprobación {new Intl.DateTimeFormat('es-ES', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(rule.ultima_comprobacion_at))}</> : 'Pendiente de la próxima comprobación'}</p></div>
            <div className="flex shrink-0 flex-wrap gap-2 sm:justify-end"><span className="self-center text-sm font-semibold tabular-nums text-slate-700">{formatPercent(rule.rendimiento_pct)}</span><Button type="button" size="sm" variant="outline" className="border-slate-200 bg-transparent text-slate-700 hover:bg-slate-50" onClick={() => void updateRule(rule, { activa: !rule.activa })} disabled={isBusy}>{isBusy ? <Loader2 className="animate-spin" /> : rule.activa ? 'Pausar' : 'Activar'}</Button><Button type="button" size="icon" variant="outline" aria-label={`Editar alerta de ${name}`} className="border-slate-200 bg-transparent text-slate-700 hover:bg-slate-50" onClick={() => openAssetRule(rule)} disabled={isBusy}><Pencil /></Button><Button type="button" size="icon" variant="outline" aria-label={`Eliminar alerta de ${name}`} className="border-slate-200 bg-transparent text-red-700 hover:bg-red-50" onClick={() => void removeRule(rule)} disabled={isBusy}><Trash2 /></Button></div>
          </div>
        })}
      </div> : <div className="mt-4 rounded-lg border border-dashed border-slate-300 bg-[#eeece5] px-4 py-5 text-center"><p className="text-sm font-semibold text-slate-700">Todavía no hay alertas de activos</p><p className="mt-1 text-[10px] text-slate-500">Crea una alerta para una posición o añade un seguimiento fuera de cartera.</p></div>}

      <Dialog open={dialogOpen} onOpenChange={(open) => { setDialogOpen(open); if (!open) resetForm() }}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-[620px]">
          <DialogHeader><DialogTitle>{editingRule ? 'Editar alerta de activo' : scope === 'cartera' ? 'Alerta de cartera completa' : assetIntent === 'position' ? 'Nueva alerta de posición' : 'Nuevo seguimiento de activo'}</DialogTitle><DialogDescription>{scope === 'cartera' ? 'Configura un aviso para la rentabilidad total de tu cartera.' : assetIntent === 'position' ? 'Elige una posición que ya tengas en cartera. El aviso seguirá su rentabilidad.' : 'Busca un activo que todavía no tengas. Se guardará como seguimiento, sin crear una operación.'} Se avisa al cruzar el nivel y vuelve a quedar listo cuando recupera el margen indicado.</DialogDescription></DialogHeader>
          <form onSubmit={saveRule} className="grid gap-5 py-2">
            {scope === 'activo' ? <div className="grid gap-2"><Label htmlFor="alert-asset-search">{assetIntent === 'position' ? 'Posición de tu cartera' : 'Activo para seguir'}</Label>{selectedAsset ? <div className="rounded-md border border-[#90b85f] bg-[#e7f2d4] px-3 py-3"><div className="flex items-start justify-between gap-3"><div className="min-w-0"><p className="truncate text-sm font-semibold text-[#31531d]">{selectedAsset.activo}</p><p className="text-[10px] text-[#52783a]">{selectedAsset.price_ticker} · {selectedAsset.poseido ? 'En cartera' : 'No poseído; se guardará como seguimiento'}</p></div>{!editingRule ? <Button type="button" size="sm" variant="outline" className="shrink-0 border-[#90b85f] bg-transparent text-[#31531d] hover:bg-[#dceec0]" onClick={() => { setSelectedAsset(null); setIsin(''); setReferencePrice(''); setTargetPrice('') }}>Cambiar</Button> : null}</div><div className="mt-3 grid gap-3 border-t border-[#c7dda7] pt-3 sm:grid-cols-2"><div><p className="text-[9px] font-bold uppercase tracking-[0.12em] text-[#52783a]">Precio actual</p><p className="mt-1 text-sm font-semibold tabular-nums text-[#31531d]">{formatAssetPrice(selectedAsset.precio_actual, selectedAsset.divisa)}</p><p className="mt-1 flex items-center gap-1 text-[10px] text-[#52783a]"><Clock3 className="h-3 w-3" />{formatAssetDate(selectedAsset.precio_actual_as_of) ? `Dato ${formatAssetDate(selectedAsset.precio_actual_as_of)}` : 'Último precio disponible'}</p></div><div><p className="text-[9px] font-bold uppercase tracking-[0.12em] text-[#52783a]">Mercado seleccionado</p><p className="mt-1 flex items-center gap-1 text-sm font-semibold text-[#31531d]"><MapPin className="h-3.5 w-3.5" />{selectedAsset.exchange || 'Mercado no identificado'}</p><p className="mt-1 text-[10px] text-[#52783a]">{selectedAsset.market_symbol || selectedAsset.price_ticker}</p></div></div></div> : <div className="relative"><Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-slate-400" /><Input id="alert-asset-search" value={searchQuery} onChange={(event) => setSearchQuery(event.target.value)} placeholder={assetIntent === 'position' ? 'Busca una posición (SXR8, BTC, NVDA…)' : 'Busca un activo que no tengas (AAPL, BTC…)'} className="pl-9" autoFocus />{searching ? <Loader2 className="absolute right-3 top-2.5 h-4 w-4 animate-spin text-slate-400" /> : null}{searchResults.length > 0 ? <div className="absolute z-20 mt-1 max-h-64 w-full overflow-y-auto rounded-md border border-slate-200 bg-white p-1 shadow-xl">{searchResults.map((result) => <button type="button" key={result.key} className="flex w-full items-start justify-between gap-3 rounded px-3 py-2 text-left hover:bg-slate-50" onClick={() => chooseAsset(result)}><span className="min-w-0"><span className="block truncate text-xs font-semibold text-slate-800">{result.activo}</span><span className="block text-[10px] text-slate-500">{result.price_ticker}{result.exchange ? ` · ${result.exchange}` : ' · Mercado no identificado'}</span><span className="block text-[10px] text-slate-400">{formatAssetPrice(result.precio_actual, result.divisa)} · ISIN {result.isin || 'no disponible'}</span></span><span className={`shrink-0 rounded-full px-2 py-0.5 text-[9px] font-semibold ${result.poseido ? 'bg-[#e7f2d4] text-[#31531d]' : 'bg-slate-100 text-slate-500'}`}>{result.poseido ? 'En cartera' : 'No poseído'}</span></button>)}</div> : null}</div>} {selectedAsset ? <div className="grid gap-2 rounded-md border border-slate-200 bg-white p-3"><div className="flex items-center justify-between gap-2"><Label className="text-slate-700" htmlFor="alert-isin">ISIN para confirmar el instrumento (opcional)</Label>{isin ? <button type="button" title="Copiar ISIN" aria-label={`Copiar ISIN ${isin}`} className="inline-flex items-center gap-1 rounded px-1.5 py-1 text-[10px] font-semibold text-slate-500 hover:bg-slate-100 hover:text-slate-900" onClick={() => void copiarIsin(isin)}><Copy className="h-3 w-3" />Copiar</button> : null}</div><Input id="alert-isin" value={isin} onChange={(event) => setIsin(event.target.value.toUpperCase())} placeholder="Ej. CY0106002112" maxLength={12} className="text-slate-900 placeholder:text-slate-400" /><p className="text-[10px] text-slate-500">{isin ? 'Se guardará junto con el ticker y el mercado seleccionado.' : 'Si el proveedor no lo devuelve, puedes pegarlo aquí. La alerta seguirá ligada a esta cotización concreta.'}</p></div> : null} {!selectedAsset && !editingRule ? <p className="text-[10px] text-slate-500">{assetIntent === 'position' ? 'Elige una posición de tu cartera.' : 'Elige un activo que no esté en tu cartera.'}</p> : null}</div> : null}
           {scope === 'activo' && selectedAsset && !selectedAsset.poseido && !editingRule ? <div className="grid gap-2"><Label htmlFor="alert-reference-price">Precio de referencia en EUR (opcional)</Label><Input id="alert-reference-price" type="number" min="0.000001" step="any" value={referencePrice} onChange={(event) => setReferencePrice(event.target.value)} placeholder="Se consulta automáticamente si lo dejas vacío" /><p className="text-[10px] text-slate-500">{selectedAsset.divisa && selectedAsset.divisa !== 'EUR' ? 'El precio mostrado está en la divisa del mercado; si dejas esto vacío, la alerta se normalizará a EUR al guardar.' : 'La variación se medirá desde este precio. Si lo dejas vacío, Finanzas capturará la cotización al guardar.'}</p></div> : null}
            {scope === 'activo' && selectedAsset ? <div className="grid gap-2"><Label htmlFor="alert-target-price">Precio objetivo en EUR (opcional)</Label><Input id="alert-target-price" type="number" min="0.000001" step="any" value={targetPrice} onChange={(event) => setTargetPrice(event.target.value)} placeholder="Ej. 120,00" /><p className="text-[10px] leading-relaxed text-slate-500">Recibirás el aviso cuando el precio normalizado a EUR alcance este nivel. Puedes usarlo solo o combinarlo con los porcentajes.</p></div> : null}
            <div className="grid gap-3 sm:grid-cols-2"><div className="grid gap-2"><Label htmlFor="alert-rise">Avisar si sube (%)</Label><Input id="alert-rise" type="number" min="0.1" step="0.1" value={rise} onChange={(event) => setRise(event.target.value)} placeholder="Ej. 10" /></div><div className="grid gap-2"><Label htmlFor="alert-drop">Avisar si cae (%)</Label><Input id="alert-drop" type="number" min="0.1" step="0.1" value={drop} onChange={(event) => setDrop(event.target.value)} placeholder="Ej. 10" /></div></div>
            <div className="grid gap-2"><Label htmlFor="alert-rearm">Recuperación para volver a avisar (%)</Label><Input id="alert-rearm" type="number" min="0.1" step="0.1" value={rearm} onChange={(event) => setRearm(event.target.value)} /><p className="text-[10px] leading-relaxed text-slate-500">No es el número de avisos: es cuánto debe recuperar la rentabilidad para rearmar la alerta. Ejemplo: si cae un 10% y pones 1%, volverá a avisar al recuperar hasta −9%.</p></div>
            <div className="grid gap-2"><Label>Canales</Label><div className="flex flex-wrap gap-2"><button type="button" aria-pressed={telegram} className={`inline-flex items-center gap-2 rounded-md border px-3 py-2 text-xs font-semibold ${channelButtonClass(telegram)}`} onClick={() => setTelegram((value) => !value)}><Send className="h-3.5 w-3.5" />Telegram</button><button type="button" aria-pressed={email} className={`inline-flex items-center gap-2 rounded-md border px-3 py-2 text-xs font-semibold ${channelButtonClass(email)}`} onClick={() => setEmail((value) => !value)}><Mail className="h-3.5 w-3.5" />Email</button></div><p className="text-[10px] text-slate-500">El workflow de n8n usa estas marcas para decidir a qué canal enviar cada cruce.</p></div>
            <div className="flex items-center justify-between rounded-md border border-slate-200 bg-[#eeece5] px-3 py-2"><div><p className="text-xs font-semibold text-slate-700">Regla activa</p><p className="text-[10px] text-slate-500">Pausarla conserva su configuración y estado.</p></div><button type="button" aria-pressed={active} className={`relative h-6 w-11 rounded-full transition ${active ? 'bg-[#739b43]' : 'bg-slate-300'}`} onClick={() => setActive((value) => !value)}><span className={`absolute top-1 h-4 w-4 rounded-full bg-white transition ${active ? 'left-6' : 'left-1'}`} /></button></div>
            <DialogFooter><Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button><Button type="submit" className="bg-slate-900 text-white hover:bg-slate-700" disabled={saving}>{saving ? <><Loader2 className="animate-spin" />Guardando…</> : 'Guardar alerta'}</Button></DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </section>
  )
}
