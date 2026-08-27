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
  MessageCircle,
  Pencil,
  Plus,
  RefreshCw,
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
  precio_actual_eur: number | null
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
  scenarioMode?: boolean
  onScenarioRulesChange?: (rules: InversionAlerta[]) => Promise<void> | void
  onScenarioPriceRefresh?: (positionId: number, update: { price: number; nativePrice: number; nativeCurrency?: string; sourceUrl: string; provider: string; asOf?: string }) => Promise<void> | void
}

type AssetIntent = 'position' | 'watchlist'

type PresentationPriceSource = Partial<Pick<InversionPosicion | InversionAlerta, 'precio_actual' | 'precio_actual_nativo' | 'divisa_nativa'>>

type PresentationQuote = {
  price: number | null
  currency: string
}

function completePresentationQuote(price: number | null | undefined, currency: string | null | undefined): PresentationQuote | null {
  const normalizedCurrency = currency?.trim()
  if (price === null || price === undefined || !Number.isFinite(price) || !normalizedCurrency) return null
  return { price, currency: normalizedCurrency }
}

function selectNativePresentationQuote(position?: PresentationPriceSource | null, rule?: PresentationPriceSource | null): PresentationQuote | null {
  for (const source of [position, rule]) {
    const quote = completePresentationQuote(source?.precio_actual_nativo, source?.divisa_nativa)
    if (quote) return quote
  }
  return null
}

function selectPresentationQuote(position?: PresentationPriceSource | null, rule?: PresentationPriceSource | null): PresentationQuote {
  const nativeQuote = selectNativePresentationQuote(position, rule)
  if (nativeQuote) return nativeQuote

  const canonicalPrice = position?.precio_actual ?? rule?.precio_actual ?? null
  return { price: Number.isFinite(canonicalPrice) ? canonicalPrice : null, currency: 'EUR' }
}

type PercentageBaseFields = Pick<InversionAlerta, 'precio_base_porcentaje' | 'precio_base_porcentaje_nativo' | 'divisa_base_porcentaje' | 'precio_actual' | 'precio_actual_nativo' | 'divisa_nativa' | 'rendimiento_pct'>

function percentageFromAlertBase(rule: PercentageBaseFields, position?: InversionPosicion | null) {
  const currentQuote = selectPresentationQuote(position, rule)
  const baseNative = completePresentationQuote(rule.precio_base_porcentaje_nativo, rule.divisa_base_porcentaje)
  if (currentQuote.price !== null && baseNative?.price !== null && baseNative && currentQuote.currency.toUpperCase() === baseNative.currency.toUpperCase() && baseNative.price > 0) {
    return (currentQuote.price - baseNative.price) / baseNative.price
  }
  const currentPrice = position?.precio_actual ?? rule.precio_actual
  const basePrice = rule.precio_base_porcentaje
  return currentPrice !== null && currentPrice !== undefined && basePrice !== null && basePrice > 0
    ? (currentPrice - basePrice) / basePrice
    : position?.pnl_pct ?? rule.rendimiento_pct
}

function percentageBaseLabel(rule: InversionAlerta, position?: InversionPosicion | null) {
  const baseNative = completePresentationQuote(rule.precio_base_porcentaje_nativo, rule.divisa_base_porcentaje)
  if (baseNative?.price !== null && baseNative) return formatAssetPrice(baseNative.price, baseNative.currency)
  const basePrice = rule.precio_base_porcentaje ?? position?.precio_actual
  return basePrice !== null && basePrice !== undefined ? formatAssetPrice(basePrice, 'EUR') : 'pendiente'
}

function ruleTarget(rule: InversionAlerta): PresentationQuote | null {
  const amount = rule.precio_objetivo_importe ?? rule.precio_objetivo
  const currency = rule.divisa_objetivo ?? 'EUR'
  return completePresentationQuote(amount, currency)
}

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

function parsePositiveInput(value: string) {
  const parsed = Number(value)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null
}

function thresholdPrice(base: number | null, percentage: string, direction: 'up' | 'down') {
  const threshold = parsePositiveInput(percentage)
  if (base === null || threshold === null) return null
  return base * (1 + (direction === 'up' ? threshold : -threshold) / 100)
}

function formatPortfolioAlertSummary(rule: InversionAlerta) {
  const base = rule.precio_base_porcentaje ?? rule.precio_referencia
  if (base === null || base <= 0) return 'Base pendiente de configurar; edita la alerta para fijarla.'
  const levels = [
    rule.umbral_subida_pct !== null
      ? `+${(Math.abs(rule.umbral_subida_pct) * 100).toFixed(1).replace(/\.0$/, '')}%: ${formatAssetPrice(base * (1 + Math.abs(rule.umbral_subida_pct)), 'EUR')}`
      : null,
    rule.umbral_caida_pct !== null
      ? `−${(Math.abs(rule.umbral_caida_pct) * 100).toFixed(1).replace(/\.0$/, '')}%: ${formatAssetPrice(base * (1 - Math.abs(rule.umbral_caida_pct)), 'EUR')}`
      : null,
  ].filter(Boolean)
  return `Base ${formatAssetPrice(base, 'EUR')}${levels.length > 0 ? ` · ${levels.join(' · ')}` : ''}`
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
  const channels = [rule.canal_telegram ? 'Telegram' : null, rule.canal_email ? 'email' : null, rule.canal_whatsapp ? 'WhatsApp' : null].filter(Boolean)
  return channels.length > 0 ? channels.join(' + ') : 'Sin canal'
}

function channelButtonClass(active: boolean) {
  return active
    ? 'border-[#90b85f] bg-[#e7f2d4] text-[#31531d]'
    : 'border-slate-200 bg-white text-slate-500 hover:bg-slate-50'
}

export function InvestmentNotificationAlerts({ rules, positions, portfolioReturnPct, onChanged, scenarioMode = false, onScenarioRulesChange, onScenarioPriceRefresh }: Props) {
  const [dialogOpen, setDialogOpen] = useState(false)
  const [scope, setScope] = useState<'cartera' | 'activo'>('cartera')
  const [assetIntent, setAssetIntent] = useState<AssetIntent>('position')
  const [editingRule, setEditingRule] = useState<InversionAlerta | null>(null)
  const [rise, setRise] = useState('')
  const [drop, setDrop] = useState('10')
  const [rearm, setRearm] = useState('1')
  const [telegram, setTelegram] = useState(true)
  const [email, setEmail] = useState(true)
  const [whatsapp, setWhatsapp] = useState(false)
  const [active, setActive] = useState(true)
  const [referencePrice, setReferencePrice] = useState('')
  const [targetPrice, setTargetPrice] = useState('')
  const [targetCurrency, setTargetCurrency] = useState('EUR')
  const [isin, setIsin] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<AssetSearchResult[]>([])
  const [selectedAsset, setSelectedAsset] = useState<AssetSearchResult | null>(null)
  const [searching, setSearching] = useState(false)
  const [saving, setSaving] = useState(false)
  const [busyRuleId, setBusyRuleId] = useState<number | null>(null)
  const [refreshingRuleId, setRefreshingRuleId] = useState<number | null>(null)
  const [rulePendingDeletion, setRulePendingDeletion] = useState<InversionAlerta | null>(null)

  const portfolioRule = useMemo(() => rules.find((rule) => rule.alcance === 'cartera') ?? null, [rules])
  const assetRules = useMemo(() => rules.filter((rule) => rule.alcance === 'activo'), [rules])
  const positionById = useMemo(() => new Map(positions.map((position) => [position.id, position])), [positions])
  const portfolioCurrentValue = useMemo(
    () => positions.reduce((sum, position) => sum + (position.valor_actual ?? 0), 0),
    [positions]
  )
  const nativeTargetCurrency = selectedAsset?.divisa?.trim().toUpperCase()
  const savedTargetCurrency = editingRule?.divisa_objetivo?.trim().toUpperCase()
  const targetCurrencyOptions = [...new Set(['EUR', 'USD', nativeTargetCurrency, savedTargetCurrency].filter((currency): currency is string => Boolean(currency)))]
  const portfolioBaseValue = parsePositiveInput(referencePrice)
  const portfolioRiseLevel = thresholdPrice(portfolioBaseValue, rise, 'up')
  const portfolioDropLevel = thresholdPrice(portfolioBaseValue, drop, 'down')

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
        const localResults: AssetSearchResult[] = positions
          .filter((position) => {
            const query = searchQuery.trim().toLocaleLowerCase('es')
            return [position.activo, position.ticker, position.price_ticker, position.market_symbol, position.isin]
              .some((value) => value?.toLocaleLowerCase('es').includes(query))
          })
          .map((position) => {
            const presentationQuote = selectPresentationQuote(position)
            return {
              key: `position:${position.id}`,
              activo: position.activo,
              ticker: position.ticker,
              tipo_activo: position.tipo,
              price_ticker: position.price_ticker || position.ticker,
              crypto_id: position.crypto_id,
              market_symbol: position.market_symbol,
              exchange: exchangeLabelFromSymbol(position.market_symbol) || position.market_symbol,
              isin: position.isin || inferIsin(position.ticker, position.market_symbol),
              precio_actual: presentationQuote.price,
              precio_actual_eur: position.precio_actual,
              divisa: presentationQuote.currency,
              precio_actual_as_of: position.snapshot_at,
              poseido: true,
              posicion_id: position.id,
            }
          })

        const response = await fetch(`/api/inversiones/alertas/buscar-activo?q=${encodeURIComponent(searchQuery.trim())}`, { cache: 'no-store', signal: controller.signal })
        const payload = await response.json().catch(() => null) as { results?: AssetSearchResult[]; error?: string } | null
        if (!response.ok) throw new Error(payload?.error || 'No se pudo buscar el activo')
        const remoteResults = (payload?.results ?? []).filter((result) => assetIntent === 'position' ? result.poseido : !result.poseido)
        const results = [...remoteResults, ...localResults].filter((result, index, all) => all.findIndex((item) => item.key === result.key) === index)
        setSearchResults(results)
      } catch (error) {
        if (!controller.signal.aborted) {
          const localResults = positions
            .filter((position) => [position.activo, position.ticker, position.price_ticker, position.market_symbol, position.isin]
              .some((value) => value?.toLocaleLowerCase('es').includes(searchQuery.trim().toLocaleLowerCase('es'))))
            .map((position) => {
              const presentationQuote = selectPresentationQuote(position)
              return {
                key: `position:${position.id}`,
                activo: position.activo,
                ticker: position.ticker,
                tipo_activo: position.tipo,
                price_ticker: position.price_ticker || position.ticker,
                crypto_id: position.crypto_id,
                market_symbol: position.market_symbol,
                exchange: exchangeLabelFromSymbol(position.market_symbol) || position.market_symbol,
                isin: position.isin || inferIsin(position.ticker, position.market_symbol),
                precio_actual: presentationQuote.price,
                precio_actual_eur: position.precio_actual,
                divisa: presentationQuote.currency,
                precio_actual_as_of: position.snapshot_at,
                poseido: true,
                posicion_id: position.id,
              }
            })
          setSearchResults(assetIntent === 'position' ? localResults : [])
          if (!localResults.length) toast.error(error instanceof Error ? error.message : 'No se pudo buscar el activo')
        }
      } finally {
        if (!controller.signal.aborted) setSearching(false)
      }
    }, 280)
    return () => {
      window.clearTimeout(timer)
      controller.abort()
    }
  }, [assetIntent, dialogOpen, editingRule, positions, scenarioMode, scope, searchQuery])

  function resetForm() {
    setEditingRule(null)
    setScope('cartera')
    setAssetIntent('position')
    setRise('')
    setDrop('10')
    setRearm('1')
    setTelegram(true)
    setEmail(true)
    setWhatsapp(false)
    setActive(true)
    setReferencePrice('')
    setTargetPrice('')
    setTargetCurrency('EUR')
    setIsin('')
    setSearchQuery('')
    setSearchResults([])
    setSelectedAsset(null)
  }

  function openPortfolioRule(rule: InversionAlerta | null) {
    resetForm()
    setScope('cartera')
    const base = portfolioCurrentValue
    if (base > 0) setReferencePrice(formatReferencePrice(base))
    if (rule) {
      setEditingRule(rule)
      setRise(percentInput(rule.umbral_subida_pct))
      setDrop(percentInput(rule.umbral_caida_pct))
      setRearm(percentInput(rule.rearmar_pct))
      setTelegram(rule.canal_telegram)
      setEmail(rule.canal_email)
      setWhatsapp(rule.canal_whatsapp)
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
      setWhatsapp(rule.canal_whatsapp)
      setActive(rule.activa)
      setReferencePrice(rule.precio_referencia === null ? '' : String(rule.precio_referencia))
      const savedTarget = ruleTarget(rule)
      setTargetPrice(savedTarget ? String(savedTarget.price) : '')
      setTargetCurrency(rule.divisa_objetivo ?? 'EUR')
      setIsin(rule.isin || position?.isin || inferIsin(position?.ticker, position?.market_symbol, rule.market_symbol) || '')
      const presentationQuote = selectPresentationQuote(position, rule)
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
        precio_actual: presentationQuote.price,
        precio_actual_eur: position?.precio_actual ?? rule.precio_actual,
        divisa: presentationQuote.currency,
        precio_actual_as_of: position?.snapshot_at || rule.ultima_comprobacion_at,
        poseido: Boolean(position),
        posicion_id: rule.posicion_id,
      })
      void hydrateEditedAssetQuote(rule, position ?? null)
    }
    setDialogOpen(true)
  }

  async function hydrateEditedAssetQuote(rule: InversionAlerta, position: InversionPosicion | null) {
    const query = position?.market_symbol || rule.market_symbol || position?.price_ticker || rule.price_ticker || position?.ticker || rule.ticker
    if (!query) return

    try {
      const response = await fetch(`/api/inversiones/alertas/buscar-activo?q=${encodeURIComponent(query)}`, { cache: 'no-store' })
      const payload = await response.json().catch(() => null) as { results?: AssetSearchResult[] } | null
      if (!response.ok) return
      const currentKey = rule.posicion_id ? `position:${rule.posicion_id}` : `alert:${rule.id}`
      const result = (payload?.results ?? []).find((item) => item.key === currentKey || (item.market_symbol || '').toLocaleLowerCase('es') === query.toLocaleLowerCase('es'))
      if (!result) return

      setSelectedAsset((current) => current?.key === currentKey ? result : current)
      if (rule.precio_objetivo === null && rule.precio_objetivo_importe === null) {
        setTargetCurrency(result.divisa?.trim().toUpperCase() || 'EUR')
      }
    } catch {
      // La cotización guardada sigue siendo válida como fallback del formulario.
    }
  }

  function chooseAsset(result: AssetSearchResult) {
    setSelectedAsset(result)
    setTargetCurrency(result.divisa?.trim().toUpperCase() || 'EUR')
    setIsin(result.isin || '')
    if (!result.poseido && result.precio_actual_eur !== null && (result.divisa || 'EUR') === 'EUR') {
      setReferencePrice(formatReferencePrice(result.precio_actual_eur))
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
    const referenceValue = referencePrice.trim() === '' ? null : Number(referencePrice)
    if ((risePct === null && dropPct === null && targetPriceValue === null) || [risePct, dropPct, rearmPct, targetPriceValue].some((value) => value !== null && (!Number.isFinite(value) || value <= 0))) {
      toast.error('Indica una alerta porcentual o un precio objetivo válido')
      return
    }
    if (scope === 'cartera' && (referenceValue === null || !Number.isFinite(referenceValue) || referenceValue <= 0)) {
      toast.error('Indica un valor base de cartera válido')
      return
    }
    if (scope === 'cartera' && targetPriceValue !== null) {
      toast.error('El precio objetivo solo está disponible para activos')
      return
    }
    if (!telegram && !email && !whatsapp) {
      toast.error('Selecciona Telegram, email o WhatsApp')
      return
    }
    if (scope === 'activo' && !selectedAsset) {
      toast.error('Busca y selecciona un activo para vigilar')
      return
    }
    const normalizedTargetCurrency = targetCurrency.trim().toUpperCase()
    if (scope === 'activo' && targetPriceValue !== null && !targetCurrencyOptions.includes(normalizedTargetCurrency)) {
      toast.error('Elige una de las divisas disponibles para este activo')
      return
    }
    if (scope === 'activo' && selectedAsset && ((assetIntent === 'position') !== selectedAsset.poseido)) {
      toast.error(assetIntent === 'position' ? 'Selecciona una posición que ya esté en tu cartera' : 'Selecciona un activo que no esté en tu cartera')
      return
    }

    setSaving(true)
    try {
      const body = scope === 'cartera'
        ? { alcance: 'cartera', precio_referencia: referenceValue, umbral_subida_pct: risePct, umbral_caida_pct: dropPct, rearmar_pct: rearmPct, canal_telegram: telegram, canal_email: email, canal_whatsapp: whatsapp, activa: active }
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
             precio_objetivo_importe: targetPriceValue,
             divisa_objetivo: targetPriceValue === null ? null : normalizedTargetCurrency,
            umbral_subida_pct: risePct,
            umbral_caida_pct: dropPct,
            rearmar_pct: rearmPct,
            canal_telegram: telegram,
            canal_email: email,
            canal_whatsapp: whatsapp,
            activa: active,
             }

      if (scenarioMode && onScenarioRulesChange) {
        const now = new Date().toISOString()
        const selectedPosition = selectedAsset?.posicion_id ? positionById.get(selectedAsset.posicion_id) : null
        const scenarioReferenceValue = scope === 'cartera'
          ? referenceValue
          : scope === 'activo' && !selectedAsset?.poseido && referencePrice.trim() !== ''
            ? Number(referencePrice)
            : null
        const currentPrice = scope === 'cartera'
          ? portfolioCurrentValue
          : selectedPosition?.precio_actual ?? selectedAsset?.precio_actual_eur ?? null
        const nativeQuote = scope === 'cartera'
          ? null
          : selectedPosition || editingRule
            ? selectNativePresentationQuote(selectedPosition, editingRule)
            : completePresentationQuote(selectedAsset?.precio_actual, selectedAsset?.divisa)
        const currentNativePrice = nativeQuote?.price ?? null
        const nativeCurrency = nativeQuote?.currency ?? null
        const normalizedNativeCurrency = nativeCurrency?.trim().toUpperCase() ?? null
        const percentageBasePrice = editingRule?.precio_base_porcentaje ?? currentPrice
        const percentageBaseNativePrice = editingRule?.precio_base_porcentaje_nativo ?? currentNativePrice
        const percentageBaseCurrency = editingRule?.divisa_base_porcentaje ?? normalizedNativeCurrency
        const currentReturn = scope === 'cartera'
          ? currentPrice !== null && scenarioReferenceValue !== null && scenarioReferenceValue > 0
            ? (currentPrice - scenarioReferenceValue) / scenarioReferenceValue
            : null
          : percentageFromAlertBase({
              precio_base_porcentaje: percentageBasePrice,
              precio_base_porcentaje_nativo: percentageBaseNativePrice,
              divisa_base_porcentaje: percentageBaseCurrency,
              precio_actual: currentPrice,
              precio_actual_nativo: currentNativePrice,
              divisa_nativa: normalizedNativeCurrency,
              rendimiento_pct: null,
            }, selectedPosition)
        if (scope === 'activo' && targetPriceValue !== null && normalizedTargetCurrency !== 'EUR' && (currentPrice === null || currentNativePrice === null || currentNativePrice <= 0)) {
          toast.error(`No hay una cotización nativa ${normalizedTargetCurrency} válida para guardar este objetivo en el escenario`)
          return
        }
        if (scope === 'activo' && targetPriceValue !== null && normalizedTargetCurrency !== 'EUR' && normalizedNativeCurrency !== normalizedTargetCurrency) {
          toast.error(`La cotización nativa disponible está en ${normalizedNativeCurrency ?? 'otra divisa'}, no en ${normalizedTargetCurrency}`)
          return
        }
        const changes: Omit<InversionAlerta, 'id' | 'created_at'> = {
          usuario_id: editingRule?.usuario_id ?? 0,
          alcance: scope,
          posicion_id: scope === 'activo' ? selectedAsset?.posicion_id ?? editingRule?.posicion_id ?? null : null,
          activo: scope === 'activo' ? selectedAsset?.activo ?? editingRule?.activo ?? null : null,
          ticker: scope === 'activo' ? selectedAsset?.ticker ?? editingRule?.ticker ?? null : null,
          tipo_activo: scope === 'activo' ? selectedAsset?.tipo_activo ?? editingRule?.tipo_activo ?? null : null,
          price_ticker: scope === 'activo' ? selectedAsset?.price_ticker ?? editingRule?.price_ticker ?? null : null,
          crypto_id: scope === 'activo' ? selectedAsset?.crypto_id ?? editingRule?.crypto_id ?? null : null,
          market_symbol: scope === 'activo' ? selectedAsset?.market_symbol ?? editingRule?.market_symbol ?? null : null,
          isin: scope === 'activo' ? isin.trim() || selectedAsset?.isin || editingRule?.isin || null : null,
          precio_referencia: scenarioReferenceValue,
          precio_objetivo: scope === 'activo' && targetPriceValue !== null
            ? normalizedTargetCurrency === 'EUR'
              ? targetPriceValue
              : currentPrice !== null && currentNativePrice !== null && currentNativePrice > 0
                ? targetPriceValue * (currentPrice / currentNativePrice)
                : null
            : null,
          precio_objetivo_importe: scope === 'activo' ? targetPriceValue : null,
          divisa_objetivo: scope === 'activo' && targetPriceValue !== null ? normalizedTargetCurrency : null,
          precio_actual: currentPrice,
          precio_actual_nativo: currentNativePrice,
          divisa_nativa: nativeCurrency,
          precio_base_porcentaje: percentageBasePrice,
          precio_base_porcentaje_nativo: percentageBaseNativePrice,
          divisa_base_porcentaje: percentageBaseCurrency,
          rendimiento_pct: currentReturn,
          umbral_subida_pct: risePct,
          umbral_caida_pct: dropPct,
          rearmar_pct: rearmPct,
          estado: editingRule?.estado ?? 'normal',
          canal_telegram: telegram,
          canal_email: email,
          canal_whatsapp: whatsapp,
          activa: active,
          ultima_comprobacion_at: editingRule?.ultima_comprobacion_at ?? null,
          ultima_alerta_at: editingRule?.ultima_alerta_at ?? null,
          ultimo_error: null,
          updated_at: now,
        }
        const localRule: InversionAlerta = editingRule
          ? { ...editingRule, ...changes }
          : { ...changes, id: -Date.now(), created_at: now }
        const nextRules = editingRule
          ? rules.map((rule) => rule.id === editingRule.id ? localRule : rule)
          : [...rules, localRule]
        await onScenarioRulesChange(nextRules)
        setDialogOpen(false)
        resetForm()
        toast.success('Alerta guardada en el escenario local')
        return
      }

      const response = await fetch(editingRule ? `/api/inversiones/alertas/${editingRule.id}` : '/api/inversiones/alertas', {
        method: editingRule ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editingRule
          ? { umbral_subida_pct: risePct, umbral_caida_pct: dropPct, rearmar_pct: rearmPct, canal_telegram: telegram, canal_email: email, canal_whatsapp: whatsapp, activa: active, ...(scope === 'cartera' ? { precio_referencia: referenceValue } : { isin: isin.trim() || null, precio_objetivo_importe: targetPriceValue, divisa_objetivo: targetPriceValue === null ? null : normalizedTargetCurrency }) }
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
      if (scenarioMode && onScenarioRulesChange) {
        await onScenarioRulesChange(rules.map((item) => item.id === rule.id ? { ...item, ...changes, updated_at: new Date().toISOString() } : item))
        return
      }

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

  async function refreshAssetPrice(rule: InversionAlerta) {
    setRefreshingRuleId(rule.id)
    try {
      if (scenarioMode && onScenarioRulesChange) {
        const position = rule.posicion_id ? positionById.get(rule.posicion_id) : null
        const now = new Date().toISOString()
        let currentPrice = position?.precio_actual ?? rule.precio_actual
        let currentNativeQuote = selectNativePresentationQuote(position, rule)
        let currentReturn = percentageFromAlertBase(rule, position)
        const refreshAsset = position
          ? { id: position.id, tipo_activo: position.tipo, ticker: position.ticker, crypto_id: position.crypto_id }
          : rule.ticker || rule.price_ticker
            ? { id: rule.id, tipo_activo: rule.tipo_activo || 'Acción', ticker: rule.price_ticker || rule.ticker || '', crypto_id: rule.crypto_id }
            : null
        if (refreshAsset) {
          const response = await fetch('/api/inversiones/referencia-precios', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ assets: [refreshAsset] }),
          })
          const payload = await response.json().catch(() => null) as { updates?: Array<{ id: number; price: number; nativePrice: number; nativeCurrency?: string; sourceUrl: string; provider: string; asOf?: string }>; errors?: Array<{ error?: string }>; error?: string } | null
          const update = payload?.updates?.[0]
          if (!response.ok || !update) throw new Error(payload?.errors?.[0]?.error || payload?.error || 'No se pudo actualizar el precio')
          if (position && onScenarioPriceRefresh) await onScenarioPriceRefresh(position.id, update)
          currentPrice = update.price
          currentNativeQuote = completePresentationQuote(update.nativePrice, update.nativeCurrency) ?? currentNativeQuote
          currentReturn = percentageFromAlertBase({
            ...rule,
            precio_actual: currentPrice,
            precio_actual_nativo: currentNativeQuote?.price ?? null,
            divisa_nativa: currentNativeQuote?.currency ?? null,
          }, null)
        }
        await onScenarioRulesChange(rules.map((item) => item.id === rule.id ? {
          ...item,
          precio_actual: currentPrice,
          precio_actual_nativo: currentNativeQuote?.price ?? null,
          divisa_nativa: currentNativeQuote?.currency ?? null,
          rendimiento_pct: currentReturn,
          ultima_comprobacion_at: now,
          ultimo_error: null,
          updated_at: now,
        } : item))
        toast.success(currentPrice !== null && currentPrice !== undefined
          ? `Precio de referencia comprobado · ${formatAssetPrice(currentNativeQuote?.price ?? currentPrice, currentNativeQuote?.currency || 'EUR')} · ${formatPercent(currentReturn)}`
          : 'Precio de referencia comprobado')
        return
      }

      const response = await fetch(`/api/inversiones/alertas/${rule.id}/actualizar`, { method: 'POST' })
      const payload = await response.json().catch(() => null) as { error?: string; precio_actual?: number | null; precio_actual_nativo?: number | null; divisa_nativa?: string | null; rendimiento_pct?: number | null } | null
      if (!response.ok) throw new Error(payload?.error || 'No se pudo actualizar el precio')
      await onChanged()
      const presentationQuote = selectPresentationQuote(null, payload)
      toast.success(payload?.precio_actual !== null && payload?.precio_actual !== undefined
        ? `Precio actualizado · ${formatAssetPrice(presentationQuote.price, presentationQuote.currency)} · ${formatPercent(payload.rendimiento_pct)}`
        : 'Precio actualizado')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'No se pudo actualizar el precio')
    } finally {
      setRefreshingRuleId(null)
    }
  }

  async function removeRule(rule: InversionAlerta) {
    setBusyRuleId(rule.id)
    try {
      if (scenarioMode && onScenarioRulesChange) {
        await onScenarioRulesChange(rules.filter((item) => item.id !== rule.id))
        setRulePendingDeletion(null)
        toast.success('Alerta eliminada del escenario')
        return
      }

      const response = await fetch(`/api/inversiones/alertas/${rule.id}`, { method: 'DELETE' })
      const payload = await response.json().catch(() => null) as { error?: string } | null
      if (!response.ok) throw new Error(payload?.error || 'No se pudo eliminar la alerta')
      await onChanged()
      setRulePendingDeletion(null)
      toast.success('Alerta eliminada')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'No se pudo eliminar la alerta')
    } finally {
      setBusyRuleId(null)
    }
  }

  return (
    <section className="rounded-xl bg-[#f7f5ef] p-4 text-slate-900 shadow-[0_12px_30px_rgba(0,0,0,.14)] sm:p-5" id="external-alerts">
      <div className="flex flex-col gap-3 border-b border-slate-200 pb-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="mb-1 flex items-center gap-2 text-[9px] font-bold uppercase tracking-[0.16em] text-slate-400"><BellRing className="h-3.5 w-3.5" /> Alertas</p>
          <h2 className="text-base font-semibold tracking-[-0.04em]">Telegram, email y WhatsApp</h2>
          <p className="mt-1.5 max-w-2xl text-[10px] leading-relaxed text-slate-500">{scenarioMode ? 'Prueba local; no modifica n8n ni tu cartera principal.' : 'n8n envía los avisos.'}</p>
        </div>
        <Button type="button" size="sm" className="bg-slate-900 text-white hover:bg-slate-700" onClick={() => openAssetRule(null, 'position')}><Plus />Nueva alerta de posición</Button>
      </div>

      <div className="mt-4 grid gap-2 lg:grid-cols-2">
        <div className={`rounded-lg border p-3 ${portfolioReturnPct !== null && portfolioReturnPct < 0 ? 'border-rose-200 bg-[#fff1f0]' : 'border-emerald-200 bg-[#eef6e5]'}`}>
          <div className="flex items-start justify-between gap-3">
            <div><p className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-400">Cartera completa</p><p className="mt-1 text-[13px] font-semibold">Alerta de rentabilidad</p></div>
            <span className={`rounded-full px-2 py-1 text-[10px] font-semibold ${portfolioRule?.activa ? 'bg-[#e7f2d4] text-[#31531d]' : 'bg-slate-100 text-slate-500'}`}>{portfolioRule?.activa ? 'Activa' : 'Sin configurar'}</span>
          </div>
          <div className="mt-3 flex items-end justify-between gap-3"><div><p className={`text-2xl font-semibold tracking-[-0.05em] tabular-nums ${portfolioReturnPct !== null && portfolioReturnPct < 0 ? 'text-red-600' : 'text-emerald-700'}`}>{formatPercent(portfolioReturnPct)}</p><p className={`mt-1 text-[10px] font-semibold ${portfolioReturnPct !== null && portfolioReturnPct < 0 ? 'text-red-700' : 'text-emerald-800'}`}>{formatPortfolioMovement(portfolioReturnPct)}</p></div><Button type="button" size="sm" variant="outline" className="border-slate-200 bg-transparent text-slate-700 hover:bg-white" onClick={() => openPortfolioRule(portfolioRule)}><Pencil />{portfolioRule ? 'Editar' : 'Configurar'}</Button></div>
          {portfolioRule ? <><p className="mt-4 flex items-center gap-1.5 text-[10px] text-slate-500"><Send className="h-3.5 w-3.5 text-[#5d8236]" />Avisar cuando suba {percentInput(portfolioRule.umbral_subida_pct) || '—'}% o baje {percentInput(portfolioRule.umbral_caida_pct) || '—'}% · {ruleChannels(portfolioRule)}</p><p className="mt-1 text-[10px] text-slate-400">{formatPortfolioAlertSummary(portfolioRule)}</p></> : <p className="mt-4 text-[10px] text-slate-400">Configura cuándo quieres recibir el aviso.</p>}
        </div>

        <div className="rounded-lg border border-slate-200 bg-white p-3">
          <div className="flex items-start justify-between gap-3"><div><p className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-400">Activos vigilados</p><p className="mt-1 text-[13px] font-semibold">Posiciones y watchlist</p></div><span className="text-2xl font-semibold tracking-[-0.05em] tabular-nums">{assetRules.length}</span></div>
          <p className="mt-2 text-[10px] leading-relaxed text-slate-500">Posiciones de tu cartera o activos que todavía no tienes.</p>
          <div className="mt-3 flex items-center justify-between gap-3"><span className="flex items-center gap-1.5 text-[10px] text-slate-500"><MessageCircle className="h-3.5 w-3.5 text-[#5d8236]" />Telegram · email · WhatsApp</span><Button type="button" size="sm" variant="outline" className="border-slate-200 bg-transparent text-slate-700 hover:bg-slate-50" onClick={() => openAssetRule(null, 'watchlist')}><Plus />Añadir seguimiento</Button></div>
        </div>
      </div>

      {assetRules.length > 0 ? <div className="mt-4 grid gap-2">
        {assetRules.map((rule) => {
          const position = rule.posicion_id ? positionById.get(rule.posicion_id) : null
          const name = position?.activo || rule.activo || rule.ticker || 'Activo vigilado'
          const ticker = position?.price_ticker || position?.ticker || rule.price_ticker || rule.ticker || '—'
          const presentationQuote = selectPresentationQuote(position, rule)
          const displayedTarget = ruleTarget(rule)
          const currentReturnPct = percentageFromAlertBase(rule, position)
          const referencePrice = rule.precio_referencia
          const isBusy = busyRuleId === rule.id || refreshingRuleId === rule.id
          const isRefreshing = refreshingRuleId === rule.id
          return <div key={rule.id} className="flex flex-col gap-3 rounded-lg border border-slate-200 bg-white p-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><p className="truncate text-sm font-semibold">{name}</p><span className="rounded bg-slate-100 px-1.5 py-0.5 text-[9px] font-semibold text-slate-500">{ticker}</span><span className={`rounded-full px-2 py-0.5 text-[9px] font-semibold ${rule.activa ? 'bg-[#e7f2d4] text-[#31531d]' : 'bg-slate-100 text-slate-500'}`}>{position ? 'En cartera' : 'No poseído'}</span></div><div className="mt-3 grid max-w-md grid-cols-2 gap-2"><div className="rounded-md bg-slate-50 px-3 py-2"><p className="text-[9px] font-bold uppercase tracking-[0.1em] text-slate-400">Precio actual</p><div className="mt-1 flex flex-wrap items-baseline gap-x-2 gap-y-0.5"><p className="text-sm font-semibold tabular-nums text-slate-800">{formatAssetPrice(presentationQuote.price, presentationQuote.currency)}</p>{referencePrice !== null && presentationQuote.currency !== 'EUR' ? <span className="text-[9px] font-medium tabular-nums text-slate-500">Referencia EUR: {formatAssetPrice(referencePrice, 'EUR')}</span> : null}</div></div><div className={`rounded-md px-3 py-2 ${currentReturnPct !== null && currentReturnPct !== undefined && currentReturnPct < 0 ? 'bg-rose-50' : 'bg-[#eef6e5]'}`}><p className="text-[9px] font-bold uppercase tracking-[0.1em] text-slate-400">Variación actual</p><p className={`mt-1 text-sm font-semibold tabular-nums ${currentReturnPct !== null && currentReturnPct !== undefined && currentReturnPct < 0 ? 'text-red-700' : 'text-emerald-700'}`}>{formatPercent(currentReturnPct)}</p><p className="mt-0.5 text-[9px] text-slate-500">{rule.precio_base_porcentaje ? `desde ${percentageBaseLabel(rule, position)} al configurar` : 'base porcentual pendiente'}</p></div></div>{displayedTarget ? <div className="mt-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2"><p className="text-[9px] font-bold uppercase tracking-[0.1em] text-amber-800">Objetivo de alerta ({displayedTarget.currency})</p><p className="mt-1 text-sm font-semibold tabular-nums text-amber-950">{formatAssetPrice(displayedTarget.price, displayedTarget.currency)}</p></div> : null}<p className="mt-2 text-[10px] text-slate-500">Avisar si sube {percentInput(rule.umbral_subida_pct) || '—'}% o cae {percentInput(rule.umbral_caida_pct) || '—'}% · {ruleChannels(rule)}</p><p className="mt-1 flex items-center gap-1.5 text-[10px] text-slate-400">{rule.ultimo_error ? <><CircleAlert className="h-3.5 w-3.5 text-amber-600" />{rule.ultimo_error}</> : rule.ultima_comprobacion_at ? <><CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />Última comprobación {new Intl.DateTimeFormat('es-ES', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(rule.ultima_comprobacion_at))}</> : 'Pendiente de la próxima comprobación'}</p></div>
            <div className="flex shrink-0 flex-wrap gap-2 sm:justify-end"><Button type="button" size="sm" variant="outline" className="border-slate-200 bg-transparent text-slate-700 hover:bg-slate-50" onClick={() => void refreshAssetPrice(rule)} disabled={isBusy}>{isRefreshing ? <Loader2 className="animate-spin" /> : <RefreshCw />} {isRefreshing ? 'Actualizando…' : 'Actualizar precio'}</Button><Button type="button" size="sm" variant="outline" className="border-slate-200 bg-transparent text-slate-700 hover:bg-slate-50" onClick={() => void updateRule(rule, { activa: !rule.activa })} disabled={isBusy}>{isBusy ? <Loader2 className="animate-spin" /> : rule.activa ? 'Pausar' : 'Activar'}</Button><Button type="button" size="icon" variant="outline" aria-label={`Editar alerta de ${name}`} className="border-slate-200 bg-transparent text-slate-700 hover:bg-slate-50" onClick={() => openAssetRule(rule)} disabled={isBusy}><Pencil /></Button><Button type="button" size="icon" variant="outline" aria-label={`Eliminar alerta de ${name}`} className="border-slate-200 bg-transparent text-red-700 hover:bg-red-50" onClick={() => setRulePendingDeletion(rule)} disabled={isBusy}><Trash2 /></Button></div>
          </div>
        })}
      </div> : <div className="mt-3 rounded-lg border border-dashed border-slate-300 bg-[#eeece5] px-4 py-3 text-center"><p className="text-[12px] font-semibold text-slate-700">Todavía no hay alertas de activos</p><p className="mt-1 text-[10px] text-slate-500">Añade una posición o un activo para seguir.</p></div>}

      <Dialog open={rulePendingDeletion !== null} onOpenChange={(open) => { if (!open && busyRuleId === null) setRulePendingDeletion(null) }}>
        <DialogContent className="border-slate-200 bg-[#f7f5ef] text-slate-900 sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Eliminar alerta</DialogTitle>
            <DialogDescription>Se eliminará la alerta de {rulePendingDeletion?.activo || rulePendingDeletion?.ticker || 'este activo'} y dejarás de recibir sus avisos por Telegram, email y WhatsApp.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setRulePendingDeletion(null)} disabled={busyRuleId !== null}>Cancelar</Button>
            <Button type="button" className="bg-red-700 text-white hover:bg-red-800" onClick={() => { if (rulePendingDeletion) void removeRule(rulePendingDeletion) }} disabled={busyRuleId !== null}>{busyRuleId !== null ? <><Loader2 className="animate-spin" />Eliminando…</> : <><Trash2 />Eliminar alerta</>}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={dialogOpen} onOpenChange={(open) => { setDialogOpen(open); if (!open) resetForm() }}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-[620px]">
          <DialogHeader><DialogTitle>{editingRule ? scope === 'cartera' ? 'Editar alerta de cartera completa' : 'Editar alerta de activo' : scope === 'cartera' ? 'Alerta de cartera completa' : assetIntent === 'position' ? 'Nueva alerta de posición' : 'Nuevo seguimiento de activo'}</DialogTitle><DialogDescription>{scope === 'cartera' ? 'Configura un aviso desde el valor base de tu cartera. Por defecto se propone el valor actual y puedes modificarlo.' : assetIntent === 'position' ? 'Elige una posición que ya tengas en cartera. El aviso seguirá su rentabilidad.' : 'Busca un activo que todavía no tengas. Se guardará como seguimiento, sin crear una operación.'} Se avisa al cruzar el nivel y vuelve a quedar listo cuando recupera el margen indicado.{scenarioMode ? ' En este escenario, la regla se guarda solo localmente y no la recibe n8n.' : ''}</DialogDescription></DialogHeader>
          <form onSubmit={saveRule} className="grid gap-5 py-2">
            {scope === 'activo' ? <div className="grid gap-2"><Label htmlFor="alert-asset-search">{assetIntent === 'position' ? 'Posición de tu cartera' : 'Activo para seguir'}</Label>{selectedAsset ? <div className="rounded-md border border-[#90b85f] bg-[#e7f2d4] px-3 py-3"><div className="flex items-start justify-between gap-3"><div className="min-w-0"><p className="truncate text-sm font-semibold text-[#31531d]">{selectedAsset.activo}</p><p className="text-[10px] text-[#52783a]">{selectedAsset.price_ticker} · {selectedAsset.poseido ? 'En cartera' : 'No poseído; se guardará como seguimiento'}</p></div>{!editingRule ? <Button type="button" size="sm" variant="outline" className="shrink-0 border-[#90b85f] bg-transparent text-[#31531d] hover:bg-[#dceec0]" onClick={() => { setSelectedAsset(null); setIsin(''); setReferencePrice(''); setTargetPrice(''); setTargetCurrency('EUR') }}>Cambiar</Button> : null}</div><div className="mt-3 grid gap-3 border-t border-[#c7dda7] pt-3 sm:grid-cols-2"><div><p className="text-[9px] font-bold uppercase tracking-[0.12em] text-[#52783a]">Precio actual</p><p className="mt-1 text-sm font-semibold tabular-nums text-[#31531d]">{formatAssetPrice(selectedAsset.precio_actual, selectedAsset.divisa)}</p><p className="mt-1 flex items-center gap-1 text-[10px] text-[#52783a]"><Clock3 className="h-3 w-3" />{formatAssetDate(selectedAsset.precio_actual_as_of) ? `Dato ${formatAssetDate(selectedAsset.precio_actual_as_of)}` : 'Último precio disponible'}</p></div><div><p className="text-[9px] font-bold uppercase tracking-[0.12em] text-[#52783a]">Mercado seleccionado</p><p className="mt-1 flex items-center gap-1 text-sm font-semibold text-[#31531d]"><MapPin className="h-3.5 w-3.5" />{selectedAsset.exchange || 'Mercado no identificado'}</p><p className="mt-1 text-[10px] text-[#52783a]">{selectedAsset.market_symbol || selectedAsset.price_ticker}</p></div></div></div> : <div className="relative"><Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-slate-400" /><Input id="alert-asset-search" value={searchQuery} onChange={(event) => setSearchQuery(event.target.value)} placeholder={assetIntent === 'position' ? 'Busca una posición (SXR8, BTC, NVDA…)' : 'Busca un activo que no tengas (AAPL, BTC…)'} className="pl-9" autoFocus />{searching ? <Loader2 className="absolute right-3 top-2.5 h-4 w-4 animate-spin text-slate-400" /> : null}{searchResults.length > 0 ? <div className="absolute z-20 mt-1 max-h-64 w-full overflow-y-auto rounded-md border border-slate-200 bg-white p-1 shadow-xl">{searchResults.map((result) => <button type="button" key={result.key} className="flex w-full items-start justify-between gap-3 rounded px-3 py-2 text-left hover:bg-slate-50" onClick={() => chooseAsset(result)}><span className="min-w-0"><span className="block truncate text-xs font-semibold text-slate-800">{result.activo}</span><span className="block text-[10px] text-slate-500">{result.price_ticker}{result.exchange ? ` · ${result.exchange}` : ' · Mercado no identificado'}</span><span className="block text-[10px] text-slate-400">{formatAssetPrice(result.precio_actual, result.divisa)} · ISIN {result.isin || 'no disponible'}</span></span><span className={`shrink-0 rounded-full px-2 py-0.5 text-[9px] font-semibold ${result.poseido ? 'bg-[#e7f2d4] text-[#31531d]' : 'bg-slate-100 text-slate-500'}`}>{result.poseido ? 'En cartera' : 'No poseído'}</span></button>)}</div> : null}</div>} {selectedAsset ? <div className="grid gap-2 rounded-md border border-slate-200 bg-white p-3"><div className="flex items-center justify-between gap-2"><Label className="text-slate-700" htmlFor="alert-isin">ISIN para confirmar el instrumento (opcional)</Label>{isin ? <button type="button" title="Copiar ISIN" aria-label={`Copiar ISIN ${isin}`} className="inline-flex items-center gap-1 rounded px-1.5 py-1 text-[10px] font-semibold text-slate-500 hover:bg-slate-100 hover:text-slate-900" onClick={() => void copiarIsin(isin)}><Copy className="h-3 w-3" />Copiar</button> : null}</div><Input id="alert-isin" value={isin} onChange={(event) => setIsin(event.target.value.toUpperCase())} placeholder="Ej. CY0106002112" maxLength={12} className="text-slate-900 placeholder:text-slate-400" /><p className="text-[10px] text-slate-500">{isin ? 'Se guardará junto con el ticker y el mercado seleccionado.' : 'Si el proveedor no lo devuelve, puedes pegarlo aquí. La alerta seguirá ligada a esta cotización concreta.'}</p></div> : null} {!selectedAsset && !editingRule ? <p className="text-[10px] text-slate-500">{assetIntent === 'position' ? 'Elige una posición de tu cartera.' : 'Elige un activo que no esté en tu cartera.'}</p> : null}</div> : null}
           {scope === 'activo' && selectedAsset && !selectedAsset.poseido && !editingRule ? <div className="grid gap-2"><Label htmlFor="alert-reference-price">Precio de referencia en EUR (opcional)</Label><Input id="alert-reference-price" type="number" min="0.000001" step="any" value={referencePrice} onChange={(event) => setReferencePrice(event.target.value)} placeholder="Se consulta automáticamente si lo dejas vacío" /><p className="text-[10px] text-slate-500">{selectedAsset.divisa && selectedAsset.divisa !== 'EUR' ? 'El precio mostrado está en la divisa del mercado; si dejas esto vacío, la alerta se normalizará a EUR al guardar.' : 'La variación se medirá desde este precio. Si lo dejas vacío, Finanzas capturará la cotización al guardar.'}</p></div> : null}
            {scope === 'cartera' ? <div className="grid gap-2 rounded-md border border-emerald-200 bg-[#eef6e5] p-3"><Label htmlFor="alert-reference-price">Valor actual de la cartera (€)</Label><Input id="alert-reference-price" type="number" min="0.01" step="any" value={referencePrice} readOnly aria-readonly="true" placeholder="Valor actual de la cartera" /><p className="text-[10px] leading-relaxed text-slate-600">Los porcentajes se calcularán desde el valor actual de la cartera al guardar la alerta. La referencia histórica se conserva aparte.</p>{portfolioBaseValue !== null && (portfolioRiseLevel !== null || portfolioDropLevel !== null) ? <p className="rounded-md bg-white/70 px-2.5 py-2 text-[10px] font-medium leading-relaxed text-slate-700">Con base en {formatAssetPrice(portfolioBaseValue, 'EUR')}{portfolioRiseLevel !== null ? ` · +${rise}%: ${formatAssetPrice(portfolioRiseLevel, 'EUR')}` : ''}{portfolioDropLevel !== null ? ` · −${drop}%: ${formatAssetPrice(portfolioDropLevel, 'EUR')}` : ''}</p> : null}</div> : null}
           {scope === 'activo' && selectedAsset ? <div className="grid gap-2"><Label htmlFor="alert-target-price">Importe objetivo de alerta (opcional)</Label><div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_8rem]"><Input id="alert-target-price" aria-label={`Importe objetivo en ${targetCurrency}`} type="number" min="0.000001" step="any" value={targetPrice} onChange={(event) => setTargetPrice(event.target.value)} placeholder="Ej. 120,00" /><select id="alert-target-currency" aria-label="Divisa del objetivo de alerta" value={targetCurrency} onChange={(event) => setTargetCurrency(event.target.value)} className="h-10 rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-900 outline-none focus:border-slate-500">{targetCurrencyOptions.map((currency) => <option key={currency} value={currency}>{currency}</option>)}</select></div><p className="text-[10px] leading-relaxed text-slate-500">La alerta comparará el objetivo en la divisa elegida. EUR usa la valoración normalizada; USD u otra divisa disponible usa la cotización del mercado.</p></div> : null}
           {scope === 'activo' && selectedAsset ? <p className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-[10px] leading-relaxed text-slate-600">El precio objetivo es un nivel absoluto. Los porcentajes se calcularán desde el precio actual de este activo en el momento de guardar la alerta.</p> : null}
            <div className="grid gap-3 sm:grid-cols-2"><div className="grid gap-2"><Label htmlFor="alert-rise">Avisar si sube (%)</Label><Input id="alert-rise" type="number" min="0.1" step="0.1" value={rise} onChange={(event) => setRise(event.target.value)} placeholder="Ej. 10" /></div><div className="grid gap-2"><Label htmlFor="alert-drop">Avisar si cae (%)</Label><Input id="alert-drop" type="number" min="0.1" step="0.1" value={drop} onChange={(event) => setDrop(event.target.value)} placeholder="Ej. 10" /></div></div>
            <div className="grid gap-2"><Label htmlFor="alert-rearm">Recuperación para volver a avisar (%)</Label><Input id="alert-rearm" type="number" min="0.1" step="0.1" value={rearm} onChange={(event) => setRearm(event.target.value)} /><p className="text-[10px] leading-relaxed text-slate-500">No es el número de avisos: es cuánto debe recuperar la rentabilidad para rearmar la alerta. Ejemplo: si cae un 10% y pones 1%, volverá a avisar al recuperar hasta −9%.</p></div>
            <div className="grid gap-2"><Label>Canales</Label><div className="flex flex-wrap gap-2"><button type="button" aria-pressed={telegram} className={`inline-flex items-center gap-2 rounded-md border px-3 py-2 text-xs font-semibold ${channelButtonClass(telegram)}`} onClick={() => setTelegram((value) => !value)}><Send className="h-3.5 w-3.5" />Telegram</button><button type="button" aria-pressed={email} className={`inline-flex items-center gap-2 rounded-md border px-3 py-2 text-xs font-semibold ${channelButtonClass(email)}`} onClick={() => setEmail((value) => !value)}><Mail className="h-3.5 w-3.5" />Email</button><button type="button" aria-pressed={whatsapp} className={`inline-flex items-center gap-2 rounded-md border px-3 py-2 text-xs font-semibold ${channelButtonClass(whatsapp)}`} onClick={() => setWhatsapp((value) => !value)}><MessageCircle className="h-3.5 w-3.5" />WhatsApp</button></div><p className="text-[10px] text-slate-500">{scenarioMode ? 'Se guardan como preferencias locales; esta vista no envía mensajes.' : 'El workflow de n8n usa estas marcas para decidir a qué canal enviar cada cruce. WhatsApp se completa desde Configuración; Telegram y email no dependen de estos datos.'}</p></div>
            <div className="flex items-center justify-between rounded-md border border-slate-200 bg-[#eeece5] px-3 py-2"><div><p className="text-xs font-semibold text-slate-700">Regla activa</p><p className="text-[10px] text-slate-500">Pausarla conserva su configuración y estado.</p></div><button type="button" aria-pressed={active} className={`relative h-6 w-11 rounded-full transition ${active ? 'bg-[#739b43]' : 'bg-slate-300'}`} onClick={() => setActive((value) => !value)}><span className={`absolute top-1 h-4 w-4 rounded-full bg-white transition ${active ? 'left-6' : 'left-1'}`} /></button></div>
            <DialogFooter><Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button><Button type="submit" className="bg-slate-900 text-white hover:bg-slate-700" disabled={saving}>{saving ? <><Loader2 className="animate-spin" />Guardando…</> : 'Guardar alerta'}</Button></DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </section>
  )
}
