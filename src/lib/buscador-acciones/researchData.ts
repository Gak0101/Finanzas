import type {
  LynchCategoryKey,
  ResearchCheck,
  ResearchMetric,
  ResearchMetricKey,
  ResearchScorecard,
  ResearchSource,
} from '@/lib/buscador-acciones/lynchFramework'
import { createEmptyScorecard } from '@/lib/buscador-acciones/lynchFramework'

export type ResearchEntity = {
  symbol: string
  company: string
  exchange: string
  type: string
  identityVerified?: boolean
}

export type FundamentalSnapshot = {
  symbol: string
  company: string
  exchange: string
  dataAsOf: string
  identityVerified: boolean
  price?: number | null
  changePercent?: number | null
  metrics: ResearchMetric[]
  sources: ResearchSource[]
  warnings: string[]
}

type SourceCredentials = {
  finnhubToken?: string
  secContactEmail?: string
  fiscalApiKey?: string
  alphaVantageApiKey?: string
  financialDatasetsApiKey?: string
}

type FinnhubMetricPayload = {
  metric?: Record<string, unknown>
}

type FinnhubReportedLine = {
  concept?: unknown
  value?: unknown
  unit?: unknown
}

type FinnhubReportedPeriod = {
  form?: unknown
  endDate?: unknown
  report?: {
    ic?: FinnhubReportedLine[]
    bs?: FinnhubReportedLine[]
    cf?: FinnhubReportedLine[]
  }
}

type FinnhubReportedPayload = {
  data?: FinnhubReportedPeriod[]
}

type SecFactObservation = {
  val?: unknown
  end?: unknown
  start?: unknown
  filed?: unknown
  form?: unknown
  fy?: unknown
  fp?: unknown
}

type SecFact = {
  units?: Record<string, SecFactObservation[]>
}

type SecCompanyFacts = {
  facts?: Record<string, Record<string, SecFact>>
}

type SecTicker = {
  cik_str?: unknown
  ticker?: unknown
  title?: unknown
}

type JsonRecord = Record<string, unknown>

const FINNHUB_METRIC_DEFINITIONS: Array<{
  key: ResearchMetricKey
  label: string
  fields: string[]
  kind: 'percent' | 'multiple' | 'number' | 'compact'
}> = [
  { key: 'revenue-growth', label: 'Crecimiento de ventas interanual', fields: ['revenueGrowthTTMYoy', 'revenueGrowth3Y'], kind: 'percent' },
  { key: 'eps-growth', label: 'Crecimiento del BPA interanual', fields: ['epsGrowthTTMYoy', 'epsGrowth3Y'], kind: 'percent' },
  { key: 'gross-margin', label: 'Margen bruto', fields: ['grossMarginTTM', 'grossMarginAnnual'], kind: 'percent' },
  { key: 'operating-margin', label: 'Margen operativo', fields: ['operatingMarginTTM', 'operatingMarginAnnual'], kind: 'percent' },
  { key: 'net-margin', label: 'Margen neto', fields: ['netProfitMarginTTM', 'netProfitMarginAnnual'], kind: 'percent' },
  { key: 'roe', label: 'ROE', fields: ['roeTTM', 'roeRfy', 'roeAnnual'], kind: 'percent' },
  { key: 'roic', label: 'ROIC', fields: ['roicTTM', 'roicRfy', 'roicAnnual'], kind: 'percent' },
  { key: 'pe', label: 'PER', fields: ['peTTM', 'peBasicExclExtraTTM', 'peNormalizedAnnual'], kind: 'multiple' },
  { key: 'ps', label: 'Precio / ventas', fields: ['psTTM', 'psAnnual'], kind: 'multiple' },
  { key: 'cash', label: 'Caja', fields: ['cashAndCashEquivalentsAnnual', 'cashAndCashEquivalentsTTM'], kind: 'compact' },
  { key: 'debt', label: 'Deuda', fields: ['totalDebtAnnual', 'totalDebtTTM'], kind: 'compact' },
  { key: 'free-cash-flow', label: 'Flujo de caja libre', fields: ['freeCashFlowTTM', 'freeCashFlowAnnual'], kind: 'compact' },
  { key: 'shares', label: 'Acciones en circulación', fields: ['shareOutstanding', 'sharesOutstanding'], kind: 'compact' },
  { key: 'market-cap', label: 'Capitalización', fields: ['marketCapitalization'], kind: 'compact' },
  { key: 'eps', label: 'Beneficio por acción', fields: ['epsTTM', 'epsAnnual'], kind: 'number' },
]

let secTickerMapPromise: Promise<Map<string, string>> | null = null
let yahooSessionPromise: Promise<{ cookie: string; crumb: string }> | null = null
let yahooSessionExpiresAt = 0
const YAHOO_USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/128 Safari/537.36'

function safeSource(label: string, url: string): ResearchSource | null {
  try {
    const parsed = new URL(url)
    if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') return null
    if (parsed.username || parsed.password) return null
    return { label: label.slice(0, 180), url: parsed.toString() }
  } catch {
    return null
  }
}

function asNumber(value: unknown) {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string' && value.trim()) {
    const parsed = Number(value.replace(/,/g, ''))
    return Number.isFinite(parsed) ? parsed : null
  }
  return null
}

function isUsableMetricValue(key: ResearchMetricKey, value: number) {
  if (['price', 'market-cap', 'pe', 'ps', 'shares'].includes(key)) return value > 0
  return true
}

function formatCompact(value: number) {
  const absolute = Math.abs(value)
  if (absolute >= 1_000_000_000_000) return `${(value / 1_000_000_000_000).toFixed(1)} B`
  if (absolute >= 1_000_000_000) return `${(value / 1_000_000_000).toFixed(1)} B`
  if (absolute >= 1_000_000) return `${(value / 1_000_000).toFixed(1)} M`
  if (absolute >= 1_000) return `${(value / 1_000).toFixed(1)} K`
  return value.toFixed(2)
}

function formatPercent(value: number) {
  const normalized = Math.abs(value) <= 2 ? value * 100 : value
  return `${normalized.toFixed(1)}%`
}

function formatMetricValue(value: number, kind: 'percent' | 'multiple' | 'number' | 'compact') {
  if (kind === 'percent') return formatPercent(value)
  if (kind === 'multiple') return `${value.toFixed(1)}x`
  if (kind === 'compact') return formatCompact(value)
  return value.toFixed(2)
}

function makeMetric(
  key: ResearchMetricKey,
  label: string,
  numericValue: number,
  sourceUrls: ResearchSource[],
  options: { kind?: 'percent' | 'multiple' | 'number' | 'compact'; period?: string; note?: string } = {},
): ResearchMetric {
  return {
    key,
    label,
    value: formatMetricValue(numericValue, options.kind ?? 'number'),
    numericValue,
    unit: options.kind === 'percent' ? '%' : undefined,
    period: options.period,
    status: 'verified',
    sourceUrls,
    note: options.note,
  }
}

function uniqueSources(sources: Array<ResearchSource | null>) {
  const seen = new Set<string>()
  return sources.filter((source): source is ResearchSource => {
    if (!source || seen.has(source.url)) return false
    seen.add(source.url)
    return true
  })
}

function mergeMetrics(...groups: ResearchMetric[][]) {
  const merged = new Map<ResearchMetricKey, ResearchMetric>()
  for (const group of groups) {
    for (const metric of group) {
      const existing = merged.get(metric.key)
      if (!existing || (existing.status !== 'verified' && metric.status === 'verified')) {
        merged.set(metric.key, metric)
        continue
      }
      if (existing.status === 'verified' && metric.status === 'verified') {
        merged.set(metric.key, {
          ...existing,
          sourceUrls: uniqueSources([...existing.sourceUrls, ...metric.sourceUrls]),
        })
      }
    }
  }
  return [...merged.values()]
}

function annualFinnhubReports(payload: unknown) {
  const data = payload && typeof payload === 'object' && Array.isArray((payload as FinnhubReportedPayload).data)
    ? (payload as FinnhubReportedPayload).data ?? []
    : []
  return data
    .filter((row) => {
      const form = typeof row.form === 'string' ? row.form : ''
      return form === '10-K' || form === '20-F' || form === '40-F'
    })
    .sort((a, b) => String(b.endDate ?? '').localeCompare(String(a.endDate ?? '')))
}

function reportedSeries(
  reports: FinnhubReportedPeriod[],
  statement: 'ic' | 'bs' | 'cf',
  concepts: string[],
) {
  const values: Array<{ value: number; period: string }> = []
  const seen = new Set<string>()
  for (const report of reports) {
    const period = typeof report.endDate === 'string' ? report.endDate.slice(0, 10) : ''
    if (!period || seen.has(period)) continue
    const lines = report.report?.[statement] ?? []
    const line = lines.find((item) => {
      const concept = typeof item.concept === 'string' ? item.concept : ''
      return concepts.some((candidate) => concept === candidate || concept.endsWith(`_${candidate}`))
    })
    const value = asNumber(line?.value)
    if (value === null) continue
    seen.add(period)
    values.push({ value, period })
  }
  return values
}

function reportedMetric(
  key: ResearchMetricKey,
  label: string,
  series: Array<{ value: number; period: string }>,
  source: ResearchSource,
  kind: 'percent' | 'multiple' | 'number' | 'compact' = 'compact',
) {
  const latest = series[0]
  return latest && isUsableMetricValue(key, latest.value)
    ? makeMetric(key, label, latest.value, [source], { kind, period: latest.period })
    : null
}

function reportedGrowthMetric(
  key: ResearchMetricKey,
  label: string,
  series: Array<{ value: number; period: string }>,
  source: ResearchSource,
) {
  const latest = series[0]
  const previous = series[1]
  if (!latest || !previous || previous.value === 0) return null
  return makeMetric(key, label, ((latest.value / previous.value) - 1) * 100, [source], {
    kind: 'percent',
    period: `${previous.period} → ${latest.period}`,
  })
}

function reportedFinancialMetrics(payload: unknown) {
  const reports = annualFinnhubReports(payload)
  const source = safeSource('Finnhub · estados financieros reportados', 'https://finnhub.io/docs/api/stock-financials-reported')
  if (!source || !reports.length) return { metrics: [] as ResearchMetric[], source: null as ResearchSource | null, dataAsOf: undefined as string | undefined }

  const revenue = reportedSeries(reports, 'ic', ['RevenueFromContractWithCustomerExcludingAssessedTax', 'Revenues', 'SalesRevenueNet'])
  const netIncome = reportedSeries(reports, 'ic', ['NetIncomeLoss', 'ProfitLoss'])
  const operatingIncome = reportedSeries(reports, 'ic', ['OperatingIncomeLoss'])
  const grossProfit = reportedSeries(reports, 'ic', ['GrossProfit'])
  const eps = reportedSeries(reports, 'ic', ['EarningsPerShareDiluted', 'EarningsPerShareBasic'])
  const dilutedShares = reportedSeries(reports, 'ic', ['WeightedAverageNumberOfDilutedSharesOutstanding', 'WeightedAverageNumberOfSharesOutstandingBasic'])
  const operatingCashFlow = reportedSeries(reports, 'cf', ['NetCashProvidedByUsedInOperatingActivities'])
  const capex = reportedSeries(reports, 'cf', ['PaymentsToAcquirePropertyPlantAndEquipment', 'PaymentsToAcquireProductiveAssets'])
  const cash = reportedSeries(reports, 'bs', ['CashAndCashEquivalentsAtCarryingValue', 'CashCashEquivalentsAndShortTermInvestments'])
  const currentDebt = reportedSeries(reports, 'bs', ['LongTermDebtCurrent', 'LongTermDebtAndFinanceLeaseObligationsCurrent', 'CommercialPaper'])
  const nonCurrentDebt = reportedSeries(reports, 'bs', ['LongTermDebtNoncurrent', 'LongTermDebtAndFinanceLeaseObligationsNoncurrent'])
  const nonCurrentDebtByPeriod = new Map(nonCurrentDebt.map((item) => [item.period, item.value]))
  const debt = currentDebt.map((item, index) => ({
    value: item.value + (nonCurrentDebtByPeriod.get(item.period) ?? 0),
    period: item.period,
  }))
  const metrics: ResearchMetric[] = []
  const push = (metric: ResearchMetric | null) => { if (metric) metrics.push(metric) }

  push(reportedMetric('revenue', 'Ventas', revenue, source))
  push(reportedGrowthMetric('revenue-growth', 'Crecimiento de ventas interanual', revenue, source))
  push(reportedMetric('net-income', 'Beneficio neto', netIncome, source))
  push(reportedGrowthMetric('eps-growth', 'Crecimiento del BPA interanual', eps, source))
  push(reportedMetric('eps', 'Beneficio por acción', eps, source, 'number'))
  push(reportedMetric('operating-cash-flow', 'Flujo de caja operativo', operatingCashFlow, source))
  if (operatingCashFlow[0] && capex[0]) {
    push(makeMetric('free-cash-flow', 'Flujo de caja libre', operatingCashFlow[0].value - Math.abs(capex[0].value), [source], {
      kind: 'compact',
      period: operatingCashFlow[0].period,
      note: 'Calculado como flujo operativo menos capex reportado.',
    }))
  }
  push(reportedMetric('cash', 'Caja', cash, source))
  push(reportedMetric('debt', 'Deuda', debt, source))
  if (cash[0] && debt[0]) {
    push(makeMetric('net-debt', 'Deuda neta', debt[0].value - cash[0].value, [source], {
      kind: 'compact', period: debt[0].period, note: 'Calculada como deuda menos caja.'
    }))
  }
  push(reportedMetric('shares', 'Acciones medias diluidas', dilutedShares, source))
  if (revenue[0] && grossProfit[0]) {
    push(makeMetric('gross-margin', 'Margen bruto', (grossProfit[0].value / revenue[0].value) * 100, [source], {
      kind: 'percent', period: grossProfit[0].period,
    }))
  }
  if (revenue[0] && operatingIncome[0]) {
    push(makeMetric('operating-margin', 'Margen operativo', (operatingIncome[0].value / revenue[0].value) * 100, [source], {
      kind: 'percent', period: operatingIncome[0].period,
    }))
  }
  if (revenue[0] && netIncome[0]) {
    push(makeMetric('net-margin', 'Margen neto', (netIncome[0].value / revenue[0].value) * 100, [source], {
      kind: 'percent', period: netIncome[0].period,
    }))
  }

  const endDate = typeof reports[0]?.endDate === 'string' ? reports[0].endDate.slice(0, 10) : undefined
  return { metrics, source, dataAsOf: endDate }
}

async function fetchFinnhubJson(url: URL, token: string) {
  url.searchParams.set('token', token)
  const response = await fetch(url, {
    cache: 'no-store',
    signal: AbortSignal.timeout(12_000),
  })
  if (!response.ok) throw new Error(`Finnhub respondió HTTP ${response.status}`)
  return response.json().catch(() => null) as Promise<unknown>
}

function normalizeSymbol(value: string) {
  return value.trim().toUpperCase().replace(/[^A-Z0-9.:-]/g, '')
}

export async function resolveFinnhubEntity(entity: ResearchEntity, token: string) {
  const requested = normalizeSymbol(entity.symbol)
  const query = requested || entity.company.trim().slice(0, 120)
  if (!query) return null
  const url = new URL('https://finnhub.io/api/v1/search')
  url.searchParams.set('q', query)
  const payload = await fetchFinnhubJson(url, token) as { result?: unknown } | null
  const matches = Array.isArray(payload?.result) ? payload.result : []
  const normalizedMatches = matches.flatMap((item) => {
    if (!item || typeof item !== 'object') return []
    const match = item as { symbol?: unknown; displaySymbol?: unknown; description?: unknown; exchange?: unknown; type?: unknown }
    const symbol = typeof match.displaySymbol === 'string' && match.displaySymbol.trim()
      ? match.displaySymbol.trim()
      : typeof match.symbol === 'string' ? match.symbol.trim() : ''
    const company = typeof match.description === 'string' ? match.description.trim() : ''
    const type = typeof match.type === 'string' ? match.type : 'Cotizada'
    if (!symbol || !company || !['Common Stock', 'ETP', 'ADR', 'REIT'].includes(type)) return []
    return [{
      symbol,
      company,
      exchange: typeof match.exchange === 'string' && match.exchange.trim() ? match.exchange.trim() : entity.exchange,
      type,
      identityVerified: true,
    }]
  })
  const exact = normalizedMatches.find((match) => normalizeSymbol(match.symbol) === requested)
  if (requested) return exact ?? null
  const companyQuery = entity.company.trim().toLowerCase()
  if (!companyQuery) return null
  const companyMatches = normalizedMatches.filter((match) => {
    const normalizedCompany = match.company.toLowerCase()
    return normalizedCompany === companyQuery
      || normalizedCompany.includes(companyQuery)
      || companyQuery.includes(normalizedCompany)
  })
  return companyMatches.length === 1 ? companyMatches[0] : null
}

async function fetchFinnhubMetrics(entity: ResearchEntity, token: string): Promise<FundamentalSnapshot> {
  const quoteUrl = new URL('https://finnhub.io/api/v1/quote')
  quoteUrl.searchParams.set('symbol', entity.symbol)
  const metricUrl = new URL('https://finnhub.io/api/v1/stock/metric')
  metricUrl.searchParams.set('symbol', entity.symbol)
  metricUrl.searchParams.set('metric', 'all')
  const reportedUrl = new URL('https://finnhub.io/api/v1/stock/financials-reported')
  reportedUrl.searchParams.set('symbol', entity.symbol)
  reportedUrl.searchParams.set('freq', 'annual')

  const [quoteResult, metricResult, reportedResult] = await Promise.allSettled([
    fetchFinnhubJson(quoteUrl, token),
    fetchFinnhubJson(metricUrl, token),
    fetchFinnhubJson(reportedUrl, token),
  ])
  const quotePayload = quoteResult.status === 'fulfilled' ? quoteResult.value : null
  const metricPayload = metricResult.status === 'fulfilled' ? metricResult.value : null
  const reportedPayload = reportedResult.status === 'fulfilled' ? reportedResult.value : null
  const quote = quotePayload && typeof quotePayload === 'object'
    ? quotePayload as { c?: unknown; dp?: unknown; t?: unknown }
    : {}
  const metricRecord = metricPayload && typeof metricPayload === 'object'
    ? (metricPayload as FinnhubMetricPayload).metric ?? {}
    : {}
  const quoteTimestamp = asNumber(quote.t)
  const quoteSource = safeSource('Finnhub · cotización', 'https://finnhub.io/docs/api/quote')
  const metricSource = safeSource('Finnhub · fundamentales básicos', 'https://finnhub.io/docs/api/metric')
  const reported = reportedFinancialMetrics(reportedPayload)
  const sourceUrls = uniqueSources([quoteSource, metricSource, reported.source])
  const metrics: ResearchMetric[] = []
  const price = asNumber(quote.c)
  if (price !== null && price > 0) {
    metrics.push(makeMetric('price', 'Precio actual', price, quoteSource ? [quoteSource] : [], {
      kind: 'number',
      note: typeof quote.dp === 'number' ? `Variación diaria: ${formatPercent(quote.dp)}` : undefined,
    }))
  }

  for (const definition of FINNHUB_METRIC_DEFINITIONS) {
    const field = definition.fields.find((candidate) => asNumber(metricRecord[candidate]) !== null)
    if (!field) continue
    const numericValue = asNumber(metricRecord[field])
    if (numericValue === null || !isUsableMetricValue(definition.key, numericValue)) continue
    metrics.push(makeMetric(definition.key, definition.label, numericValue, metricSource ? [metricSource] : [], {
      kind: definition.kind,
      period: field.includes('TTM') ? 'TTM' : 'último dato disponible',
    }))
  }

  const mergedMetrics = mergeMetrics(metrics, reported.metrics)
  const reportedDate = reported.dataAsOf ? new Date(reported.dataAsOf).toISOString() : undefined
  const warnings = [
    quoteResult.status === 'rejected' ? 'Finnhub no devolvió cotización en tiempo real' : '',
    metricResult.status === 'rejected' ? 'Finnhub no devolvió métricas básicas' : '',
    reportedResult.status === 'rejected' ? 'Finnhub no devolvió estados financieros reportados' : '',
  ].filter(Boolean)
  if (!mergedMetrics.length) warnings.push('Finnhub no devolvió métricas fundamentales para este símbolo')

  return {
    symbol: entity.symbol,
    company: entity.company,
    exchange: entity.exchange,
    identityVerified: entity.identityVerified === true,
    dataAsOf: quoteTimestamp && quoteTimestamp > 1_000_000_000
      ? new Date(quoteTimestamp * 1000).toISOString()
      : reportedDate ?? new Date().toISOString(),
    price: price ?? null,
    changePercent: asNumber(quote.dp),
    metrics: mergedMetrics,
    sources: sourceUrls,
    warnings,
  }
}

function annualObservations(fact: SecFact | undefined, unit: string) {
  const observations = fact?.units?.[unit]
  if (!Array.isArray(observations)) return []
  const annual = observations.filter((observation) => {
    const form = typeof observation.form === 'string' ? observation.form : ''
    const fp = typeof observation.fp === 'string' ? observation.fp : ''
    return form.startsWith('10-K') || fp === 'FY'
  })
  const sorted = [...annual].sort((a, b) => String(b.end ?? '').localeCompare(String(a.end ?? '')))
  const seen = new Set<string>()
  return sorted.filter((observation) => {
    const end = typeof observation.end === 'string' ? observation.end : ''
    if (!end || seen.has(end)) return false
    seen.add(end)
    return asNumber(observation.val) !== null
  }).slice(0, 6)
}

function instantObservations(fact: SecFact | undefined, unit: string) {
  const observations = fact?.units?.[unit]
  if (!Array.isArray(observations)) return []
  const sorted = [...observations].sort((a, b) => String(b.end ?? '').localeCompare(String(a.end ?? '')))
  const seen = new Set<string>()
  return sorted.filter((observation) => {
    const end = typeof observation.end === 'string' ? observation.end : ''
    if (!end || seen.has(end)) return false
    seen.add(end)
    return asNumber(observation.val) !== null
  }).slice(0, 6)
}

function findFact(facts: Record<string, SecFact>, names: string[]) {
  for (const name of names) {
    if (facts[name]) return facts[name]
  }
  return undefined
}

function latestValue(observations: SecFactObservation[]) {
  const latest = observations[0]
  return latest ? asNumber(latest.val) : null
}

function previousValue(observations: SecFactObservation[]) {
  const previous = observations[1]
  return previous ? asNumber(previous.val) : null
}

function periodOf(observations: SecFactObservation[]) {
  const latest = observations[0]
  return typeof latest?.end === 'string' ? latest.end : undefined
}

function growthMetric(
  key: ResearchMetricKey,
  label: string,
  observations: SecFactObservation[],
  source: ResearchSource,
) {
  const latest = latestValue(observations)
  const previous = previousValue(observations)
  if (latest === null || previous === null || previous === 0) return null
  return makeMetric(key, label, ((latest / previous) - 1) * 100, [source], {
    kind: 'percent',
    period: `${String(observations[1]?.end ?? '')} → ${String(observations[0]?.end ?? '')}`,
  })
}

async function loadSecTickerMap(email: string) {
  if (!secTickerMapPromise) {
    secTickerMapPromise = fetch('https://www.sec.gov/files/company_tickers.json', {
      headers: { 'User-Agent': `Finanzas · ${email}` },
      cache: 'no-store',
      signal: AbortSignal.timeout(12_000),
    }).then(async (response) => {
      if (!response.ok) throw new Error(`SEC respondió HTTP ${response.status}`)
      const payload = await response.json().catch(() => null) as Record<string, SecTicker> | null
      const map = new Map<string, string>()
      for (const item of Object.values(payload ?? {})) {
        const ticker = typeof item.ticker === 'string' ? item.ticker.toUpperCase() : ''
        const cik = asNumber(item.cik_str)
        if (ticker && cik !== null) map.set(ticker, String(Math.trunc(cik)).padStart(10, '0'))
      }
      return map
    }).catch((error) => {
      secTickerMapPromise = null
      throw error
    })
  }
  return secTickerMapPromise
}

async function fetchSecMetrics(entity: ResearchEntity, email: string): Promise<FundamentalSnapshot> {
  const tickerMap = await loadSecTickerMap(email)
  const cik = tickerMap.get(entity.symbol.toUpperCase().replace(/^[A-Z]+:/, ''))
  if (!cik) {
    return {
      symbol: entity.symbol,
      company: entity.company,
      exchange: entity.exchange,
      dataAsOf: new Date().toISOString(),
      identityVerified: false,
      metrics: [],
      sources: [],
      warnings: ['SEC no encontró un CIK para este símbolo'],
    }
  }

  const url = `https://data.sec.gov/api/xbrl/companyfacts/CIK${cik}.json`
  const response = await fetch(url, {
    headers: { 'User-Agent': `Finanzas · ${email}` },
    cache: 'no-store',
    signal: AbortSignal.timeout(15_000),
  })
  if (!response.ok) throw new Error(`SEC Company Facts respondió HTTP ${response.status}`)
  const payload = await response.json().catch(() => null) as SecCompanyFacts | null
  const gaap = payload?.facts?.['us-gaap'] ?? {}
  const dei = payload?.facts?.dei ?? {}
  const source = safeSource('SEC · Company Facts', url)
  if (!source) throw new Error('URL SEC no válida')

  const revenue = annualObservations(findFact(gaap, ['RevenueFromContractWithCustomerExcludingAssessedTax', 'Revenues', 'SalesRevenueNet']), 'USD')
  const netIncome = annualObservations(findFact(gaap, ['NetIncomeLoss', 'ProfitLoss']), 'USD')
  const operatingIncome = annualObservations(findFact(gaap, ['OperatingIncomeLoss']), 'USD')
  const operatingCashFlow = annualObservations(findFact(gaap, ['NetCashProvidedByUsedInOperatingActivities']), 'USD')
  const capex = annualObservations(findFact(gaap, ['PaymentsToAcquirePropertyPlantAndEquipment', 'PaymentsToAcquireProductiveAssets']), 'USD')
  const eps = annualObservations(findFact(gaap, ['EarningsPerShareDiluted', 'EarningsPerShareBasic']), 'USD/shares')
  const cash = instantObservations(findFact(gaap, ['CashAndCashEquivalentsAtCarryingValue', 'CashCashEquivalentsRestrictedCashAndRestrictedCashEquivalents']), 'USD')
  const debt = instantObservations(findFact(gaap, ['LongTermDebtAndFinanceLeaseObligationsCurrent', 'LongTermDebtCurrent', 'LongTermDebtNoncurrent', 'LongTermDebtAndFinanceLeaseObligationsNoncurrent']), 'USD')
  const shares = instantObservations(dei.EntityCommonStockSharesOutstanding, 'shares')
  const metrics: ResearchMetric[] = []

  const revenueValue = latestValue(revenue)
  const netIncomeValue = latestValue(netIncome)
  const operatingIncomeValue = latestValue(operatingIncome)
  const operatingCashValue = latestValue(operatingCashFlow)
  const capexValue = capex.length ? Math.abs(latestValue(capex) ?? 0) : null
  const cashValue = latestValue(cash)
  const debtValue = latestValue(debt)
  if (revenueValue !== null) metrics.push(makeMetric('revenue', 'Ventas', revenueValue, [source], { kind: 'compact', period: periodOf(revenue) }))
  const revenueGrowth = growthMetric('revenue-growth', 'Crecimiento de ventas interanual', revenue, source)
  if (revenueGrowth) metrics.push(revenueGrowth)
  if (netIncomeValue !== null) metrics.push(makeMetric('net-income', 'Beneficio neto', netIncomeValue, [source], { kind: 'compact', period: periodOf(netIncome) }))
  const epsValue = latestValue(eps)
  if (epsValue !== null) metrics.push(makeMetric('eps', 'Beneficio por acción', epsValue, [source], { kind: 'number', period: periodOf(eps) }))
  const epsGrowth = growthMetric('eps-growth', 'Crecimiento del BPA interanual', eps, source)
  if (epsGrowth) metrics.push(epsGrowth)
  if (revenueValue && netIncomeValue !== null) metrics.push(makeMetric('net-margin', 'Margen neto', (netIncomeValue / revenueValue) * 100, [source], { kind: 'percent', period: periodOf(netIncome) }))
  if (revenueValue && operatingIncomeValue !== null) metrics.push(makeMetric('operating-margin', 'Margen operativo', (operatingIncomeValue / revenueValue) * 100, [source], { kind: 'percent', period: periodOf(operatingIncome) }))
  if (operatingCashValue !== null) metrics.push(makeMetric('operating-cash-flow', 'Flujo de caja operativo', operatingCashValue, [source], { kind: 'compact', period: periodOf(operatingCashFlow) }))
  if (operatingCashValue !== null && capexValue !== null) metrics.push(makeMetric('free-cash-flow', 'Flujo de caja libre', operatingCashValue - capexValue, [source], { kind: 'compact', period: periodOf(operatingCashFlow), note: 'Calculado como CFO menos capex reportado.' }))
  if (cashValue !== null) metrics.push(makeMetric('cash', 'Caja', cashValue, [source], { kind: 'compact', period: periodOf(cash) }))
  if (debtValue !== null) metrics.push(makeMetric('debt', 'Deuda', debtValue, [source], { kind: 'compact', period: periodOf(debt) }))
  if (cashValue !== null && debtValue !== null) metrics.push(makeMetric('net-debt', 'Deuda neta', debtValue - cashValue, [source], { kind: 'compact', period: periodOf(debt), note: 'Calculada como deuda menos caja.' }))
  const sharesValue = latestValue(shares)
  if (sharesValue !== null) metrics.push(makeMetric('shares', 'Acciones en circulación', sharesValue, [source], { kind: 'compact', period: periodOf(shares) }))

  return {
    symbol: entity.symbol,
    company: entity.company,
    exchange: entity.exchange,
    dataAsOf: periodOf(revenue) ?? periodOf(netIncome) ?? new Date().toISOString(),
    identityVerified: true,
    metrics,
    sources: [source],
    warnings: metrics.length ? [] : ['SEC no devolvió datos anuales utilizables'],
  }
}

function findRatioValue(value: unknown, keys: string[]): number | null {
  if (!value || typeof value !== 'object') return null
  if (Array.isArray(value)) {
    for (const item of value) {
      const result = findRatioValue(item, keys)
      if (result !== null) return result
    }
    return null
  }
  const record = value as Record<string, unknown>
  for (const key of keys) {
    const direct = asNumber(record[key])
    if (direct !== null) return direct
  }
  for (const child of Object.values(record)) {
    const result = findRatioValue(child, keys)
    if (result !== null) return result
  }
  return null
}

async function fetchFiscalMetrics(entity: ResearchEntity, apiKey: string): Promise<FundamentalSnapshot> {
  const url = new URL('https://api.fiscal.ai/v1/company/ratios')
  url.searchParams.set('ticker', entity.symbol)
  if (entity.exchange && entity.exchange !== 'Finnhub') url.searchParams.set('exchange', entity.exchange)
  url.searchParams.set('periodType', 'latest,annual')
  const response = await fetch(url, {
    headers: { 'X-Api-Key': apiKey },
    cache: 'no-store',
    signal: AbortSignal.timeout(15_000),
  })
  if (!response.ok) throw new Error(`Fiscal.ai respondió HTTP ${response.status}`)
  const payload = await response.json().catch(() => null)
  const source = safeSource('Fiscal.ai · ratios', 'https://docs.fiscal.ai/docs/api-reference')
  if (!source) throw new Error('URL Fiscal.ai no válida')
  const metrics: ResearchMetric[] = []
  const ratioDefinitions: Array<{ key: ResearchMetricKey; label: string; names: string[] }> = [
    { key: 'pe', label: 'PER', names: ['ratio_price_to_earnings', 'priceToEarnings', 'pe'] },
    { key: 'ps', label: 'Precio / ventas', names: ['ratio_price_to_sales', 'priceToSales', 'ps'] },
  ]
  for (const definition of ratioDefinitions) {
    const value = findRatioValue(payload, definition.names)
    if (value !== null && isUsableMetricValue(definition.key, value)) {
      metrics.push(makeMetric(definition.key, definition.label, value, [source], { kind: 'multiple', period: 'último dato disponible' }))
    }
  }
  return {
    symbol: entity.symbol,
    company: entity.company,
    exchange: entity.exchange,
    dataAsOf: new Date().toISOString(),
    identityVerified: entity.identityVerified === true,
    metrics,
    sources: [source],
    warnings: metrics.length ? [] : ['Fiscal.ai no devolvió ratios reconocibles para este símbolo'],
  }
}

function asRecord(value: unknown): JsonRecord | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as JsonRecord
    : null
}

function asRecordArray(value: unknown) {
  return Array.isArray(value) ? value.flatMap((item) => {
    const record = asRecord(item)
    return record ? [record] : []
  }) : []
}

function orderedRecords(value: unknown, periodField: string) {
  return asRecordArray(value).sort((left, right) => String(right[periodField] ?? '').localeCompare(String(left[periodField] ?? '')))
}

function firstNumber(record: JsonRecord | undefined, fields: string[]) {
  if (!record) return null
  for (const field of fields) {
    const value = asNumber(record[field])
    if (value !== null) return value
  }
  return null
}

function recordPeriod(record: JsonRecord | undefined, fields: string[]) {
  if (!record) return undefined
  for (const field of fields) {
    const value = record[field]
    if (typeof value === 'string' && value.trim()) return value.trim().slice(0, 10)
  }
  return undefined
}

function identitySymbol(value: string) {
  return normalizeSymbol(value).split(':').at(-1) ?? ''
}

function yahooNumber(record: JsonRecord | null | undefined, field: string) {
  const value = record?.[field]
  const wrapped = asRecord(value)
  return firstNumber(wrapped ?? undefined, ['raw']) ?? asNumber(value)
}

async function yahooSession() {
  if (yahooSessionPromise && Date.now() < yahooSessionExpiresAt) return yahooSessionPromise
  yahooSessionPromise = (async () => {
    const cookieResponse = await fetch('https://fc.yahoo.com', {
      headers: { 'User-Agent': YAHOO_USER_AGENT },
      redirect: 'manual',
      cache: 'no-store',
      signal: AbortSignal.timeout(12_000),
    })
    const headers = cookieResponse.headers as Headers & { getSetCookie?: () => string[] }
    const setCookies = headers.getSetCookie?.() ?? [headers.get('set-cookie') ?? '']
    const cookie = setCookies.filter(Boolean).map((value) => value.split(';')[0]).join('; ')
    if (!cookie) throw new Error('Yahoo Finance no entregó una sesión de consulta')
    const crumbResponse = await fetch('https://query2.finance.yahoo.com/v1/test/getcrumb', {
      headers: { 'User-Agent': YAHOO_USER_AGENT, Cookie: cookie },
      cache: 'no-store',
      signal: AbortSignal.timeout(12_000),
    })
    const crumb = (await crumbResponse.text()).trim()
    if (!crumbResponse.ok || !crumb || /unauthorized|error/i.test(crumb)) {
      throw new Error(`Yahoo Finance no entregó autorización de consulta (${crumbResponse.status})`)
    }
    yahooSessionExpiresAt = Date.now() + 30 * 60 * 1000
    return { cookie, crumb }
  })().catch((error) => {
    yahooSessionPromise = null
    yahooSessionExpiresAt = 0
    throw error
  })
  return yahooSessionPromise
}

async function fetchYahooQuoteSummary(symbol: string) {
  const session = await yahooSession()
  const url = new URL(`https://query1.finance.yahoo.com/v10/finance/quoteSummary/${encodeURIComponent(symbol)}`)
  url.searchParams.set('modules', [
    'financialData',
    'defaultKeyStatistics',
    'summaryDetail',
    'incomeStatementHistory',
    'balanceSheetHistory',
    'cashflowStatementHistory',
  ].join(','))
  url.searchParams.set('crumb', session.crumb)
  const response = await fetch(url, {
    headers: { 'User-Agent': YAHOO_USER_AGENT, Cookie: session.cookie },
    cache: 'no-store',
    signal: AbortSignal.timeout(15_000),
  })
  const payload = asRecord(await response.json().catch(() => null))
  if (!response.ok) {
    if (response.status === 401) {
      yahooSessionPromise = null
      yahooSessionExpiresAt = 0
    }
    throw new Error(`Yahoo Finance fundamentales respondió HTTP ${response.status}`)
  }
  const quoteSummary = asRecord(payload?.quoteSummary)
  return asRecordArray(quoteSummary?.result)[0] ?? null
}

export async function resolveYahooEntity(entity: ResearchEntity) {
  const requested = identitySymbol(entity.symbol)
  const companyQuery = entity.company.trim().slice(0, 120)
  const baseQuery = requested || companyQuery
  if (!baseQuery) return null
  const words = baseQuery.split(/\s+/).filter(Boolean)
  const queryAttempts = [baseQuery, words.slice(0, 3).join(' '), words.slice(0, 2).join(' ')]
    .filter((value, index, all) => value && all.indexOf(value) === index)
  const companyTokens = new Set(companyQuery.toLowerCase().match(/[a-záéíóúüñ0-9]{3,}/g) ?? [])

  for (const query of queryAttempts) {
    const url = new URL('https://query2.finance.yahoo.com/v1/finance/search')
    url.searchParams.set('q', query)
    url.searchParams.set('quotesCount', '8')
    url.searchParams.set('newsCount', '0')
    const response = await fetch(url, {
      headers: { 'User-Agent': YAHOO_USER_AGENT },
      cache: 'no-store',
      signal: AbortSignal.timeout(12_000),
    })
    if (!response.ok) throw new Error(`Yahoo Finance búsqueda respondió HTTP ${response.status}`)
    const payload = asRecord(await response.json().catch(() => null))
    const matches = asRecordArray(payload?.quotes).flatMap((quote) => {
      const symbol = typeof quote.symbol === 'string' ? quote.symbol.trim() : ''
      const company = [quote.longname, quote.shortname]
        .find((value): value is string => typeof value === 'string' && Boolean(value.trim()))
      const quoteType = typeof quote.quoteType === 'string' ? quote.quoteType.toUpperCase() : ''
      if (!symbol || !company || !['EQUITY', 'ETF'].includes(quoteType)) return []
      const normalizedCompany = company.toLowerCase()
      const overlap = [...companyTokens].filter((token) => normalizedCompany.includes(token)).length
      const primaryListingScore = symbol.endsWith('.L') ? 20 : symbol.includes('.') ? 0 : 10
      return [{
        entity: {
          symbol,
          company: company.trim(),
          exchange: typeof quote.exchDisp === 'string' && quote.exchDisp.trim()
            ? quote.exchDisp.trim()
            : typeof quote.exchange === 'string' ? quote.exchange.trim() : entity.exchange,
          type: quoteType === 'ETF' ? 'ETP' : 'Common Stock',
          identityVerified: true,
        } satisfies ResearchEntity,
        score: overlap * 100 + primaryListingScore,
      }]
    })
    const exact = matches.find((match) => identitySymbol(match.entity.symbol) === requested)
    if (exact) return exact.entity
    if (requested) continue
    const ranked = matches.filter((match) => !companyTokens.size || match.score >= 100).sort((left, right) => right.score - left.score)
    if (ranked[0]) return ranked[0].entity
  }
  return null
}

async function fetchAlphaVantageJson(functionName: string, symbol: string, apiKey: string) {
  const url = new URL('https://www.alphavantage.co/query')
  url.searchParams.set('function', functionName)
  url.searchParams.set('symbol', symbol)
  url.searchParams.set('apikey', apiKey)
  const response = await fetch(url, {
    cache: 'no-store',
    signal: AbortSignal.timeout(15_000),
  })
  if (!response.ok) throw new Error(`Alpha Vantage respondió HTTP ${response.status}`)
  const payload = asRecord(await response.json().catch(() => null))
  if (!payload) throw new Error('Alpha Vantage no devolvió JSON válido')
  const providerMessage = ['Error Message', 'Information', 'Note']
    .map((field) => payload[field])
    .find((value) => typeof value === 'string' && value.trim())
  if (typeof providerMessage === 'string') {
    const isQuota = /rate|limit|frequency|calls|quota/i.test(providerMessage)
    throw new Error(isQuota ? 'Alpha Vantage ha alcanzado su límite gratuito' : `Alpha Vantage: ${providerMessage.slice(0, 180)}`)
  }
  return payload
}

async function fetchAlphaVantageMetrics(entity: ResearchEntity, apiKey: string): Promise<FundamentalSnapshot> {
  const endpointNames = ['OVERVIEW', 'INCOME_STATEMENT', 'BALANCE_SHEET', 'CASH_FLOW'] as const
  const results = await Promise.allSettled(endpointNames.map((endpoint) => fetchAlphaVantageJson(endpoint, entity.symbol, apiKey)))
  const payloadFor = (endpoint: typeof endpointNames[number]) => {
    const result = results[endpointNames.indexOf(endpoint)]
    return result?.status === 'fulfilled' ? result.value : null
  }
  const overview = payloadFor('OVERVIEW')
  const incomePayload = payloadFor('INCOME_STATEMENT')
  const balancePayload = payloadFor('BALANCE_SHEET')
  const cashPayload = payloadFor('CASH_FLOW')
  const income = orderedRecords(incomePayload?.annualReports, 'fiscalDateEnding')
  const balance = orderedRecords(balancePayload?.annualReports, 'fiscalDateEnding')
  const cashFlow = orderedRecords(cashPayload?.annualReports, 'fiscalDateEnding')
  const latestIncome = income[0]
  const previousIncome = income[1]
  const latestBalance = balance[0]
  const latestCashFlow = cashFlow[0]
  const source = safeSource('Alpha Vantage · fundamentales', 'https://www.alphavantage.co/documentation/#fundamentals')
  if (!source) throw new Error('URL de Alpha Vantage no válida')
  const metrics: ResearchMetric[] = []
  const push = (metric: ResearchMetric | null) => { if (metric) metrics.push(metric) }
  const sourceUrls = [source]
  const incomePeriod = recordPeriod(latestIncome, ['fiscalDateEnding'])
  const balancePeriod = recordPeriod(latestBalance, ['fiscalDateEnding'])
  const cashPeriod = recordPeriod(latestCashFlow, ['fiscalDateEnding'])

  const overviewDefinitions: Array<{
    key: ResearchMetricKey
    label: string
    fields: string[]
    kind: 'percent' | 'multiple' | 'number' | 'compact'
  }> = [
    { key: 'market-cap', label: 'Capitalización', fields: ['MarketCapitalization'], kind: 'compact' },
    { key: 'pe', label: 'PER', fields: ['PERatio', 'TrailingPE'], kind: 'multiple' },
    { key: 'ps', label: 'Precio / ventas', fields: ['PriceToSalesRatioTTM'], kind: 'multiple' },
    { key: 'eps', label: 'Beneficio por acción', fields: ['DilutedEPSTTM', 'EPS'], kind: 'number' },
    { key: 'revenue', label: 'Ventas TTM', fields: ['RevenueTTM'], kind: 'compact' },
    { key: 'revenue-growth', label: 'Crecimiento de ventas interanual', fields: ['QuarterlyRevenueGrowthYOY'], kind: 'percent' },
    { key: 'eps-growth', label: 'Crecimiento del BPA interanual', fields: ['QuarterlyEarningsGrowthYOY'], kind: 'percent' },
    { key: 'gross-margin', label: 'Margen bruto', fields: ['GrossProfitTTM'], kind: 'percent' },
    { key: 'operating-margin', label: 'Margen operativo', fields: ['OperatingMarginTTM'], kind: 'percent' },
    { key: 'net-margin', label: 'Margen neto', fields: ['ProfitMargin'], kind: 'percent' },
    { key: 'roe', label: 'ROE', fields: ['ReturnOnEquityTTM'], kind: 'percent' },
    { key: 'roic', label: 'Retorno sobre la inversión', fields: ['ReturnOnInvestmentTTM'], kind: 'percent' },
    { key: 'shares', label: 'Acciones en circulación', fields: ['SharesOutstanding'], kind: 'compact' },
  ]
  for (const definition of overviewDefinitions) {
    let value = firstNumber(overview ?? undefined, definition.fields)
    if (definition.key === 'gross-margin' && value !== null) {
      const overviewRevenue = firstNumber(overview ?? undefined, ['RevenueTTM'])
      value = overviewRevenue ? (value / overviewRevenue) * 100 : null
    }
    if (value !== null && isUsableMetricValue(definition.key, value)) {
      push(makeMetric(definition.key, definition.label, value, sourceUrls, {
        kind: definition.kind,
        period: definition.fields.some((field) => field.endsWith('TTM')) ? 'TTM' : 'último dato disponible',
      }))
    }
  }

  const revenue = firstNumber(latestIncome, ['totalRevenue'])
  const previousRevenue = firstNumber(previousIncome, ['totalRevenue'])
  const grossProfit = firstNumber(latestIncome, ['grossProfit'])
  const operatingIncome = firstNumber(latestIncome, ['operatingIncome'])
  const netIncome = firstNumber(latestIncome, ['netIncome'])
  const cashValue = firstNumber(latestBalance, ['cashAndShortTermInvestments', 'cashAndCashEquivalentsAtCarryingValue'])
  const reportedDebt = firstNumber(latestBalance, ['shortLongTermDebtTotal'])
  const currentDebt = firstNumber(latestBalance, ['currentDebt', 'shortTermDebt'])
  const longTermDebt = firstNumber(latestBalance, ['longTermDebt'])
  const debtValue = reportedDebt ?? (currentDebt !== null || longTermDebt !== null ? (currentDebt ?? 0) + (longTermDebt ?? 0) : null)
  const shares = firstNumber(latestBalance, ['commonStockSharesOutstanding'])
  const operatingCashFlow = firstNumber(latestCashFlow, ['operatingCashflow'])
  const capex = firstNumber(latestCashFlow, ['capitalExpenditures'])

  if (revenue !== null) push(makeMetric('revenue', 'Ventas', revenue, sourceUrls, { kind: 'compact', period: incomePeriod }))
  if (revenue !== null && previousRevenue !== null && previousRevenue !== 0) {
    push(makeMetric('revenue-growth', 'Crecimiento de ventas interanual', ((revenue / previousRevenue) - 1) * 100, sourceUrls, {
      kind: 'percent', period: `${recordPeriod(previousIncome, ['fiscalDateEnding']) ?? '?'} → ${incomePeriod ?? '?'}`,
    }))
  }
  if (netIncome !== null) push(makeMetric('net-income', 'Beneficio neto', netIncome, sourceUrls, { kind: 'compact', period: incomePeriod }))
  if (revenue) {
    if (grossProfit !== null) push(makeMetric('gross-margin', 'Margen bruto', (grossProfit / revenue) * 100, sourceUrls, { kind: 'percent', period: incomePeriod }))
    if (operatingIncome !== null) push(makeMetric('operating-margin', 'Margen operativo', (operatingIncome / revenue) * 100, sourceUrls, { kind: 'percent', period: incomePeriod }))
    if (netIncome !== null) push(makeMetric('net-margin', 'Margen neto', (netIncome / revenue) * 100, sourceUrls, { kind: 'percent', period: incomePeriod }))
  }
  if (cashValue !== null) push(makeMetric('cash', 'Caja', cashValue, sourceUrls, { kind: 'compact', period: balancePeriod }))
  if (debtValue !== null) push(makeMetric('debt', 'Deuda', debtValue, sourceUrls, { kind: 'compact', period: balancePeriod }))
  if (cashValue !== null && debtValue !== null) push(makeMetric('net-debt', 'Deuda neta', debtValue - cashValue, sourceUrls, { kind: 'compact', period: balancePeriod, note: 'Calculada como deuda menos caja.' }))
  if (shares !== null) push(makeMetric('shares', 'Acciones en circulación', shares, sourceUrls, { kind: 'compact', period: balancePeriod }))
  if (operatingCashFlow !== null) push(makeMetric('operating-cash-flow', 'Flujo de caja operativo', operatingCashFlow, sourceUrls, { kind: 'compact', period: cashPeriod }))
  if (operatingCashFlow !== null && capex !== null) push(makeMetric('free-cash-flow', 'Flujo de caja libre', operatingCashFlow - Math.abs(capex), sourceUrls, { kind: 'compact', period: cashPeriod, note: 'Calculado como flujo operativo menos capex reportado.' }))

  const requestedSymbol = identitySymbol(entity.symbol)
  const returnedSymbols = [overview?.Symbol, incomePayload?.symbol, balancePayload?.symbol, cashPayload?.symbol]
    .filter((value): value is string => typeof value === 'string')
    .map(identitySymbol)
  const warnings = results.flatMap((result, index) => result.status === 'rejected'
    ? [`Alpha Vantage ${endpointNames[index]}: ${result.reason instanceof Error ? result.reason.message : 'no respondió'}`]
    : [])
  if (!metrics.length && !warnings.length) warnings.push('Alpha Vantage no devolvió métricas reconocibles para este símbolo')
  const periods = [incomePeriod, balancePeriod, cashPeriod].filter((value): value is string => Boolean(value)).sort()
  return {
    symbol: entity.symbol,
    company: typeof overview?.Name === 'string' && overview.Name.trim() ? overview.Name.trim() : entity.company,
    exchange: typeof overview?.Exchange === 'string' && overview.Exchange.trim() ? overview.Exchange.trim() : entity.exchange,
    dataAsOf: periods.at(-1) ?? new Date().toISOString(),
    identityVerified: Boolean(requestedSymbol && returnedSymbols.includes(requestedSymbol)),
    metrics: mergeMetrics(metrics),
    sources: metrics.length ? [source] : [],
    warnings,
  }
}

async function fetchFinancialDatasetsMetrics(entity: ResearchEntity, apiKey: string): Promise<FundamentalSnapshot> {
  const url = new URL('https://api.financialdatasets.ai/financials/')
  url.searchParams.set('ticker', entity.symbol)
  url.searchParams.set('period', 'annual')
  url.searchParams.set('limit', '3')
  const response = await fetch(url, {
    headers: { 'X-API-KEY': apiKey },
    cache: 'no-store',
    signal: AbortSignal.timeout(15_000),
  })
  const payload = asRecord(await response.json().catch(() => null))
  if (!response.ok) {
    const providerMessage = typeof payload?.message === 'string' ? payload.message : ''
    if (response.status === 402) throw new Error('Financial Datasets requiere un plan compatible con este endpoint')
    throw new Error(providerMessage || `Financial Datasets respondió HTTP ${response.status}`)
  }
  const financials = asRecord(payload?.financials)
  const income = orderedRecords(financials?.income_statements, 'report_period')
  const balance = orderedRecords(financials?.balance_sheets, 'report_period')
  const cashFlow = orderedRecords(financials?.cash_flow_statements, 'report_period')
  const latestIncome = income[0]
  const previousIncome = income[1]
  const latestBalance = balance[0]
  const latestCashFlow = cashFlow[0]
  const documentationSource = safeSource('Financial Datasets · estados financieros', 'https://docs.financialdatasets.ai/api/financials/all-financial-statements')
  if (!documentationSource) throw new Error('URL de Financial Datasets no válida')
  const filingSource = [latestIncome, latestBalance, latestCashFlow]
    .map((record) => typeof record?.filing_url === 'string' ? safeSource('Informe financiero presentado', record.filing_url) : null)
    .find((source): source is ResearchSource => Boolean(source))
  const sourceUrls = uniqueSources([filingSource ?? null, documentationSource])
  const metrics: ResearchMetric[] = []
  const push = (metric: ResearchMetric | null) => { if (metric) metrics.push(metric) }
  const incomePeriod = recordPeriod(latestIncome, ['report_period'])
  const balancePeriod = recordPeriod(latestBalance, ['report_period'])
  const cashPeriod = recordPeriod(latestCashFlow, ['report_period'])
  const revenue = firstNumber(latestIncome, ['revenue'])
  const previousRevenue = firstNumber(previousIncome, ['revenue'])
  const grossProfit = firstNumber(latestIncome, ['gross_profit'])
  const operatingIncome = firstNumber(latestIncome, ['operating_income'])
  const netIncome = firstNumber(latestIncome, ['net_income', 'net_income_common_stock'])
  const eps = firstNumber(latestIncome, ['earnings_per_share_diluted', 'earnings_per_share'])
  const previousEps = firstNumber(previousIncome, ['earnings_per_share_diluted', 'earnings_per_share'])
  const shares = firstNumber(latestBalance, ['outstanding_shares']) ?? firstNumber(latestIncome, ['weighted_average_shares_diluted', 'weighted_average_shares'])
  const cashValue = firstNumber(latestBalance, ['cash_and_equivalents'])
  const debtValue = firstNumber(latestBalance, ['total_debt']) ?? (() => {
    const current = firstNumber(latestBalance, ['current_debt'])
    const nonCurrent = firstNumber(latestBalance, ['non_current_debt'])
    return current !== null || nonCurrent !== null ? (current ?? 0) + (nonCurrent ?? 0) : null
  })()
  const operatingCashFlow = firstNumber(latestCashFlow, ['net_cash_flow_from_operations'])
  const capex = firstNumber(latestCashFlow, ['capital_expenditure'])
  const freeCashFlow = firstNumber(latestCashFlow, ['free_cash_flow'])

  if (revenue !== null) push(makeMetric('revenue', 'Ventas', revenue, sourceUrls, { kind: 'compact', period: incomePeriod }))
  if (revenue !== null && previousRevenue !== null && previousRevenue !== 0) push(makeMetric('revenue-growth', 'Crecimiento de ventas interanual', ((revenue / previousRevenue) - 1) * 100, sourceUrls, { kind: 'percent', period: `${recordPeriod(previousIncome, ['report_period']) ?? '?'} → ${incomePeriod ?? '?'}` }))
  if (netIncome !== null) push(makeMetric('net-income', 'Beneficio neto', netIncome, sourceUrls, { kind: 'compact', period: incomePeriod }))
  if (eps !== null) push(makeMetric('eps', 'Beneficio por acción', eps, sourceUrls, { kind: 'number', period: incomePeriod }))
  if (eps !== null && previousEps !== null && previousEps !== 0) push(makeMetric('eps-growth', 'Crecimiento del BPA interanual', ((eps / previousEps) - 1) * 100, sourceUrls, { kind: 'percent', period: `${recordPeriod(previousIncome, ['report_period']) ?? '?'} → ${incomePeriod ?? '?'}` }))
  if (revenue) {
    if (grossProfit !== null) push(makeMetric('gross-margin', 'Margen bruto', (grossProfit / revenue) * 100, sourceUrls, { kind: 'percent', period: incomePeriod }))
    if (operatingIncome !== null) push(makeMetric('operating-margin', 'Margen operativo', (operatingIncome / revenue) * 100, sourceUrls, { kind: 'percent', period: incomePeriod }))
    if (netIncome !== null) push(makeMetric('net-margin', 'Margen neto', (netIncome / revenue) * 100, sourceUrls, { kind: 'percent', period: incomePeriod }))
  }
  if (cashValue !== null) push(makeMetric('cash', 'Caja', cashValue, sourceUrls, { kind: 'compact', period: balancePeriod }))
  if (debtValue !== null) push(makeMetric('debt', 'Deuda', debtValue, sourceUrls, { kind: 'compact', period: balancePeriod }))
  if (cashValue !== null && debtValue !== null) push(makeMetric('net-debt', 'Deuda neta', debtValue - cashValue, sourceUrls, { kind: 'compact', period: balancePeriod, note: 'Calculada como deuda menos caja.' }))
  if (shares !== null) push(makeMetric('shares', 'Acciones en circulación', shares, sourceUrls, { kind: 'compact', period: balancePeriod ?? incomePeriod }))
  if (operatingCashFlow !== null) push(makeMetric('operating-cash-flow', 'Flujo de caja operativo', operatingCashFlow, sourceUrls, { kind: 'compact', period: cashPeriod }))
  if (freeCashFlow !== null) push(makeMetric('free-cash-flow', 'Flujo de caja libre', freeCashFlow, sourceUrls, { kind: 'compact', period: cashPeriod }))
  else if (operatingCashFlow !== null && capex !== null) push(makeMetric('free-cash-flow', 'Flujo de caja libre', operatingCashFlow - Math.abs(capex), sourceUrls, { kind: 'compact', period: cashPeriod, note: 'Calculado como flujo operativo menos capex reportado.' }))

  const requestedSymbol = identitySymbol(entity.symbol)
  const returnedSymbols = [...income, ...balance, ...cashFlow]
    .map((record) => typeof record.ticker === 'string' ? identitySymbol(record.ticker) : '')
    .filter(Boolean)
  const periods = [incomePeriod, balancePeriod, cashPeriod].filter((value): value is string => Boolean(value)).sort()
  return {
    symbol: entity.symbol,
    company: entity.company,
    exchange: entity.exchange,
    dataAsOf: periods.at(-1) ?? new Date().toISOString(),
    identityVerified: Boolean(requestedSymbol && returnedSymbols.includes(requestedSymbol)),
    metrics: mergeMetrics(metrics),
    sources: metrics.length ? sourceUrls : [],
    warnings: metrics.length ? [] : ['Financial Datasets no devolvió estados financieros reconocibles para este símbolo'],
  }
}

async function fetchYahooMarketSnapshot(entity: ResearchEntity): Promise<FundamentalSnapshot> {
  const url = new URL(`https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(entity.symbol)}`)
  url.searchParams.set('range', '5d')
  url.searchParams.set('interval', '1d')
  url.searchParams.set('events', 'history')
  const summaryPromise = fetchYahooQuoteSummary(entity.symbol)
    .then((summary) => ({ summary, warning: '' }))
    .catch((error) => ({
      summary: null,
      warning: error instanceof Error ? error.message : 'Yahoo Finance no devolvió fundamentales',
    }))
  const response = await fetch(url, {
    headers: { 'User-Agent': YAHOO_USER_AGENT },
    cache: 'no-store',
    signal: AbortSignal.timeout(12_000),
  })
  if (!response.ok) throw new Error(`Yahoo Finance respondió HTTP ${response.status}`)
  const payload = asRecord(await response.json().catch(() => null))
  const chart = asRecord(payload?.chart)
  const result = asRecordArray(chart?.result)[0]
  const meta = asRecord(result?.meta)
  const returnedSymbol = typeof meta?.symbol === 'string' ? meta.symbol : ''
  const price = firstNumber(meta ?? undefined, ['regularMarketPrice'])
  const previousClose = firstNumber(meta ?? undefined, ['chartPreviousClose', 'previousClose'])
  const timestamp = firstNumber(meta ?? undefined, ['regularMarketTime'])
  const marketCurrency = typeof meta?.currency === 'string' ? meta.currency.trim() : ''
  const marketSource = safeSource('Yahoo Finance · mercado', url.toString())
  const fundamentalsSource = safeSource('Yahoo Finance · fundamentales', `https://finance.yahoo.com/quote/${encodeURIComponent(entity.symbol)}/`)
  if (!marketSource || !fundamentalsSource) throw new Error('URL de Yahoo Finance no válida')
  const metrics: ResearchMetric[] = []
  if (price !== null && price > 0) {
    const changePercent = previousClose && previousClose > 0 ? ((price / previousClose) - 1) * 100 : null
    const priceMetric = makeMetric('price', 'Precio de mercado', price, [marketSource], {
      kind: 'number',
      period: timestamp && timestamp > 1_000_000_000 ? new Date(timestamp * 1000).toISOString() : 'último dato disponible',
      note: changePercent === null ? undefined : `Variación frente al cierre anterior: ${formatPercent(changePercent)}.`,
    })
    metrics.push(marketCurrency ? { ...priceMetric, value: `${priceMetric.value} ${marketCurrency}`, unit: marketCurrency } : priceMetric)
  }
  const { summary, warning: summaryWarning } = await summaryPromise
  const financialData = asRecord(summary?.financialData)
  const statistics = asRecord(summary?.defaultKeyStatistics)
  const summaryDetail = asRecord(summary?.summaryDetail)
  const financialCurrency = typeof financialData?.financialCurrency === 'string' ? financialData.financialCurrency.trim() : ''
  const ttmMetrics: Array<{
    key: ResearchMetricKey
    label: string
    record: JsonRecord | null
    field: string
    kind: 'percent' | 'multiple' | 'number' | 'compact'
  }> = [
    { key: 'market-cap', label: 'Capitalización', record: summaryDetail, field: 'marketCap', kind: 'compact' },
    { key: 'revenue', label: 'Ventas TTM', record: financialData, field: 'totalRevenue', kind: 'compact' },
    { key: 'revenue-growth', label: 'Crecimiento de ventas interanual', record: financialData, field: 'revenueGrowth', kind: 'percent' },
    { key: 'eps', label: 'Beneficio por acción', record: statistics, field: 'trailingEps', kind: 'number' },
    { key: 'eps-growth', label: 'Crecimiento del beneficio interanual', record: financialData, field: 'earningsGrowth', kind: 'percent' },
    { key: 'gross-margin', label: 'Margen bruto', record: financialData, field: 'grossMargins', kind: 'percent' },
    { key: 'operating-margin', label: 'Margen operativo', record: financialData, field: 'operatingMargins', kind: 'percent' },
    { key: 'net-margin', label: 'Margen neto', record: financialData, field: 'profitMargins', kind: 'percent' },
    { key: 'operating-cash-flow', label: 'Flujo de caja operativo', record: financialData, field: 'operatingCashflow', kind: 'compact' },
    { key: 'free-cash-flow', label: 'Flujo de caja libre', record: financialData, field: 'freeCashflow', kind: 'compact' },
    { key: 'cash', label: 'Caja', record: financialData, field: 'totalCash', kind: 'compact' },
    { key: 'debt', label: 'Deuda', record: financialData, field: 'totalDebt', kind: 'compact' },
    { key: 'shares', label: 'Acciones en circulación', record: statistics, field: 'sharesOutstanding', kind: 'compact' },
    { key: 'pe', label: 'PER', record: summaryDetail, field: 'trailingPE', kind: 'multiple' },
    { key: 'ps', label: 'Precio / ventas', record: summaryDetail, field: 'priceToSalesTrailing12Months', kind: 'multiple' },
    { key: 'roe', label: 'ROE', record: financialData, field: 'returnOnEquity', kind: 'percent' },
  ]
  for (const definition of ttmMetrics) {
    const value = yahooNumber(definition.record, definition.field)
    if (value !== null && isUsableMetricValue(definition.key, value)) {
      const metric = makeMetric(definition.key, definition.label, value, [fundamentalsSource], {
        kind: definition.kind,
        period: 'TTM o último dato publicado',
      })
      const financialKeys: ResearchMetricKey[] = ['revenue', 'operating-cash-flow', 'free-cash-flow', 'cash', 'debt']
      const currency = definition.key === 'market-cap' ? marketCurrency : financialKeys.includes(definition.key) ? financialCurrency : ''
      const unit = definition.key === 'eps' && financialCurrency ? `${financialCurrency}/acción` : currency
      metrics.push(unit ? { ...metric, value: `${metric.value} ${unit}`, unit } : metric)
    }
  }
  const cashValue = metrics.find((metric) => metric.key === 'cash')?.numericValue
  const debtValue = metrics.find((metric) => metric.key === 'debt')?.numericValue
  if (cashValue !== undefined && debtValue !== undefined) {
    const metric = makeMetric('net-debt', 'Deuda neta', debtValue - cashValue, [fundamentalsSource], {
      kind: 'compact', period: 'último dato publicado', note: 'Calculada como deuda menos caja.',
    })
    metrics.push(financialCurrency ? { ...metric, value: `${metric.value} ${financialCurrency}`, unit: financialCurrency } : metric)
  }
  const incomeHistory = asRecord(summary?.incomeStatementHistory)
  const annualIncome = orderedRecords(incomeHistory?.incomeStatementHistory, 'endDate')
  const latestIncome = annualIncome[0]
  const netIncome = yahooNumber(latestIncome ? asRecord(latestIncome.netIncome) : null, 'raw')
  const statementPeriodRaw = asRecord(latestIncome?.endDate)
  const statementTimestamp = firstNumber(statementPeriodRaw ?? undefined, ['raw'])
  const statementPeriod = statementTimestamp && statementTimestamp > 1_000_000_000
    ? new Date(statementTimestamp * 1000).toISOString().slice(0, 10)
    : typeof statementPeriodRaw?.fmt === 'string' ? statementPeriodRaw.fmt : undefined
  if (netIncome !== null) {
    const metric = makeMetric('net-income', 'Beneficio neto', netIncome, [fundamentalsSource], {
      kind: 'compact', period: statementPeriod ?? 'último ejercicio publicado',
    })
    metrics.push(financialCurrency ? { ...metric, value: `${metric.value} ${financialCurrency}`, unit: financialCurrency } : metric)
  }
  const requestedSymbol = identitySymbol(entity.symbol)
  const company = [meta?.longName, meta?.shortName]
    .find((value): value is string => typeof value === 'string' && Boolean(value.trim()))
  const exchange = [meta?.fullExchangeName, meta?.exchangeName]
    .find((value): value is string => typeof value === 'string' && Boolean(value.trim()))
  return {
    symbol: returnedSymbol || entity.symbol,
    company: company?.trim() || entity.company,
    exchange: exchange?.trim() || entity.exchange,
    dataAsOf: timestamp && timestamp > 1_000_000_000 ? new Date(timestamp * 1000).toISOString() : new Date().toISOString(),
    identityVerified: Boolean(requestedSymbol && identitySymbol(returnedSymbol) === requestedSymbol && metrics.length),
    price,
    changePercent: price !== null && previousClose && previousClose > 0 ? ((price / previousClose) - 1) * 100 : null,
    metrics: mergeMetrics(metrics),
    sources: metrics.length ? uniqueSources([marketSource, summary ? fundamentalsSource : null]) : [],
    warnings: [
      metrics.length ? '' : 'Yahoo Finance no devolvió un precio utilizable para este símbolo',
      summaryWarning,
    ].filter(Boolean),
  }
}

export async function collectFundamentals(entity: ResearchEntity, credentials: SourceCredentials): Promise<FundamentalSnapshot> {
  const tasks: Promise<FundamentalSnapshot>[] = [fetchYahooMarketSnapshot(entity)]
  if (credentials.finnhubToken) tasks.push(fetchFinnhubMetrics(entity, credentials.finnhubToken))
  if (credentials.secContactEmail) tasks.push(fetchSecMetrics(entity, credentials.secContactEmail))
  if (credentials.fiscalApiKey) tasks.push(fetchFiscalMetrics(entity, credentials.fiscalApiKey))
  if (credentials.alphaVantageApiKey) tasks.push(fetchAlphaVantageMetrics(entity, credentials.alphaVantageApiKey))
  if (credentials.financialDatasetsApiKey) tasks.push(fetchFinancialDatasetsMetrics(entity, credentials.financialDatasetsApiKey))

  if (!tasks.length) {
    return {
      symbol: entity.symbol,
      company: entity.company,
      exchange: entity.exchange,
      dataAsOf: new Date().toISOString(),
      identityVerified: false,
      metrics: [],
      sources: [],
      warnings: ['No hay una fuente de fundamentales configurada para este símbolo'],
    }
  }

  const results = await Promise.allSettled(tasks)
  const fulfilled = results.flatMap((result) => result.status === 'fulfilled' ? [result.value] : [])
  const warnings = results.flatMap((result) => result.status === 'rejected' ? [result.reason instanceof Error ? result.reason.message : 'Una fuente financiera no respondió'] : [])
  return {
    symbol: entity.symbol,
    company: entity.company,
    exchange: entity.exchange,
    dataAsOf: fulfilled.map((result) => result.dataAsOf).sort().at(-1) ?? new Date().toISOString(),
    identityVerified: fulfilled.some((result) => result.identityVerified),
    metrics: mergeMetrics(...fulfilled.map((result) => result.metrics)),
    sources: uniqueSources(fulfilled.flatMap((result) => result.sources)),
    warnings: [...new Set([...warnings, ...fulfilled.flatMap((result) => result.warnings)])],
  }
}

export function mergeFundamentalSnapshots(snapshots: FundamentalSnapshot[]) {
  const bySymbol = new Map<string, FundamentalSnapshot>()
  for (const snapshot of snapshots) {
    const key = snapshot.symbol.toUpperCase()
    const existing = bySymbol.get(key)
    if (!existing) {
      bySymbol.set(key, snapshot)
      continue
    }
    bySymbol.set(key, {
      ...existing,
      identityVerified: existing.identityVerified || snapshot.identityVerified,
      price: existing.price ?? snapshot.price,
      changePercent: existing.changePercent ?? snapshot.changePercent,
      metrics: mergeMetrics(existing.metrics, snapshot.metrics),
      sources: uniqueSources([...existing.sources, ...snapshot.sources]),
      warnings: [...new Set([...existing.warnings, ...snapshot.warnings])],
      dataAsOf: [existing.dataAsOf, snapshot.dataAsOf].sort().at(-1) ?? existing.dataAsOf,
    })
  }
  return [...bySymbol.values()]
}

type ScorecardNarrative = {
  category: LynchCategoryKey
  categoryReason?: string
  evidence?: string[]
  risks?: string[]
}

type ScorecardSources = {
  webSources: ResearchSource[]
  newsSources: ResearchSource[]
}

function statusForMetric(metrics: ResearchMetric[], keys: ResearchMetricKey[]) {
  const matches = metrics.filter((metric) => keys.includes(metric.key) && metric.status === 'verified')
  return matches.length ? matches : []
}

export function buildResearchScorecard(
  snapshot: FundamentalSnapshot | undefined,
  narrative: ScorecardNarrative,
  sources: ScorecardSources,
): ResearchScorecard {
  const empty = createEmptyScorecard(
    narrative.categoryReason || 'La categoría es una lectura cualitativa; necesita confirmarse con los datos de la empresa.',
  )
  const available = snapshot?.metrics ?? []
  const metricsByKey = new Map(available.map((metric) => [metric.key, metric]))
  const metrics = empty.metrics.map((metric) => metricsByKey.get(metric.key) ?? metric)
  const webSourceUrls = sources.webSources
  const newsSourceUrls = sources.newsSources
  const check = (
    key: ResearchCheck['key'],
    label: string,
    status: ResearchCheck['status'],
    detail: string,
    sourceUrls: ResearchSource[],
  ): ResearchCheck => ({ key, label, status, detail, sourceUrls: uniqueSources(sourceUrls) })

  const growth = statusForMetric(available, ['revenue-growth', 'eps-growth'])
  const profitability = statusForMetric(available, ['net-margin', 'operating-margin', 'gross-margin', 'roe', 'roic'])
  const balance = statusForMetric(available, ['cash', 'debt', 'net-debt', 'operating-cash-flow', 'free-cash-flow'])
  const valuation = statusForMetric(available, ['pe', 'ps'])
  const dilution = statusForMetric(available, ['shares'])
  const growthStatus: ResearchCheck['status'] = growth.length >= 2 && metricsByKey.has('revenue') && metricsByKey.has('eps')
    ? 'verified'
    : growth.length ? 'partial' : 'missing'
  const profitabilityStatus: ResearchCheck['status'] = profitability.length >= 2
    ? 'verified'
    : profitability.length ? 'partial' : 'missing'
  const balanceStatus: ResearchCheck['status'] = balance.length >= 2
    ? 'verified'
    : balance.length ? 'partial' : 'missing'
  const coreKeys: ResearchMetricKey[] = [
    'revenue', 'revenue-growth', 'net-income', 'eps', 'eps-growth',
    'free-cash-flow', 'cash', 'debt', 'shares', 'pe', 'ps',
  ]
  const covered = coreKeys.filter((key) => metricsByKey.get(key)?.status === 'verified').length
  const coverage = Math.round((covered / coreKeys.length) * 100)
  const dataQuality = coverage >= 75 ? 'complete' : coverage >= 35 ? 'partial' : 'insufficient'
  const checks = [
    check('story', 'Historia del negocio', webSourceUrls.length ? 'partial' : 'missing', webSourceUrls.length
      ? `${webSourceUrls.length} fuentes web aportan contexto; la historia debe contrastarse con el informe de la empresa.`
      : 'No se encontraron fuentes web para contrastar qué vende y por qué vuelve el cliente.', webSourceUrls),
    check('category', 'Categoría Lynch', narrative.categoryReason ? 'partial' : 'missing', narrative.categoryReason
      ? narrative.categoryReason
      : `Clasificada como ${narrative.category}, sin explicación suficiente para verificar la categoría.`, webSourceUrls),
    check('growth', 'Crecimiento', growthStatus, growth.length
      ? `${growth.map((metric) => `${metric.label}: ${metric.value}`).join(' · ')}.`
      : 'Faltan ventas o BPA comparables para comprobar el crecimiento.', growth.flatMap((metric) => metric.sourceUrls)),
    check('profitability', 'Rentabilidad', profitabilityStatus, profitability.length
      ? `${profitability.map((metric) => `${metric.label}: ${metric.value}`).join(' · ')}.`
      : 'Faltan márgenes, ROE o ROIC verificables.', profitability.flatMap((metric) => metric.sourceUrls)),
    check('balance-sheet', 'Balance y deuda', balanceStatus, balance.length
      ? `${balance.map((metric) => `${metric.label}: ${metric.value}`).join(' · ')}.`
      : 'Faltan caja, deuda o flujo de caja para medir la capacidad de esperar.', balance.flatMap((metric) => metric.sourceUrls)),
    check('valuation', 'Valoración', valuation.length ? (valuation.length >= 2 ? 'verified' : 'partial') : 'missing', valuation.length
      ? `${valuation.map((metric) => `${metric.label}: ${metric.value}`).join(' · ')}. No se compara automáticamente con un valor razonable.`
      : 'No hay múltiplos verificables; no se puede juzgar si el precio deja margen.', valuation.flatMap((metric) => metric.sourceUrls)),
    check('dilution', 'Acciones y dilución', dilution.length ? 'partial' : 'missing', dilution.length
      ? `Acciones reportadas: ${dilution[0]?.value}. Falta una serie histórica para confirmar dilución.`
      : 'No hay acciones en circulación verificables.', dilution.flatMap((metric) => metric.sourceUrls)),
    check('risk', 'Riesgos e invalidación', narrative.risks?.length ? 'partial' : 'missing', narrative.risks?.length
      ? `${narrative.risks.length} riesgos propuestos por el análisis; revisa cada uno en su fuente primaria.`
      : 'El análisis no devolvió riesgos concretos que puedan invalidar la tesis.', newsSourceUrls),
  ]
  const weights: Record<ResearchCheck['key'], number> = {
    story: 0.5,
    category: 0.5,
    growth: 1.5,
    profitability: 1.5,
    'balance-sheet': 1.5,
    valuation: 1.5,
    dilution: 1,
    risk: 0.5,
  }
  const statusPoints = (status: ResearchCheck['status']) => status === 'verified' ? 1 : status === 'partial' ? 0.5 : 0
  const totalWeight = checks.reduce((sum, item) => sum + weights[item.key], 0)
  const score = Math.round((checks.reduce((sum, item) => sum + weights[item.key] * statusPoints(item.status), 0) / totalWeight) * 100)
  const verdict = score >= 65 && coverage >= 50 && valuation.length
    ? 'investigar'
    : score >= 35 || coverage >= 25
      ? 'esperar'
      : 'sin-datos'

  return {
    score,
    coverage,
    dataQuality,
    verdict,
    categoryReason: narrative.categoryReason || empty.categoryReason,
    metrics,
    checks,
    valuation: {
      status: valuation.length >= 2 ? 'evaluable' : valuation.length ? 'partial' : 'not-evaluable',
      label: valuation.length >= 2 ? 'Múltiplos disponibles' : valuation.length ? 'Valoración parcial' : 'No evaluable',
      note: valuation.length
        ? 'Los múltiplos son una fotografía; la aplicación no calcula un precio objetivo ni compara automáticamente con un histórico.'
        : 'Añade una fuente de fundamentales o revisa los informes para obtener múltiplos.',
    },
  }
}
