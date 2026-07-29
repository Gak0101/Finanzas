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
  type ResearchEngine,
  type ResearchInput,
  type ResearchResult,
  type ResearchSource,
} from '@/lib/buscador-acciones/lynchFramework'

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
  evidence: z.array(z.string().min(1).max(600)).min(2).max(4),
  risks: z.array(z.string().min(1).max(600)).min(2).max(4),
  firstSource: z.string().min(1).max(400),
  stage: z.enum(['Universo', 'Preselección', 'Revisión']),
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
  questions: z.array(z.string().min(1).max(600)).min(3).max(5),
  nextStep: z.string().min(1).max(1000),
  candidates: z.array(candidateSchema).min(1).max(5),
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

const BASE_SYSTEM_PROMPT = `Eres un asistente de investigación bursátil para una aplicación educativa en español.

Tu marco pedagógico está inspirado en las ideas generales de "Un paso por delante de Wall Street" de Peter Lynch: observar negocios entendibles, clasificar la empresa en una de seis categorías (slow grower, stalwart, fast grower, cyclical, turnaround o asset play), comprobar la historia con los números, pagar una valoración razonable y definir qué invalidaría la tesis.

Reglas obligatorias:
- No eres asesor financiero. Nunca digas comprar, vender, mantener, entrada, precio objetivo ni asignes una probabilidad de conseguir 10x.
- Devuelve candidatos para investigar, no recomendaciones. El campo fit es solo encaje con el marco de lectura, no probabilidad ni puntuación de rentabilidad.
- Señala la fecha de los datos como texto y recuerda que la cotización y la tesis pueden cambiar.
- No copies texto del libro. Aplícalo como checklist de razonamiento propio.
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

function systemPrompt(tier: 'free' | 'premium') {
  if (tier === 'premium') {
    return `${BASE_SYSTEM_PROMPT}

    MODO AVANZADO:
- Firecrawl es una instancia propia de la app y no implica una búsqueda web de pago. El posible coste depende únicamente del modelo avanzado configurado.
- Busca empresas cotizadas reales y actuales. Para IPO usa únicamente ofertas o empresas con información pública verificable; no presentes oportunidades pre-IPO privadas.
- Usa exclusivamente los resultados web proporcionados por la instancia Firecrawl de la app. Prioriza SEC/EDGAR, reguladores, informes anuales, resultados y relaciones con inversores. Usa prensa financiera solo para contexto.
- Cada candidato debe tener al menos una URL pública y concreta que permita verificar la afirmación. Si no puedes verificar el ticker o la fuente, no lo incluyas.`
  }

  return `${BASE_SYSTEM_PROMPT}

MODO GRATUITO:
- No tienes búsqueda web de pago. Puedes usar únicamente el CONTEXTO DE FUENTES GRATUITAS que acompaña a la consulta: Firecrawl propio, Finnhub, NewsAPI y enlaces públicos.
- Los precios, noticias y resultados de las APIs pueden estar limitados o retrasados. Cita la fecha del contexto y no presentes un dato ausente como comprobado.
- Puedes proponer empresas cotizadas conocidas como hipótesis educativas, pero marca dataAsOf como "No verificado en tiempo real".
- Incluye enlaces oficiales generales para que el usuario pueda iniciar la comprobación manual. No inventes URLs, cifras, noticias ni fechas.
- Explica en methodNote que la propuesta usa IA gratuita, fuentes gratuitas y necesita verificación posterior.
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
fit debe ser un entero entre 0 y 100; stage solo puede ser Universo, Preselección o Revisión; devuelve entre 1 y 5 candidatos.`
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
    { label: 'Buscar documentos SEC EDGAR', url: 'https://www.sec.gov/search-filings' },
  ].map(safeSource).filter((source): source is ResearchSource => source !== null)

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
          return safeSource({ label: value.label, url: value.url })
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

type FirecrawlResult = {
  title: string
  description: string
  url: string
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
}

type ResearchContext = {
  webSources: FirecrawlResult[]
  news: NewsApiResult[]
  market: FinnhubResult[]
  sourcesUsed: string[]
  warnings: string[]
}

function firecrawlSearchUrl(baseUrl: string) {
  const url = new URL(baseUrl)
  if (url.protocol !== 'https:' && url.protocol !== 'http:') throw new Error('Protocolo Firecrawl no válido')
  if (url.username || url.password) throw new Error('La URL de Firecrawl no debe incluir credenciales')
  const path = url.pathname.replace(/\/+$/, '')
  url.pathname = path.endsWith('/v2/search')
    ? path
    : path.endsWith('/v2')
      ? `${path}/search`
      : `${path}/v2/search`
  return url.toString()
}

function firecrawlScrapeUrl(baseUrl: string) {
  const url = new URL(baseUrl)
  if (url.protocol !== 'https:' && url.protocol !== 'http:') throw new Error('Protocolo Firecrawl no válido')
  if (url.username || url.password) throw new Error('La URL de Firecrawl no debe incluir credenciales')
  const path = url.pathname.replace(/\/+$/, '')
  url.pathname = path.endsWith('/v1') ? `${path}/scrape` : `${path}/v1/scrape`
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
      description: '',
      url: source.url,
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
    ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
  }
  const response = await fetch(firecrawlSearchUrl(row.firecrawl_base_url), {
    method: 'POST',
    headers,
    body: JSON.stringify({
      query,
      limit: 6,
      sources: ['web'],
      country: 'ES',
      timeout: 25_000,
    }),
    cache: 'no-store',
    signal: AbortSignal.timeout(30_000),
  })
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
      }]
    }).slice(0, 6)
  }

  if (response.status !== 404 && response.status !== 405) {
    throw new Error(`Firecrawl respondió HTTP ${response.status}`)
  }

  const searchPage = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`
  const scrapeResponse = await fetch(firecrawlScrapeUrl(row.firecrawl_base_url), {
    method: 'POST',
    headers,
    body: JSON.stringify({ url: searchPage, formats: ['markdown'] }),
    cache: 'no-store',
    signal: AbortSignal.timeout(30_000),
  })
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
  if (!row.finnhub_token_cifrado || !query.trim()) return { market: [], news: [] }

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
    const match = item as { symbol?: unknown; description?: unknown; displaySymbol?: unknown; type?: unknown }
    if (typeof match.symbol !== 'string' || typeof match.description !== 'string') return []
    const type = typeof match.type === 'string' ? match.type : 'Cotizada'
    if (!['Common Stock', 'ETP', 'ADR', 'REIT'].includes(type)) return []
    return [{
      symbol: match.displaySymbol && typeof match.displaySymbol === 'string' ? match.displaySymbol : match.symbol,
      company: match.description,
      exchange: 'Finnhub',
      type,
    }]
  }).slice(0, 3)

  const marketPromise = Promise.all(matches.map(async (match): Promise<FinnhubResult> => {
    const quoteUrl = new URL('https://finnhub.io/api/v1/quote')
    quoteUrl.searchParams.set('symbol', match.symbol)
    quoteUrl.searchParams.set('token', apiKey)
    const quoteResponse = await fetch(quoteUrl, {
      cache: 'no-store',
      signal: AbortSignal.timeout(12_000),
    }).catch(() => null)
    const quote = quoteResponse?.ok
      ? await quoteResponse.json().catch(() => null) as { c?: unknown; dp?: unknown; t?: unknown } | null
      : null
    const price = typeof quote?.c === 'number' && quote.c > 0 ? quote.c : null
    const changePercent = typeof quote?.dp === 'number' ? quote.dp : null
    const timestamp = typeof quote?.t === 'number' && quote.t > 0 ? quote.t * 1000 : Date.now()
    return {
      ...match,
      price,
      changePercent,
      dataAsOf: new Date(timestamp).toISOString(),
      sourceUrl: 'https://finnhub.io/docs/api/quote',
    }
  }))

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

  const [market, news] = await Promise.all([marketPromise, newsPromise])
  return { market, news }
}

async function gatherResearchContext(
  row: typeof configuraciones_fuentes_inversion.$inferSelect | undefined,
  webQuery: string,
  entityQuery: string
): Promise<ResearchContext> {
  if (!row) return { webSources: [], news: [], market: [], sourcesUsed: [], warnings: [] }

  const tasks = [
    row.firecrawl_base_url
      ? searchWithFirecrawl(row, webQuery)
      : Promise.resolve([] as FirecrawlResult[]),
    row.finnhub_token_cifrado && entityQuery.trim()
      ? searchWithFinnhub(row, entityQuery)
      : Promise.resolve({ market: [], news: [] } as FinnhubContext),
    row.newsapi_key_cifrada && entityQuery.trim()
      ? searchWithNewsApi(row, entityQuery)
      : Promise.resolve([] as NewsApiResult[]),
  ] as const

  const [webResult, marketResult, newsResult] = await Promise.allSettled(tasks)
  const warnings: string[] = []
  const webSources = webResult.status === 'fulfilled' ? webResult.value : []
  const finnhubContext = marketResult.status === 'fulfilled' ? marketResult.value : { market: [], news: [] }
  const market = finnhubContext.market
  const newsApiNews = newsResult.status === 'fulfilled' ? newsResult.value : []
  const news = [...finnhubContext.news, ...newsApiNews]
  if (webResult.status === 'rejected') warnings.push('Firecrawl no respondió')
  if (marketResult.status === 'rejected') warnings.push('Finnhub no respondió')
  if (newsResult.status === 'rejected') warnings.push('NewsAPI no respondió')

  return {
    webSources,
    news,
    market,
    sourcesUsed: [
      webSources.length ? 'Firecrawl propio' : '',
      market.length ? 'Finnhub' : '',
      finnhubContext.news.length ? 'Finnhub noticias' : '',
      newsApiNews.length ? 'NewsAPI' : '',
    ].filter(Boolean),
    warnings,
  }
}

function toResearchResult(raw: z.infer<typeof aiResultSchema>, provider: AiProviderConfig, sourcesUsed: string[], warnings: string[]): ResearchResult {
  const leads = raw.candidates.map((candidate, index) => {
    const sourceUrls = candidate.sourceUrls.map(safeSource).filter((source): source is ResearchSource => source !== null)
    return {
      id: `ai-${candidate.ticker.toLowerCase().replace(/[^a-z0-9]+/g, '-') || index}`,
      title: candidate.title,
      subtitle: `${candidate.company} · ${candidate.ticker} · ${candidate.exchange}`,
      category: candidate.category,
      fit: candidate.fit,
      thesis: candidate.thesis,
      evidence: candidate.evidence,
      risks: candidate.risks,
      firstSource: candidate.firstSource,
      stage: candidate.stage,
      ticker: candidate.ticker,
      company: candidate.company,
      exchange: candidate.exchange,
      sourceUrls,
      dataAsOf: candidate.dataAsOf,
    }
  })

  const sourceNote = sourcesUsed.length ? ` · fuentes: ${sourcesUsed.join(' · ')}` : ''
  const warningNote = warnings.length ? ` · avisos: ${warnings.join(' · ')}` : ''
  return {
    title: raw.title,
    summary: raw.summary,
    methodNote: raw.methodNote,
    questions: raw.questions,
    nextStep: raw.nextStep,
    leads,
    engine: provider.engine,
    generatedAt: new Date().toISOString(),
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
  const researchQuery = `${entityQuery || 'empresas cotizadas para investigar'} ${input.mode} inversión fuentes oficiales resultados recientes`
  const researchContext = await gatherResearchContext(sourceSettings, researchQuery, entityQuery)
  if (input.tier === 'premium' && !researchContext.webSources.length) {
    return NextResponse.json(localFallback(input, 'Tu Firecrawl no devolvió resultados web; no se activó ninguna búsqueda de pago.'))
  }

  const userPrompt = JSON.stringify({
    pista: input.query || 'Exploración abierta: encuentra candidatos que encajen con este modo.',
    modo: input.mode,
    horizonte: input.horizon,
    tolerancia: input.risk,
    fechaDeConsulta: new Date().toISOString(),
    fuentesGratuitas: {
      web: researchContext.webSources,
      mercadoFinnhub: researchContext.market,
      noticiasNewsApi: researchContext.news,
      limitaciones: researchContext.warnings,
    },
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
          { role: 'system', content: systemPrompt(input.tier) },
          { role: 'user', content: userPrompt },
        ],
        max_tokens: 3200,
        reasoning: { effort: 'low', exclude: true },
      }
      : {
      model: provider.model,
      messages: [
        { role: 'system', content: systemPrompt(input.tier) },
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
        { role: 'system', content: `${systemPrompt(input.tier)}\n\n${JSON_OUTPUT_CONTRACT}` },
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
      return NextResponse.json(toResearchResult(validated.data, successfulProvider, researchContext.sourcesUsed, researchContext.warnings))
    }

    return NextResponse.json(localFallback(input, lastFailure))
  } catch {
    return NextResponse.json(localFallback(input, `No se pudo conectar con ${provider.label} · ${provider.model}; se muestra el marco local.`))
  }
}
