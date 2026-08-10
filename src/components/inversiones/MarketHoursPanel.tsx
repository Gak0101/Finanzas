'use client'

import { useEffect, useMemo, useState } from 'react'
import { ChevronDown, Clock3, Globe2, LockKeyhole, Moon, Sun } from 'lucide-react'
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

type MarketCardProps = {
  group: MarketGroup
  snapshot: MarketSnapshot
  now: Date
  priority: boolean
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

function MarketCard({ group, snapshot, now, priority }: MarketCardProps) {
  const styles = STATUS_STYLES[snapshot.status]
  const nextEvent = formatNextEvent(snapshot.nextEventAt, now)
  const labels = [...new Set(group.positions.map(positionLabel))].filter(Boolean).slice(0, 5)
  const extraCount = Math.max(0, new Set(group.positions.map(positionLabel)).size - labels.length)
  const tradeRepublicCount = group.positions.filter((position) => position.custodia.toLocaleLowerCase('es').includes('trade republic')).length

  return (
    <article className={`rounded-lg border p-4 transition ${priority ? 'border-[#c8f56a]/40 bg-[#1a241b]' : 'border-white/10 bg-[#121923]'}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <Globe2 className="h-3.5 w-3.5 shrink-0 text-slate-400" />
            <h3 className="truncate text-sm font-semibold text-slate-100">{group.market.name}</h3>
          </div>
          <p className="mt-1 text-[10px] text-slate-500">{group.market.region} · hora española</p>
        </div>
        {priority && <span className="shrink-0 rounded-full bg-[#c8f56a] px-2 py-1 text-[9px] font-bold uppercase tracking-[0.08em] text-[#172016]">En cartera</span>}
      </div>

      <div className="mt-4 flex items-center justify-between gap-3">
        <span className={`inline-flex items-center gap-1.5 rounded-full px-2 py-1 text-[10px] font-semibold ${styles.badge}`}>
          <span className={`h-1.5 w-1.5 rounded-full ${styles.dot}`} />
          {snapshot.statusLabel}
        </span>
        {snapshot.countdownSeconds !== null && <span className="font-mono text-sm font-semibold tabular-nums text-slate-100">{formatCountdown(snapshot.countdownSeconds)}</span>}
      </div>

      <div className="mt-3 flex items-center justify-between gap-3 text-[10px]">
        <span className="text-slate-500">{snapshot.nextEventLabel ?? 'Sesión continua'}</span>
        <span className="font-medium text-slate-300">{nextEvent ?? '24 horas · 7 días'}</span>
      </div>

      {group.positions.length > 0 ? (
        <div className="mt-4 border-t border-white/10 pt-3">
          <div className="flex items-center justify-between gap-3 text-[10px]">
            <span className="text-slate-500">Tus posiciones</span>
            <span className="font-semibold tabular-nums text-[#c8f56a]">{formatEuro(group.investedValue)}</span>
          </div>
          <p className="mt-1 truncate text-[10px] text-slate-300">
            {labels.join(' · ')}{extraCount > 0 ? ` · +${extraCount}` : ''}
          </p>
          {tradeRepublicCount > 0 && (
            <p className="mt-2 text-[9px] leading-relaxed text-[#a8b89b]">
              Trade Republic · {tradeRepublicCount} {tradeRepublicCount === 1 ? 'posición' : 'posiciones'} · {group.market.id === 'crypto' ? 'cripto 24/7' : `referencia ${group.market.shortName}`}
            </p>
          )}
        </div>
      ) : (
        <p className="mt-4 border-t border-white/10 pt-3 text-[10px] text-slate-600">Sin posiciones actuales en este mercado</p>
      )}
    </article>
  )
}

export function MarketHoursPanel({ positions }: { positions: InversionPosicion[] }) {
  const [nowMs, setNowMs] = useState<number | null>(null)

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
        if (left.positions.length > 0 !== right.positions.length > 0) return right.positions.length - left.positions.length
        if (left.investedValue !== right.investedValue) return right.investedValue - left.investedValue
        return right.positions.length - left.positions.length
      })
  }, [positions])

  const now = nowMs === null ? null : new Date(nowMs)
  const snapshots = useMemo(() => {
    if (nowMs === null) return new Map<string, MarketSnapshot>()
    const current = new Date(nowMs)
    return new Map(groups.map((group) => [group.market.id, getMarketSnapshot(group.market, current)]))
  }, [groups, nowMs])

  const priorityGroups = groups.filter((group) => group.positions.length > 0)
  const portfolioNonCrypto = priorityGroups.filter((group) => group.market.id !== 'crypto')
  const portfolioCrypto = priorityGroups.filter((group) => group.market.id === 'crypto')
  const wallStreet = groups.find((group) => group.market.id === 'nasdaq-nyse')
  const madrid = groups.find((group) => group.market.id === 'bme')
  const featuredCandidates = priorityGroups.length > 0
    ? [...portfolioNonCrypto, wallStreet, ...portfolioCrypto]
    : [wallStreet, madrid]
  const highlightedGroups = featuredCandidates.filter((group, index, list) => group && list.findIndex((candidate) => candidate?.market.id === group.market.id) === index).slice(0, 2) as MarketGroup[]
  const highlightedIds = new Set(highlightedGroups.map((group) => group.market.id))
  const otherGroups = groups.filter((group) => !highlightedIds.has(group.market.id))

  return (
    <section className="mt-3 overflow-hidden rounded-xl border border-white/10 bg-[#151b25] p-5 text-slate-100 shadow-[0_12px_30px_rgba(0,0,0,.18)] sm:p-6" id="market-hours-panel" aria-labelledby="market-hours-title">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="mb-2 text-[9px] font-bold uppercase tracking-[0.16em] text-[#c8f56a]">Reloj / sesiones globales</p>
          <h2 id="market-hours-title" className="text-lg font-semibold tracking-[-0.04em]">Mercados en hora española</h2>
          <p className="mt-2 max-w-2xl text-[10px] leading-relaxed text-slate-400">Cuenta atrás hasta la apertura, cierre o reanudación de cada mercado. Tus mercados aparecen primero y Trade Republic se muestra como custodia separada del mercado.</p>
        </div>
        <div className="flex shrink-0 items-center gap-2 rounded-lg border border-white/10 bg-[#10161f] px-3 py-2">
          <Clock3 className="h-4 w-4 text-[#c8f56a]" />
          <div>
            <p className="text-[9px] uppercase tracking-[0.1em] text-slate-500">Ahora · España</p>
            <p className="mt-0.5 font-mono text-sm font-semibold tabular-nums text-slate-100">{now ? formatMadridDateTime(now) : '—'}</p>
          </div>
        </div>
      </div>

      {now ? (
        <>
          <div className="mt-5 grid gap-3 xl:grid-cols-2" aria-label="Mercados donde tienes posiciones">
            {highlightedGroups.map((group) => (
              <MarketCard key={group.market.id} group={group} snapshot={snapshots.get(group.market.id)!} now={now} priority={group.positions.length > 0} />
            ))}
          </div>

          {otherGroups.length > 0 && (
            <details className="mt-4 rounded-lg border border-white/10 bg-[#10161f]">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 text-[10px] font-semibold text-slate-300 [&::-webkit-details-marker]:hidden">
                <span className="inline-flex items-center gap-2"><ChevronDown className="h-3.5 w-3.5 text-slate-500" />Ver todos los mercados disponibles ({otherGroups.length})</span>
                <span className="text-[9px] font-normal text-slate-500">BME · Wall Street · Asia · Oceanía y más</span>
              </summary>
              <div className="grid gap-3 border-t border-white/10 p-3 xl:grid-cols-2">
                {otherGroups.map((group) => (
                  <MarketCard key={group.market.id} group={group} snapshot={snapshots.get(group.market.id)!} now={now} priority={false} />
                ))}
              </div>
            </details>
          )}
        </>
      ) : (
        <div className="mt-5 flex items-center gap-2 rounded-lg border border-white/10 bg-[#10161f] px-4 py-4 text-[10px] text-slate-400" role="status">
          <Moon className="h-4 w-4 animate-pulse text-slate-500" />Sincronizando la hora española…
        </div>
      )}

      <div className="mt-4 flex flex-col gap-2 border-t border-white/10 pt-4 text-[9px] leading-relaxed text-slate-500 sm:flex-row sm:items-center sm:justify-between">
        <span className="inline-flex items-center gap-1.5"><Sun className="h-3 w-3" />La cuenta atrás usa el horario regular, sin premarket ni after-hours.</span>
        <span className="inline-flex items-center gap-1.5"><LockKeyhole className="h-3 w-3" />Trade Republic puede enrutar acciones/ETF a distintas bolsas; en planes de inversión se toma Xetra como referencia.</span>
        <span>Festivos comunes incluidos; algunos mercados pueden tener cierres locales adicionales.</span>
      </div>
    </section>
  )
}
