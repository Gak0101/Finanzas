import { and, desc, eq } from 'drizzle-orm'
import ExcelJS from 'exceljs'
import JSZip from 'jszip'
import { db } from '@/lib/db'
import {
  inversiones_excel_filas,
  inversiones_posiciones,
  inversiones_seguimiento_estado,
  inversiones_seguimiento_runs,
} from '@/lib/db/schema'
import { fetchYahooClose } from '@/lib/inversiones/marketData'
import { getMarketById, getMarketSnapshot } from '@/lib/mercados/horarios'
import { getAiCredentials } from '@/lib/ai/provider-config'
import { buildOpenRouterModelChain, normalizeOpenRouterFreeModel } from '@/lib/ai/model-routing'
import { getLynchBookContext } from '@/lib/buscador-acciones/lynchBook'
import { madridSlot, safeUrl, triage } from '@/lib/seguimiento/policy'
import type { Candidate, FollowupItem, FollowupReport, Source } from '@/lib/seguimiento/types'

const MASTER_SHEET = 'Maestro_Lynch'
const MAX_CANDIDATES = 160
const NEWSLETTER_URL = process.env.SVI_NEWSLETTER_URL?.trim() || 'https://svinvesting.substack.com/feed'

async function loadWorkbook(buffer: Buffer) {
  const workbook = new ExcelJS.Workbook()
  try {
    await workbook.xlsx.load(buffer as never)
    return workbook
  } catch {
    // El Excel maestro generado por Artifact Tool usa el prefijo `x:` en XML.
    // ExcelJS espera etiquetas sin ese prefijo; normalizamos solo la copia en
    // memoria y conservamos intacto el archivo original.
    const zip = await JSZip.loadAsync(buffer)
    const xmlFiles = Object.keys(zip.files).filter(name => /(?:\.xml|\.rels)$/i.test(name))
    await Promise.all(xmlFiles.map(async name => {
      const entry = zip.file(name)
      if (!entry) return
      const xml = await entry.async('string')
      zip.file(name, xml.replace(/(<\/?)(?:x:)/g, '$1')
        // ExcelJS no puede reconciliar los comentarios de Artifact Tool con
        // sus relaciones absolutas; el texto de las celdas se conserva.
        .replace(/<Relationship\b[^>]*(?:comments|threadedComment|vmlDrawing)[^>]*\/>/gi, '')
        .replace(/<legacyDrawing\b[^>]*\/>/gi, '')
        .replace(/<tableParts\b[\s\S]*?<\/tableParts>/gi, ''))
    }))
    await workbook.xlsx.load(await zip.generateAsync({ type: 'nodebuffer' }) as never)
    return workbook
  }
}

function text(value: unknown) { return value === null || value === undefined ? '' : String(value).trim() }
function number(value: unknown) {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  const parsed = Number(text(value).replace(/[%€$£,]/g, '').replace(',', '.'))
  return Number.isFinite(parsed) ? parsed : null
}
function source(label: string, url: string, period?: string): Source | null {
  const safe = safeUrl(url)
  return safe ? { label, url: safe, ...(period ? { period } : {}) } : null
}
function json(value: unknown): Record<string, unknown> {
  if (typeof value !== 'string') return {}
  try { const parsed = JSON.parse(value); return parsed && typeof parsed === 'object' ? parsed as Record<string, unknown> : {} } catch { return {} }
}
function marketTicker(ticker: string, market: string) {
  const raw = ticker.split('/')[0]?.trim().toUpperCase() || ticker.trim().toUpperCase()
  if (!raw) return null
  if (/\./.test(raw)) return raw
  const m = market.toLowerCase()
  if (m.includes('lse') || m.includes('aim')) return `${raw}.L`
  if (m.includes('xetra') || m.includes('frankfurt')) return `${raw}.DE`
  if (m.includes('bme') || m.includes('madrid')) return `${raw}.MC`
  return raw
}
function parseRow(row: Record<string, unknown>): Candidate | null {
  const ticker = text(row.ticker || row['Ticker / mercado'] || row['Ticker'])
  const name = text(row.empresa || row.Empresa || row.company || row.Empresa)
  if (!ticker || !name || /ticker|mercado|empresa/i.test(`${ticker} ${name}`)) return null
  const rawSymbol = ticker.split('/')[0]?.trim() || ''
  // Evita convertir títulos y notas de las secciones del Excel en candidatos.
  if (!/^[A-Za-z0-9][A-Za-z0-9.-]{0,9}$/.test(rawSymbol)) return null
  const market = text(row.mercado || row['Ticker / mercado'] || ticker)
  const url = text(row['Fuente oficial'] || row['Fuente oficial / empresa'] || row['Fuente'] || row.url)
  return {
    symbol: rawSymbol.toUpperCase(),
    marketSymbol: marketTicker(ticker, market), name,
    held: false,
    rank: number(row.orden || row['Orden profundo'] || row.Posición || row.Posicion || row.position),
    rating: number(row.rating || row['Rating global'] || row['Rating profundo'] || row.Rating),
    thesis: text(row.tesis || row.Tesis || row['Tesis / historia'] || row['Estado / veredicto']),
    risks: text(row.riesgos || row['Riesgos / invalidación'] || row['Riesgos + invalidación']),
    nextReview: text(row['Próxima revisión'] || row['Próxima revisión / catalizador'] || row['Siguiente fase'] || row['Próximo hito']) || null,
    targetEur: number(row['Zona 1 EUR'] || row['Entrada EUR'] || row['Precio objetivo EUR']),
    source: url,
  }
}

export async function importWorkbook(userId: number, buffer: Buffer) {
  const workbook = await loadWorkbook(buffer)
  let count = 0
  const now = new Date().toISOString()
  for (const worksheet of workbook.worksheets) {
    const rows: Record<string, unknown>[] = []
    let headers: string[] = []
    worksheet.eachRow((row, rowNumber) => {
      const values = Array.isArray(row.values) ? row.values.slice(1) : []
      const normalized = values.map(value => text(value))
      const headerValues = normalized.map(value => value.toLowerCase())
      const looksLikeHeader = headerValues.some(value => ['ticker', 'ticker / mercado', 'empresa', 'company'].includes(value))
      if (looksLikeHeader && normalized.filter(Boolean).length >= 2) {
        headers = normalized
        return
      }
      if (headers.length > 0 && normalized.some(Boolean)) {
        const record: Record<string, unknown> = { __row: rowNumber }
        headers.forEach((header, index) => { if (header) record[header] = values[index] })
        // Conservamos también las filas de contexto, notas y próximos hitos.
        // Solo las filas identificables como empresa/ticker entran después en
        // el universo de candidatos del informe.
        rows.push(record)
      }
    })
    for (const record of rows) {
      const candidate = parseRow(record)
      const rowNumber = Number(record.__row)
      const tipo = candidate ? (rowNumber >= 869 ? 'deep' : 'watchlist') : 'context'
      await db.insert(inversiones_excel_filas).values({
        usuario_id: userId, hoja: worksheet.name, fila: rowNumber, tipo,
        datos: JSON.stringify(record), imported_at: now,
      }).onConflictDoUpdate({
        target: [inversiones_excel_filas.usuario_id, inversiones_excel_filas.hoja, inversiones_excel_filas.fila],
        set: { tipo, datos: JSON.stringify(record), imported_at: now },
      })
      count += 1
    }
  }
  return count
}

async function loadCandidates(userId: number) {
  const [positions, excelRows] = await Promise.all([
    db.query.inversiones_posiciones.findMany({ where: eq(inversiones_posiciones.usuario_id, userId) }),
    db.query.inversiones_excel_filas.findMany({ where: eq(inversiones_excel_filas.usuario_id, userId), orderBy: [desc(inversiones_excel_filas.imported_at), desc(inversiones_excel_filas.fila)] }),
  ])
  const bySymbol = new Map<string, Candidate>()
  for (const row of excelRows) {
    if (row.hoja !== MASTER_SHEET && excelRows.some(item => item.hoja === MASTER_SHEET)) continue
    const candidate = parseRow(json(row.datos))
    if (candidate && !bySymbol.has(candidate.symbol)) bySymbol.set(candidate.symbol, candidate)
  }
  for (const position of positions) {
    const symbol = text(position.ticker).toUpperCase()
    if (!symbol) continue
    const existing = bySymbol.get(symbol)
    bySymbol.set(symbol, {
      symbol, marketSymbol: position.market_symbol || position.price_ticker || marketTicker(symbol, position.tipo),
      name: position.activo, held: true, rank: existing?.rank ?? null, rating: existing?.rating ?? null,
      thesis: existing?.thesis || text(position.nota) || 'Posición actual: revisar la tesis y la exposición.',
      risks: existing?.risks || 'Riesgos y señales de invalidación pendientes de actualizar.',
      nextReview: existing?.nextReview || null, targetEur: existing?.targetEur ?? position.objetivo_precio ?? null,
      source: existing?.source || position.fuente_url || '',
    })
  }
  return [...bySymbol.values()].sort((a, b) => (a.rank ?? 9999) - (b.rank ?? 9999) || (b.rating ?? 0) - (a.rating ?? 0)).slice(0, MAX_CANDIDATES)
}

async function readNewsletter() {
  try {
    const response = await fetch(NEWSLETTER_URL, { cache: 'no-store', headers: { Accept: 'application/xml,text/xml,text/plain' } })
    if (!response.ok) return { subject: null, date: null, status: `SVI no disponible (HTTP ${response.status})` }
    const xml = await response.text()
    const item = xml.match(/<item[\s\S]*?<\/item>/i)?.[0] || xml.match(/<entry[\s\S]*?<\/entry>/i)?.[0] || ''
    const pick = (tag: string) => text(item.match(new RegExp(`<${tag}(?:[^>]*)>([\\s\\S]*?)<\\/${tag}>`, 'i'))?.[1]).replace(/<!\[CDATA\[|\]\]>/g, '')
    const subject = pick('title') || null
    const date = pick('pubDate') || pick('published') || pick('updated') || null
    const link = pick('link') || NEWSLETTER_URL
    return { subject, date, status: subject ? 'SVI RSS leído; no es la bandeja de Gmail.' : 'SVI RSS sin entrada legible.', link }
  } catch { return { subject: null, date: null, status: 'SVI RSS no accesible desde el VPS.' } }
}

type NewsItem = { title: string; url: string; date: string }

function xmlValue(block: string, tag: string) {
  return text(block.match(new RegExp(`<${tag}(?:[^>]*)>([\\s\\S]*?)<\\/${tag}>`, 'i'))?.[1])
    .replace(/<!\[CDATA\[|\]\]>/g, '')
    .replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;/g, "'")
}

async function readGeneralNews(symbol: string): Promise<NewsItem[]> {
  const feedUrl = `https://feeds.finance.yahoo.com/rss/2.0/headline?s=${encodeURIComponent(symbol)}&region=US&lang=en-US`
  try {
    const response = await fetch(feedUrl, { cache: 'no-store', headers: { Accept: 'application/rss+xml,application/xml,text/xml' } })
    if (!response.ok) return []
    const xml = await response.text()
    return [...xml.matchAll(/<item[\s\S]*?<\/item>/gi)].slice(0, 3).map(match => match[0]).map(block => ({
      title: xmlValue(block, 'title'), url: safeUrl(xmlValue(block, 'link')) || '', date: xmlValue(block, 'pubDate'),
    })).filter(item => item.title && item.url)
  } catch { return [] }
}

function currentMarket() {
  const market = getMarketById('nasdaq-nyse')
  const snap = market ? getMarketSnapshot(market, new Date()) : null
  return { status: snap?.statusLabel || 'No disponible', nextOpen: snap?.nextEventAt?.toISOString() || null }
}

function chatCompletionsUrl(configured: string, fallback: string) {
  const base = (configured || fallback).replace(/\/+$/, '')
  return base.endsWith('/v1') ? `${base}/chat/completions` : `${base}/v1/chat/completions`
}

function outputText(payload: unknown) {
  if (!payload || typeof payload !== 'object') return null
  const choices = (payload as { choices?: unknown }).choices
  if (!Array.isArray(choices)) return null
  for (const choice of choices) {
    if (!choice || typeof choice !== 'object') continue
    const content = (choice as { message?: { content?: unknown } }).message?.content
    if (typeof content === 'string' && content.trim()) return content.trim()
  }
  return null
}

async function generateLynchAnalysis(
  userId: number,
  items: FollowupItem[],
  newsletter: Awaited<ReturnType<typeof readNewsletter>>,
  lynchContext: Awaited<ReturnType<typeof getLynchBookContext>>,
) {
  const credentials = await getAiCredentials(userId)
  if (!credentials) return null

  const configuredModel = credentials.provider === 'openrouter'
    ? normalizeOpenRouterFreeModel(credentials.models.portfolioAnalysis)
    : credentials.models.portfolioAnalysis
  const models = credentials.provider === 'openrouter' ? buildOpenRouterModelChain(configuredModel) : [configuredModel]
  const focusItems = items.slice(0, 30).map(item => ({
    ticker: item.symbol, empresa: item.name, cartera: item.held, decision: item.decision,
    precioOrigen: item.price, divisa: item.currency, precioEur: item.priceEur,
    ratingExcel: item.rating, ordenExcel: item.rank, tesis: item.thesis, riesgos: item.risks,
    siguienteRevision: item.nextReview, noticias: item.news,
    fuentes: item.sources.map(itemSource => itemSource.url),
  }))
  const system = `Eres el analista diario de una cartera y watchlist siguiendo un marco inspirado en Peter Lynch.
Usa el contexto interno indexado como criterio de razonamiento, pero no cites ni reproduzcas el libro literalmente.
Los datos actuales solo pueden proceder del contexto JSON recibido: Excel, cotizaciones, SVI y fuentes externas.
Separa hechos, cálculos e interpretación. Marca mentalmente las fuentes como [SVI], [OFICIAL EXTERNA], [EXTERNA] o [CALCULADO].
No inventes resultados, fechas, múltiplos ni noticias. No emitas órdenes automáticas de compra o venta.
Redacta en español y termina cada idea accionable con el dato que hay que revisar después.
Devuelve texto breve con estas secciones: Lectura Lynch; Noticias y cambios; Cartera; Watchlist; Próximos controles.`
  const user = JSON.stringify({
    fecha: new Date().toISOString(), mercado: currentMarket(),
    newsletter: { asunto: newsletter.subject, fecha: newsletter.date, estado: newsletter.status },
    contextoLynch: { modo: lynchContext.mode, paginas: lynchContext.pages, extractos: lynchContext.text },
    valores: focusItems,
  })
  const endpoint = chatCompletionsUrl(
    credentials.provider === 'openrouter' ? process.env.OPENROUTER_BASE_URL ?? '' : process.env.OPENAI_BASE_URL ?? process.env.OPENAI_API_BASE ?? '',
    credentials.provider === 'openrouter' ? 'https://openrouter.ai/api/v1' : 'https://api.openai.com/v1',
  )

  for (const model of models) {
    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${credentials.apiKey}`,
          'Content-Type': 'application/json',
          ...(credentials.provider === 'openrouter' ? {
            'HTTP-Referer': process.env.OPENROUTER_SITE_URL ?? process.env.NEXTAUTH_URL ?? 'http://localhost:3000',
            'X-OpenRouter-Title': process.env.OPENROUTER_APP_NAME ?? 'Finanzas · Seguimiento Lynch',
          } : {}),
        },
        body: JSON.stringify({ model, messages: [{ role: 'system', content: system }, { role: 'user', content: user }], max_tokens: 2200 }),
        cache: 'no-store', signal: AbortSignal.timeout(35_000),
      })
      if (!response.ok) continue
      const text = outputText(await response.json().catch(() => null))
      if (text) return { text, provider: `${credentials.provider} · ${model}` }
    } catch {
      // El informe determinista se conserva si el proveedor no responde.
    }
  }
  return null
}

async function buildReport(userId: number): Promise<FollowupReport> {
  const [candidates, newsletter] = await Promise.all([loadCandidates(userId), readNewsletter()])
  const lynchContext = await getLynchBookContext('seguimiento diario cartera beneficios ventas caja deuda flujo de caja valoracion PER vender noticias')
  // El precio se consulta para todo el universo; las noticias se limitan a las
  // primeras 30 fichas ordenadas para mantener el worker ligero en el VPS.
  const newsEntries = await Promise.all(candidates.slice(0, 30).map(async candidate => [candidate.symbol, await readGeneralNews(candidate.marketSymbol || candidate.symbol)] as const))
  const newsBySymbol = new Map(newsEntries)
  const warnings: string[] = []
  if (candidates.length === 0) warnings.push('No hay filas de watchlist importadas ni posiciones para analizar. Importa el Excel maestro.')
  if (!newsletter.subject) warnings.push(newsletter.status)
  if (NEWSLETTER_URL.includes('substack.com')) warnings.push('La newsletter se lee por RSS público del SVI; el VPS no tiene acceso directo a tu Gmail.')
  const items = await Promise.all(candidates.map(async candidate => {
    let quote: Awaited<ReturnType<typeof fetchYahooClose>> | null = null
    let quoteError: string | null = null
    if (candidate.marketSymbol) {
      try { quote = await fetchYahooClose(candidate.marketSymbol) } catch { quoteError = 'Cotización no disponible desde Yahoo Finance.' }
    } else quoteError = 'Símbolo de mercado no identificado.'
    if (quoteError) warnings.push(`${candidate.symbol}: ${quoteError}`)
    const stale = !quote?.asOf || Date.now() - new Date(quote.asOf).getTime() > 8 * 24 * 60 * 60 * 1000
    // Los umbrales del Excel están en EUR; la cotización nativa puede venir en USD.
    // `price` es la conversión EUR que devuelve fetchYahooClose.
    const decision = triage(candidate.held, quote?.price ?? null, candidate.targetEur, stale)
    const primary = source(candidate.source.startsWith('http') ? '[OFICIAL EXTERNA]' : '[EXTERNA]', candidate.source, 'periodo del Excel no actualizado')
    const news = newsBySymbol.get(candidate.symbol) || []
    const newsSources = news.map(item => source('[EXTERNA] Noticias Yahoo', item.url)).filter(Boolean) as Source[]
    return {
      symbol: candidate.symbol, name: candidate.name, held: candidate.held, decision: decision.decision,
      reason: decision.reason, price: quote?.nativePrice ?? null, currency: quote?.nativeCurrency || null,
      priceEur: quote?.price ?? null, quoteAt: quote?.asOf || null, change: null,
      nextReview: candidate.nextReview, sources: [primary, source('[EXTERNA] Cotización', quote?.sourceUrl || ''), ...newsSources].filter(Boolean) as Source[],
      rank: candidate.rank, rating: candidate.rating, thesis: candidate.thesis, risks: candidate.risks,
      news, metrics: [],
    } satisfies FollowupItem
  }))
  const complete = items.filter(item => item.price !== null).length
  if (complete < items.length) warnings.push(`${items.length - complete} activos no tienen cotización verificable. Lee los avisos antes de decidir.`)
  const aiAnalysis = await generateLynchAnalysis(userId, items, newsletter, lynchContext)
  if (!aiAnalysis) warnings.push('No se generó análisis LLM; se conserva el seguimiento determinista y el contexto Lynch indexado.')
  return {
    asOf: new Date().toISOString(), market: currentMarket(),
    summary: `Seguimiento de ${items.length} activos: ${items.filter(item => item.decision === 'revisar-entrada').length} en umbral, ${items.filter(item => item.decision === 'revisar-posicion').length} posiciones y ${items.filter(item => item.decision === 'esperar').length} en espera. Contexto Lynch ${lynchContext.mode === 'indexed' ? 'indexado' : 'de respaldo'}; no es una orden de compra ni sustituye verificar la tesis con fuentes primarias.`,
    items, warnings, newsletter: { subject: newsletter.subject, date: newsletter.date, status: newsletter.status },
    lynchContext: { mode: lynchContext.mode, pages: lynchContext.pages, source: 'src/lib/buscador-acciones/lynch-book.md + lynch-book-index.json' },
    analysis: `${aiAnalysis ? `Modelo ${aiAnalysis.provider}:\n${aiAnalysis.text}\n\n` : ''}Corte ${new Date().toISOString()}. Fuente principal de precio: Yahoo Finance cuando devuelve cotización. Excel, SVI y noticias externas aportan contexto pendiente de contraste.`,
  }
}

export async function createRun(userId: number, requestedSlot?: string) {
  const now = new Date()
  const slotInfo = madridSlot(now)
  const slot = requestedSlot || slotInfo?.slot || 'manual'
  const runKey = `${now.toISOString().slice(0, 10)}:${slot}`
  const existing = await db.query.inversiones_seguimiento_runs.findFirst({ where: and(eq(inversiones_seguimiento_runs.usuario_id, userId), eq(inversiones_seguimiento_runs.run_key, runKey)) })
  if (existing && existing.status === 'running') return existing
  if (existing && requestedSlot) return existing
  const [run] = await db.insert(inversiones_seguimiento_runs).values({ usuario_id: userId, run_key: requestedSlot ? runKey : `${runKey}:${now.getTime()}`, slot, status: 'running', started_at: now.toISOString() }).returning()
  void executeRun(run.id, userId)
  return run
}
export async function executeRun(runId: number, userId: number) {
  try {
    const report = await buildReport(userId)
    await db.update(inversiones_seguimiento_runs).set({ status: report.warnings.some(warning => /no disponible|no accesible|No hay/i.test(warning)) ? 'partial' : 'complete', finished_at: new Date().toISOString(), report: JSON.stringify(report), error: null }).where(and(eq(inversiones_seguimiento_runs.id, runId), eq(inversiones_seguimiento_runs.usuario_id, userId)))
  } catch (error) {
    await db.update(inversiones_seguimiento_runs).set({ status: 'failed', finished_at: new Date().toISOString(), error: error instanceof Error ? error.message : 'Error desconocido' }).where(and(eq(inversiones_seguimiento_runs.id, runId), eq(inversiones_seguimiento_runs.usuario_id, userId)))
  }
}
export async function listRuns(userId: number) {
  const rows = await db.query.inversiones_seguimiento_runs.findMany({ where: eq(inversiones_seguimiento_runs.usuario_id, userId), orderBy: [desc(inversiones_seguimiento_runs.started_at)], limit: 30 })
  return rows.map(row => ({ id: row.id, status: row.status, slot: row.slot, startedAt: row.started_at, finishedAt: row.finished_at, error: row.error, report: row.report ? JSON.parse(row.report) : null }))
}
export async function schedulerState(userId: number) {
  const state = await db.query.inversiones_seguimiento_estado.findFirst({ where: eq(inversiones_seguimiento_estado.usuario_id, userId) })
  return { enabled: process.env.SEGUIMIENTO_ENABLED === 'true', lastHeartbeat: state?.heartbeat_at || null, schedule: '08:00 y 14:00 · Europe/Madrid' }
}
export async function heartbeat(userId: number) {
  const now = new Date().toISOString()
  await db.insert(inversiones_seguimiento_estado).values({ usuario_id: userId, heartbeat_at: now }).onConflictDoUpdate({ target: inversiones_seguimiento_estado.usuario_id, set: { heartbeat_at: now } })
  const slot = madridSlot(new Date())
  if (!slot) return { triggered: false, slot: null }
  const run = await createRun(userId, slot.slot)
  return { triggered: true, slot: slot.slot, runId: run.id }
}
export { loadCandidates }
