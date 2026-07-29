import { createHash } from 'node:crypto'
import { NextResponse } from 'next/server'
import { eq } from 'drizzle-orm'
import { z } from 'zod'
import { getAuthenticatedUserId, isNextResponse } from '@/lib/api-utils'
import { getAiCredentials, type AiCredentials } from '@/lib/ai/provider-config'
import { decryptSecret } from '@/lib/ai/secret-crypto'
import { db } from '@/lib/db'
import { configuraciones_fuentes_inversion } from '@/lib/db/schema'
import {
  generateResearchResult,
  type LynchCategoryKey,
  type ResearchEngine,
  type ResearchInput,
  type ResearchLead,
  type ResearchResult,
  type ResearchSource,
} from '@/lib/buscador-acciones/lynchFramework'
import {
  buildResearchScorecard,
  collectFundamentals,
  mergeFundamentalSnapshots,
  resolveFinnhubEntity,
  type FundamentalSnapshot,
  type ResearchEntity,
} from '@/lib/buscador-acciones/researchData'

export const runtime = 'nodejs'

const inputSchema = z.object({
  query: z.string().trim().max(240).default(''),
  mode: z.enum(['boring', 'ipo', 'everyday', 'growth']).default('boring'),
  horizon: z.enum(['3-5', '5-10', '10+']).default('5-10'),
  risk: z.enum(['prudente', 'moderado', 'alto']).default('moderado'),
  tier: z.enum(['free', 'premium']).default('free'),
})

const candidateSchema = z.object({
  ticker: z.string().min(1).max(20),
  company: z.string().min(1).max(140),
  exchange: z.string().min(1).max(80),
  title: z.string().min(1).max(300),
  subtitle: z.string().min(1).max(500),
  category: z.enum(['slow-grower', 'stalwart', 'fast-grower', 'cyclical', 'turnaround', 'asset-play']),
  fit: z.number().int().min(0).max(100),
  thesis: z.string().min(1).max(2000),
  evidence: z.array(z.string().min(1).max(600)).min(1).max(4),
  risks: z.array(z.string().min(1).max(600)).min(1).max(4),
  firstSource: z.string().min(1).max(400),
  stage: z.enum(['Universo', 'Preselección', 'Revisión']),
  categoryReason: z.string().max(800).optional().default(''),
  sourceUrls: z.array(z.object({
    label: z.string().min(1).max(240),
    url: z.string().url(),
  })).min(1).max(4),
  dataAsOf: z.string().min(1).max(200),
})

const aiResultSchema = z.object({
  title: z.string().min(1).max(500),
  summary: z.string().min(1).max(2000),
  methodNote: z.string().min(1).max(1500),
  questions: z.array(z.string().min(1).max(600)).min(1).max(5),
  nextStep: z.string().min(1).max(1000),
  candidates: z.array(candidateSchema).max(5),
})

const RESPONSE_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    title: { type: 'string' },
    summary: { type: 'string' },
    methodNote: { type: 'string' },
    questions: { type: 'array', items: { type: 'string' } },
    nextStep: { type: 'string' },
    candidates: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        properties: {
          ticker: { type: 'string' },
          company: { type: 'string' },
          exchange: { type: 'string' },
          title: { type: 'string' },
          subtitle: { type: 'string' },
          category: { type: 'string', enum: ['slow-grower', 'stalwart', 'fast-grower', 'cyclical', 'turnaround', 'asset-play'] },
          fit: { type: 'integer' },
          thesis: { type: 'string' },
          evidence: { type: 'array', items: { type: 'string' } },
          risks: { type: 'array', items: { type: 'string' } },
          firstSource: { type: 'string' },
          stage: { type: 'string', enum: ['Universo', 'Preselección', 'Revisión'] },
          categoryReason: { type: 'string' },
          sourceUrls: {
            type: 'array',
            items: {
              type: 'object',
              additionalProperties: false,
              properties: {
                label: { type: 'string' },
                url: { type: 'string' },
              },
              required: ['label', 'url'],
            },
          },
          dataAsOf: { type: 'string' },
        },
        required: ['ticker', 'company', 'exchange', 'title', 'subtitle', 'category', 'fit', 'thesis', 'evidence', 'risks', 'firstSource', 'stage', 'sourceUrls', 'dataAsOf'],
      },
    },
  },
  required: ['title', 'summary', 'methodNote', 'questions', 'nextStep', 'candidates'],
} as const

const BASE_SYSTEM_PROMPT = `Eres un analista de investigación bursátil para una aplicación educativa en español.

El marco está inspirado en ideas generales de "Un paso por delante de Wall Street" de Peter Lynch: entender la historia del negocio, clasificarlo en una de seis categorías (slow grower, stalwart, fast grower, cyclical, turnaround o asset play), comprobar ventas/beneficio/caja/deuda/acciones, revisar la valoración y escribir qué invalidaría la tesis.

Reglas obligatorias:
- No eres asesor financiero. Nunca digas comprar, vender, mantener, entrada, precio objetivo ni asignes una probabilidad de conseguir 10x.
- Devuelve empresas para investigar, no recomendaciones. El campo fit es solo encaje cualitativo con el marco, no rentabilidad esperada.
- Los DATOS FINANCIEROS VERIFICADOS son los que aparecen en FUENTES Y MÉTRICAS. No inventes cifras, fechas, múltiplos, crecimiento, ticker ni URLs.
- Si falta una métrica, dilo explícitamente en evidence o risks; no la rellenes con una estimación mental.
- Diferencia siempre hechos (con fuente y periodo) de interpretación (tesis, categoría y riesgos).
- El ticker, empresa y mercado deben salir de EMPRESAS VERIFICADAS o de una fuente web del contexto; si no puedes verificar la identidad, no devuelvas ese candidato.
- El campo fit no es una puntuación de calidad: la aplicación lo sustituirá por su propio scorecard determinista. No lo uses para sugerir rentabilidad.
- Señala la fecha de los datos y recuerda que la cotización y la tesis pueden cambiar.
- No copies texto del libro. Aplícalo como protocolo de razonamiento propio.
- Responde exclusivamente con el JSON solicitado, sin markdown.`

const JSON_OUTPUT_CONTRACT = `La respuesta debe ser exclusivamente un objeto JSON válido con esta estructura exacta:
{
  "title": "título",
  "summary": "resumen",
  "methodNote": "cómo se ha investigado",
  "questions": ["pregunta 1", "pregunta 2", "pregunta 3"],
  "nextStep": "siguiente paso",
  "candidates": [{
    "ticker": "ticker real",
    "company": "empresa",
    "exchange": "bolsa",
    "title": "título breve",
    "subtitle": "subtítulo breve",
    "category": "slow-grower | stalwart | fast-grower | cyclical | turnaround | asset-play",
    "categoryReason": "por qué la categoría encaja, separando interpretación de hechos",
    "fit": 0,
    "thesis": "tesis",
    "evidence": ["comprobación 1", "comprobación 2"],
    "risks": ["riesgo 1", "riesgo 2"],
    "firstSource": "fuente para revisar",
    "stage": "Universo | Preselección | Revisión",
    "sourceUrls": [{"label": "fuente", "url": "https://example.com"}],
    "dataAsOf": "fecha o No verificado en tiempo real"
  }]
}
Incluye entre 1 y 5 candidatos, al menos 2 elementos en evidence y risks, y no añadas texto fuera del JSON.`

function systemPrompt(tier: 'free' | 'premium', openDiscovery = false) {
  if (tier === 'premium') {
    return `${BASE_SYSTEM_PROMPT}

    MODO AVANZADO:
- Firecrawl es una instancia propia de la app y no implica una búsqueda web de pago. El posible coste depende únicamente del modelo avanzado configurado.
- Busca empresas cotizadas reales y actuales. Para IPO usa únicamente ofertas o empresas con información pública verificable; no presentes oportunidades pre-IPO privadas.
- Usa exclusivamente los resultados web proporcionados por la instancia Firecrawl de la app. Prioriza SEC/EDGAR, reguladores, informes anuales, resultados y relaciones con inversores. Usa prensa financiera solo para contexto.
- Usa la tabla de métricas que acompaña a la consulta para separar datos comprobados de preguntas pendientes. Si una empresa no tiene métricas suficientes, devuélvela como Revisión o no la incluyas.
- Devuelve como máximo cinco empresas verificables y prioriza las que tengan ventas/BPA comparables, caja/deuda, acciones y al menos un múltiplo. Si no hay empresas verificables, devuelve una lista vacía antes que inventar una.
- Cada candidato debe tener al menos una URL pública y concreta que permita verificar la afirmación. Si no puedes verificar el ticker o la fuente, no lo incluyas.`
  }

  const discoveryRule = openDiscovery
    ? `- Esta es una pista temática y todavía no hay EMPRESAS VERIFICADAS. Puedes proponer hasta cinco empresas cotizadas que aparezcan literalmente en los resultados de Firecrawl o que sean una inferencia claramente identificable a partir de ellos, siempre con ticker real. La aplicación volverá a verificar cada ticker con Finnhub antes de mostrarlo; si Finnhub no lo confirma, ese candidato se descarta.
- No devuelvas una lista de empresas famosas al azar para rellenar el resultado. Si la web no aporta nombres o tickers suficientes, devuelve candidates vacío.`
    : `- Para una consulta concreta, selecciona primero empresas que aparezcan en EMPRESAS VERIFICADAS. Una empresa conocida fuera de esa lista no es un resultado válido.`

  return `${BASE_SYSTEM_PROMPT}

MODO GRATUITO:
- No tienes búsqueda web de pago. Puedes usar únicamente el CONTEXTO DE FUENTES GRATUITAS que acompaña a la consulta: Firecrawl propio, Finnhub, NewsAPI y enlaces públicos.
- Los precios, noticias y resultados de las APIs pueden estar limitados o retrasados. Cita la fecha del contexto y no presentes un dato ausente como comprobado.
${discoveryRule}
- Incluye enlaces oficiales generales para que el usuario pueda iniciar la comprobación manual. No inventes URLs, cifras, noticias ni fechas.
- Explica en methodNote que la salida es un informe de cribado, qué métricas están verificadas y qué debe confirmarse después.
- Devuelve exactamente este contrato JSON, sin añadir ni omitir campos:
{
  "title": "texto",
  "summary": "texto",
  "methodNote": "texto",
  "questions": ["pregunta 1", "pregunta 2", "pregunta 3"],
  "nextStep": "texto",
  "candidates": [{
    "ticker": "ticker real",
    "company": "empresa",
    "exchange": "bolsa",
    "title": "título breve",
    "subtitle": "subtítulo breve",
    "category": "slow-grower | stalwart | fast-grower | cyclical | turnaround | asset-play",
    "fit": 0,
    "thesis": "texto",
    "evidence": ["comprobación 1", "comprobación 2"],
    "risks": ["riesgo 1", "riesgo 2"],
    "firstSource": "fuente para revisar",
    "stage": "Universo",
    "sourceUrls": [{"label": "fuente oficial", "url": "https://..."}],
    "dataAsOf": "No verificado en tiempo real"
  }]
}
fit debe ser un entero entre 0 y 100; stage solo puede ser Universo, Preselección o Revisión; devuelve entre 0 y 5 candidatos. Si no hay una empresa verificable, devuelve candidates vacío.`
}

type AiProviderConfig = {
  apiStyle: 'responses' | 'chat-completions'
  apiKey: string
  endpoint: string
  model: string
  engine: Extract<ResearchEngine, 'openrouter-free' | 'openai-firecrawl' | 'openrouter-firecrawl'>
  label: string
  headers: Record<string, string>
  tools: Array<Record<string, unknown>>
}

function responsesUrl(configured: string, fallback: string) {
  const base = (configured || fallback).replace(/\/+$/, '')
  return base.endsWith('/v1') ? `${base}/responses` : `${base}/v1/responses`
}

function chatCompletionsUrl(configured: string, fallback: string) {
  const base = (configured || fallback).replace(/\/+$/, '')
  return base.endsWith('/v1') ? `${base}/chat/completions` : `${base}/v1/chat/completions`
}

function aiProviderConfig(credentials: AiCredentials | null, tier: 'free' | 'premium'): AiProviderConfig | null {
  if (credentials?.provider === 'openrouter') {
    const configuredFreeModel = credentials.models.searchFree === 'openrouter/free' || credentials.models.searchFree.endsWith(':free')
    return {
      apiStyle: 'chat-completions',
      apiKey: credentials.apiKey,
      endpoint: chatCompletionsUrl(process.env.OPENROUTER_BASE_URL ?? '', 'https://openrouter.ai/api/v1'),
      model: tier === 'free'
        ? (configuredFreeModel ? credentials.models.searchFree : 'openrouter/free')
        : credentials.models.searchPremium,
      engine: tier === 'free' ? 'openrouter-free' : 'openrouter-firecrawl',
      label: 'OpenRouter',
      headers: {
        'HTTP-Referer': process.env.OPENROUTER_SITE_URL ?? process.env.NEXTAUTH_URL ?? 'http://localhost:3000',
        'X-OpenRouter-Title': process.env.OPENROUTER_APP_NAME ?? 'Finanzas · Buscador de inversiones',
      },
      tools: [],
    }
  }

  if (credentials?.provider !== 'openai') return null
  if (tier === 'free') return null
  return {
    apiStyle: 'responses',
    apiKey: credentials.apiKey,
    endpoint: responsesUrl(process.env.OPENAI_BASE_URL ?? process.env.OPENAI_API_BASE ?? '', 'https://api.openai.com/v1'),
    model: credentials.models.searchPremium,
    engine: 'openai-firecrawl',
    label: 'OpenAI',
    headers: {},
    tools: [],
  }
}

function safetyIdentifier(userId: number) {
  return createHash('sha256').update(`finanzas:${userId}`).digest('hex')
}

function safeSource(source: ResearchSource): ResearchSource | null {
  try {
    const url = new URL(source.url)
    if (url.protocol !== 'https:' && url.protocol !== 'http:') return null
    if (url.username || url.password) return null
    return { label: source.label.slice(0, 120), url: url.toString() }
  } catch {
    return null
  }
}

function extractOutputText(payload: unknown) {
  if (!payload || typeof payload !== 'object') return null
  const response = payload as { output_text?: unknown; output?: unknown; choices?: unknown }
  if (typeof response.output_text === 'string') return response.output_text

  function contentText(content: unknown) {
    if (typeof content === 'string') return content
    if (!Array.isArray(content)) return null
    const text = content
      .flatMap((part) => {
        if (!part || typeof part !== 'object') return []
        const value = (part as { text?: unknown }).text
        return typeof value === 'string' ? [value] : []
      })
      .join('')
      .trim()
    return text || null
  }

  if (Array.isArray(response.choices)) {
    for (const choice of response.choices) {
      if (!choice || typeof choice !== 'object') continue
      const message = (choice as { message?: unknown }).message
      if (!message || typeof message !== 'object') continue
      const content = (message as { content?: unknown }).content
      const text = contentText(content)
      if (text) return text
    }
  }
  if (!Array.isArray(response.output)) return null

  for (const item of response.output) {
    if (!item || typeof item !== 'object') continue
    const content = (item as { content?: unknown }).content
    if (!Array.isArray(content)) continue
    for (const part of content) {
      if (!part || typeof part !== 'object') continue
      const text = (part as { text?: unknown }).text
      if (typeof text === 'string') return text
    }
  }
  return null
}

function parseJsonResponse(text: string) {
  const trimmed = text.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '')
  try {
    return JSON.parse(trimmed) as unknown
  } catch {
    const start = trimmed.indexOf('{')
    const end = trimmed.lastIndexOf('}')
    if (start === -1 || end <= start) return null
    try {
      return JSON.parse(trimmed.slice(start, end + 1)) as unknown
    } catch {
      return null
    }
  }
}

function repairSourceUrls(payload: unknown, context: ResearchContext) {
  if (!payload || typeof payload !== 'object') return payload
  const record = payload as { candidates?: unknown }
  if (!Array.isArray(record.candidates)) return payload

  const fallbackSources = [
    ...context.webSources.map((source) => ({ label: source.title, url: source.url })),
    ...context.news.map((source) => ({ label: source.title, url: source.url })),
    ...context.market.map((source) => ({ label: `Finnhub · ${source.symbol}`, url: source.sourceUrl })),
    ...context.fundamentals.flatMap((snapshot) => snapshot.sources),
    { label: 'Buscar documentos SEC EDGAR', url: 'https://www.sec.gov/search-filings' },
  ].map(safeSource).filter((source): source is ResearchSource => source !== null)
  const allowedUrls = new Set(fallbackSources.map((source) => source.url))

  return {
    ...record,
    candidates: record.candidates.map((candidate) => {
      if (!candidate || typeof candidate !== 'object') return candidate
      const candidateRecord = candidate as { sourceUrls?: unknown }
      const sourceUrls = Array.isArray(candidateRecord.sourceUrls)
        ? candidateRecord.sourceUrls.map((source) => {
          if (!source || typeof source !== 'object') return null
          const value = source as { label?: unknown; url?: unknown }
          if (typeof value.label !== 'string' || typeof value.url !== 'string') return null
          const safe = safeSource({ label: value.label, url: value.url })
          return safe && allowedUrls.has(safe.url) ? safe : null
        }).filter((source): source is ResearchSource => source !== null)
        : []
      return {
        ...candidateRecord,
        sourceUrls: (sourceUrls.length ? sourceUrls : fallbackSources).slice(0, 4),
      }
    }),
  }
}

function localFallback(input: ResearchInput, providerNote: string, engine: ResearchEngine = 'local-fallback') {
  return {
    ...generateResearchResult(input),
    engine,
    providerNote,
  } satisfies ResearchResult
}

function metricValue(snapshot: FundamentalSnapshot, key: string) {
  return snapshot.metrics.find((metric) => metric.key === key && metric.status === 'verified')
}

function metricEvidence(snapshot: FundamentalSnapshot) {
  const preferredKeys = [
    'revenue',
    'revenue-growth',
    'eps',
    'eps-growth',
    'free-cash-flow',
    'operating-cash-flow',
    'pe',
    'ps',
    'net-margin',
  ]
  return preferredKeys
    .map((key) => metricValue(snapshot, key))
    .filter((metric): metric is NonNullable<typeof metric> => Boolean(metric))
    .slice(0, 4)
    .map((metric) => `${metric.label}: ${metric.value}${metric.period ? ` (${metric.period})` : ''}.`)
}

function metricRisks(snapshot: FundamentalSnapshot) {
  const requiredForReview = [
    ['revenue-growth', 'crecimiento de ventas comparable'],
    ['eps-growth', 'crecimiento del BPA comparable'],
    ['free-cash-flow', 'flujo de caja libre'],
    ['debt', 'deuda'],
    ['pe', 'PER'],
  ] as const
  const missing = requiredForReview
    .filter(([key]) => !metricValue(snapshot, key))
    .map(([, label]) => label)
  const risks = missing.length
    ? [`Falta verificar: ${missing.join(', ')}.`]
    : []
  risks.push(...snapshot.warnings.slice(0, 2))
  risks.push('La clasificación es automática y provisional; hay que contrastar la historia del negocio en una fuente primaria.')
  return risks.slice(0, 4)
}

function fallbackCategory(snapshot: FundamentalSnapshot): { category: LynchCategoryKey; reason: string } {
  const revenueGrowth = metricValue(snapshot, 'revenue-growth')?.numericValue
  const epsGrowth = metricValue(snapshot, 'eps-growth')?.numericValue
  if (revenueGrowth !== undefined && epsGrowth !== undefined && revenueGrowth >= 15 && epsGrowth >= 15) {
    return {
      category: 'fast-grower',
      reason: `Etiqueta automática por crecimiento verificado de ventas (${metricValue(snapshot, 'revenue-growth')?.value}) y BPA (${metricValue(snapshot, 'eps-growth')?.value}); no es una recomendación ni sustituye la revisión del negocio.`,
    }
  }
  if (revenueGrowth !== undefined && revenueGrowth < 5) {
    return {
      category: 'slow-grower',
      reason: `Etiqueta automática por crecimiento de ventas verificado moderado (${metricValue(snapshot, 'revenue-growth')?.value}); falta contrastar la evolución histórica y el dividendo.`,
    }
  }
  return {
    category: 'stalwart',
    reason: revenueGrowth !== undefined
      ? `Etiqueta provisional por crecimiento de ventas verificado de ${metricValue(snapshot, 'revenue-growth')?.value}; faltan contexto competitivo y una serie histórica más amplia.`
      : 'Etiqueta provisional: no hay crecimiento comparable suficiente para clasificar con seguridad; revisar manualmente antes de extraer una conclusión.',
  }
}

function dataDrivenFallback(
  input: ResearchInput,
  provider: AiProviderConfig,
  context: ResearchContext,
  providerNote: string,
): ResearchResult {
  const leads = context.fundamentals
    .filter((snapshot) => snapshot.identityVerified && snapshot.metrics.some((metric) => metric.status === 'verified'))
    .slice(0, 5)
    .flatMap((snapshot, index) => {
      const sources = sourceListForCandidate([], snapshot, context)
      if (!sources.length) return []
      const { category, reason } = fallbackCategory(snapshot)
      const evidence = metricEvidence(snapshot)
      const risks = metricRisks(snapshot)
      const scorecard = buildResearchScorecard(snapshot, {
        category,
        categoryReason: reason,
        evidence,
        risks,
      }, {
        webSources: context.webSources.map((source) => ({ label: source.title, url: source.url })),
        newsSources: context.news.map((source) => ({ label: source.title, url: source.url })),
      })
      if (scorecard.verdict === 'sin-datos') return []
      return [{
        id: `data-${snapshot.symbol.toLowerCase().replace(/[^a-z0-9]+/g, '-') || index}`,
        title: `${snapshot.company} (${snapshot.symbol})`,
        subtitle: `${snapshot.company} · ${snapshot.symbol} · ${snapshot.exchange}`,
        category,
        fit: scorecard.score,
        thesis: 'Cribado determinista construido con las métricas verificadas de las fuentes configuradas. La interpretación del negocio y la valoración relativa siguen pendientes de revisión.',
        evidence: evidence.length ? evidence : ['Hay métricas verificadas disponibles; revisa el detalle y su periodo antes de interpretarlas.'],
        risks,
        firstSource: sources[0]?.label ?? 'Fuente financiera configurada',
        stage: scorecard.verdict === 'investigar' ? 'Preselección' : 'Revisión',
        ticker: snapshot.symbol,
        company: snapshot.company,
        exchange: snapshot.exchange,
        sourceUrls: sources,
        dataAsOf: snapshot.dataAsOf,
        categoryReason: reason,
        scorecard,
      } satisfies ResearchLead]
    })

  if (!leads.length) return localFallback(input, providerNote)
  const sourceNote = context.sourcesUsed.length ? ` · fuentes: ${context.sourcesUsed.join(' · ')}` : ''
  const warningNote = context.warnings.length ? ` · avisos: ${context.warnings.slice(0, 4).join(' · ')}` : ''
  return {
    title: `Cribado con datos verificables para ${input.query.trim() || 'empresas cotizadas'}`,
    summary: 'La IA no devolvió una respuesta utilizable, así que se muestran únicamente empresas identificadas y métricas obtenidas de las fuentes configuradas. No se ha rellenado ningún dato ausente.',
    methodNote: 'Fallback determinista: identidad, métricas, periodos y enlaces proceden de las APIs disponibles. La categoría y la tesis son etiquetas provisionales para ordenar la revisión, no recomendaciones.',
    questions: [
      `¿Puedes explicar el negocio de ${input.query.trim() || 'la empresa'} en dos minutos sin usar palabras de moda?`,
      '¿Qué métrica verificada debería mantenerse o mejorar para que la historia siga en pie?',
      '¿Qué dato falta todavía sobre deuda, dilución o valoración?',
    ],
    nextStep: 'Abre cada fuente primaria, confirma los periodos y completa la historia del negocio antes de tomar una decisión.',
    leads,
    engine: 'local-fallback',
    generatedAt: new Date().toISOString(),
    providerNote: `${provider.label} · ${provider.model} · datos de APIs sin texto IA${sourceNote}${warningNote} · ${providerNote}`,
    screening: {
      companiesFound: context.fundamentals.filter((snapshot) => snapshot.identityVerified).length,
      candidatesReturned: leads.length,
      candidatesDiscarded: 0,
      note: 'La IA no pudo redactar el informe; se conserva el cribado solo cuando hay identidad, métricas y fuentes verificables.',
    },
  }
}

type FirecrawlResult = {
  title: string
  description: string
  url: string
  content?: string
}

type NewsApiResult = {
  title: string
  description: string
  url: string
  publishedAt: string
  source: string
}

type FinnhubResult = {
  symbol: string
  company: string
  exchange: string
  type: string
  price: number | null
  changePercent: number | null
  dataAsOf: string
  sourceUrl: string
}

type FinnhubContext = {
  market: FinnhubResult[]
  news: NewsApiResult[]
  fundamentals: FundamentalSnapshot[]
  warnings: string[]
}

type ResearchContext = {
  webSources: FirecrawlResult[]
  news: NewsApiResult[]
  market: FinnhubResult[]
  fundamentals: FundamentalSnapshot[]
  sourcesUsed: string[]
  warnings: string[]
}

function firecrawlBasePath(url: URL) {
  const path = url.pathname.replace(/\/+$/, '')
  // La configuración histórica de la instancia se guardó con `/v0`, pero
  // el proxy público expone actualmente las rutas versionadas desde la raíz.
  return path.replace(/\/v[012]$/, '')
}

function appendUrlPath(root: string, suffix: string) {
  const cleanRoot = root.replace(/\/+$/, '')
  return `${cleanRoot}/${suffix.replace(/^\/+/, '')}` || `/${suffix.replace(/^\/+/, '')}`
}

function firecrawlSearchUrl(baseUrl: string) {
  const url = new URL(baseUrl)
  if (url.protocol !== 'https:' && url.protocol !== 'http:') throw new Error('Protocolo Firecrawl no válido')
  if (url.username || url.password) throw new Error('La URL de Firecrawl no debe incluir credenciales')
  const path = url.pathname.replace(/\/+$/, '')
  url.pathname = path.endsWith('/v2/search')
    ? path
    : appendUrlPath(firecrawlBasePath(url), 'v2/search')
  return url.toString()
}

function firecrawlScrapeUrl(baseUrl: string) {
  const url = new URL(baseUrl)
  if (url.protocol !== 'https:' && url.protocol !== 'http:') throw new Error('Protocolo Firecrawl no válido')
  if (url.username || url.password) throw new Error('La URL de Firecrawl no debe incluir credenciales')
  const path = url.pathname.replace(/\/+$/, '')
  url.pathname = path.endsWith('/scrape') ? path : appendUrlPath(firecrawlBasePath(url), 'v1/scrape')
  return url.toString()
}

function unwrapSearchResultUrl(value: string) {
  try {
    const url = new URL(value)
    if (url.hostname.endsWith('duckduckgo.com') && url.pathname === '/l/') {
      const target = url.searchParams.get('uddg')
      if (target) return decodeURIComponent(target)
    }
    return url.toString()
  } catch {
    return null
  }
}

function scrapeSearchResults(payload: unknown): FirecrawlResult[] {
  if (!payload || typeof payload !== 'object') return []
  const data = (payload as { data?: unknown }).data
  if (!data || typeof data !== 'object') return []

  const scrapeData = data as { links?: unknown; markdown?: unknown }
  const labels = new Map<string, string>()
  const markdown = typeof scrapeData.markdown === 'string' ? scrapeData.markdown : ''
  const markdownLink = /\[([^\]]{1,240})\]\(([^)\s]+)\)/g
  for (const match of markdown.matchAll(markdownLink)) {
    const url = unwrapSearchResultUrl(match[2])
    if (!url) continue
    const label = match[1].replace(/^!+/, '').trim()
    if (label && !label.startsWith('[]')) labels.set(url, label)
  }

  const rawLinks = Array.isArray(scrapeData.links) ? scrapeData.links : []
  const urls = [...labels.keys(), ...rawLinks.filter((link): link is string => typeof link === 'string')]
  const results: FirecrawlResult[] = []
  const seen = new Set<string>()
  for (const rawUrl of urls) {
    const unwrapped = unwrapSearchResultUrl(rawUrl)
    if (!unwrapped) continue
    let parsed: URL
    try {
      parsed = new URL(unwrapped)
    } catch {
      continue
    }
    if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') continue
    if (parsed.hostname.endsWith('duckduckgo.com')) continue
    const url = parsed.toString()
    if (seen.has(url)) continue
    seen.add(url)
    const source = safeSource({
      label: labels.get(unwrapped) ?? parsed.hostname,
      url,
    })
    if (!source) continue
    results.push({
      title: source.label,
      description: markdown.replace(/\s+/g, ' ').slice(0, 500),
      url: source.url,
      content: markdown.slice(0, 1400),
    })
    if (results.length >= 6) break
  }
  return results
}

async function searchWithFirecrawl(
  row: typeof configuraciones_fuentes_inversion.$inferSelect,
  query: string
): Promise<FirecrawlResult[]> {
  if (!row.firecrawl_base_url) return []
  let apiKey: string | null = null
  if (row.firecrawl_api_key_cifrada) {
    apiKey = decryptSecret(row.firecrawl_api_key_cifrada)
  }

  const headers = {
    'Content-Type': 'application/json',
    Accept: 'application/json',
    ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
  }
  const request = async (url: string, body: unknown, timeout: number, requestHeaders = headers) => fetch(url, {
    method: 'POST',
    headers: requestHeaders,
    body: JSON.stringify(body),
    cache: 'no-store',
    signal: AbortSignal.timeout(timeout),
  })
  const searchBody = {
    query,
    limit: 6,
    sources: ['web'],
    country: 'ES',
    timeout: 25_000,
    scrapeOptions: { formats: [{ type: 'markdown' }] },
  }
  let response = await request(firecrawlSearchUrl(row.firecrawl_base_url), searchBody, 30_000)
  if ((response.status === 401 || response.status === 403) && apiKey) {
    // La instancia propia puede estar configurada sin autenticación. La clave
    // guardada no debe impedir que el conector gratuito pruebe el endpoint.
    response = await request(firecrawlSearchUrl(row.firecrawl_base_url), searchBody, 30_000, {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    })
  }
  if (response.ok) {
    const payload = await response.json().catch(() => null) as {
      data?: { web?: unknown[] } | unknown[]
    } | null
    const rawResults = Array.isArray(payload?.data)
      ? payload.data
      : Array.isArray(payload?.data?.web)
        ? payload.data.web
        : []

    return rawResults.flatMap((item) => {
      if (!item || typeof item !== 'object') return []
      const result = item as { title?: unknown; description?: unknown; markdown?: unknown; url?: unknown }
      if (typeof result.url !== 'string') return []
      const safe = safeSource({
        label: typeof result.title === 'string' ? result.title : 'Resultado web',
        url: result.url,
      })
      if (!safe) return []
      const description = typeof result.description === 'string'
        ? result.description
        : typeof result.markdown === 'string'
          ? result.markdown
          : ''
      return [{
        title: safe.label,
        description: description.slice(0, 1600),
        url: safe.url,
        content: typeof result.markdown === 'string' ? result.markdown.slice(0, 7000) : undefined,
      }]
    }).slice(0, 6)
  }

  if (response.status !== 404 && response.status !== 405) {
    throw new Error(`Firecrawl respondió HTTP ${response.status}`)
  }

  const searchPage = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`
  let scrapeResponse = await request(firecrawlScrapeUrl(row.firecrawl_base_url), { url: searchPage, formats: ['markdown'] }, 30_000)
  if ((scrapeResponse.status === 401 || scrapeResponse.status === 403) && apiKey) {
    scrapeResponse = await request(firecrawlScrapeUrl(row.firecrawl_base_url), { url: searchPage, formats: ['markdown'] }, 30_000, {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    })
  }
  if (!scrapeResponse.ok) throw new Error(`Firecrawl respondió HTTP ${scrapeResponse.status}`)

  return scrapeSearchResults(await scrapeResponse.json().catch(() => null))
}

async function searchWithNewsApi(
  row: typeof configuraciones_fuentes_inversion.$inferSelect,
  query: string
): Promise<NewsApiResult[]> {
  if (!row.newsapi_key_cifrada || !query.trim()) return []

  const apiKey = decryptSecret(row.newsapi_key_cifrada)
  const url = new URL('https://newsapi.org/v2/everything')
  url.searchParams.set('q', query.trim().slice(0, 180))
  url.searchParams.set('searchIn', 'title,description')
  url.searchParams.set('sortBy', 'publishedAt')
  url.searchParams.set('pageSize', '8')
  url.searchParams.set('language', 'en')
  url.searchParams.set('apiKey', apiKey)

  const response = await fetch(url, {
    cache: 'no-store',
    signal: AbortSignal.timeout(12_000),
  })
  const payload = await response.json().catch(() => null) as {
    status?: unknown
    message?: unknown
    articles?: unknown
  } | null
  if (!response.ok || payload?.status === 'error') {
    if (response.status === 429 || /too many|limit|quota/i.test(typeof payload?.message === 'string' ? payload.message : '')) {
      throw new Error('NewsAPI ha alcanzado el límite gratuito')
    }
    if (response.status === 426) {
      throw new Error('NewsAPI requiere un plan compatible con producción')
    }
    throw new Error(typeof payload?.message === 'string' ? payload.message : `NewsAPI respondió HTTP ${response.status}`)
  }

  const articles = Array.isArray(payload?.articles) ? payload.articles : []
  return articles.flatMap((item) => {
    if (!item || typeof item !== 'object') return []
    const article = item as {
      title?: unknown
      description?: unknown
      url?: unknown
      publishedAt?: unknown
      source?: { name?: unknown }
    }
    if (typeof article.title !== 'string' || article.title === '[Removed]' || typeof article.url !== 'string') return []
    const safe = safeSource({ label: article.title, url: article.url })
    if (!safe) return []
    return [{
      title: safe.label,
      description: typeof article.description === 'string' ? article.description.slice(0, 700) : '',
      url: safe.url,
      publishedAt: typeof article.publishedAt === 'string' ? article.publishedAt : 'Fecha no disponible',
      source: typeof article.source?.name === 'string' ? article.source.name : 'NewsAPI',
    }]
  }).slice(0, 8)
}

async function searchWithFinnhub(
  row: typeof configuraciones_fuentes_inversion.$inferSelect,
  query: string
): Promise<FinnhubContext> {
  if (!row.finnhub_token_cifrado || !query.trim()) return { market: [], news: [], fundamentals: [], warnings: [] }

  const apiKey = decryptSecret(row.finnhub_token_cifrado)
  const searchUrl = new URL('https://finnhub.io/api/v1/search')
  searchUrl.searchParams.set('q', query.trim().slice(0, 120))
  searchUrl.searchParams.set('token', apiKey)
  const searchResponse = await fetch(searchUrl, {
    cache: 'no-store',
    signal: AbortSignal.timeout(12_000),
  })
  if (!searchResponse.ok) throw new Error(`Finnhub respondió HTTP ${searchResponse.status}`)

  const searchPayload = await searchResponse.json().catch(() => null) as { result?: unknown } | null
  const rawMatches = Array.isArray(searchPayload?.result) ? searchPayload.result : []
  const matches = rawMatches.flatMap((item) => {
    if (!item || typeof item !== 'object') return []
    const match = item as { symbol?: unknown; description?: unknown; displaySymbol?: unknown; type?: unknown; exchange?: unknown }
    if (typeof match.symbol !== 'string' || typeof match.description !== 'string') return []
    const type = typeof match.type === 'string' ? match.type : 'Cotizada'
    if (!['Common Stock', 'ETP', 'ADR', 'REIT'].includes(type)) return []
    return [{
      symbol: match.displaySymbol && typeof match.displaySymbol === 'string' ? match.displaySymbol : match.symbol,
      company: match.description,
      exchange: typeof match.exchange === 'string' && match.exchange.trim() ? match.exchange : 'Finnhub',
      type,
    }]
  }).slice(0, 3)

  let fiscalApiKey: string | undefined
  try {
    fiscalApiKey = row.fiscal_api_key_cifrada ? decryptSecret(row.fiscal_api_key_cifrada) : undefined
  } catch {
    fiscalApiKey = undefined
  }

  const fundamentalsPromise = Promise.all(matches.map((match) => collectFundamentals(match, {
    finnhubToken: apiKey,
    secContactEmail: row.sec_contact_email ?? undefined,
    fiscalApiKey,
  })))

  const newsPromise = matches[0]
    ? (async () => {
      const to = new Date()
      const from = new Date(to.getTime() - 30 * 24 * 60 * 60 * 1000)
      const newsUrl = new URL('https://finnhub.io/api/v1/company-news')
      newsUrl.searchParams.set('symbol', matches[0].symbol)
      newsUrl.searchParams.set('from', from.toISOString().slice(0, 10))
      newsUrl.searchParams.set('to', to.toISOString().slice(0, 10))
      newsUrl.searchParams.set('token', apiKey)
      const newsResponse = await fetch(newsUrl, {
        cache: 'no-store',
        signal: AbortSignal.timeout(12_000),
      })
      if (!newsResponse.ok) return [] as NewsApiResult[]
      const payload = await newsResponse.json().catch(() => null) as unknown
      if (!Array.isArray(payload)) return []
      return payload.flatMap((item) => {
        if (!item || typeof item !== 'object') return []
        const article = item as { headline?: unknown; summary?: unknown; url?: unknown; datetime?: unknown; source?: unknown }
        if (typeof article.headline !== 'string' || typeof article.url !== 'string') return []
        const safe = safeSource({ label: article.headline, url: article.url })
        if (!safe) return []
        const timestamp = typeof article.datetime === 'number' && article.datetime > 0 ? article.datetime * 1000 : Date.now()
        return [{
          title: safe.label,
          description: typeof article.summary === 'string' ? article.summary.slice(0, 700) : '',
          url: safe.url,
          publishedAt: new Date(timestamp).toISOString(),
          source: typeof article.source === 'string' ? article.source : 'Finnhub',
        }]
      }).slice(0, 6)
    })()
    : Promise.resolve([] as NewsApiResult[])

  const [fundamentals, news] = await Promise.all([fundamentalsPromise, newsPromise])
  const market = fundamentals.map((snapshot): FinnhubResult => {
    const priceMetric = snapshot.metrics.find((metric) => metric.key === 'price')
    return {
      symbol: snapshot.symbol,
      company: snapshot.company,
      exchange: snapshot.exchange,
      type: matches.find((match) => match.symbol === snapshot.symbol)?.type ?? 'Cotizada',
      price: snapshot.price ?? priceMetric?.numericValue ?? null,
      changePercent: snapshot.changePercent ?? null,
      dataAsOf: snapshot.dataAsOf,
      sourceUrl: priceMetric?.sourceUrls[0]?.url ?? 'https://finnhub.io/docs/api/quote',
    }
  })
  return {
    market,
    news,
    fundamentals,
    warnings: fundamentals.flatMap((snapshot) => snapshot.warnings),
  }
}

async function gatherResearchContext(
  row: typeof configuraciones_fuentes_inversion.$inferSelect | undefined,
  webQuery: string,
  entityQuery: string
): Promise<ResearchContext> {
  if (!row) return { webSources: [], news: [], market: [], fundamentals: [], sourcesUsed: [], warnings: [] }

  const tasks = [
    row.firecrawl_base_url
      ? searchWithFirecrawl(row, webQuery)
      : Promise.resolve([] as FirecrawlResult[]),
    row.finnhub_token_cifrado && entityQuery.trim()
      ? searchWithFinnhub(row, entityQuery)
      : Promise.resolve({ market: [], news: [], fundamentals: [], warnings: [] } as FinnhubContext),
    row.newsapi_key_cifrada && entityQuery.trim()
      ? searchWithNewsApi(row, entityQuery)
      : Promise.resolve([] as NewsApiResult[]),
  ] as const

  const [webResult, marketResult, newsResult] = await Promise.allSettled(tasks)
  const warnings: string[] = []
  const webSources = webResult.status === 'fulfilled' ? webResult.value : []
  const finnhubContext = marketResult.status === 'fulfilled'
    ? marketResult.value
    : { market: [], news: [], fundamentals: [], warnings: [] }
  const market = finnhubContext.market
  const newsApiNews = newsResult.status === 'fulfilled' ? newsResult.value : []
  const news = [...finnhubContext.news, ...newsApiNews]
  const sourceFailure = (label: string, reason: unknown) => {
    const message = reason instanceof Error ? reason.message : ''
    if (/429|l[ií]mite|quota|too many/i.test(message)) return `${label} ha alcanzado su límite gratuito`
    if (/401|403|autoriz|credencial|clave/i.test(message)) return `${label} rechazó la credencial configurada`
    if (/404|405/i.test(message)) return `${label} no ofrece el endpoint configurado`
    return `${label} no respondió`
  }
  if (webResult.status === 'rejected') warnings.push(sourceFailure('Firecrawl', webResult.reason))
  if (marketResult.status === 'rejected') warnings.push(sourceFailure('Finnhub', marketResult.reason))
  if (newsResult.status === 'rejected') warnings.push(sourceFailure('NewsAPI', newsResult.reason))
  warnings.push(...finnhubContext.warnings)

  const fiscalReady = finnhubContext.fundamentals.some((snapshot) => snapshot.sources.some((source) => source.url.includes('fiscal.ai')))
  const secReady = finnhubContext.fundamentals.some((snapshot) => snapshot.sources.some((source) => source.url.includes('sec.gov')))

  return {
    webSources,
    news,
    market,
    fundamentals: finnhubContext.fundamentals,
    sourcesUsed: [
      webSources.length ? 'Firecrawl propio' : '',
      market.length ? 'Finnhub' : '',
      finnhubContext.news.length ? 'Finnhub noticias' : '',
      newsApiNews.length ? 'NewsAPI' : '',
      secReady ? 'SEC EDGAR' : '',
      fiscalReady ? 'Fiscal.ai' : '',
    ].filter(Boolean),
    warnings,
  }
}

function promptResearchContext(context: ResearchContext) {
  return {
    web: context.webSources.slice(0, 4).map((source) => ({
      titulo: source.title,
      descripcion: source.description.slice(0, 600),
      contenido: source.content?.slice(0, 1400),
      url: source.url,
    })),
    mercadoFinnhub: context.market.slice(0, 5),
    noticias: context.news.slice(0, 8).map((source) => ({
      titulo: source.title,
      descripcion: source.description.slice(0, 500),
      fecha: source.publishedAt,
      fuente: source.source,
      url: source.url,
    })),
    fundamentales: context.fundamentals.slice(0, 5).map((snapshot) => ({
      empresa: snapshot.company,
      ticker: snapshot.symbol,
      mercado: snapshot.exchange,
      datosHasta: snapshot.dataAsOf,
      metricas: snapshot.metrics.filter((metric) => metric.status === 'verified').slice(0, 20).map((metric) => ({
        clave: metric.key,
        nombre: metric.label,
        valor: metric.value,
        periodo: metric.period ?? 'no indicado',
        fuentes: metric.sourceUrls.slice(0, 2),
      })),
      fuentes: snapshot.sources.slice(0, 6),
      avisos: snapshot.warnings.slice(0, 4),
    })),
    limitaciones: context.warnings.slice(0, 8),
  }
}

function normalizeSymbol(value: string) {
  const normalized = value.trim().toUpperCase().replace(/[^A-Z0-9.:-]/g, '')
  return normalized.length >= 1 && normalized.length <= 20 ? normalized : null
}

function symbolKey(value: string) {
  return normalizeSymbol(value)?.split(':').at(-1) ?? ''
}

function sourceCredentials(row: typeof configuraciones_fuentes_inversion.$inferSelect | undefined) {
  if (!row) return {}
  let finnhubToken: string | undefined
  let fiscalApiKey: string | undefined
  try {
    finnhubToken = row.finnhub_token_cifrado ? decryptSecret(row.finnhub_token_cifrado) : undefined
  } catch {
    finnhubToken = undefined
  }
  try {
    fiscalApiKey = row.fiscal_api_key_cifrada ? decryptSecret(row.fiscal_api_key_cifrada) : undefined
  } catch {
    fiscalApiKey = undefined
  }
  return {
    finnhubToken,
    fiscalApiKey,
    secContactEmail: row.sec_contact_email ?? undefined,
  }
}

async function enrichCandidateFundamentals(
  candidates: Array<z.infer<typeof candidateSchema>>,
  row: typeof configuraciones_fuentes_inversion.$inferSelect | undefined,
  existing: FundamentalSnapshot[],
) {
  const known = new Set(existing.filter((snapshot) => snapshot.identityVerified).map((snapshot) => symbolKey(snapshot.symbol)))
  const entities: Array<{ candidate: z.infer<typeof candidateSchema>; entity: ResearchEntity }> = candidates.flatMap((candidate) => {
    const symbol = normalizeSymbol(candidate.ticker)
    if (!symbol || ['N/A', 'NA', 'UNKNOWN', 'NONE'].includes(symbol) || known.has(symbolKey(symbol))) return []
    return [{ candidate, entity: {
      symbol,
      company: candidate.company,
      exchange: candidate.exchange,
      type: 'Common Stock',
    } }]
  }).slice(0, 5)

  const credentials = sourceCredentials(row)
  const unresolved: string[] = []
  if (!credentials.finnhubToken) {
    return { snapshots: existing, unresolved: candidates.map((candidate) => candidate.ticker) }
  }

  const resolved = await Promise.all(entities.map(async ({ candidate, entity }) => {
    try {
      const verifiedEntity = await resolveFinnhubEntity(entity, credentials.finnhubToken as string)
      if (!verifiedEntity) {
        unresolved.push(candidate.ticker)
        return null
      }
      return collectFundamentals(verifiedEntity, credentials)
    } catch {
      unresolved.push(candidate.ticker)
      return null
    }
  }))
  const extra = resolved.flatMap((snapshot) => snapshot ? [snapshot] : [])
  const alreadyKnown = new Set([...existing, ...extra].map((snapshot) => symbolKey(snapshot.symbol)))
  for (const candidate of candidates) {
    if (!alreadyKnown.has(symbolKey(candidate.ticker)) && !unresolved.includes(candidate.ticker)) unresolved.push(candidate.ticker)
  }
  return { snapshots: mergeFundamentalSnapshots([...existing, ...extra]), unresolved }
}

function sourceListForCandidate(
  candidateSources: ResearchSource[],
  snapshot: FundamentalSnapshot | undefined,
  context: ResearchContext,
) {
  const available = [
    ...context.webSources.map((source) => ({ label: source.title, url: source.url })),
    ...context.news.map((source) => ({ label: source.title, url: source.url })),
    ...context.market.map((source) => ({ label: `Finnhub · ${source.symbol}`, url: source.sourceUrl })),
    ...context.fundamentals.flatMap((item) => item.sources),
  ].map(safeSource).filter((source): source is ResearchSource => source !== null)
  const allowedUrls = new Set(available.map((source) => source.url))
  const seen = new Set<string>()
  return [...candidateSources.filter((source) => allowedUrls.has(source.url)), ...(snapshot?.sources ?? [])].filter((source) => {
    if (seen.has(source.url)) return false
    seen.add(source.url)
    return true
  }).slice(0, 6)
}

function toResearchResult(
  raw: z.infer<typeof aiResultSchema>,
  provider: AiProviderConfig,
  context: ResearchContext,
  screening: { unresolved: string[]; companiesFound: number } = { unresolved: [], companiesFound: context.fundamentals.filter((snapshot) => snapshot.identityVerified).length },
): ResearchResult {
  const mappedLeads = raw.candidates.map((candidate, index) => {
    const sourceUrls = candidate.sourceUrls.map(safeSource).filter((source): source is ResearchSource => source !== null)
    const snapshot = context.fundamentals.find((item) => symbolKey(item.symbol) === symbolKey(candidate.ticker))
    const verifiedSources = sourceListForCandidate(sourceUrls, snapshot, context)
    const scorecard = buildResearchScorecard(snapshot, {
      category: candidate.category,
      categoryReason: candidate.categoryReason,
      evidence: candidate.evidence,
      risks: candidate.risks,
    }, {
      webSources: verifiedSources,
      newsSources: verifiedSources,
    })
    if (!snapshot?.identityVerified || !snapshot.metrics.length || scorecard.verdict === 'sin-datos' || !verifiedSources.length) return null
    const stage: ResearchLead['stage'] = scorecard.verdict === 'investigar' ? 'Preselección' : 'Revisión'
    return {
      id: `ai-${candidate.ticker.toLowerCase().replace(/[^a-z0-9]+/g, '-') || index}`,
      title: candidate.title,
      subtitle: `${snapshot.company} · ${snapshot.symbol} · ${snapshot.exchange}`,
      category: candidate.category,
      fit: scorecard.score,
      thesis: candidate.thesis,
      evidence: candidate.evidence,
      risks: candidate.risks,
      firstSource: candidate.firstSource,
      stage,
      ticker: snapshot.symbol,
      company: snapshot.company,
      exchange: snapshot.exchange,
      sourceUrls: verifiedSources,
      dataAsOf: snapshot.dataAsOf,
      categoryReason: candidate.categoryReason,
      scorecard,
    }
  })
  const leads = mappedLeads.flatMap((lead) => lead ? [lead] : [])
  const discarded = raw.candidates.length - leads.length
  const screeningNote = leads.length
    ? 'Solo se muestran candidatos con ticker validado, métricas verificables y una decisión de cribado distinta de «sin datos».'
    : 'No se ha mostrado ningún candidato: la IA no ha producido una empresa con identidad, métricas y fuentes suficientes para pasar el filtro.'

  const sourceNote = context.sourcesUsed.length ? ` · fuentes: ${context.sourcesUsed.join(' · ')}` : ''
  const warningNote = context.warnings.length ? ` · avisos: ${context.warnings.slice(0, 4).join(' · ')}` : ''
  return {
    title: raw.title,
    summary: raw.summary,
    methodNote: raw.methodNote,
    questions: raw.questions,
    nextStep: raw.nextStep,
    leads,
    engine: provider.engine,
    generatedAt: new Date().toISOString(),
    screening: {
      companiesFound: screening.companiesFound,
      candidatesReturned: leads.length,
      candidatesDiscarded: discarded,
      note: screeningNote,
    },
    providerNote: provider.engine === 'openrouter-free'
      ? `${provider.label} · ${provider.model} · sin búsqueda web de pago${sourceNote}${warningNote}`
      : `${provider.label} · ${provider.model} · Firecrawl propio${sourceNote}${warningNote}`,
  }
}

export async function POST(request: Request) {
  const authResult = await getAuthenticatedUserId()
  if (isNextResponse(authResult)) return authResult

  const body = await request.json().catch(() => null)
  const parsed = inputSchema.safeParse(body ?? {})
  if (!parsed.success) {
    return NextResponse.json({ error: 'La consulta no es válida. Revisa la pista y los filtros.' }, { status: 400 })
  }

  const input = parsed.data
  const sourceSettingsPromise = db.query.configuraciones_fuentes_inversion.findFirst({
    where: eq(configuraciones_fuentes_inversion.usuario_id, authResult.userId),
  })
  const aiCredentialsPromise = getAiCredentials(authResult.userId)
  const [sourceSettings, aiCredentials] = await Promise.all([sourceSettingsPromise, aiCredentialsPromise])
  if (input.tier === 'premium' && !sourceSettings?.firecrawl_base_url) {
    return NextResponse.json({
      error: 'Configura la URL de tu Firecrawl en Configuración antes de usar la búsqueda web.',
    }, { status: 409 })
  }

  const provider = aiProviderConfig(aiCredentials, input.tier)
  if (!provider || process.env.BUSCADOR_ACCIONES_DISABLE_AI === '1') {
    const providerNote = process.env.BUSCADOR_ACCIONES_DISABLE_AI === '1'
      ? 'Proveedor IA desactivado para esta prueba: se muestra el marco local sin datos actuales.'
      : 'Proveedor IA no configurado: se muestra el marco local sin datos actuales.'
    return NextResponse.json(localFallback(input, providerNote))
  }

  const entityQuery = input.query.trim()
  const modeHint = {
    boring: 'small caps listed companies with boring recurring businesses and understandable economics',
    ipo: 'recent IPOs spin-offs and newly listed public companies with verifiable financial information',
    everyday: 'listed companies behind everyday products services and observable consumer habits',
    growth: 'small cap listed companies with verifiable revenue and earnings growth',
  }[input.mode]
  const researchQuery = `${entityQuery || 'empresas cotizadas para investigar'} ${modeHint} investment stocks ticker annual report recent results`
  const researchContext = await gatherResearchContext(sourceSettings, researchQuery, entityQuery)
  if (input.tier === 'premium' && !researchContext.webSources.length) {
    return NextResponse.json(localFallback(input, 'Tu Firecrawl no devolvió resultados web; no se activó ninguna búsqueda de pago.'))
  }

  const openDiscovery = Boolean(entityQuery) && !researchContext.fundamentals.some((snapshot) => snapshot.identityVerified)
  const activeSystemPrompt = systemPrompt(input.tier, openDiscovery)
  const userPrompt = JSON.stringify({
    pista: input.query || 'Exploración abierta: encuentra candidatos que encajen con este modo.',
    modo: input.mode,
    tipoDeBusqueda: openDiscovery ? 'descubrimiento temático: extrae candidatos de las fuentes y verifícalos después' : 'verificación de empresas identificadas',
    horizonte: input.horizon,
    tolerancia: input.risk,
    fechaDeConsulta: new Date().toISOString(),
    empresasVerificadas: researchContext.fundamentals
      .filter((snapshot) => snapshot.identityVerified)
      .map((snapshot) => ({ ticker: snapshot.symbol, empresa: snapshot.company, mercado: snapshot.exchange })),
    fuentesGratuitas: promptResearchContext(researchContext),
  })
  const jsonFormat = {
    type: 'json_schema',
    name: 'lynch_stock_research',
    description: 'Candidatos bursátiles investigables, con riesgos y fuentes verificables.',
    strict: true,
    schema: RESPONSE_SCHEMA,
  } as const
  const requestPayload = provider.apiStyle === 'chat-completions'
    ? input.tier === 'free'
      ? {
        model: provider.model,
        messages: [
          { role: 'system', content: activeSystemPrompt },
          { role: 'user', content: userPrompt },
        ],
        max_tokens: 2600,
        reasoning: { effort: 'none', exclude: true },
      }
      : {
      model: provider.model,
      messages: [
        { role: 'system', content: activeSystemPrompt },
        { role: 'user', content: userPrompt },
      ],
      tools: provider.tools,
      response_format: {
        type: 'json_schema',
        json_schema: jsonFormat,
      },
      provider: { require_parameters: true },
    }
    : {
      model: provider.model,
      store: false,
      safety_identifier: safetyIdentifier(authResult.userId),
      tools: provider.tools,
      input: [
        { role: 'system', content: [{ type: 'input_text', text: systemPrompt(input.tier) }] },
        { role: 'user', content: [{ type: 'input_text', text: userPrompt }] },
      ],
      text: {
        format: jsonFormat,
      },
    }

  const fallbackModel = input.tier === 'free' && provider.apiStyle === 'chat-completions'
    ? 'openrouter/free'
    : provider.model
  const fallbackRequestPayload = provider.apiStyle === 'chat-completions'
    ? {
      model: fallbackModel,
      messages: [
        { role: 'system', content: `${activeSystemPrompt}\n\n${JSON_OUTPUT_CONTRACT}` },
        { role: 'user', content: userPrompt },
      ],
      max_tokens: 4200,
      reasoning: { effort: 'none', exclude: true },
    }
    : requestPayload

  try {
    const attempts = input.tier === 'free' || provider.apiStyle === 'chat-completions' ? 2 : 1
    const providerDescriptor = `${provider.label} · ${provider.model}`
    let lastFailure = `${providerDescriptor} no estuvo disponible; se muestra el marco local para no inventar datos.`

    for (let attempt = 0; attempt < attempts; attempt += 1) {
      const attemptPayload = attempt > 0 && provider.apiStyle === 'chat-completions'
          ? fallbackRequestPayload
          : requestPayload
      const response = await fetch(provider.endpoint, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${provider.apiKey}`,
          'Content-Type': 'application/json',
          ...provider.headers,
        },
        body: JSON.stringify(attemptPayload),
        cache: 'no-store',
        signal: AbortSignal.timeout(35_000),
      })

      if (!response.ok) {
        lastFailure = `${providerDescriptor} no estuvo disponible; se muestra el marco local para no inventar datos.`
        continue
      }

      const payload = await response.json().catch(() => null)
      const text = extractOutputText(payload)
      if (!text) {
        lastFailure = 'El modelo gratuito no generó texto verificable; se muestra el marco local.'
        continue
      }

      const candidatePayload = repairSourceUrls(parseJsonResponse(text), researchContext)
      if (!candidatePayload) {
        lastFailure = 'La respuesta IA no llegó en el formato verificable esperado; se muestra el marco local.'
        continue
      }

      const validated = aiResultSchema.safeParse(candidatePayload)
      if (!validated.success) {
        const issue = validated.error.issues[0]
        const field = issue?.path.join('.') || 'respuesta'
        lastFailure = `La respuesta IA no superó la validación en ${field}; se muestra el marco local.`
        continue
      }

      const successfulProvider = attempt > 0 && fallbackModel !== provider.model
        ? { ...provider, model: fallbackModel }
        : provider
      const enrichedFundamentals = await enrichCandidateFundamentals(
        validated.data.candidates,
        sourceSettings,
        researchContext.fundamentals,
      )
      const enrichedContext: ResearchContext = {
        ...researchContext,
        fundamentals: enrichedFundamentals.snapshots,
      }
      const result = toResearchResult(validated.data, successfulProvider, enrichedContext, {
        unresolved: enrichedFundamentals.unresolved,
        companiesFound: enrichedContext.fundamentals.filter((snapshot) => snapshot.identityVerified).length,
      })
      return NextResponse.json(result.leads.length
        ? result
        : dataDrivenFallback(input, successfulProvider, enrichedContext, 'La IA respondió, pero sus candidatos no pasaron el filtro de identidad, métricas y fuentes.'))
    }

    return NextResponse.json(dataDrivenFallback(input, provider, researchContext, lastFailure))
  } catch {
    return NextResponse.json(dataDrivenFallback(
      input,
      provider,
      researchContext,
      `No se pudo completar la respuesta de ${provider.label} · ${provider.model}; se conservan los datos verificables disponibles.`,
    ))
  }
}
