'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { z } from 'zod'

const reportSchema = z.object({
  asOf: z.string(), market: z.object({ status: z.string(), nextOpen: z.string().nullable() }),
  summary: z.string(),
  items: z.array(z.object({
    symbol: z.string(), name: z.string(), held: z.boolean(), decision: z.string(), reason: z.string(),
    price: z.number().nullable(), currency: z.string().nullable(), priceEur: z.number().nullable(),
    quoteAt: z.string().nullable(), change: z.string().nullable(), nextReview: z.string().nullable(),
    sources: z.array(z.object({ label: z.string(), url: z.string(), period: z.string().optional() })),
  })),
  warnings: z.array(z.string()),
  newsletter: z.object({ subject: z.string().nullable(), date: z.string().nullable(), status: z.string() }),
  analysis: z.string().nullable(),
})
const runSchema = z.object({
  id: z.number().int(), status: z.enum(['running', 'complete', 'partial', 'failed']), slot: z.string(),
  startedAt: z.string(), finishedAt: z.string().nullable(), error: z.string().nullable(), report: reportSchema.nullable(),
})
const payloadSchema = z.object({
  runs: z.array(runSchema), watchlistCount: z.number(), portfolioCount: z.number(),
  newsletter: z.object({ configured: z.boolean() }),
  scheduler: z.object({ enabled: z.boolean(), lastHeartbeat: z.string().nullable(), schedule: z.string() }),
  aiConfigured: z.boolean(),
})
type FollowupData = z.infer<typeof payloadSchema>
const endpoint = '/api/inversiones/seguimiento'
const statusLabels = { running: 'En curso', complete: 'Completado', partial: 'Parcial', failed: 'Fallido' }
const panel = 'rounded-xl border border-white/10 bg-[#151b25] p-4 sm:p-5'
const button = 'min-h-11 rounded-lg border border-white/20 px-4 py-2 text-sm font-medium hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#c8f56a] disabled:cursor-not-allowed disabled:opacity-50'
const madrid = new Intl.DateTimeFormat('es-ES', { timeZone: 'Europe/Madrid', dateStyle: 'medium', timeStyle: 'short' })
function date(value: string | null) {
  if (!value) return 'No disponible'
  const parsed = new Date(value)
  return Number.isFinite(parsed.getTime()) ? madrid.format(parsed) : value
}
function price(value: number | null, currency: string | null) {
  return value === null ? 'No disponible' : `${new Intl.NumberFormat('es-ES', { maximumFractionDigits: 4 }).format(value)} ${currency || '(divisa no disponible)'}`
}
function safeUrl(value: string) {
  try { const url = new URL(value); return ['http:', 'https:'].includes(url.protocol) && !url.username && !url.password ? url.href : null } catch { return null }
}
async function request(url: string, init?: RequestInit): Promise<unknown> {
  const response = await fetch(url, { ...init, cache: 'no-store' })
  if (response.redirected || response.status === 401) throw new Error('Sesión caducada. Vuelve a iniciar sesión.')
  const payload: unknown = await response.json().catch(() => null)
  if (!response.ok) {
    const error = z.object({ error: z.string() }).safeParse(payload)
    throw new Error(error.success ? error.data.error : `Error HTTP ${response.status}: ${response.statusText || 'no se pudo completar la solicitud'}`)
  }
  return payload
}
function message(error: unknown) { return error instanceof Error ? error.message : 'Error desconocido' }

export function InvestmentFollowup() {
  const [data, setData] = useState<FollowupData | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [action, setAction] = useState<'run' | 'import' | null>(null)
  const [pendingId, setPendingId] = useState<number | null>(null)
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [filter, setFilter] = useState('all')
  const [file, setFile] = useState<File | null>(null)
  const [now, setNow] = useState(0)
  const busy = useRef(false)
  const controller = useRef<AbortController | null>(null)
  const input = useRef<HTMLInputElement>(null)
  const running = pendingId !== null || Boolean(data?.runs.some(run => run.status === 'running'))
  const refresh = useCallback(async () => {
    if (controller.current) return
    const current = new AbortController()
    controller.current = current
    setLoading(true)
    try {
      const parsed = payloadSchema.safeParse(await request(endpoint, { signal: current.signal }))
      if (!parsed.success) throw new Error('La respuesta de seguimiento no cumple el contrato esperado.')
      if (current.signal.aborted) return
      setData(parsed.data)
      setPendingId(id => id !== null && parsed.data.runs.some(run => run.id === id) ? null : id)
      setLoadError(null)
    } catch (error) { if (!current.signal.aborted) setLoadError(message(error)) }
    finally { if (!current.signal.aborted) setLoading(false); if (controller.current === current) controller.current = null }
  }, [])
  useEffect(() => {
    void refresh()
    return () => { controller.current?.abort(); controller.current = null }
  }, [refresh])
  useEffect(() => {
    const timer = setInterval(() => { void refresh() }, running ? 3000 : 30000)
    return () => clearInterval(timer)
  }, [refresh, running])
  useEffect(() => {
    setNow(Date.now())
    const timer = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(timer)
  }, [])

  async function execute(kind: 'run' | 'import') {
    if (busy.current || running) return
    if (kind === 'import' && (!file || !/\.xlsx$/i.test(file.name))) {
      setActionError('Selecciona un archivo Excel .xlsx.'); return
    }
    busy.current = true
    setAction(kind); setActionError(null); setNotice(null)
    try {
      if (kind === 'run') {
        const result = z.object({ runId: z.number().int() }).safeParse(await request(endpoint, { method: 'POST' }))
        if (!result.success) throw new Error('Respuesta de ejecución inválida. Actualiza el estado antes de reintentar.')
        setPendingId(result.data.runId); setSelectedId(result.data.runId)
        setNotice(`Ejecución #${result.data.runId} aceptada. Esperando estado del servidor.`)
      } else {
        const body = new FormData(); body.append('file', file!)
        const result = z.object({ count: z.number().int().nonnegative() }).safeParse(await request(`${endpoint}/import`, { method: 'POST', body }))
        if (!result.success) throw new Error('La respuesta de importación no contiene un recuento válido.')
        setNotice(`Excel importado: ${result.data.count} registros.`)
        setFile(null); if (input.current) input.current.value = ''
      }
    } catch (error) { setActionError(message(error)) }
    finally { busy.current = false; setAction(null); void refresh() }
  }

  const runs = data ? [...data.runs].sort((a, b) => b.id - a.id) : []
  const selected = selectedId === null ? runs[0] : runs.find(run => run.id === selectedId)
  const report = selected?.report
  const items = report?.items.filter(item => filter === 'all' || (filter === 'portfolio' ? item.held : !item.held)) ?? []
  const heartbeatAge = data?.scheduler.lastHeartbeat ? now - new Date(data.scheduler.lastHeartbeat).getTime() : NaN
  const freshHeartbeat = Number.isFinite(heartbeatAge) && heartbeatAge >= 0 && heartbeatAge <= 5 * 60 * 1000
  const activeRun = runs.find(run => run.status === 'running')
  const elapsed = activeRun ? Math.max(0, Math.floor((now - new Date(activeRun.startedAt).getTime()) / 1000)) : null

  return (
    <section className="min-w-0 space-y-5 py-6 pb-28 text-slate-100" aria-label="Seguimiento Lynch">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div><h1 className="text-2xl font-semibold">Seguimiento Lynch</h1><p className="mt-2 text-sm text-slate-400">Cartera y Excel maestro de seguimiento. Todas las horas en Madrid.</p></div>
        <div className="flex flex-wrap gap-2">
          <button className={button} disabled={loading} onClick={() => void refresh()}>{loading ? 'Consultando…' : 'Actualizar estado'}</button>
          <button className={`${button} bg-[#c8f56a] text-[#172016] hover:bg-[#b8e55a]`} disabled={!data || Boolean(loadError) || running || action !== null} onClick={() => void execute('run')}>{action === 'run' ? 'Solicitando…' : running ? 'Ejecución en curso' : 'Ejecutar seguimiento'}</button>
        </div>
      </header>
      {loadError && <p role="alert" className="rounded-lg border border-red-400/30 bg-red-400/10 p-4 text-sm text-red-200">{loadError}{data ? ' Se muestran los últimos datos recibidos; pueden estar desactualizados.' : ''}</p>}
      {actionError && <p role="alert" className="text-sm text-red-200">{actionError}</p>}
      {notice && <p role="status" className="text-sm text-slate-300">{notice}</p>}
      {running && <div className={`${panel} border-amber-300/30`}><p role="status">{activeRun ? `Ejecución #${activeRun.id} en curso` : `Esperando confirmación de #${pendingId}`} {elapsed !== null && Number.isFinite(elapsed) ? `· ${Math.floor(elapsed / 60)} min ${elapsed % 60} s` : ''}</p><p className="mt-2 text-sm text-slate-400">Consulta cada 3 segundos. El trabajo se ejecuta en el servidor; cerrar esta vista no lo cancela.</p></div>}
      {data && <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <div className={panel}><h2 className="font-medium">Universo</h2><p className="mt-2 text-sm">Cartera: {data.portfolioCount} · Watchlist: {data.watchlistCount}</p></div>
        <div className={panel}><h2 className="font-medium">IA</h2><p className="mt-2 text-sm">{data.aiConfigured ? 'Configurada' : 'Sin configurar: el análisis puede ser parcial.'}</p></div>
        <div className={panel}><h2 className="font-medium">Newsletter</h2><p className="mt-2 text-sm">{data.newsletter.configured ? 'Configurada; recepción no confirmada por configuración.' : 'Sin configurar'}</p></div>
        <div className={`${panel} break-words`}><h2 className="font-medium">Programador</h2><p className="mt-2 text-sm">{!data.scheduler.enabled ? 'Deshabilitado' : freshHeartbeat ? 'Habilitado · señal reciente' : 'Habilitado · actividad no confirmada'}</p><p className="mt-2 text-xs text-slate-400">Última señal: {date(data.scheduler.lastHeartbeat)}<br />Horario configurado: {data.scheduler.schedule || 'No disponible'}<br />Señal reciente: últimos 5 minutos. No confirma ejecuciones futuras.</p></div>
      </div>}
      <form className={panel} onSubmit={event => { event.preventDefault(); void execute('import') }}>
        <label htmlFor="lynch-master" className="font-medium">Importar Excel maestro (.xlsx)</label>
        <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-center"><input ref={input} id="lynch-master" type="file" accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" disabled={action !== null || running} onChange={event => { setFile(event.target.files?.[0] ?? null); setActionError(null) }} className="min-w-0 flex-1 text-sm file:mr-3 file:rounded-md file:border-0 file:bg-slate-700 file:p-3 file:text-white" /><button className={button} disabled={!file || action !== null || running || !data || Boolean(loadError)} type="submit">{action === 'import' ? 'Importando…' : 'Importar maestro'}</button></div>
      </form>
      {data && <div className="grid min-w-0 gap-5 lg:grid-cols-[260px_minmax(0,1fr)]">
        <aside className={`${panel} min-w-0`}><h2 className="font-semibold">Historial</h2>{runs.length === 0 ? <p className="mt-3 text-sm text-slate-400">Todavía no hay ejecuciones.</p> : <ul className="mt-3 max-h-[480px] space-y-2 overflow-y-auto">{runs.map(run => <li key={run.id}><button className={`${button} w-full text-left ${selected?.id === run.id ? 'border-[#c8f56a] bg-white/10' : ''}`} aria-pressed={selected?.id === run.id} onClick={() => setSelectedId(run.id)}><span className="block">#{run.id} · {statusLabels[run.status]}</span><span className="mt-1 block text-xs text-slate-400">{date(run.startedAt)}</span><span className="block break-words text-xs text-slate-400">{run.slot}</span></button></li>)}</ul>}</aside>
        <div className="min-w-0 space-y-4">
          {!selected ? <p className={panel}>{pendingId ? 'Esperando que el servidor publique la ejecución solicitada.' : 'Ejecuta un seguimiento para consultar el primer informe.'}</p> : <div className={panel}><h2 className="font-semibold">Ejecución #{selected.id} · {statusLabels[selected.status]}</h2><p className="mt-2 text-xs text-slate-400">Inicio: {date(selected.startedAt)} · Fin: {date(selected.finishedAt)}</p>{selected.error && <p role="alert" className="mt-3 whitespace-pre-wrap break-words text-sm text-red-200">{selected.error}</p>}{selected.status === 'partial' && <p className="mt-3 text-sm text-amber-200">Informe parcial: revisa los avisos y los datos ausentes antes de tomar decisiones.</p>}{!report && <p className="mt-3 text-sm text-slate-400">{selected.status === 'running' ? 'El informe aún no está disponible.' : 'Esta ejecución no tiene informe.'}</p>}</div>}
          {report && <>
            <div className={panel}><h2 className="font-semibold">Resumen · corte {date(report.asOf)}</h2><p className="mt-2 text-sm text-slate-400">Mercado: {report.market.status} · Próxima apertura: {date(report.market.nextOpen)}</p><p className="mt-3 whitespace-pre-wrap break-words text-sm">{report.summary || 'Sin resumen disponible.'}</p><p className="mt-3 text-xs text-slate-400">Newsletter: {report.newsletter.status} · {report.newsletter.subject || 'Sin asunto'} · {date(report.newsletter.date)}</p></div>
            {report.warnings.length > 0 && <div className={`${panel} border-amber-300/30 text-amber-100`}><h3 className="font-medium">Avisos del informe</h3><ul className="mt-2 list-disc space-y-2 pl-5 text-sm">{report.warnings.map((warning, index) => <li className="whitespace-pre-wrap break-words" key={index}>{warning}</li>)}</ul></div>}
            <div className="flex flex-wrap items-center justify-between gap-3"><label className="text-sm" htmlFor="lynch-filter">Mostrar <select id="lynch-filter" value={filter} onChange={event => setFilter(event.target.value)} className="ml-2 min-h-11 rounded-lg border border-white/20 bg-[#151b25] px-3"><option value="all">Todos</option><option value="portfolio">Cartera</option><option value="watchlist">Watchlist</option></select></label><span className="text-sm text-slate-400">{items.length} de {report.items.length} activos del informe</span></div>
            {items.length === 0 && <p className={panel}>No hay activos para este filtro en el informe.</p>}
            {items.map((item, index) => <article key={`${item.symbol}-${index}`} className={`${panel} min-w-0 break-words`}>
              <div className="flex flex-wrap justify-between gap-2"><h3 className="font-semibold">{item.symbol} · {item.name}</h3><span className="text-xs text-slate-400">{item.held ? 'Cartera' : 'Watchlist'}</span></div>
              <p className="mt-3 font-medium text-[#c8f56a]">Decisión del informe: {item.decision || 'No disponible'}</p><p className="mt-2 whitespace-pre-wrap text-sm">{item.reason || 'Sin justificación disponible.'}</p>
              <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2"><div><dt className="text-slate-400">Precio en origen</dt><dd>{price(item.price, item.currency)}</dd></div><div><dt className="text-slate-400">Precio EUR</dt><dd>{price(item.priceEur, 'EUR')}</dd></div><div><dt className="text-slate-400">Fecha de cotización</dt><dd>{date(item.quoteAt)}</dd></div><div><dt className="text-slate-400">Cambio comunicado</dt><dd>{item.change ?? 'No disponible'}</dd></div><div><dt className="text-slate-400">Próxima revisión / catalizador</dt><dd>{item.nextReview ?? 'No disponible'}</dd></div></dl>
              <h4 className="mt-4 text-sm font-medium">Fuentes del informe</h4>{item.sources.length === 0 ? <p className="mt-1 text-xs text-amber-200">Sin fuentes aportadas.</p> : <ul className="mt-2 space-y-2 text-xs">{item.sources.map((source, sourceIndex) => { const href = safeUrl(source.url); return <li key={sourceIndex}>{href ? <a href={href} target="_blank" rel="noopener noreferrer" className="text-sky-300 underline underline-offset-4">{source.label || href}</a> : <span>{source.label || 'Fuente'} · enlace no seguro omitido</span>}{source.period ? ` · Periodo: ${source.period}` : ' · Periodo no indicado'}</li> })}</ul>}
            </article>)}
            {report.analysis && <details className={panel}><summary className="cursor-pointer font-medium">Análisis completo</summary><p className="mt-4 whitespace-pre-wrap break-words text-sm leading-relaxed">{report.analysis}</p></details>}
          </>}
        </div>
      </div>}
    </section>
  )
}
