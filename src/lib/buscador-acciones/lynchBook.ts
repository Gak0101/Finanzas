import { readFile } from 'node:fs/promises'
import path from 'node:path'
import type { LynchResearchProfile } from './lynchFramework'

type LynchBookPage = {
  page: number
  part: string
  heading: string
  start: number
  end: number
  topics: string[]
}

type LynchBookIndex = {
  title: string
  source: string
  pages: LynchBookPage[]
}

type LynchBookData = {
  text: string
  index: LynchBookIndex
}

export type LynchBookContext = {
  text: string
  mode: 'indexed' | 'fallback'
  pages: number[]
}

const BOOK_MARKDOWN_PATH = path.join(process.cwd(), 'src', 'lib', 'buscador-acciones', 'lynch-book.md')
const BOOK_INDEX_PATH = path.join(process.cwd(), 'src', 'lib', 'buscador-acciones', 'lynch-book-index.json')

const FALLBACK_REFERENCE = `
REFERENCIA LOCAL DE LYNCH
El asistente sigue un marco de investigación inspirado en ideas generales de Peter Lynch: empezar por una historia de negocio que el usuario pueda entender, clasificar provisionalmente la empresa, comprobar una serie de beneficios y ventas, estudiar caja, deuda, acciones y valoración en contexto, y escribir de antemano qué datos confirmarían o romperían la tesis. Las seis categorías son slow grower, stalwart, fast grower, cyclical, turnaround y asset play. No conviertas la categoría, el PER bajo ni una caída del precio en una recomendación. Separa hechos con fecha y fuente de hipótesis, y formula condiciones de revisión en vez de órdenes automáticas.
`

let bookDataPromise: Promise<LynchBookData | null> | null = null

function normalizeEol(value: string) {
  return value.replace(/\r\n?/g, '\n')
}

function normalize(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
}

function loadBookData() {
  if (!bookDataPromise) {
    bookDataPromise = Promise.all([
      readFile(BOOK_MARKDOWN_PATH, 'utf8'),
      readFile(BOOK_INDEX_PATH, 'utf8'),
    ])
      .then(([rawText, indexText]) => {
        const text = normalizeEol(rawText)
        const index = JSON.parse(indexText) as LynchBookIndex
        if (!Array.isArray(index.pages) || !index.pages.length) throw new Error('Índice Lynch vacío')
        const valid = index.pages.every((page, position) => (
          Number.isInteger(page.start)
          && Number.isInteger(page.end)
          && page.start >= 0
          && page.end > page.start
          && page.end <= text.length
          && (position === 0 || page.start >= index.pages[position - 1].end)
        ))
        if (!valid) throw new Error('Offsets del índice Lynch no válidos')
        return { text, index }
      })
      .catch(() => {
        bookDataPromise = null
        return null
      })
  }
  return bookDataPromise
}

function profileTerms(profile?: LynchResearchProfile) {
  if (!profile) return []
  const categoryTerms: Record<LynchResearchProfile['category'], string[]> = {
    'slow-grower': ['slow grower', 'lento', 'dividendo', 'caja'],
    stalwart: ['stalwart', 'estable', 'grande', 'defensiva', 'per'],
    'fast-grower': ['alto crecimiento', 'crecimiento', 'beneficios', 'bpa', 'expansion'],
    cyclical: ['ciclica', 'ciclico', 'inventarios', 'oferta', 'demanda', 'ciclo'],
    turnaround: ['recuperacion', 'turnaround', 'deuda', 'liquidez', 'reestructuracion'],
    'asset-play': ['activos', 'valor contable', 'catalizador', 'inmuebles'],
    undecided: [],
  }
  const focusTerms: Record<string, string[]> = {
    growth: ['crecimiento', 'beneficios', 'ventas', 'bpa'],
    profitability: ['margen', 'rentabilidad', 'beneficio', 'roe'],
    'cash-flow': ['cash flow', 'flujo de caja', 'caja'],
    'balance-sheet': ['deuda', 'balance', 'liquidez', 'caja'],
    valuation: ['per', 'valoracion', 'ratio', 'precio'],
    dilution: ['acciones emitidas', 'dilucion', 'opciones', 'acciones'],
  }
  return [
    ...categoryTerms[profile.category],
    ...profile.metricFocus.flatMap((focus) => focusTerms[focus] ?? []),
  ]
}

function searchTerms(query: string, profile?: LynchResearchProfile) {
  const stopWords = new Set(['para', 'como', 'esta', 'este', 'tiene', 'desde', 'sobre', 'quiero', 'empresa', 'acciones', 'investigar'])
  const words = normalize([
    query,
    profile?.observation,
    profile?.business,
    profile?.thesis,
    profile?.invalidation,
  ].filter(Boolean).join(' '))
    .split(/[^a-z0-9]+/)
    .filter((word) => word.length >= 4 && !stopWords.has(word))
  return [...new Set([...profileTerms(profile), ...words])].slice(0, 28)
}

function termPattern(term: string) {
  const escaped = normalize(term).replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\s+/g, '\\s+')
  return new RegExp(`(^|[^a-z0-9])${escaped}(?=$|[^a-z0-9])`, 'g')
}

function termPositions(text: string, terms: string[]) {
  const positions: number[] = []
  for (const term of terms) {
    const pattern = termPattern(term)
    for (const match of text.matchAll(pattern)) {
      positions.push((match.index ?? 0) + match[1].length)
      if (positions.length >= 80) return positions
    }
  }
  return positions
}

function pageScore(page: LynchBookPage, pageText: string, terms: string[]) {
  const normalizedPage = normalize(pageText)
  const topicText = normalize(page.topics.join(' '))
  return terms.reduce((score, term) => {
    const count = [...normalizedPage.matchAll(termPattern(term))].length
    const topicMatch = termPattern(term).test(topicText)
    return score + Math.min(count, 4) * 3 + (topicMatch ? 2 : 0)
  }, 0)
}

function relevantExcerpt(text: string, terms: string[]) {
  const normalizedText = normalize(text)
  const positions = termPositions(normalizedText, terms)
  const focus = positions.reduce((best, position) => {
    const nearby = positions.filter((candidate) => Math.abs(candidate - position) <= 800).length
    const bestNearby = positions.filter((candidate) => Math.abs(candidate - best) <= 800).length
    return nearby > bestNearby ? position : best
  }, positions[0] ?? 0)
  const start = Math.max(0, Math.min(focus - 500, text.length - 1600))
  return text.slice(start, start + 1600).trim()
}

export async function getLynchBookContext(query: string, profile?: LynchResearchProfile): Promise<LynchBookContext> {
  const data = await loadBookData()
  if (!data?.index.pages.length) return { text: FALLBACK_REFERENCE, mode: 'fallback', pages: [] }

  const terms = searchTerms(query, profile)
  const effectiveTerms = terms.length ? terms : ['beneficios', 'deuda', 'valoracion', 'vender']
  const ranked = data.index.pages
    .map((page) => {
      const pageText = data.text.slice(page.start, page.end)
      return { page, pageText, score: pageScore(page, pageText, effectiveTerms) }
    })
    .sort((left, right) => right.score - left.score || left.page.page - right.page.page)
  const selected = ranked.filter((item) => item.score > 0).slice(0, 6)
  if (selected.length < 2) selected.push(...ranked.filter((item) => !selected.includes(item)).slice(0, 2 - selected.length))

  const excerpts = selected.map(({ page, pageText }) => {
    const title = page.heading ? ` · ${page.heading}` : ''
    return `Página ${page.page}${title} (${page.part}):\n${relevantExcerpt(pageText, effectiveTerms)}`
  })

  return {
    text: `${FALLBACK_REFERENCE}\nEXTRACTOS DE REFERENCIA INTERNA (parafrasea, no los cites literalmente):\n${excerpts.join('\n\n')}`.slice(0, 11000),
    mode: 'indexed',
    pages: selected.map(({ page }) => page.page),
  }
}
