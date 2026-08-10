const ISIN_PATTERN = /^[A-Z]{2}[A-Z0-9]{9}[0-9]$/

const KNOWN_ISINS_BY_SYMBOL: Record<string, string> = {
  ATYM: 'CY0106002112',
  'ATYM.L': 'CY0106002112',
  'ATYML.XC': 'CY0106002112',
  'E5S1.DU': 'CY0106002112',
  'E5S1.F': 'CY0106002112',
  'E5S1.HM': 'CY0106002112',
  'E5S1.SG': 'CY0106002112',
  ISRCF: 'IE00B3WJKG14',
  NVDA: 'US67066G1040',
  PAAS: 'CA6979001089',
  'PHAG.MI': 'JE00B1VS3333',
  WPC: 'US92936U1097',
  '0P00012JRK': 'LU1046421795',
}

const KNOWN_TRADINGVIEW_SYMBOLS_BY_ISIN: Record<string, string> = {
  // Yahoo puede devolver ATYM.L, ATYML.XC o E5S1.* para el mismo emisor.
  // El widget gratuito de TradingView sí expone la cotización alemana.
  CY0106002112: 'FWB:E5S1',
}

export function normalizeIsin(value: string | null | undefined) {
  const normalized = value?.trim().toUpperCase().replace(/\s+/g, '')
  return normalized && ISIN_PATTERN.test(normalized) ? normalized : null
}

function instrumentLookupKeys(value: string | null | undefined) {
  const normalized = value?.trim().toUpperCase().replace(/\s+/g, '')
  if (!normalized) return []
  const withoutVendorPrefix = normalized.replace(/^(?:OTCMKTS|NYSE|NASDAQ|BIT):/, '')
  const baseSymbol = withoutVendorPrefix.split(':').at(-1) ?? withoutVendorPrefix
  return [...new Set([normalized, withoutVendorPrefix, baseSymbol])]
}

export function inferIsin(...values: Array<string | null | undefined>) {
  for (const value of values) {
    const isin = normalizeIsin(value)
    if (isin) return isin
    for (const key of instrumentLookupKeys(value)) {
      const knownIsin = KNOWN_ISINS_BY_SYMBOL[key]
      if (knownIsin) return knownIsin
    }
  }
  return null
}

const TRADINGVIEW_EXCHANGES_BY_YAHOO_SUFFIX: Record<string, string> = {
  AS: 'EURONEXT',
  DE: 'XETR',
  L: 'LSE',
  MC: 'BME',
  MI: 'MIL',
  PA: 'EURONEXT',
  SW: 'SIX',
  TO: 'TSX',
  VI: 'VIE',
}

function normalizeMarketSymbol(value: string) {
  return value.trim().toUpperCase().replace(/\s+/g, '')
}

/**
 * Converts the provider's market identifier into a TradingView symbol.
 * Unknown Yahoo suffixes are rejected instead of sending a symbol that the
 * embedded chart will render as "Este símbolo no existe".
 */
export function inferTradingViewSymbol(...values: Array<string | null | undefined>) {
  const isin = inferIsin(...values)
  if (isin && KNOWN_TRADINGVIEW_SYMBOLS_BY_ISIN[isin]) return KNOWN_TRADINGVIEW_SYMBOLS_BY_ISIN[isin]

  for (const value of values) {
    if (!value?.trim()) continue
    const normalized = normalizeMarketSymbol(value)
    if (normalizeIsin(normalized)) continue
    if (normalized.includes(':')) return normalized

    const match = normalized.match(/^(.+)\.([A-Z0-9]+)$/)
    if (!match) return normalized

    const [, base, suffix] = match
    const exchange = TRADINGVIEW_EXCHANGES_BY_YAHOO_SUFFIX[suffix]
    if (exchange) return `${exchange}:${base}`
  }

  return null
}

export function exchangeLabelFromSymbol(symbol: string | null | undefined) {
  const suffix = symbol?.trim().toUpperCase().match(/\.([A-Z0-9]+)$/)?.[1]
  if (!suffix) return null

  const labels: Record<string, string> = {
    AS: 'Euronext Amsterdam',
    BR: 'Euronext Brussels',
    CO: 'Nasdaq Copenhagen',
    DE: 'Xetra',
    DU: 'Düsseldorf',
    F: 'Frankfurt',
    HE: 'Nasdaq Helsinki',
    HM: 'Hamburgo',
    L: 'London Stock Exchange',
    MC: 'BME Madrid',
    MI: 'Borsa Italiana',
    OL: 'Oslo Børs',
    PA: 'Euronext Paris',
    SG: 'Stuttgart',
    ST: 'Nasdaq Stockholm',
    SW: 'SIX Swiss Exchange',
    TO: 'Toronto',
    VI: 'Vienna',
  }

  return labels[suffix] ?? null
}
