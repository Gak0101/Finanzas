'use client'

import { useEffect, useMemo, useState } from 'react'
import { AlertTriangle, CalendarDays, CircleDollarSign, Landmark, Save, Target, TrendingUp, Wallet } from 'lucide-react'
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
import type { PositionInvestmentAnalytics } from '@/lib/inversiones/analytics'

type QuickOperation = 'Compra' | 'Venta' | 'Dividendo'

export type PositionMetadataChanges = {
  nota: string | null
  sector: string | null
  pais: string | null
  fecha_apertura: string | null
  objetivo_precio: number | null
  objetivo_peso_pct: number | null
  alerta_subida_pct: number | null
  alerta_caida_pct: number | null
}

type Props = {
  position: InversionPosicion | null
  analytics: PositionInvestmentAnalytics | null
  operations: InversionOperacion[]
  open: boolean
  onOpenChange: (open: boolean) => void
  onUpdated: (position: InversionPosicion) => void
  onStartOperation: (type: QuickOperation, position: InversionPosicion) => void
  onSaveMetadata?: (positionId: number, changes: PositionMetadataChanges) => Promise<InversionPosicion>
}

function formatEuro(value: number | null | undefined) {
  if (value === null || value === undefined || Number.isNaN(value)) return 'Dato pendiente'
  return new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR', maximumFractionDigits: 2 }).format(value)
}

function formatPct(value: number | null | undefined) {
  if (value === null || value === undefined || Number.isNaN(value)) return 'Dato pendiente'
  return `${value >= 0 ? '+' : ''}${(value * 100).toFixed(1)}%`
}

function formatDate(value: string | null | undefined) {
  if (!value) return 'Fecha pendiente'
  return new Intl.DateTimeFormat('es-ES', { day: '2-digit', month: 'short', year: 'numeric' }).format(new Date(`${value.slice(0, 10)}T12:00:00`))
}

function normalizeInstrument(value: string | null | undefined) {
  return value?.trim().toLocaleLowerCase('es') ?? ''
}

function instrumentKeys(value: Pick<InversionPosicion, 'activo' | 'ticker' | 'price_ticker' | 'market_symbol'> | Pick<InversionOperacion, 'activo' | 'ticker'>) {
  const keys = [normalizeInstrument(value.activo), normalizeInstrument(value.ticker)]

  if ('price_ticker' in value) {
    keys.push(...(value.price_ticker ?? '').split('/').map(normalizeInstrument))
    keys.push(normalizeInstrument(value.market_symbol))
  }

  return new Set(keys.filter(Boolean))
}

export function PositionDetailDialog({ position, analytics, operations, open, onOpenChange, onUpdated, onStartOperation, onSaveMetadata }: Props) {
  const [saving, setSaving] = useState(false)
  const [note, setNote] = useState('')
  const [sector, setSector] = useState('')
  const [country, setCountry] = useState('')
  const [openingDate, setOpeningDate] = useState('')
  const [targetPrice, setTargetPrice] = useState('')
  const [targetWeight, setTargetWeight] = useState('')
  const [riseAlert, setRiseAlert] = useState('')
  const [dropAlert, setDropAlert] = useState('')

  useEffect(() => {
    if (!position) return
    setNote(position.nota ?? '')
    setSector(position.sector ?? '')
    setCountry(position.pais ?? '')
    setOpeningDate(position.fecha_apertura ?? '')
    setTargetPrice(position.objetivo_precio?.toString() ?? '')
    setTargetWeight(position.objetivo_peso_pct === null ? '' : (position.objetivo_peso_pct * 100).toString())
    setRiseAlert(position.alerta_subida_pct === null ? '' : (position.alerta_subida_pct * 100).toString())
    setDropAlert(position.alerta_caida_pct === null ? '' : (position.alerta_caida_pct * 100).toString())
  }, [position])

  const relatedOperations = useMemo(() => {
    if (!position) return []
    const positionKeys = instrumentKeys(position)
    return operations.filter((operation) => {
      if (normalizeInstrument(operation.custodia) !== normalizeInstrument(position.custodia)) return false
      return [...instrumentKeys(operation)].some((key) => positionKeys.has(key))
    })
  }, [operations, position])

  if (!position) return null

  const daysActive = position.fecha_apertura
    ? Math.max(0, Math.floor((Date.now() - new Date(`${position.fecha_apertura}T00:00:00Z`).getTime()) / 86_400_000))
    : null

  async function saveMetadata() {
    setSaving(true)
    try {
      const changes: PositionMetadataChanges = {
        nota: note.trim() || null,
        sector: sector.trim() || null,
        pais: country.trim() || null,
        fecha_apertura: openingDate || null,
        objetivo_precio: targetPrice === '' ? null : Number(targetPrice),
        objetivo_peso_pct: targetWeight === '' ? null : Number(targetWeight) / 100,
        alerta_subida_pct: riseAlert === '' ? null : Number(riseAlert) / 100,
        alerta_caida_pct: dropAlert === '' ? null : Number(dropAlert) / 100,
      }

      if (onSaveMetadata) {
        const updated = await onSaveMetadata(position!.id, changes)
        onUpdated(updated)
        toast.success('Ficha de posición actualizada en el escenario')
        return
      }

      const response = await fetch(`/api/inversiones/${position!.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(changes),
      })
      const payload = await response.json().catch(() => null)
      if (!response.ok || !payload || typeof payload.id !== 'number') {
        throw new Error(typeof payload?.error === 'string' ? payload.error : 'No se pudieron guardar los datos')
      }
      onUpdated(payload as InversionPosicion)
      toast.success('Ficha de posición actualizada')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'No se pudieron guardar los datos')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[calc(100dvh-1rem)] w-[calc(100vw-1rem)] max-w-4xl overflow-x-hidden overflow-y-auto border-slate-700 bg-[#111821] p-0 text-slate-100 sm:w-full sm:max-w-4xl">
        <DialogHeader className="border-b border-white/10 px-5 py-5 text-left sm:px-7">
          <div className="flex flex-wrap items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-[#c8f56a]">
            <span>{position.tipo}</span><span className="text-slate-600">/</span><span>{position.custodia}</span>
          </div>
          <DialogTitle className="mt-1 break-words text-2xl tracking-[-0.04em] sm:text-3xl">{position.activo}</DialogTitle>
          <DialogDescription className="text-slate-400">{position.price_ticker || position.ticker} · ficha construida solo con operaciones registradas.</DialogDescription>
          {position.isin ? <p className="text-[11px] font-semibold tracking-[0.08em] text-slate-500">ISIN {position.isin}</p> : null}
        </DialogHeader>

        <div className="grid gap-4 p-5 sm:p-7">
          <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4" aria-label="Resumen de la posición">
            {[
              { label: 'Valor actual', value: formatEuro(position.valor_actual), icon: CircleDollarSign },
              { label: 'Coste conocido', value: formatEuro(position.coste), icon: Wallet },
              { label: 'P / L actual', value: formatEuro(position.pnl), helper: formatPct(position.pnl_pct), icon: TrendingUp },
              { label: 'Tiempo en cartera', value: daysActive === null ? 'Fecha pendiente' : `${daysActive} días`, helper: formatDate(position.fecha_apertura), icon: CalendarDays },
            ].map((item) => (
              <div key={item.label} className="rounded-xl border border-white/10 bg-[#171f2a] p-4">
                <div className="flex items-center justify-between text-[11px] text-slate-400"><span>{item.label}</span><item.icon className="h-4 w-4" /></div>
                <p className="mt-4 text-xl font-semibold tracking-[-0.04em] tabular-nums">{item.value}</p>
                {item.helper ? <p className="mt-1 text-[11px] text-slate-500">{item.helper}</p> : null}
              </div>
            ))}
          </section>

          <section className="grid gap-3 lg:grid-cols-[minmax(0,1.2fr)_minmax(300px,.8fr)]">
            <div className="rounded-xl bg-[#f7f5ef] p-5 text-slate-900 sm:p-6">
              <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-400">Historial de la posición</p>
              <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
                {[
                  ['Compras', analytics?.purchases],
                  ['Ventas', analytics?.saleProceeds],
                  ['Realizado', analytics?.realisedPnl],
                  ['Dividendos', analytics?.dividends],
                  ['Comisiones', analytics?.commissions],
                  ['Impuestos', analytics?.taxes],
                  ['Operaciones', analytics?.operations ?? 0],
                  ['Precio medio', position.precio_compra],
                ].map(([label, value]) => (
                  <div key={String(label)} className="rounded-lg bg-[#eeece5] p-3">
                    <p className="text-[10px] text-slate-500">{label}</p>
                    <p className="mt-1 text-sm font-semibold tabular-nums">{label === 'Operaciones' ? value : formatEuro(value as number | null | undefined)}</p>
                  </div>
                ))}
              </div>

              <div className="mt-5 max-h-72 overflow-y-auto border-t border-slate-200">
                {relatedOperations.length > 0 ? relatedOperations.slice(0, 30).map((operation) => (
                  <div key={operation.id} className="grid min-w-0 grid-cols-[minmax(76px,82px)_minmax(0,1fr)_auto] items-start gap-3 border-b border-slate-200 py-3 text-[11px] last:border-0">
                    <span className="whitespace-nowrap text-slate-400">{formatDate(operation.fecha)}</span>
                    <span className="min-w-0 break-words"><strong className="font-semibold">{operation.tipo}</strong><span className="ml-2 text-slate-400">{operation.descripcion || operation.notas || ''}</span></span>
                    <span className="whitespace-nowrap font-semibold tabular-nums">{formatEuro(operation.importe)}</span>
                  </div>
                )) : (
                  <div className="grid gap-2 py-5 text-[11px] text-slate-500">
                    <p>No hay compras, ventas o ingresos registrados para esta posición y custodia.</p>
                    {position.coste === null ? <p className="text-slate-600">Añade la primera compra para que la app pueda calcular su coste y su P/L.</p> : null}
                  </div>
                )}
              </div>
            </div>

            <div className="rounded-xl border border-white/10 bg-[#171f2a] p-5 sm:p-6">
              <div className="flex items-center gap-2"><Target className="h-4 w-4 text-[#c8f56a]" /><h3 className="font-semibold">Tesis y alertas</h3></div>
              <div className="mt-5 grid gap-4">
                <div className="grid gap-2"><Label htmlFor="position-thesis" className="text-slate-300">Tesis o notas</Label><textarea id="position-thesis" value={note} onChange={(event) => setNote(event.target.value)} rows={4} placeholder="Qué esperas y qué invalidaría la posición…" className="resize-y rounded-md border border-white/10 bg-[#111821] px-3 py-2 text-sm outline-none placeholder:text-slate-600 focus:border-[#c8f56a]" /></div>
                <div className="grid gap-3 sm:grid-cols-2"><div className="grid gap-2"><Label htmlFor="position-sector" className="text-slate-300">Sector</Label><Input id="position-sector" value={sector} onChange={(event) => setSector(event.target.value)} className="border-white/10 bg-[#111821]" /></div><div className="grid gap-2"><Label htmlFor="position-country" className="text-slate-300">País</Label><Input id="position-country" value={country} onChange={(event) => setCountry(event.target.value)} className="border-white/10 bg-[#111821]" /></div></div>
                <div className="grid gap-2"><Label htmlFor="position-opening-date" className="text-slate-300">Fecha de apertura</Label><Input id="position-opening-date" type="date" value={openingDate} max={new Date().toISOString().slice(0, 10)} onChange={(event) => setOpeningDate(event.target.value)} className="border-white/10 bg-[#111821]" /><p className="text-[10px] leading-relaxed text-slate-500">Necesaria para calcular cuánto tiempo lleva activa y sus equivalencias D/M/A.</p></div>
                <div className="grid gap-2"><Label htmlFor="position-target" className="text-slate-300">Objetivo de precio (€)</Label><Input id="position-target" type="number" min="0" step="any" value={targetPrice} onChange={(event) => setTargetPrice(event.target.value)} className="border-white/10 bg-[#111821]" /></div>
                <div className="grid gap-2"><Label htmlFor="position-target-weight" className="text-slate-300">Objetivo en cartera (%)</Label><Input id="position-target-weight" type="number" min="0" max="100" step="0.1" value={targetWeight} onChange={(event) => setTargetWeight(event.target.value)} className="border-white/10 bg-[#111821]" /><p className="text-[10px] leading-relaxed text-slate-500">La app lo comparará con el peso actual y te avisará si se separa demasiado.</p></div>
                <div className="grid gap-3 sm:grid-cols-2"><div className="grid gap-2"><Label htmlFor="position-rise" className="text-slate-300">Alerta de subida (%)</Label><Input id="position-rise" type="number" min="0" step="0.1" value={riseAlert} onChange={(event) => setRiseAlert(event.target.value)} className="border-white/10 bg-[#111821]" /></div><div className="grid gap-2"><Label htmlFor="position-drop" className="text-slate-300">Alerta de caída (%)</Label><Input id="position-drop" type="number" min="0" step="0.1" value={dropAlert} onChange={(event) => setDropAlert(event.target.value)} className="border-white/10 bg-[#111821]" /></div></div>
                {position.coste === null ? <div className="grid gap-3 rounded-lg border border-amber-400/15 bg-amber-400/5 p-3 text-[11px] leading-relaxed text-amber-100/80"><div className="flex gap-2"><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" /><span>Falta el coste de adquisición. El valor actual sí está disponible, pero el P/L de esta posición es parcial.</span></div><Button type="button" variant="outline" className="w-full border-amber-300/30 bg-transparent text-amber-50 hover:bg-amber-50/10" onClick={() => onStartOperation('Compra', position)}>Registrar primera compra</Button></div> : null}
              <div className="flex gap-2 rounded-lg border border-amber-400/15 bg-amber-400/5 p-3 text-[11px] leading-relaxed text-amber-100/70"><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />Estos umbrales generan avisos dentro de la app. Para Telegram o email, configura una alerta externa en el bloque correspondiente de la página de inversiones; nunca ejecutan órdenes ni recomiendan comprar o vender.</div>
                <Button onClick={() => void saveMetadata()} disabled={saving} className="bg-[#c8f56a] text-[#172016] hover:bg-[#d8fb83]"><Save />{saving ? 'Guardando…' : 'Guardar ficha'}</Button>
              </div>
            </div>
          </section>
        </div>

        <DialogFooter className="sticky bottom-0 border-t border-white/10 bg-[#111821]/95 px-5 py-4 backdrop-blur sm:px-7">
          <div className="flex w-full flex-wrap gap-2 sm:justify-between">
            <div className="flex flex-wrap gap-2">
              {(['Compra', 'Venta', 'Dividendo'] as QuickOperation[]).map((type) => <Button key={type} variant="outline" className="border-white/15 bg-transparent text-slate-200 hover:bg-white/10 hover:text-white" onClick={() => onStartOperation(type, position)}>{type}</Button>)}
            </div>
            <Button variant="outline" className="border-white/15 bg-transparent text-slate-200 hover:bg-white/10 hover:text-white" onClick={() => onOpenChange(false)}><Landmark />Cerrar ficha</Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
