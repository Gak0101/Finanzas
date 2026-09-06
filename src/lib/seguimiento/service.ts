import { and, desc, eq } from 'drizzle-orm'
import ExcelJS from 'exceljs'
import { db } from '@/lib/db'
import {
  inversiones_excel_filas,
  inversiones_posiciones,
  inversiones_seguimiento_estado,
  inversiones_seguimiento_runs,
} from '@/lib/db/schema'
import { fetchYahooClose } from '@/lib/inversiones/marketData'
import { getMarketById, getMarketSnapshot } from '@/lib/mercados/horarios'
import { madridSlot, safeUrl, triage } from '@/lib/seguimiento/policy'
import type { Candidate, FollowupItem, FollowupReport, Source } from '@/lib/seguimiento/types'

const MASTER_SHEET = 'Maestro_Lynch'
const MAX_CANDIDATES = 80
const NEWSLETTER_URL = process.env.SVI_NEWSLETTER_URL?.trim() || 'https://svinvesting.substack.com/feed'

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
  const market = text(row.mercado || row['Ticker / mercado'] || ticker)
  const url = text(row['Fuente oficial'] || row['Fuente oficial / empresa'] || row['Fuente'] || row.url)
  return {
    symbol: ticker.split('/')[0].trim().toUpperCase(),
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
  const workbook = new ExcelJS.Workbook()
  await workbook.xlsx.load(buffer as never)
  let count = 0
  const now = new Date().toISOString()
  for (const worksheet of workbook.worksheets) {
    const rows: Record<string, unknown>[] = []
    let headers: string[] = []
    worksheet.eachRow((row, rowNumber) => {
      const values = Array.isArray(row.values) ? row.values.slice(1) : []
      const normalized = values.map(value => text(value))
      if (normalized.some(value => /ticker|empresa|company/i.test(value)) && normalized.filter(Boolean).length >= 2) {
        headers = normalized
        return
      }
      if (headers.length > 0 && normalized.some(Boolean)) {
        const record: Record<string, unknown> = { __row: rowNumber }
        headers.forEach((header, index) => { if (header) record[header] = values[index] })
        const candidate = parseRow(record)
        if (candidate) rows.push(record)
      }
    })
    for (const record of rows) {
      const candidate = parseRow(record)
      if (!candidate) continue
      const rowNumber = Number(record.__row)
      const tipo = rowNumber >= 869 ? 'deep' : 'watchlist'
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

async function buildReport(userId: number): Promise<FollowupReport> {
  const [candidates, newsletter] = await Promise.all([loadCandidates(userId), readNewsletter()])
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
  return {
    asOf: new Date().toISOString(), market: currentMarket(),
    summary: `Seguimiento de ${items.length} activos: ${items.filter(item => item.decision === 'revisar-entrada').length} en umbral, ${items.filter(item => item.decision === 'revisar-posicion').length} posiciones y ${items.filter(item => item.decision === 'esperar').length} en espera. No es una orden de compra ni sustituye verificar la tesis con fuentes primarias.`,
    items, warnings, newsletter: { subject: newsletter.subject, date: newsletter.date, status: newsletter.status },
    analysis: `Corte ${new Date().toISOString()}. Fuente principal de precio: Yahoo Finance cuando devuelve cotización. Excel y SVI aportan contexto pendiente de contraste.`,
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
