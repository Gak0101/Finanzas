'use client'

import { type FormEvent, useEffect, useMemo, useState } from 'react'
import {
  ArrowRight,
  BarChart3,
  BookOpenCheck,
  CheckCircle2,
  BrainCircuit,
  Check,
  ChevronDown,
  CircleAlert,
  CircleCheck,
  CircleDot,
  Database,
  ExternalLink,
  FileSearch,
  FlaskConical,
  Leaf,
  Lightbulb,
  ListChecks,
  Search,
  Scale,
  ShieldAlert,
  Sparkles,
  Target,
  TrendingUp,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  createInitialResult,
  generateResearchResult,
  getCategory,
  LYNCH_CATEGORIES,
  RESEARCH_CHECKLIST,
  SEARCH_MODES,
  type LynchCategoryKey,
  type ResearchInput,
  type ResearchMetricStatus,
  type ResearchResult,
  type ResearchCheckStatus,
  type SearchMode,
} from '@/lib/buscador-acciones/lynchFramework'

const MODE_ICONS: Record<SearchMode, typeof Search> = {
  boring: FlaskConical,
  ipo: TrendingUp,
  everyday: Lightbulb,
  growth: Target,
}

const INPUT_CLASS =
  'w-full rounded-md border border-[#d9d8d1] bg-white px-3 py-2.5 text-sm text-[#16202b] outline-none transition placeholder:text-[#9aa5ae] focus:border-[#7a8b59] focus:ring-2 focus:ring-[#c8f56a]/40'

function formatHorizon(value: ResearchInput['horizon']) {
  return value === '10+' ? '10 años o más' : `${value.replace('-', '–')} años`
}

function formatResearchTimestamp(value: string) {
  if (!value) return 'sin ejecutar'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'fecha no disponible'
  return new Intl.DateTimeFormat('es-ES', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date)
}

function engineLabel(engine: ResearchResult['engine']) {
  if (engine === 'openrouter-free') return 'IA gratuita · cribado con fuentes'
  if (engine === 'openrouter-firecrawl') return 'OpenRouter + tu Firecrawl'
  if (engine === 'openai-firecrawl') return 'OpenAI + tu Firecrawl'
  if (engine === 'local-fallback') return 'Marco local · proveedor no disponible'
  return 'Marco local · sin datos actuales'
}

function isLiveEngine(engine: ResearchResult['engine']) {
  return engine === 'openrouter-free' || engine === 'openrouter-firecrawl' || engine === 'openai-firecrawl'
}

function metricStatusLabel(status: ResearchMetricStatus) {
  if (status === 'verified') return 'Verificado'
  if (status === 'partial') return 'Parcial'
  return 'No encontrado'
}

function checkStatusLabel(status: ResearchCheckStatus) {
  if (status === 'verified') return 'Dato'
  if (status === 'partial') return 'Parcial'
  return 'Falta'
}

function qualityLabel(value: 'complete' | 'partial' | 'insufficient') {
  if (value === 'complete') return 'Cobertura alta'
  if (value === 'partial') return 'Cobertura parcial'
  return 'Datos insuficientes'
}

function StepNumber({ children }: { children: number }) {
  return (
    <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-[#c8f56a] text-xs font-bold text-[#16202b]">
      {children}
    </span>
  )
}

type StockFinderProps = {
  embedded?: boolean
}

type ResearchTier = 'free' | 'premium'

export function StockFinder({ embedded = false }: StockFinderProps = {}) {
  const [query, setQuery] = useState('')
  const [mode, setMode] = useState<SearchMode>('boring')
  const [horizon, setHorizon] = useState<ResearchInput['horizon']>('5-10')
  const [risk, setRisk] = useState<ResearchInput['risk']>('moderado')
  const [isRunning, setIsRunning] = useState(false)
  const [guideOpen, setGuideOpen] = useState(false)
  const [activeCategory, setActiveCategory] = useState<LynchCategoryKey | 'all'>('all')
  const [result, setResult] = useState(createInitialResult)
  const [selectedLeadId, setSelectedLeadId] = useState(result.leads[0]?.id ?? '')
  const [showAllMetrics, setShowAllMetrics] = useState(false)
  const [lastRunHorizon, setLastRunHorizon] = useState<ResearchInput['horizon']>('5-10')
  const [requestError, setRequestError] = useState<string | null>(null)
  const [researchTier, setResearchTier] = useState<ResearchTier>('free')
  const [webSearchReady, setWebSearchReady] = useState(false)
  const [freeSourcesReady, setFreeSourcesReady] = useState(false)

  useEffect(() => {
    const controller = new AbortController()
    fetch('/api/configuracion/fuentes-inversion', { cache: 'no-store', signal: controller.signal })
      .then(async (response) => response.ok ? response.json() : null)
      .then((payload) => {
        setWebSearchReady(payload?.premiumReady === true)
        setFreeSourcesReady(payload?.freeSourcesReady === true)
      })
      .catch(() => undefined)
    return () => controller.abort()
  }, [])

  const selectedMode = SEARCH_MODES.find((item) => item.key === mode) ?? SEARCH_MODES[0]
  const selectedLead = result.leads.find((lead) => lead.id === selectedLeadId) ?? result.leads[0]
  const selectedScorecard = selectedLead?.scorecard
  const availableMetrics = selectedScorecard?.metrics.filter((metric) => metric.status !== 'missing') ?? []
  const visibleMetrics = showAllMetrics ? availableMetrics : availableMetrics.slice(0, 8)

  const visibleLeads = useMemo(() => {
    if (activeCategory === 'all') return result.leads
    return result.leads.filter((lead) => lead.category === activeCategory)
  }, [activeCategory, result.leads])

  useEffect(() => {
    setShowAllMetrics(false)
    if (!visibleLeads.length) {
      setSelectedLeadId('')
      return
    }
    if (!visibleLeads.some((lead) => lead.id === selectedLeadId)) {
      setSelectedLeadId(visibleLeads[0].id)
    }
  }, [selectedLeadId, visibleLeads])

  async function runResearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (isRunning) return

    setIsRunning(true)
    setRequestError(null)
    try {
      const response = await fetch('/api/buscador-acciones', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query, mode, horizon, risk, tier: researchTier }),
      })
      const payload = await response.json().catch(() => null)
      if (!response.ok || !payload || typeof payload !== 'object' || !Array.isArray((payload as { leads?: unknown }).leads)) {
        const providerError = payload && typeof payload === 'object' && typeof (payload as { error?: unknown }).error === 'string'
          ? (payload as { error: string }).error
          : 'La investigación no devolvió una ficha válida'
        throw new Error(providerError)
      }

      const nextResult = payload as ResearchResult
      setResult(nextResult)
      setSelectedLeadId(nextResult.leads[0]?.id ?? '')
      setActiveCategory('all')
      setLastRunHorizon(horizon)
      window.requestAnimationFrame(() => {
        document.getElementById('resultados-acciones')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
      })
    } catch (error) {
      const nextResult = generateResearchResult({ query, mode, horizon, risk })
      setResult({
        ...nextResult,
        engine: 'local-fallback',
        providerNote: 'No se pudo consultar el endpoint; se muestra el marco local sin datos actuales.',
      })
      setRequestError(error instanceof Error ? error.message : 'No se pudo consultar el servicio IA. Se muestra un marco local sin datos actuales.')
      setSelectedLeadId(nextResult.leads[0]?.id ?? '')
      setActiveCategory('all')
      setLastRunHorizon(horizon)
      window.requestAnimationFrame(() => {
        document.getElementById('resultados-acciones')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
      })
    } finally {
      setIsRunning(false)
    }
  }

  function usePrompt(prompt: string, promptMode: SearchMode) {
    setQuery(prompt)
    setMode(promptMode)
  }

  return (
    <div className={embedded ? 'min-h-0 bg-transparent text-[#f7f5ef]' : '-mx-4 -my-6 min-h-[calc(100vh-4rem)] bg-[#0d1118] text-[#f7f5ef]'}>
      <div className={embedded ? 'mx-auto max-w-[1600px] px-0 py-2 sm:py-4' : 'mx-auto max-w-[1600px] px-4 py-7 sm:px-6 sm:py-9'}>
        <header className="flex flex-col gap-5 border-b border-white/10 pb-7 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-3xl">
            <div className="mb-4 flex flex-wrap items-center gap-2 text-[10px] font-bold uppercase tracking-[0.18em] text-[#c8f56a]">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-[#c8f56a]/30 bg-[#c8f56a]/10 px-2.5 py-1">
                <BrainCircuit className="h-3.5 w-3.5" /> Asistente IA · Lynch
              </span>
              <span className="text-white/35">·</span>
              <span className="text-white/50">Laboratorio de investigación</span>
            </div>
            <h1 className="max-w-2xl text-4xl font-semibold tracking-[-0.06em] text-[#f7f5ef] sm:text-5xl">
              Buscador de acciones
            </h1>
            <p className="mt-4 max-w-2xl text-sm leading-7 text-[#aab4be] sm:text-base">
              Busca una empresa o describe lo que estás viendo. La app reúne fuentes públicas, contrasta sus números y te enseña qué está probado y qué falta comprobar.
            </p>
          </div>

          <div className="flex max-w-sm items-start gap-3 rounded-lg border border-[#e7a35e]/30 bg-[#e7a35e]/10 p-3 text-xs leading-5 text-[#f0c996]">
            <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-[#e7a35e]" />
            <p>
              El buscador no predice rentabilidad: verifica empresas con el método de Lynch y deja visibles los datos que faltan antes de seguir investigando.
            </p>
          </div>
        </header>

        <main>
          <section className="mt-7 grid gap-4 lg:grid-cols-[minmax(0,1.35fr)_minmax(320px,.65fr)]">
            <form onSubmit={runResearch} className="rounded-xl bg-[#f7f5ef] p-5 text-[#16202b] shadow-[0_18px_45px_rgba(0,0,0,.16)] sm:p-7">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <p className="mb-2 text-[10px] font-bold uppercase tracking-[0.16em] text-[#78828b]">01 / Define la investigación</p>
                  <h2 className="text-2xl font-semibold tracking-[-0.05em]">¿Qué empresa, ticker o sector quieres verificar?</h2>
                  <p className="mt-2 max-w-xl text-sm leading-6 text-[#75808d]">
                    Escribe una empresa, un ticker o un criterio. Primero se comprueba la identidad y los números; después la IA redacta la lectura Lynch, los riesgos y las preguntas pendientes.
                  </p>
                </div>
                <span className={`inline-flex w-fit items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-semibold ${isLiveEngine(result.engine) ? 'bg-[#dfe9ff] text-[#40558a]' : 'bg-[#e8eee0] text-[#58702d]'}`}>
                  <Sparkles className="h-3.5 w-3.5" /> {engineLabel(result.engine)}
                </span>
              </div>

              <div className="mt-6 grid gap-2">
                <label htmlFor="stock-clue" className="text-xs font-semibold text-[#16202b]">
                  Empresa, ticker o criterio
                </label>
                <textarea
                  id="stock-clue"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder={selectedMode.prompt}
                  rows={3}
                  className={`${INPUT_CLASS} resize-y`}
                />
                <div className="flex flex-wrap gap-2 pt-1">
                  {SEARCH_MODES.map((item) => (
                    <button
                      key={item.key}
                      type="button"
                      onClick={() => usePrompt(item.prompt, item.key)}
                      className="rounded-full border border-[#d9d8d1] px-2.5 py-1 text-[10px] text-[#697580] transition hover:border-[#9baa78] hover:bg-[#eef3e7] hover:text-[#34421e]"
                    >
                      {item.prompt}
                    </button>
                  ))}
                </div>
              </div>

              <div className="mt-6 grid gap-2">
                <span className="text-xs font-semibold text-[#16202b]">Qué quieres rastrear</span>
                <div className="grid gap-2 sm:grid-cols-2">
                  {SEARCH_MODES.map((item) => {
                    const Icon = MODE_ICONS[item.key]
                    const active = mode === item.key
                    return (
                      <button
                        key={item.key}
                        type="button"
                        onClick={() => setMode(item.key)}
                        aria-pressed={active}
                        className={`flex min-h-[76px] items-start gap-3 rounded-lg border p-3 text-left transition ${
                          active
                            ? 'border-[#879b5a] bg-[#eef3e7] shadow-[inset_0_0_0_1px_#879b5a]'
                            : 'border-[#deddd6] bg-white hover:border-[#b8c3a0] hover:bg-[#fbfcf8]'
                        }`}
                      >
                        <span className={`mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-md ${active ? 'bg-[#16202b] text-[#c8f56a]' : 'bg-[#eef0eb] text-[#78828b]'}`}>
                          <Icon className="h-4 w-4" />
                        </span>
                        <span>
                          <span className="block text-xs font-semibold text-[#16202b]">{item.label}</span>
                          <span className="mt-1 block text-[10px] leading-4 text-[#78828b]">{item.description}</span>
                        </span>
                      </button>
                    )
                  })}
                </div>
              </div>

              <div className="mt-6 grid gap-3 sm:grid-cols-2">
                <label className="grid gap-2 text-xs font-semibold text-[#16202b]" htmlFor="stock-horizon">
                  Horizonte de estudio
                  <span className="relative">
                    <select id="stock-horizon" value={horizon} onChange={(event) => setHorizon(event.target.value as ResearchInput['horizon'])} className={`${INPUT_CLASS} appearance-none pr-9 font-normal`}>
                      <option value="3-5">3–5 años</option>
                      <option value="5-10">5–10 años</option>
                      <option value="10+">10 años o más</option>
                    </select>
                    <ChevronDown className="pointer-events-none absolute right-3 top-3 h-4 w-4 text-[#89939b]" />
                  </span>
                </label>
                <label className="grid gap-2 text-xs font-semibold text-[#16202b]" htmlFor="stock-risk">
                  Tolerancia a la incertidumbre
                  <span className="relative">
                    <select id="stock-risk" value={risk} onChange={(event) => setRisk(event.target.value as ResearchInput['risk'])} className={`${INPUT_CLASS} appearance-none pr-9 font-normal`}>
                      <option value="prudente">Prudente · evidencia primero</option>
                      <option value="moderado">Moderada · equilibrio</option>
                       <option value="alto">Alta · exploración inicial</option>
                    </select>
                    <ChevronDown className="pointer-events-none absolute right-3 top-3 h-4 w-4 text-[#89939b]" />
                  </span>
                </label>
              </div>

              <div className="mt-6 border-t border-[#deddd6] pt-5">
                <div className="grid gap-2 sm:grid-cols-2">
                    <p className="text-[10px] leading-4 text-[#89939b]">La app separa hechos con fuente de interpretación. Si un número no aparece, queda como «No encontrado».</p>
                   <p className="text-[10px] leading-4 text-[#89939b]">Solo se envían la pista y fuentes públicas; nunca tu cartera ni tus datos bancarios.</p>
                </div>
                <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                  <div>
                    <span className="mb-1.5 block text-[10px] font-semibold uppercase tracking-[0.12em] text-[#78828b]">Fuentes de búsqueda</span>
                    <div role="group" aria-label="Modo de fuentes" className="inline-flex rounded-lg border border-[#d9d8d1] bg-white p-1">
                      <button
                        type="button"
                        onClick={() => setResearchTier('free')}
                        aria-pressed={researchTier === 'free'}
                        className={`inline-flex h-8 items-center gap-1.5 rounded-md px-3 text-[10px] font-semibold transition ${researchTier === 'free' ? 'bg-[#e8eee0] text-[#40551d]' : 'text-[#78828b] hover:text-[#34421e]'}`}
                      >
                        <Leaf className="h-3.5 w-3.5" /> Gratis · fuentes
                      </button>
                      <button
                        type="button"
                        onClick={() => webSearchReady && setResearchTier('premium')}
                        aria-pressed={researchTier === 'premium'}
                        aria-disabled={!webSearchReady}
                        className={`inline-flex h-8 items-center gap-1.5 rounded-md px-3 text-[10px] font-semibold transition ${researchTier === 'premium' ? 'bg-[#16202b] text-[#c8f56a]' : webSearchReady ? 'text-[#78828b] hover:text-[#16202b]' : 'cursor-not-allowed text-[#b2b7b5]'}`}
                      >
                        <BrainCircuit className="h-3.5 w-3.5" /> Análisis avanzado
                      </button>
                    </div>
                    <p className="mt-1.5 max-w-sm text-[10px] leading-4 text-[#71815b]">
                      {researchTier === 'premium'
                        ? 'Firecrawl propio sigue siendo gratuito; este modo solo cambia al modelo avanzado que hayas configurado.'
                        : freeSourcesReady
                          ? 'Usa OpenRouter gratuito y combina Firecrawl propio, Finnhub y NewsAPI sin activar búsquedas de pago.'
                          : 'Usa OpenRouter gratuito. Añade Firecrawl, Finnhub o NewsAPI en Configuración para ampliar el contexto.'}
                    </p>
                    {!webSearchReady && <a href="/configuracion#fuentes-inversion" className="mt-1.5 block text-[10px] font-medium text-[#6b7f42] hover:underline">Configurar Firecrawl propio · gratis</a>}
                  </div>
                  <Button type="submit" disabled={isRunning} className="h-10 bg-[#16202b] px-5 text-xs font-semibold text-white hover:bg-[#263545]">
                    {isRunning ? <><Search className="animate-pulse" /> Buscando y verificando…</> : <><Sparkles /> Buscar y verificar</>}
                  </Button>
                </div>
              </div>
            </form>

            <aside className="rounded-xl border border-white/10 bg-[#151e28] p-5 sm:p-7">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="mb-2 text-[10px] font-bold uppercase tracking-[0.16em] text-[#c8f56a]">02 / El profesor</p>
                  <h2 className="text-2xl font-semibold tracking-[-0.05em]">Lynch como guía</h2>
                </div>
                <BookOpenCheck className="h-5 w-5 text-[#c8f56a]" />
              </div>
              <p className="mt-3 text-sm leading-6 text-[#aab4be]">
                La IA sigue una secuencia sencilla: entender el negocio, clasificarlo, comprobar los números y saber qué puede salir mal.
              </p>

              <div className="mt-6 grid gap-4">
                {[
                  ['La historia', '¿Qué vende y por qué vuelve el cliente?'],
                  ['La categoría', '¿Es fast grower, cíclica, turnaround o algo distinto?'],
                  ['Los números', '¿Ventas, caja y deuda cuentan la misma historia?'],
                  ['La tesis', '¿Qué tendría que ocurrir para acercarse a 10×?'],
                ].map(([title, description], index) => (
                  <div key={title} className="flex gap-3">
                    <StepNumber>{index + 1}</StepNumber>
                    <div>
                      <p className="text-xs font-semibold text-[#f7f5ef]">{title}</p>
                      <p className="mt-1 text-[11px] leading-5 text-[#8997a3]">{description}</p>
                    </div>
                  </div>
                ))}
              </div>

              <button type="button" onClick={() => setGuideOpen((open) => !open)} className="mt-7 flex w-full items-center justify-between border-t border-white/10 pt-4 text-left text-xs font-semibold text-[#d7dfd1] hover:text-[#c8f56a]">
                <span className="inline-flex items-center gap-2"><ListChecks className="h-4 w-4" /> Ver las seis categorías de Lynch</span>
                <ChevronDown className={`h-4 w-4 transition-transform ${guideOpen ? 'rotate-180' : ''}`} />
              </button>

              {guideOpen && (
                <div className="mt-4 grid gap-2">
                  {LYNCH_CATEGORIES.map((category) => (
                    <div key={category.key} className="rounded-lg border border-white/10 bg-white/[.03] p-3">
                      <div className="flex items-center gap-2">
                        <span className="h-2 w-2 rounded-full" style={{ backgroundColor: category.color }} />
                        <p className="text-[11px] font-semibold text-[#f7f5ef]">{category.label}</p>
                      </div>
                      <p className="mt-1 text-[10px] leading-4 text-[#8997a3]">{category.description}</p>
                    </div>
                  ))}
                </div>
              )}
            </aside>
          </section>

          <section id="resultados-acciones" className="mt-5 scroll-mt-6 rounded-xl bg-[#f7f5ef] p-5 text-[#16202b] shadow-[0_18px_45px_rgba(0,0,0,.16)] sm:p-7">
            <div className="flex flex-col gap-4 border-b border-[#deddd6] pb-5 lg:flex-row lg:items-end lg:justify-between">
              <div>
                <div className="mb-2 flex flex-wrap items-center gap-2 text-[10px] font-bold uppercase tracking-[0.16em] text-[#78828b]">
                  <span>03 / Informe de investigación</span>
                  <span className="rounded-full bg-[#e8eee0] px-2 py-1 text-[#58702d]">{formatHorizon(lastRunHorizon)}</span>
                  <span className={`rounded-full px-2 py-1 ${isLiveEngine(result.engine) ? 'bg-[#dfe9ff] text-[#40558a]' : 'bg-[#f0eee8] text-[#78828b]'}`}>{engineLabel(result.engine)}</span>
                </div>
                <h2 className="max-w-3xl text-2xl font-semibold tracking-[-0.05em]">{result.title}</h2>
                <p className="mt-2 max-w-3xl text-sm leading-6 text-[#75808d]">{result.summary}</p>
              </div>
              <div className="max-w-xs rounded-lg border border-[#e7a35e]/40 bg-[#fff7e9] p-3 text-[10px] leading-4 text-[#83571f]">
                <div className="flex items-center gap-1.5 font-bold uppercase tracking-[0.12em]"><CircleAlert className="h-3.5 w-3.5" /> Puntuación de cribado</div>
                <p className="mt-1">Se calcula con métricas y comprobaciones disponibles. No es una probabilidad ni una recomendación.</p>
              </div>
            </div>

            <div className="mt-5 flex flex-col gap-3 rounded-lg border border-[#dfe3d9] bg-[#eef3e7] p-3.5 text-xs leading-5 text-[#4d5f33] sm:flex-row sm:items-start">
              <BrainCircuit className="mt-0.5 h-4 w-4 shrink-0 text-[#6e8c3a]" />
                <p><strong className="font-semibold">Qué se ha comprobado:</strong> {result.methodNote}</p>
              <p className="text-[10px] text-[#71815b]">Consulta generada: {formatResearchTimestamp(result.generatedAt)}{result.providerNote ? ` · ${result.providerNote}` : ''}</p>
            </div>

            {result.screening && (
              <div className="mt-4 flex flex-col gap-2 rounded-lg border border-[#d9d8d1] bg-white p-3.5 text-[11px] leading-5 text-[#586571] sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <p className="font-semibold text-[#16202b]">Filtro de evidencia</p>
                  <p className="mt-1">{result.screening.companiesFound} empresa{result.screening.companiesFound === 1 ? '' : 's'} con identidad verificada · {result.screening.candidatesReturned} pasa{result.screening.candidatesReturned === 1 ? '' : 'n'} el cribado · {result.screening.candidatesDiscarded} descartada{result.screening.candidatesDiscarded === 1 ? '' : 's'} por falta de datos.</p>
                </div>
                <p className="max-w-xl text-[10px] text-[#78828b]">{result.screening.note}</p>
              </div>
            )}

            {requestError && (
              <div role="status" className="mt-4 flex items-start gap-2 rounded-lg border border-[#e7a35e]/40 bg-[#fff7e9] p-3.5 text-[11px] leading-5 text-[#83571f]">
                <CircleAlert className="mt-0.5 h-4 w-4 shrink-0" />
                <span>{requestError}</span>
              </div>
            )}

            <div className="mt-6 flex gap-2 overflow-x-auto pb-1">
              <button type="button" onClick={() => setActiveCategory('all')} className={`whitespace-nowrap rounded-full border px-3 py-1.5 text-[10px] font-semibold transition ${activeCategory === 'all' ? 'border-[#16202b] bg-[#16202b] text-white' : 'border-[#d9d8d1] text-[#78828b] hover:border-[#899b67]'}`}>
                Todas ({result.leads.length})
              </button>
              {LYNCH_CATEGORIES.map((category) => {
                const count = result.leads.filter((lead) => lead.category === category.key).length
                if (!count) return null
                return (
                  <button key={category.key} type="button" onClick={() => setActiveCategory(category.key)} className={`whitespace-nowrap rounded-full border px-3 py-1.5 text-[10px] font-semibold transition ${activeCategory === category.key ? 'border-[#16202b] bg-[#16202b] text-white' : 'border-[#d9d8d1] text-[#78828b] hover:border-[#899b67]'}`}>
                    {category.label} ({count})
                  </button>
                )
              })}
            </div>

            <div className="mt-4 grid gap-4 xl:grid-cols-[minmax(0,1.35fr)_minmax(300px,.65fr)]">
              <div className="grid gap-3 md:grid-cols-2">
                {!visibleLeads.length && (
                  <div className="md:col-span-2 rounded-lg border border-dashed border-[#c9c9c1] bg-white p-6 text-center">
                    <Database className="mx-auto h-6 w-6 text-[#879b5a]" />
                    <h3 className="mt-3 text-base font-semibold text-[#16202b]">Ninguna empresa ha pasado el filtro</h3>
                    <p className="mx-auto mt-2 max-w-lg text-xs leading-5 text-[#78828b]">La aplicación ha preferido no mostrar una idea sin ticker validado, métricas suficientes o fuentes trazables. Prueba con un ticker concreto o completa Finnhub/SEC en Configuración.</p>
                  </div>
                )}
                {visibleLeads.map((lead) => {
                  const category = getCategory(lead.category)
                  const selected = lead.id === selectedLead?.id
                  const ticker = lead.ticker && !['N/A', '—', '-'].includes(lead.ticker) ? lead.ticker : null
                  const coverage = lead.scorecard?.coverage ?? 0
                  const quality = lead.scorecard ? qualityLabel(lead.scorecard.dataQuality) : 'Datos insuficientes'
                  return (
                    <button key={lead.id} type="button" onClick={() => setSelectedLeadId(lead.id)} aria-pressed={selected} className={`flex flex-col rounded-lg border p-4 text-left transition ${selected ? 'border-[#879b5a] bg-[#fbfcf8] shadow-[0_0_0_1px_#879b5a]' : 'border-[#deddd6] bg-white hover:border-[#b8c3a0] hover:bg-[#fbfcf8]'}`}>
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <span className="inline-flex items-center gap-1.5 text-[9px] font-bold uppercase tracking-[0.12em] text-[#89939b]">
                            <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: category.color }} /> {lead.stage}
                          </span>
                          <h3 className="mt-2 text-base font-semibold tracking-[-0.03em] text-[#16202b]">{lead.title}</h3>
                          <p className="mt-1 text-[10px] font-medium text-[#78828b]">{lead.subtitle}</p>
                        </div>
                        <ArrowRight className={`mt-1 h-4 w-4 shrink-0 ${selected ? 'text-[#58702d]' : 'text-[#b0b8b2]'}`} />
                      </div>
                      <div className="mt-4 flex flex-wrap items-center gap-2 text-[10px]">
                        <span className="rounded-full px-2 py-1 font-semibold" style={{ backgroundColor: `${category.color}30`, color: '#4d5f33' }}>{category.label}</span>
                        {ticker ? <span className="rounded-full border border-[#d9d8d1] px-2 py-1 font-semibold text-[#52606c]">{ticker}{lead.exchange ? ` · ${lead.exchange}` : ''}</span> : <span className="rounded-full border border-dashed border-[#c8c9c1] px-2 py-1 text-[#89939b]">Pista de búsqueda</span>}
                        <span className="ml-auto text-right font-semibold text-[#63707b]">Cribado <strong className="text-[#16202b]">{lead.scorecard?.score ?? lead.fit}/100</strong><span className="block text-[9px] font-medium text-[#89939b]">Cobertura {coverage}%</span></span>
                      </div>
                      <div className="mt-2 h-1 overflow-hidden rounded-full bg-[#e8e8e2]"><div className="h-full rounded-full bg-[#879b5a]" style={{ width: `${coverage}%` }} /></div>
                      <p className="mt-1 text-[9px] font-semibold uppercase tracking-[0.08em] text-[#89939b]">{quality}</p>
                      <p className="mt-4 text-xs leading-5 text-[#586571]">{lead.thesis}</p>
                      <div className="mt-auto flex items-center gap-2 border-t border-[#ecebe5] pt-3 text-[10px] font-medium text-[#78828b]"><FileSearch className="h-3.5 w-3.5" /> Primera fuente: {lead.firstSource}</div>
                    </button>
                  )
                })}
              </div>

              {selectedLead && (
                <aside className="flex flex-col rounded-lg bg-[#16202b] p-5 text-[#f7f5ef]">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#c8f56a]">Ficha de lectura</p>
                    <span className="rounded-full border border-white/15 px-2 py-1 text-[9px] text-[#aab4be]">No es señal</span>
                  </div>
                  <h3 className="mt-4 text-xl font-semibold tracking-[-0.04em]">{selectedLead.title}</h3>
                  <p className="mt-1 text-xs text-[#8997a3]">{selectedLead.subtitle}</p>
                  {selectedLead.dataAsOf && <p className="mt-2 text-[10px] text-[#8997a3]">Datos declarados por la búsqueda: {selectedLead.dataAsOf}</p>}

                  {selectedScorecard && (
                    <>
                      <div className="mt-5 rounded-lg border border-[#c8f56a]/20 bg-[#c8f56a]/10 p-3.5">
                        <div className="flex items-center justify-between gap-3">
                          <p className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.12em] text-[#c8f56a]"><Database className="h-3.5 w-3.5" /> {qualityLabel(selectedScorecard.dataQuality)}</p>
                          <strong className="text-lg text-[#c8f56a]">{selectedScorecard.score}/100</strong>
                        </div>
                        <p className="mt-1 text-[10px] leading-4 text-[#c3d1bf]">Puntuación determinista del protocolo · cobertura de métricas: {selectedScorecard.coverage}%. No es una probabilidad de rentabilidad.</p>
                        <p className="mt-2 text-[10px] font-semibold text-[#f7f5ef]">Resultado de cribado: {selectedScorecard.verdict === 'investigar' ? 'hay base para seguir investigando' : selectedScorecard.verdict === 'esperar' ? 'faltan comprobaciones antes de concluir' : 'todavía no hay datos suficientes'}</p>
                      </div>

                      <div className="mt-4 rounded-lg border border-white/10 bg-white/[.04] p-3.5">
                        <p className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.12em] text-[#aab4be]"><BarChart3 className="h-3.5 w-3.5" /> Métricas encontradas</p>
                        <div className="mt-3 grid grid-cols-2 gap-2">
                          {visibleMetrics.map((metric) => (
                            <div key={metric.key} className="rounded-md border border-white/10 bg-black/10 p-2">
                              <p className="truncate text-[9px] text-[#8997a3]">{metric.label}</p>
                              <p className="mt-1 text-xs font-semibold text-[#f7f5ef]">{metric.value}</p>
                              <p className="mt-0.5 text-[9px] text-[#8997a3]">{metric.period ?? 'último dato'}{metric.unit ? ` · ${metric.unit}` : ''} · {metricStatusLabel(metric.status)}</p>
                              {metric.note && <p className="mt-1 text-[9px] leading-3 text-[#aab4be]">{metric.note}</p>}
                              {metric.sourceUrls[0] && <a href={metric.sourceUrls[0].url} target="_blank" rel="noreferrer" className="mt-1 inline-flex items-center gap-1 text-[9px] font-semibold text-[#c8f56a] hover:underline">Fuente <ExternalLink className="h-2.5 w-2.5" /></a>}
                            </div>
                          ))}
                        </div>
                         {!availableMetrics.length && <p className="mt-2 text-[10px] text-[#e7b7b8]">No hay métricas verificadas para este candidato.</p>}
                         {availableMetrics.length > 8 && <button type="button" onClick={() => setShowAllMetrics((value) => !value)} className="mt-3 text-[10px] font-semibold text-[#c8f56a] hover:underline">{showAllMetrics ? 'Mostrar resumen' : `Ver las ${availableMetrics.length} métricas`}</button>}
                      </div>

                      <div className="mt-4">
                        <p className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.12em] text-[#aab4be]"><CheckCircle2 className="h-3.5 w-3.5" /> Checklist Lynch</p>
                        <ul className="mt-3 grid gap-2">
                          {selectedScorecard.checks.map((check) => (
                            <li key={check.key} className="flex items-start gap-2 text-[10px] leading-4 text-[#d5ddd5]">
                              {check.status === 'verified' ? <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#c8f56a]" /> : check.status === 'partial' ? <CircleDot className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#e7a35e]" /> : <CircleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#e58b8d]" />}
                              <span><strong className="text-[#f7f5ef]">{check.label} · {checkStatusLabel(check.status)}</strong><span className="block text-[#aab4be]">{check.detail}</span></span>
                            </li>
                          ))}
                        </ul>
                      </div>

                      <div className="mt-4 rounded-lg border border-white/10 bg-white/[.04] p-3.5">
                        <p className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.12em] text-[#aab4be]"><Scale className="h-3.5 w-3.5" /> Valoración</p>
                        <p className="mt-2 text-xs font-semibold text-[#f7f5ef]">{selectedScorecard.valuation.label}</p>
                        <p className="mt-1 text-[10px] leading-4 text-[#aab4be]">{selectedScorecard.valuation.note}</p>
                      </div>
                    </>
                  )}

                  <div className="mt-5 rounded-lg border border-white/10 bg-white/[.04] p-3.5">
                    <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-[#aab4be]">La historia que habría que probar</p>
                    {selectedScorecard?.categoryReason && <p className="mt-2 text-[10px] leading-4 text-[#aab4be]">Categoría: {selectedScorecard.categoryReason}</p>}
                    <p className="mt-2 text-xs leading-5 text-[#e0e6df]">{selectedLead.thesis}</p>
                  </div>

                  <div className="mt-5">
                    <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-[#aab4be]">Evidencias que pide el método</p>
                    <ul className="mt-3 grid gap-3">
                      {selectedLead.evidence.map((item) => <li key={item} className="flex gap-2 text-xs leading-5 text-[#d5ddd5]"><CircleCheck className="mt-0.5 h-4 w-4 shrink-0 text-[#c8f56a]" />{item}</li>)}
                    </ul>
                  </div>

                  <div className="mt-5 rounded-lg border border-[#e58b8d]/20 bg-[#e58b8d]/10 p-3.5">
                    <p className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.12em] text-[#f0b1b2]"><CircleAlert className="h-3.5 w-3.5" /> Lo que puede romperla</p>
                    <ul className="mt-2 grid gap-1.5 text-xs leading-5 text-[#edcccc]">{selectedLead.risks.map((riskItem) => <li key={riskItem}>· {riskItem}</li>)}</ul>
                  </div>

                  <div className="mt-auto pt-5">
                    <p className="text-[10px] text-[#8997a3]">Primera fuente recomendada</p>
                    <p className="mt-1 text-xs font-semibold text-[#f7f5ef]">{selectedLead.firstSource}</p>
                    <div className="mt-4 grid gap-2">
                      {(selectedLead.sourceUrls ?? []).map((source) => (
                        <a key={source.url} href={source.url} target="_blank" rel="noreferrer" className="inline-flex items-center justify-between gap-2 rounded-md border border-white/15 px-3 py-2 text-[10px] font-semibold text-[#d5ddd5] transition hover:border-[#c8f56a]/60 hover:text-[#c8f56a]">
                          <span className="truncate">{source.label}</span><ExternalLink className="h-3 w-3 shrink-0" />
                        </a>
                      ))}
                      {!selectedLead.sourceUrls?.length && <p className="text-[10px] text-[#e7b7b8]">No hay una fuente concreta vinculada a este candidato.</p>}
                    </div>
                  </div>
                </aside>
              )}
            </div>

            <div className="mt-6 grid gap-4 border-t border-[#deddd6] pt-6 lg:grid-cols-[minmax(0,1.1fr)_minmax(300px,.9fr)]">
              <div>
                <p className="mb-2 text-[10px] font-bold uppercase tracking-[0.16em] text-[#78828b]">04 / Preguntas del profesor</p>
                <h3 className="text-lg font-semibold tracking-[-0.04em]">Antes de buscar un ticker, responde esto</h3>
                <div className="mt-4 grid gap-2 sm:grid-cols-2">
                  {result.questions.map((question, index) => <div key={question} className="flex gap-2.5 rounded-lg border border-[#deddd6] bg-white p-3 text-xs leading-5 text-[#586571]"><span className="font-bold text-[#879b5a]">0{index + 1}</span><span>{question}</span></div>)}
                </div>
              </div>
              <div className="rounded-lg border border-[#dfe3d9] bg-[#eef3e7] p-5">
                <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#58702d]">Siguiente paso</p>
                <p className="mt-3 text-sm font-semibold leading-6 text-[#34421e]">{result.nextStep}</p>
                <div className="mt-4 flex items-center gap-2 text-[10px] leading-4 text-[#63734d]"><ArrowRight className="h-3.5 w-3.5" /> La paciencia también forma parte del método.</div>
              </div>
            </div>
          </section>

          <section className="mt-5 grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(320px,.72fr)]">
            <div className="rounded-xl border border-white/10 bg-[#151e28] p-5 sm:p-7">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="mb-2 text-[10px] font-bold uppercase tracking-[0.16em] text-[#c8f56a]">Checklist vivo</p>
                  <h2 className="text-2xl font-semibold tracking-[-0.05em]">La IA te acompaña, no te sustituye</h2>
                </div>
                <ListChecks className="h-5 w-5 text-[#c8f56a]" />
              </div>
              <div className="mt-6 grid gap-3 md:grid-cols-2">
                {RESEARCH_CHECKLIST.map((item, index) => (
                  <div key={item.title} className="flex gap-3 rounded-lg border border-white/10 bg-white/[.03] p-3.5">
                    <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full border border-[#c8f56a]/40 text-[10px] font-bold text-[#c8f56a]">{index + 1}</span>
                    <div><p className="text-xs font-semibold text-[#f7f5ef]">{item.title}</p><p className="mt-1 text-[10px] leading-4 text-[#8997a3]">{item.description}</p></div>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-xl bg-[#c8f56a] p-5 text-[#16202b] sm:p-7">
              <div className="flex items-start justify-between gap-4"><div><p className="mb-2 text-[10px] font-bold uppercase tracking-[0.16em] text-[#58702d]">Lectura base</p><h2 className="text-2xl font-semibold tracking-[-0.05em]">Un paso por delante de Wall Street</h2></div><BookOpenCheck className="h-5 w-5 text-[#58702d]" /></div>
              <p className="mt-4 text-sm leading-6 text-[#34421e]">El libro es el marco pedagógico: observar primero, investigar después y mantener una tesis que pueda ser falsada.</p>
              <div className="mt-6 grid gap-2">
                <a href="https://www.simonandschuster.com/books/One-Up-On-Wall-Street/Peter-Lynch/9780743200400" target="_blank" rel="noreferrer" className="flex items-center justify-between rounded-lg border border-[#58702d]/20 bg-white/30 px-3 py-2.5 text-xs font-semibold text-[#34421e] transition hover:bg-white/60"><span className="inline-flex items-center gap-2"><BookOpenCheck className="h-4 w-4" /> Página oficial del libro</span><ExternalLink className="h-3.5 w-3.5" /></a>
                <a href="https://www.sec.gov/search-filings" target="_blank" rel="noreferrer" className="flex items-center justify-between rounded-lg border border-[#58702d]/20 bg-white/30 px-3 py-2.5 text-xs font-semibold text-[#34421e] transition hover:bg-white/60"><span className="inline-flex items-center gap-2"><FileSearch className="h-4 w-4" /> Buscar documentos EDGAR</span><ExternalLink className="h-3.5 w-3.5" /></a>
              </div>
              <p className="mt-5 text-[10px] leading-4 text-[#58702d]">La app no reproduce el texto del libro: convierte sus ideas generales en preguntas de investigación propias.</p>
            </div>
          </section>
        </main>

        <footer className="flex flex-col gap-2 border-t border-white/10 py-6 text-[10px] leading-5 text-[#788692] sm:flex-row sm:items-center sm:justify-between">
          <span>FIN · Buscador de acciones · informes educativos, no asesoramiento financiero</span>
          <span className="inline-flex items-center gap-1.5"><Check className="h-3.5 w-3.5 text-[#c8f56a]" /> Fuentes primarias antes de cualquier decisión</span>
        </footer>
      </div>
    </div>
  )
}
