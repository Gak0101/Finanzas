'use client'

import { type FormEvent, useEffect, useMemo, useState } from 'react'
import {
  ArrowRight,
  BarChart3,
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
  MessageCircle,
  RotateCcw,
  Search,
  Scale,
  Send,
  ShieldAlert,
  Sparkles,
  Target,
  TrendingUp,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  createInitialResult,
  createInitialResearchProfile,
  generateResearchResult,
  getCategory,
  LYNCH_CATEGORIES,
  LYNCH_COACH_STEPS,
  LYNCH_METRIC_FOCUS,
  RESEARCH_INTEGRITY_NOTE,
  RESEARCH_INTERPRETATION_NOTE,
  SEARCH_MODES,
  type LynchCategoryKey,
  type ResearchInput,
  type ResearchMetricStatus,
  type ResearchResult,
  type ResearchCheckStatus,
  type LynchMetricFocus,
  type LynchResearchProfile,
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
  if (engine === 'data-fallback') return 'Datos verificables · IA sin redacción'
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

function coachAnswerLabel(stepKey: (typeof LYNCH_COACH_STEPS)[number]['key'], profile: LynchResearchProfile) {
  if (stepKey === 'category') {
    return profile.category === 'undecided' ? 'Todavía no lo sé' : getCategory(profile.category).label
  }
  if (stepKey === 'metricFocus') {
    return profile.metricFocus
      .map((key) => LYNCH_METRIC_FOCUS.find((item) => item.key === key)?.label)
      .filter(Boolean)
      .join(' · ')
  }
  if (stepKey === 'observation') return profile.observation
  if (stepKey === 'business') return profile.business
  if (stepKey === 'thesis') return profile.thesis
  return profile.invalidation
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
  const [activeCategory, setActiveCategory] = useState<LynchCategoryKey | 'all'>('all')
  const [result, setResult] = useState(createInitialResult)
  const [selectedLeadId, setSelectedLeadId] = useState(result.leads[0]?.id ?? '')
  const [showAllMetrics, setShowAllMetrics] = useState(false)
  const [lastRunHorizon, setLastRunHorizon] = useState<ResearchInput['horizon']>('5-10')
  const [requestError, setRequestError] = useState<string | null>(null)
  const [researchTier, setResearchTier] = useState<ResearchTier>('free')
  const [webSearchReady, setWebSearchReady] = useState(false)
  const [freeSourcesReady, setFreeSourcesReady] = useState(false)
  const [coachOpen, setCoachOpen] = useState(true)
  const [coachStepIndex, setCoachStepIndex] = useState(0)
  const [coachDraft, setCoachDraft] = useState('')
  const [coachProfile, setCoachProfile] = useState<LynchResearchProfile>(createInitialResearchProfile)

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
  const coachComplete = coachStepIndex >= LYNCH_COACH_STEPS.length
  const hasRun = Boolean(result.generatedAt)
  const activeCoachStep = LYNCH_COACH_STEPS[coachStepIndex]
  const selectedLead = result.leads.find((lead) => lead.id === selectedLeadId) ?? result.leads[0]
  const selectedScorecard = selectedLead?.scorecard
  const availableMetrics = selectedScorecard?.metrics.filter((metric) => metric.status !== 'missing') ?? []
  const visibleMetrics = showAllMetrics ? availableMetrics : availableMetrics.slice(0, 8)
  const noLeadsCopy = result.screening?.companiesFound
    ? 'Hay empresas identificadas, pero ninguna ha reunido todavía suficientes métricas y fuentes para entrar en el informe. Revisa los descartes y prueba una empresa concreta si quieres profundizar.'
    : query.trim()
      ? 'La pista no ha producido una empresa cotizada verificable en esta pasada. Prueba con un ticker, una empresa o un sector más concreto; la app no rellenará el resultado con nombres inventados.'
      : 'Completa el mapa Lynch o escribe una empresa, un ticker o una pista temática para iniciar el cribado.'

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

    const effectiveQuery = query.trim() || coachProfile.observation.trim()
    setIsRunning(true)
    setRequestError(null)
    try {
      const response = await fetch('/api/buscador-acciones', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: effectiveQuery, mode, horizon, risk, tier: researchTier, profile: coachProfile }),
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
      const nextResult = generateResearchResult({ query: effectiveQuery, mode, horizon, risk, profile: coachProfile })
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

  function resetCoach() {
    setCoachProfile(createInitialResearchProfile())
    setCoachDraft('')
    setCoachStepIndex(0)
    setCoachOpen(true)
  }

  function saveCoachAnswer() {
    const step = activeCoachStep
    if (!step) return
    if (step.key === 'category' || step.key === 'metricFocus') return
    const value = coachDraft.trim()
    setCoachProfile((current) => ({ ...current, [step.key]: value }))
    setCoachDraft('')
    setCoachStepIndex((index) => index + 1)
  }

  function skipCoachAnswer() {
    const step = activeCoachStep
    if (!step) return
    if (step.key === 'category') {
      setCoachProfile((current) => ({ ...current, category: 'undecided' }))
    }
    if (step.key === 'metricFocus') {
      setCoachProfile((current) => ({ ...current, metricFocus: ['growth', 'balance-sheet', 'valuation'] }))
    }
    setCoachDraft('')
    setCoachStepIndex((index) => index + 1)
  }

  function chooseCoachCategory(category: LynchCategoryKey | 'undecided') {
    setCoachProfile((current) => ({ ...current, category }))
  }

  function toggleMetricFocus(key: LynchMetricFocus) {
    setCoachProfile((current) => ({
      ...current,
      metricFocus: current.metricFocus.includes(key)
        ? current.metricFocus.filter((item) => item !== key)
        : [...current.metricFocus, key],
    }))
  }

  function continueCoachChoice() {
    if (!activeCoachStep || (activeCoachStep.key === 'category' && coachProfile.category === 'undecided' && !coachProfile.observation)) {
      skipCoachAnswer()
      return
    }
    if (activeCoachStep.key === 'metricFocus' && !coachProfile.metricFocus.length) {
      skipCoachAnswer()
      return
    }
    setCoachStepIndex((index) => index + 1)
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
              Investiga como Lynch
            </h1>
            <p className="mt-4 max-w-2xl text-sm leading-7 text-[#aab4be] sm:text-base">
              Primero aclaramos la historia, después contrastamos los números y solo al final dejamos empresas para investigar. El asistente no sustituye tu criterio: te ayuda a formularlo.
            </p>
          </div>

          <div className="flex max-w-sm items-start gap-3 rounded-lg border border-[#e7a35e]/30 bg-[#e7a35e]/10 p-3 text-xs leading-5 text-[#f0c996]">
            <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-[#e7a35e]" />
            <p>
              El buscador no predice rentabilidad ni rellena huecos: solo muestra empresas y cifras con fuente trazable. Lo que no se pueda verificar queda como «No encontrado» o se descarta.
            </p>
          </div>
        </header>

        <main>
          <section className="mt-7">
            <form onSubmit={runResearch} className="rounded-xl bg-[#f7f5ef] p-5 text-[#16202b] shadow-[0_18px_45px_rgba(0,0,0,.16)] sm:p-7">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <p className="mb-2 text-[10px] font-bold uppercase tracking-[0.16em] text-[#78828b]">01 / Define la investigación</p>
                  <h2 className="text-2xl font-semibold tracking-[-0.05em]">¿Qué historia merece una investigación?</h2>
                  <p className="mt-2 max-w-xl text-sm leading-6 text-[#75808d]">
                    El preparador te hará las preguntas importantes del método. Si ya tienes un ticker, puedes saltar la conversación y usar el atajo.
                  </p>
                </div>
                <span className={`inline-flex w-fit items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-semibold ${isLiveEngine(result.engine) ? 'bg-[#dfe9ff] text-[#40558a]' : 'bg-[#e8eee0] text-[#58702d]'}`}>
                  <Sparkles className="h-3.5 w-3.5" /> {engineLabel(result.engine)}
                </span>
              </div>

              <div className="mt-6 overflow-hidden rounded-xl border border-[#263545] bg-[#16202b] text-[#f7f5ef]">
                <button
                  type="button"
                  onClick={() => setCoachOpen((open) => !open)}
                  aria-expanded={coachOpen}
                  className="flex w-full items-center justify-between gap-4 px-4 py-4 text-left transition hover:bg-white/[.04] sm:px-5"
                >
                  <span className="flex items-start gap-3">
                    <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-[#c8f56a] text-[#16202b]"><MessageCircle className="h-4 w-4" /></span>
                    <span>
                      <span className="block text-[10px] font-bold uppercase tracking-[0.14em] text-[#c8f56a]">Preparador Lynch · {coachComplete ? 'mapa listo' : `${Math.min(coachStepIndex + 1, LYNCH_COACH_STEPS.length)} de ${LYNCH_COACH_STEPS.length}`}</span>
                      <span className="mt-1 block text-sm font-semibold text-[#f7f5ef]">Construye la pregunta antes de buscar</span>
                    </span>
                  </span>
                  <span className="text-[10px] font-semibold text-[#aab4be]">{coachOpen ? 'Cerrar' : 'Abrir'}</span>
                </button>

                {coachOpen && (
                  <div className="border-t border-white/10 px-4 pb-4 pt-4 sm:px-5">
                    <div className="flex gap-1.5" aria-label="Progreso del preparador Lynch">
                      {LYNCH_COACH_STEPS.map((step, index) => (
                        <span key={step.key} className={`h-1.5 flex-1 rounded-full ${index < coachStepIndex ? 'bg-[#c8f56a]' : index === coachStepIndex && !coachComplete ? 'bg-[#87a34b]' : 'bg-white/10'}`} />
                      ))}
                    </div>

                    <div className="mt-4 grid gap-3" aria-live="polite">
                      {LYNCH_COACH_STEPS.slice(0, coachStepIndex).map((step) => {
                        const answer = coachAnswerLabel(step.key, coachProfile)
                        return (
                          <div key={step.key} className="grid gap-1.5">
                            <div className="max-w-[95%] rounded-2xl rounded-bl-md bg-white/[.07] px-3.5 py-2.5 text-xs leading-5 text-[#d5ddd5]">{step.prompt}</div>
                            <div className="ml-auto max-w-[95%] rounded-2xl rounded-br-md bg-[#c8f56a] px-3.5 py-2.5 text-xs leading-5 text-[#16202b]">{answer || 'Lo dejamos como pregunta pendiente.'}</div>
                          </div>
                        )
                      })}

                      {coachComplete ? (
                        <div className="rounded-lg border border-[#c8f56a]/25 bg-[#c8f56a]/10 p-3 text-xs leading-5 text-[#d5ddd5]">
                          <p className="font-semibold text-[#c8f56a]">Mapa listo. Ahora lanza la búsqueda.</p>
                          <p className="mt-1">Usaremos tus respuestas como contexto y solo mostraremos hechos respaldados por fuentes y métricas verificables.</p>
                          <div className="mt-3 flex flex-wrap items-center gap-3">
                            <Button type="submit" disabled={isRunning} className="h-9 bg-[#c8f56a] px-4 text-[10px] font-bold text-[#16202b] hover:bg-[#d8ff88]">
                              <Search className="h-3.5 w-3.5" /> {isRunning ? 'Buscando…' : 'Buscar y verificar'}
                            </Button>
                            <button type="button" onClick={resetCoach} className="inline-flex items-center gap-1.5 text-[10px] font-semibold text-[#c8f56a] hover:underline"><RotateCcw className="h-3 w-3" /> Reiniciar conversación</button>
                          </div>
                        </div>
                      ) : activeCoachStep ? (
                        <>
                          <div className="max-w-[95%] rounded-2xl rounded-bl-md bg-white/[.07] px-3.5 py-2.5 text-xs leading-5 text-[#d5ddd5]">
                            <p>{activeCoachStep.prompt}</p>
                            <p className="mt-1.5 text-[10px] leading-4 text-[#8997a3]">{activeCoachStep.hint}</p>
                          </div>

                          {activeCoachStep.key === 'category' && (
                            <div className="grid gap-2 sm:grid-cols-2">
                              {[...LYNCH_CATEGORIES, { key: 'undecided' as const, label: 'Todavía no lo sé', description: 'Deja que los datos pesen más que la primera impresión.', color: '#9aa5ae', watch: 'Evidencia antes de etiquetar.' }].map((category) => {
                                const selected = coachProfile.category === category.key
                                return (
                                  <button key={category.key} type="button" onClick={() => chooseCoachCategory(category.key)} aria-pressed={selected} className={`rounded-lg border p-2.5 text-left transition ${selected ? 'border-[#c8f56a] bg-[#c8f56a]/10' : 'border-white/10 bg-white/[.03] hover:border-white/25'}`}>
                                    <span className="flex items-center gap-2 text-[10px] font-semibold text-[#f7f5ef]"><span className="h-2 w-2 rounded-full" style={{ backgroundColor: category.color }} />{category.label}</span>
                                    <span className="mt-1 block text-[9px] leading-4 text-[#8997a3]">{category.description}</span>
                                  </button>
                                )
                              })}
                            </div>
                          )}

                          {activeCoachStep.key === 'metricFocus' && (
                            <div className="grid gap-2 sm:grid-cols-2">
                              {LYNCH_METRIC_FOCUS.map((item) => {
                                const selected = coachProfile.metricFocus.includes(item.key)
                                return (
                                  <button key={item.key} type="button" onClick={() => toggleMetricFocus(item.key)} aria-pressed={selected} className={`rounded-lg border p-2.5 text-left transition ${selected ? 'border-[#c8f56a] bg-[#c8f56a]/10' : 'border-white/10 bg-white/[.03] hover:border-white/25'}`}>
                                    <span className="flex items-center gap-2 text-[10px] font-semibold text-[#f7f5ef]"><span className={`grid h-3.5 w-3.5 place-items-center rounded border text-[9px] ${selected ? 'border-[#c8f56a] bg-[#c8f56a] text-[#16202b]' : 'border-white/25 text-transparent'}`}><Check className="h-2.5 w-2.5" /></span>{item.label}</span>
                                    <span className="mt-1 block pl-5 text-[9px] leading-4 text-[#8997a3]">{item.description}</span>
                                  </button>
                                )
                              })}
                            </div>
                          )}

                          {!['category', 'metricFocus'].includes(activeCoachStep.key) && (
                            <textarea value={coachDraft} onChange={(event) => setCoachDraft(event.target.value)} rows={2} placeholder={activeCoachStep.hint} className="w-full resize-y rounded-lg border border-white/15 bg-black/10 px-3 py-2.5 text-xs leading-5 text-[#f7f5ef] outline-none placeholder:text-[#71808c] focus:border-[#c8f56a]/60 focus:ring-2 focus:ring-[#c8f56a]/20" />
                          )}

                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <button type="button" onClick={skipCoachAnswer} className="text-[10px] font-semibold text-[#8997a3] hover:text-[#f7f5ef]">Saltar por ahora</button>
                            <Button type="button" onClick={['category', 'metricFocus'].includes(activeCoachStep.key) ? continueCoachChoice : saveCoachAnswer} disabled={['category', 'metricFocus'].includes(activeCoachStep.key) ? activeCoachStep.key === 'metricFocus' && !coachProfile.metricFocus.length : !coachDraft.trim()} className="h-9 bg-[#c8f56a] px-4 text-[10px] font-bold text-[#16202b] hover:bg-[#d8ff88]"><Send className="h-3.5 w-3.5" /> Continuar</Button>
                          </div>
                        </>
                      ) : null}
                    </div>
                  </div>
                )}
              </div>

              <div className="mt-6 grid gap-2">
                <label htmlFor="stock-clue" className="text-xs font-semibold text-[#16202b]">
                  Atajo opcional: empresa, ticker o criterio
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
                          ? 'Usa OpenRouter gratuito, Yahoo Finance y las fuentes configuradas sin activar búsquedas web de pago.'
                          : 'Usa OpenRouter y Yahoo Finance. Añade Firecrawl u otras APIs en Configuración para ampliar el contexto.'}
                    </p>
                    {!webSearchReady && <a href="/configuracion#fuentes-inversion" className="mt-1.5 block text-[10px] font-medium text-[#6b7f42] hover:underline">Configurar Firecrawl propio · gratis</a>}
                  </div>
                  <Button type="submit" disabled={isRunning} className="h-10 bg-[#16202b] px-5 text-xs font-semibold text-white hover:bg-[#263545]">
                    {isRunning ? <><Search className="animate-pulse" /> Buscando y verificando…</> : <><Sparkles /> Buscar y verificar</>}
                  </Button>
                </div>
              </div>
            </form>

          </section>

          <section id="resultados-acciones" className="mt-5 scroll-mt-6 rounded-xl bg-[#f7f5ef] p-5 text-[#16202b] shadow-[0_18px_45px_rgba(0,0,0,.16)] sm:p-7">
            <div className="flex flex-col gap-4 border-b border-[#deddd6] pb-5 lg:flex-row lg:items-end lg:justify-between">
              <div>
                <div className="mb-2 flex flex-wrap items-center gap-2 text-[10px] font-bold uppercase tracking-[0.16em] text-[#78828b]">
                  <span>03 / Resultados</span>
                  {hasRun && <span className="rounded-full bg-[#e8eee0] px-2 py-1 text-[#58702d]">{formatHorizon(lastRunHorizon)}</span>}
                  <span className={`rounded-full px-2 py-1 ${hasRun && isLiveEngine(result.engine) ? 'bg-[#dfe9ff] text-[#40558a]' : 'bg-[#f0eee8] text-[#78828b]'}`}>{hasRun ? engineLabel(result.engine) : 'Esperando búsqueda'}</span>
                </div>
                <h2 className="max-w-3xl text-2xl font-semibold tracking-[-0.05em]">{hasRun ? result.title : 'Aquí aparecerán tus resultados'}</h2>
                <p className="mt-2 max-w-3xl text-sm leading-6 text-[#75808d]">{hasRun ? result.summary : 'Pulsa «Buscar y verificar» para consultar las fuentes configuradas y mostrar solo empresas con identidad, datos y enlaces comprobables.'}</p>
              </div>
              {hasRun && <div className="max-w-xs rounded-lg border border-[#e7a35e]/40 bg-[#fff7e9] p-3 text-[10px] leading-4 text-[#83571f]">
                <div className="flex items-center gap-1.5 font-bold uppercase tracking-[0.12em]"><CircleAlert className="h-3.5 w-3.5" /> Puntuación de cribado</div>
                <p className="mt-1">Se calcula con métricas y comprobaciones disponibles. No es una probabilidad ni una recomendación.</p>
              </div>}
            </div>

            {hasRun ? (
              <div className="mt-5 flex flex-col gap-3 rounded-lg border border-[#dfe3d9] bg-[#eef3e7] p-3.5 text-xs leading-5 text-[#4d5f33] sm:flex-row sm:items-start">
                <BrainCircuit className="mt-0.5 h-4 w-4 shrink-0 text-[#6e8c3a]" />
                <div>
                  <p><strong className="font-semibold">Qué se ha comprobado:</strong> {result.methodNote}</p>
                  <p className="mt-2 border-t border-[#d5dfca] pt-2 text-[10px] font-semibold text-[#4d5f33]">{RESEARCH_INTEGRITY_NOTE}</p>
                  <p className="mt-1 text-[10px] text-[#71815b]">{RESEARCH_INTERPRETATION_NOTE}</p>
                  <p className="mt-1 text-[10px] text-[#71815b]">Consulta generada: {formatResearchTimestamp(result.generatedAt)}{result.providerNote ? ` · ${result.providerNote}` : ''}</p>
                </div>
              </div>
            ) : (
              <div className="mt-5 flex items-start gap-3 rounded-lg border border-dashed border-[#c9c9c1] bg-white p-4 text-xs leading-5 text-[#586571]">
                <Search className="mt-0.5 h-4 w-4 shrink-0 text-[#879b5a]" />
                <div>
                  <p className="font-semibold text-[#16202b]">Todavía no hay una búsqueda ejecutada</p>
                  <p className="mt-1">Elige una empresa, ticker o criterio —o usa el mapa que acabas de completar— y pulsa el botón verde de arriba.</p>
                </div>
              </div>
            )}

            {hasRun && result.screening && (
              <div className="mt-4 flex flex-col gap-2 rounded-lg border border-[#d9d8d1] bg-white p-3.5 text-[11px] leading-5 text-[#586571] sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <p className="font-semibold text-[#16202b]">Filtro de evidencia</p>
                  <p className="mt-1">{result.screening.companiesFound} empresa{result.screening.companiesFound === 1 ? '' : 's'} con identidad verificada · {result.screening.candidatesReturned} mostrada{result.screening.candidatesReturned === 1 ? '' : 's'} en el informe · {result.screening.candidatesDiscarded} candidato{result.screening.candidatesDiscarded === 1 ? '' : 's'} descartado{result.screening.candidatesDiscarded === 1 ? '' : 's'} por falta de datos.</p>
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

            {hasRun && <div className="mt-6 flex gap-2 overflow-x-auto pb-1">
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
            </div>}

            {hasRun && <div className="mt-4 grid gap-4 xl:grid-cols-[minmax(0,1.35fr)_minmax(300px,.65fr)]">
              <div className="grid gap-3 md:grid-cols-2">
                {!visibleLeads.length && (
                  <div className="md:col-span-2 rounded-lg border border-dashed border-[#c9c9c1] bg-white p-6 text-center">
                    <Database className="mx-auto h-6 w-6 text-[#879b5a]" />
                    <h3 className="mt-3 text-base font-semibold text-[#16202b]">Ninguna empresa ha pasado el filtro</h3>
                    <p className="mx-auto mt-2 max-w-lg text-xs leading-5 text-[#78828b]">{noLeadsCopy}</p>
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
                    <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-[#aab4be]">Hipótesis a contrastar · no hechos</p>
                    {selectedScorecard?.categoryReason && <p className="mt-2 text-[10px] leading-4 text-[#aab4be]">Categoría: {selectedScorecard.categoryReason}</p>}
                    <p className="mt-2 text-xs leading-5 text-[#e0e6df]">{selectedLead.thesis}</p>
                  </div>

                  <div className="mt-5">
                    <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-[#aab4be]">Datos y comprobaciones verificadas</p>
                    <ul className="mt-3 grid gap-3">
                      {selectedLead.evidence.map((item) => <li key={item} className="flex gap-2 text-xs leading-5 text-[#d5ddd5]"><CircleCheck className="mt-0.5 h-4 w-4 shrink-0 text-[#c8f56a]" />{item}</li>)}
                    </ul>
                  </div>

                  <div className="mt-5 rounded-lg border border-[#e58b8d]/20 bg-[#e58b8d]/10 p-3.5">
                    <p className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.12em] text-[#f0b1b2]"><CircleAlert className="h-3.5 w-3.5" /> Riesgos por comprobar</p>
                    <ul className="mt-2 grid gap-1.5 text-xs leading-5 text-[#edcccc]">{selectedLead.risks.map((riskItem) => <li key={riskItem}>· {riskItem}</li>)}</ul>
                  </div>

                  <div className="mt-5 grid gap-3 sm:grid-cols-2">
                    <div className="rounded-lg border border-[#c8f56a]/20 bg-[#c8f56a]/10 p-3.5">
                      <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-[#c8f56a]">Qué seguir</p>
                      <ul className="mt-2 grid gap-1.5 text-[10px] leading-4 text-[#d5ddd5]">{(selectedLead.monitoring ?? selectedLead.evidence).map((item) => <li key={item}>· {item}</li>)}</ul>
                    </div>
                    <div className="rounded-lg border border-[#e7a35e]/20 bg-[#e7a35e]/10 p-3.5">
                      <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-[#f0c996]">Cuándo revisar o invalidar</p>
                      <ul className="mt-2 grid gap-1.5 text-[10px] leading-4 text-[#eddfca]">{(selectedLead.exitSignals ?? selectedLead.risks).map((item) => <li key={item}>· {item}</li>)}</ul>
                    </div>
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
            </div>}
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
