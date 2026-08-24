'use client'

import { useEffect, useMemo, useState } from 'react'
import { Clock3, Globe2, Sun } from 'lucide-react'
import type { InversionPosicion } from '@/lib/db/schema'
import {
  formatCountdown,
  formatMadridDateTime,
  formatNextEvent,
  getMarketIdForPosition,
  getMarketSnapshot,
  MARKET_DEFINITIONS,
  type MarketDefinition,
  type MarketSnapshot,
} from '@/lib/mercados/horarios'

type MarketGroup = {
  market: MarketDefinition
  positions: InversionPosicion[]
  investedValue: number
}

const STATUS_STYLES: Record<MarketSnapshot['status'], { badge: string; dot: string }> = {
  open: { badge: 'bg-emerald-100 text-emerald-800', dot: 'bg-emerald-500' },
  break: { badge: 'bg-amber-100 text-amber-800', dot: 'bg-amber-500' },
  closed: { badge: 'bg-slate-200 text-slate-700', dot: 'bg-slate-400' },
  weekend: { badge: 'bg-violet-100 text-violet-800', dot: 'bg-violet-500' },
  holiday: { badge: 'bg-rose-100 text-rose-800', dot: 'bg-rose-500' },
}

function formatEuro(value: number) {
  return new Intl.NumberFormat('es-ES', {
    style: 'currency',
    currency: 'EUR',
    maximumFractionDigits: 0,
  }).format(value)
}

function positionLabel(position: InversionPosicion) {
  return (position.price_ticker || position.market_symbol || position.ticker).split(' / ')[0]
}

export function MarketHoursPanel({ positions, compact = true }: { positions: InversionPosicion[]; compact?: boolean }) {
  const [nowMs, setNowMs] = useState<number | null>(null)
  const [selectedMarketId, setSelectedMarketId] = useState<string | null>(null)

  useEffect(() => {
    const syncClock = () => setNowMs(Date.now())
    syncClock()
    const interval = window.setInterval(syncClock, 1000)
    return () => window.clearInterval(interval)
  }, [])

  const groups = useMemo<MarketGroup[]>(() => {
    const positionsByMarket = new Map<string, InversionPosicion[]>()
    for (const position of positions) {
      const marketId = getMarketIdForPosition(position)
      const marketPositions = positionsByMarket.get(marketId) ?? []
      marketPositions.push(position)
      positionsByMarket.set(marketId, marketPositions)
    }

    return MARKET_DEFINITIONS
      .map((market) => {
        const marketPositions = positionsByMarket.get(market.id) ?? []
        return {
          market,
          positions: marketPositions,
          investedValue: marketPositions.reduce((sum, position) => sum + (position.valor_actual ?? 0), 0),
        }
      })
      .toSorted((left, right) => {
        if (left.positions.length !== right.positions.length) return right.positions.length - left.positions.length
        if (left.investedValue !== right.investedValue) return right.investedValue - left.investedValue
        return left.market.name.localeCompare(right.market.name, 'es')
      })
  }, [positions])

  const now = nowMs === null ? null : new Date(nowMs)
  const snapshots = useMemo(() => {
    if (nowMs === null) return new Map<string, MarketSnapshot>()
    const current = new Date(nowMs)
    return new Map(groups.map((group) => [group.market.id, getMarketSnapshot(group.market, current)]))
  }, [groups, nowMs])

  const defaultGroup = groups.find((group) => group.positions.length > 0) ?? groups[0] ?? null
  const selectedGroup = groups.find((group) => group.market.id === selectedMarketId) ?? defaultGroup
  const selectedSnapshot = selectedGroup ? snapshots.get(selectedGroup.market.id) ?? null : null
  const selectedStyles = selectedSnapshot ? STATUS_STYLES[selectedSnapshot.status] : STATUS_STYLES.closed
  const selectedNextEvent = selectedSnapshot && now ? formatNextEvent(selectedSnapshot.nextEventAt, now) : null
  const selectedLabels = selectedGroup ? [...new Set(selectedGroup.positions.map(positionLabel))].filter(Boolean).slice(0, 4) : []
  const selectedExtraCount = selectedGroup ? Math.max(0, new Set(selectedGroup.positions.map(positionLabel)).size - selectedLabels.length) : 0

  return (
    <section className={`${compact ? '' : 'mt-3'} overflow-hidden rounded-xl border border-white/10 bg-[#151b25] ${compact ? 'p-4' : 'p-5 sm:p-6'} text-slate-100 shadow-[0_12px_30px_rgba(0,0,0,.18)]`} id="market-hours-panel" aria-labelledby="market-hours-title">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="mb-1 text-[9px] font-bold uppercase tracking-[0.16em] text-[#c8f56a]">Horarios de mercado</p>
          <h2 id="market-hours-title" className="text-base font-semibold tracking-[-0.04em]">Qué mercado está abierto</h2>
          <p className="mt-1.5 max-w-2xl text-[10px] leading-relaxed text-slate-400">Selecciona un mercado para ver su estado y la próxima apertura o cierre en hora española.</p>
        </div>
        <div className="flex shrink-0 items-center gap-2 rounded-lg border border-white/10 bg-[#10161f] px-3 py-2">
          <Clock3 className="h-4 w-4 text-[#c8f56a]" />
          <div>
            <p className="text-[9px] uppercase tracking-[0.1em] text-slate-500">Ahora · España</p>
            <p className="mt-0.5 font-mono text-sm font-semibold tabular-nums text-slate-100">{now ? formatMadridDateTime(now) : '—'}</p>
          </div>
        </div>
      </div>

      {now && selectedGroup && selectedSnapshot ? (
        <div className="mt-4 grid gap-3 md:grid-cols-[minmax(0,1fr)_minmax(250px,.8fr)]">
          <div>
            <label htmlFor="market-hours-selector" className="text-[9px] font-bold uppercase tracking-[0.12em] text-slate-500">Seleccionar mercado</label>
            <select id="market-hours-selector" aria-label="Seleccionar mercado" value={selectedGroup.market.id} onChange={(event) => setSelectedMarketId(event.target.value)} className="mt-1.5 h-10 w-full rounded-md border border-white/10 bg-[#10161f] px-3 text-[11px] font-medium text-slate-100 outline-none focus:border-[#c8f56a]">
              {groups.map((group) => <option key={group.market.id} value={group.market.id}>{group.market.name}{group.positions.length > 0 ? ' · En cartera' : ''}</option>)}
            </select>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <span className={`inline-flex items-center gap-1.5 rounded-full px-2 py-1 text-[10px] font-semibold ${selectedStyles.badge}`}><span className={`h-1.5 w-1.5 rounded-full ${selectedStyles.dot}`} />{selectedSnapshot.statusLabel}</span>
              {selectedGroup.positions.length > 0 ? <span className="rounded-full bg-[#c8f56a] px-2 py-1 text-[9px] font-bold uppercase tracking-[0.08em] text-[#172016]">En cartera</span> : <span className="text-[10px] text-slate-500">Sin posiciones actuales</span>}
            </div>
            <p className="mt-2 flex items-center gap-1.5 text-[10px] text-slate-400"><Globe2 className="h-3.5 w-3.5" />{selectedGroup.market.region} · hora española</p>
          </div>

          <div className="rounded-lg border border-white/10 bg-[#10161f] p-3">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate text-[12px] font-semibold text-slate-100">{selectedGroup.market.name}</p>
                <p className="mt-1 text-[9px] uppercase tracking-[0.1em] text-slate-500">Próximo cambio</p>
              </div>
              <p className="shrink-0 font-mono text-base font-semibold tabular-nums text-slate-100">{selectedNextEvent ?? '24/7'}</p>
            </div>
            <p className="mt-2 text-[10px] text-slate-400">{selectedSnapshot.nextEventLabel ?? 'Sesión continua'}</p>
            {selectedSnapshot.countdownSeconds !== null ? <p className="mt-1 text-[10px] text-[#c8f56a]">En {formatCountdown(selectedSnapshot.countdownSeconds)}</p> : <p className="mt-1 text-[10px] text-[#c8f56a]">Abierto 24 horas · 7 días</p>}
            {selectedGroup.positions.length > 0 ? <div className="mt-3 border-t border-white/10 pt-2"><div className="flex items-center justify-between gap-3 text-[10px]"><span className="text-slate-500">Tus posiciones</span><span className="font-semibold tabular-nums text-[#c8f56a]">{formatEuro(selectedGroup.investedValue)}</span></div><p className="mt-1 truncate text-[9px] text-slate-400">{selectedLabels.join(' · ')}{selectedExtraCount > 0 ? ` · +${selectedExtraCount}` : ''}</p></div> : null}
          </div>
        </div>
      ) : (
        <div className="mt-4 flex items-center gap-2 rounded-lg border border-white/10 bg-[#10161f] px-4 py-4 text-[10px] text-slate-400" role="status">Sincronizando los horarios en España…</div>
      )}

      <p className="mt-3 border-t border-white/10 pt-3 text-[9px] leading-relaxed text-slate-500"><Sun className="mr-1 inline h-3 w-3" />La cuenta atrás usa el horario regular · sin premarket ni after-hours.</p>
    </section>
  )
}
