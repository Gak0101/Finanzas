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
