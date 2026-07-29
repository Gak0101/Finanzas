import { createHash } from 'node:crypto'
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { getAuthenticatedUserId, isNextResponse } from '@/lib/api-utils'
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
})

const candidateSchema = z.object({
  ticker: z.string().min(1).max(20),
  company: z.string().min(1).max(140),
  exchange: z.string().min(1).max(80),
  title: z.string().min(1).max(120),
  subtitle: z.string().min(1).max(180),
  category: z.enum(['slow-grower', 'stalwart', 'fast-grower', 'cyclical', 'turnaround', 'asset-play']),
  fit: z.number().int().min(0).max(100),
  thesis: z.string().min(1).max(600),
  evidence: z.array(z.string().min(1).max(220)).min(2).max(4),
  risks: z.array(z.string().min(1).max(220)).min(2).max(4),
  firstSource: z.string().min(1).max(180),
  stage: z.enum(['Universo', 'Preselección', 'Revisión']),
  sourceUrls: z.array(z.object({
    label: z.string().min(1).max(120),
    url: z.string().url(),
  })).min(1).max(4),
  dataAsOf: z.string().min(1).max(80),
})

const aiResultSchema = z.object({
  title: z.string().min(1).max(180),
  summary: z.string().min(1).max(700),
  methodNote: z.string().min(1).max(500),
  questions: z.array(z.string().min(1).max(240)).min(3).max(5),
  nextStep: z.string().min(1).max(300),
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

const SYSTEM_PROMPT = `Eres un asistente de investigación bursátil para una aplicación educativa en español.

Tu marco pedagógico está inspirado en las ideas generales de "Un paso por delante de Wall Street" de Peter Lynch: observar negocios entendibles, clasificar la empresa en una de seis categorías (slow grower, stalwart, fast grower, cyclical, turnaround o asset play), comprobar la historia con los números, pagar una valoración razonable y definir qué invalidaría la tesis.

Reglas obligatorias:
- No eres asesor financiero. Nunca digas comprar, vender, mantener, entrada, precio objetivo ni asignes una probabilidad de conseguir 10x.
- Devuelve candidatos para investigar, no recomendaciones. El campo fit es solo encaje con el marco de lectura, no probabilidad ni puntuación de rentabilidad.
- Busca empresas cotizadas reales y actuales. Para IPO usa únicamente ofertas o empresas con información pública verificable; no presentes oportunidades pre-IPO privadas.
- Usa la búsqueda web antes de responder. Prioriza documentos primarios: SEC/EDGAR y prospectos S-1/F-1 para EEUU, documentos oficiales de la bolsa o regulador, informes anuales, resultados y relaciones con inversores. Usa prensa financiera solo para contexto.
- Cada candidato debe tener al menos una URL pública y concreta que permita verificar la afirmación. Si no puedes verificar el ticker o la fuente, no lo incluyas.
- Señala la fecha de los datos como texto y recuerda que la cotización y la tesis pueden cambiar.
- No copies texto del libro. Aplícalo como checklist de razonamiento propio.
- Responde exclusivamente con el JSON solicitado, sin markdown.`

function responsesUrl() {
  const configured = process.env.OPENAI_BASE_URL ?? process.env.OPENAI_API_BASE
  const base = (configured || 'https://api.openai.com/v1').replace(/\/+$/, '')
  return base.endsWith('/v1') ? `${base}/responses` : `${base}/v1/responses`
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
  const response = payload as { output_text?: unknown; output?: unknown }
  if (typeof response.output_text === 'string') return response.output_text
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

function localFallback(input: ResearchInput, providerNote: string, engine: ResearchEngine = 'local-fallback') {
  return {
    ...generateResearchResult(input),
    engine,
    providerNote,
  } satisfies ResearchResult
}

function toResearchResult(raw: z.infer<typeof aiResultSchema>): ResearchResult {
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

  return {
    title: raw.title,
    summary: raw.summary,
    methodNote: raw.methodNote,
    questions: raw.questions,
    nextStep: raw.nextStep,
    leads,
    engine: 'openai-web',
    generatedAt: new Date().toISOString(),
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
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey || process.env.BUSCADOR_ACCIONES_DISABLE_AI === '1') {
    const providerNote = process.env.BUSCADOR_ACCIONES_DISABLE_AI === '1'
      ? 'Proveedor IA desactivado para esta prueba: se muestra el marco local sin datos actuales.'
      : 'Proveedor IA no configurado: se muestra el marco local sin datos actuales.'
    return NextResponse.json(localFallback(input, providerNote))
  }

  const requestPayload = {
    model: process.env.BUSCADOR_ACCIONES_MODEL ?? process.env.OPENAI_MODEL ?? 'gpt-5.6-luna',
    store: false,
    safety_identifier: safetyIdentifier(authResult.userId),
    tools: [{ type: 'web_search', search_context_size: 'high' }],
    input: [
      { role: 'system', content: [{ type: 'input_text', text: SYSTEM_PROMPT }] },
      {
        role: 'user',
        content: [{
          type: 'input_text',
          text: JSON.stringify({
            pista: input.query || 'Exploración abierta: encuentra candidatos que encajen con este modo.',
            modo: input.mode,
            horizonte: input.horizon,
            tolerancia: input.risk,
            fechaDeConsulta: new Date().toISOString(),
          }),
        }],
      },
    ],
    text: {
      format: {
        type: 'json_schema',
        name: 'lynch_stock_research',
        description: 'Candidatos bursátiles investigables, con riesgos y fuentes verificables.',
        strict: true,
        schema: RESPONSE_SCHEMA,
      },
    },
  }

  try {
    const response = await fetch(responsesUrl(), {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestPayload),
      cache: 'no-store',
    })

    if (!response.ok) {
      return NextResponse.json(localFallback(input, 'La consulta IA no estuvo disponible; se muestra el marco local para no inventar datos.'))
    }

    const payload = await response.json().catch(() => null)
    const text = extractOutputText(payload)
    if (!text) {
      return NextResponse.json(localFallback(input, 'La respuesta IA no pudo convertirse en una ficha verificable; se muestra el marco local.'))
    }

    let candidatePayload: unknown
    try {
      candidatePayload = JSON.parse(text)
    } catch {
      return NextResponse.json(localFallback(input, 'La respuesta IA no llegó en el formato verificable esperado; se muestra el marco local.'))
    }

    const validated = aiResultSchema.safeParse(candidatePayload)
    if (!validated.success) {
      return NextResponse.json(localFallback(input, 'La respuesta IA no superó la validación de fuentes y estructura; se muestra el marco local.'))
    }

    return NextResponse.json(toResearchResult(validated.data))
  } catch {
    return NextResponse.json(localFallback(input, 'No se pudo conectar con la consulta IA; se muestra el marco local.'))
  }
}
