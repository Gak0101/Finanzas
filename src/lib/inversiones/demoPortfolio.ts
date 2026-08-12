import type {
  InversionAlerta,
  InversionOperacion,
  InversionPosicion,
  InversionSnapshotDiario,
} from '@/lib/db/schema'
import { calculateInvestmentAnalytics, type InvestmentAnalytics } from '@/lib/inversiones/analytics'
import type { ClosedInvestmentPosition } from '@/lib/inversiones/history'

export type DemoPortfolioConfig = {
  id: string
  name: string
  capital: number
  /** Kept for backwards-compatible localStorage entries; market data determines the return. */
  targetReturnPct?: number
  createdAt: string
}

export type DemoPortfolioData = {
  positions: InversionPosicion[]
  operations: InversionOperacion[]
  snapshots: InversionSnapshotDiario[]
  notificationAlerts: InversionAlerta[]
  closedPositions: ClosedInvestmentPosition[]
  analytics: InvestmentAnalytics
}

export const DEMO_PORTFOLIO_STORAGE_KEY = 'finanzas:investment-demo-portfolios:v1'

export const DEFAULT_DEMO_PORTFOLIO: DemoPortfolioConfig = {
  id: 'growth-20k',
  name: 'Cartera Growth',
  capital: 20_000,
  targetReturnPct: 2.777692,
  createdAt: '2026-08-12T00:00:00.000Z',
}

const REFERENCE_OPENING_DATE = '2021-08-12'
const REFERENCE_VALUATION_DATE = '2026-08-12'
const PRICE_AS_OF_DATE = '2026-08-11'
const HISTORICAL_EURUSD = 1.173626
const CURRENT_EURUSD = 1.154068
const PRICE_SOURCE_URL = 'https://finance.yahoo.com/quote/'

// Reference adjusted closes from Yahoo Finance for the five-year comparison.
// The positions remain a local scenario; only the quoted prices and EUR/USD conversion are market references.

type DemoAssetDefinition = {
  asset: string
  ticker: string
  type: 'Acción' | 'ETF' | 'Crypto'
  marketSymbol: string
  isin: string
  sector: string
  country: string
  allocationEur: number
  historicalAdjustedCloseUsd: number
  currentAdjustedCloseUsd: number
}

const DEMO_ASSETS: DemoAssetDefinition[] = [
  { asset: 'NVIDIA Corporation', ticker: 'NVDA', type: 'Acción', marketSymbol: 'NASDAQ:NVDA', isin: 'US67066G1040', sector: 'Semiconductores', country: 'Estados Unidos', allocationEur: 500, historicalAdjustedCloseUsd: 19.83638954, currentAdjustedCloseUsd: 217.5 },
  { asset: 'Vertiv Holdings Co.', ticker: 'VRT', type: 'Acción', marketSymbol: 'NYSE:VRT', isin: 'US92537N1081', sector: 'Centros de datos', country: 'Estados Unidos', allocationEur: 800, historicalAdjustedCloseUsd: 27.32933807, currentAdjustedCloseUsd: 281.81 },
  { asset: 'Oracle Corporation', ticker: 'ORCL', type: 'Acción', marketSymbol: 'NYSE:ORCL', isin: 'US68389X1054', sector: 'Software empresarial', country: 'Estados Unidos', allocationEur: 4_200, historicalAdjustedCloseUsd: 83.95598602, currentAdjustedCloseUsd: 145.48 },
  { asset: 'Costco Wholesale Corporation', ticker: 'COST', type: 'Acción', marketSymbol: 'NASDAQ:COST', isin: 'US22160K1051', sector: 'Consumo', country: 'Estados Unidos', allocationEur: 2_000, historicalAdjustedCloseUsd: 422.05541992, currentAdjustedCloseUsd: 944.32 },
  { asset: 'Cloudflare, Inc.', ticker: 'NET', type: 'Acción', marketSymbol: 'NYSE:NET', isin: 'US18915M1071', sector: 'Ciberseguridad', country: 'Estados Unidos', allocationEur: 2_500, historicalAdjustedCloseUsd: 122.23000336, currentAdjustedCloseUsd: 306.97000122 },
  { asset: 'TransMedics Group, Inc.', ticker: 'TMDX', type: 'Acción', marketSymbol: 'NASDAQ:TMDX', isin: 'US89377M1099', sector: 'Tecnología médica', country: 'Estados Unidos', allocationEur: 2_000, historicalAdjustedCloseUsd: 30.23999977, currentAdjustedCloseUsd: 89.36000061 },
  { asset: 'Axon Enterprise, Inc.', ticker: 'AXON', type: 'Acción', marketSymbol: 'NASDAQ:AXON', isin: 'US05464C1018', sector: 'Tecnología de seguridad', country: 'Estados Unidos', allocationEur: 2_000, historicalAdjustedCloseUsd: 186.44999695, currentAdjustedCloseUsd: 636.30999756 },
  { asset: 'CrowdStrike Holdings, Inc.', ticker: 'CRWD', type: 'Acción', marketSymbol: 'NASDAQ:CRWD', isin: 'US22788C1053', sector: 'Ciberseguridad', country: 'Estados Unidos', allocationEur: 2_000, historicalAdjustedCloseUsd: 61.45500183, currentAdjustedCloseUsd: 221.8999939 },
  { asset: 'Taiwan Semiconductor Manufacturing Co.', ticker: 'TSM', type: 'Acción', marketSymbol: 'NYSE:TSM', isin: 'US8740391003', sector: 'Semiconductores', country: 'Taiwán', allocationEur: 1_500, historicalAdjustedCloseUsd: 106.65216064, currentAdjustedCloseUsd: 422.05999756 },
  { asset: 'Cameco Corporation', ticker: 'CCJ', type: 'Acción', marketSymbol: 'NYSE:CCJ', isin: 'CA13321L1085', sector: 'Uranio y energía', country: 'Canadá', allocationEur: 1_000, historicalAdjustedCloseUsd: 16.9794445, currentAdjustedCloseUsd: 98.73000336 },
  { asset: 'Palantir Technologies Inc.', ticker: 'PLTR', type: 'Acción', marketSymbol: 'NASDAQ:PLTR', isin: 'US69608A1088', sector: 'Software empresarial', country: 'Estados Unidos', allocationEur: 1_000, historicalAdjustedCloseUsd: 24.88999939, currentAdjustedCloseUsd: 174.94000244 },
  { asset: 'Rocket Lab USA, Inc.', ticker: 'RKLB', type: 'Acción', marketSymbol: 'NASDAQ:RKLB', isin: 'US7731221062', sector: 'Espacio', country: 'Estados Unidos', allocationEur: 500, historicalAdjustedCloseUsd: 10.53999996, currentAdjustedCloseUsd: 80.01000214 },
]

const BASE_CAPITAL = DEMO_ASSETS.reduce((sum, item) => sum + item.allocationEur, 0)
const BASE_VALUE = DEMO_ASSETS.reduce(
  (sum, item) => sum + item.allocationEur * (item.currentAdjustedCloseUsd / CURRENT_EURUSD) / (item.historicalAdjustedCloseUsd / HISTORICAL_EURUSD),
  0,
)

function isoAtNoon(date: string) {
  return `${date}T12:00:00.000Z`
}

function createDemoPosition(
  definition: DemoAssetDefinition,
  index: number,
  config: DemoPortfolioConfig,
  openingDate: string,
  valuationDate: string,
): InversionPosicion {
  const cost = config.capital * (definition.allocationEur / BASE_CAPITAL)
  const purchasePrice = definition.historicalAdjustedCloseUsd / HISTORICAL_EURUSD
  const currentPrice = definition.currentAdjustedCloseUsd / CURRENT_EURUSD
  const quantity = cost / purchasePrice
  const value = quantity * currentPrice
  const pnl = value - cost

  return {
    id: 90_000 + index,
    usuario_id: 0,
    custodia: 'Cartera Growth',
    broker: 'Escenario',
    activo: definition.asset,
    tipo: definition.type,
    ticker: definition.ticker,
    isin: definition.isin,
    price_ticker: definition.ticker,
    crypto_id: definition.type === 'Crypto' ? 'bitcoin' : null,
    cantidad: quantity,
    precio_compra: purchasePrice,
    coste: cost,
    objetivo_peso_pct: null,
    precio_actual: currentPrice,
    valor_actual: value,
    pnl,
    pnl_pct: cost > 0 ? pnl / cost : null,
    peso: value > 0 ? value / (config.capital * (BASE_VALUE / BASE_CAPITAL)) : 0,
    fuente: 'Referencia de mercado',
    estado_fuente: 'REFERENCE',
    ultimo_valido: currentPrice,
    fallback_map: null,
    proveedor: 'Yahoo Finance · adjusted close',
    fuente_url: `${PRICE_SOURCE_URL}${definition.ticker}/history/`,
    nota: `Escenario local con precios de referencia de Yahoo Finance; cierre ajustado al ${PRICE_AS_OF_DATE}.`,
    snapshot_at: isoAtNoon(valuationDate),
    fecha_apertura: openingDate,
    hoja_origen: config.name,
    fila_origen: index + 1,
    incluido_resumen: true,
    divisa: 'EUR',
    sector: definition.sector,
    pais: definition.country,
    objetivo_precio: null,
    alerta_subida_pct: null,
    alerta_caida_pct: null,
    market_symbol: definition.marketSymbol,
    created_at: isoAtNoon(openingDate),
    updated_at: isoAtNoon(valuationDate),
  }
}

function createDemoOperation(position: InversionPosicion, index: number, openingDate: string): InversionOperacion {
  return {
    id: 91_000 + index,
    usuario_id: 0,
    fecha: openingDate,
    fecha_hora: isoAtNoon(openingDate),
    tipo: 'Compra',
    tipo_externo: null,
    activo: position.activo,
    ticker: position.ticker,
    tipo_activo: position.tipo,
    custodia: position.custodia,
    cantidad: position.cantidad,
    precio_unitario: position.precio_compra ?? 0,
    importe: position.coste ?? 0,
    comision: 0,
    impuesto: 0,
    divisa: 'EUR',
    fuente: 'Referencia de mercado',
    external_id: null,
    descripcion: 'Entrada de escenario basada en precios históricos',
    notas: 'Escenario local; no representa una operación registrada.',
    created_at: isoAtNoon(openingDate),
  }
}

function createDemoSnapshot(position: InversionPosicion, index: number, date: string, value: number, price: number, pnl: number): InversionSnapshotDiario {
  return {
    id: 92_000 + index,
    usuario_id: 0,
    posicion_id: position.id,
    fecha_valoracion: date,
    cantidad: position.cantidad,
    coste_eur: position.coste,
    precio_eur: price,
    valor_eur: value,
    pnl_no_realizado_eur: pnl,
    precio_as_of: isoAtNoon(date),
    proveedor: 'Yahoo Finance · adjusted close',
    estado_precio: 'reference',
    created_at: isoAtNoon(date),
    updated_at: isoAtNoon(date),
  }
}

export function buildDemoPortfolioData(config: DemoPortfolioConfig): DemoPortfolioData {
  const openingDate = REFERENCE_OPENING_DATE
  const valuationDate = REFERENCE_VALUATION_DATE
  const positions = DEMO_ASSETS.map((definition, index) => createDemoPosition(definition, index, config, openingDate, valuationDate))
  const operations = positions.map((position, index) => createDemoOperation(position, index, openingDate))
  const snapshots = positions.flatMap((position, index) => [
    createDemoSnapshot(position, 2 * index, openingDate, position.coste ?? 0, position.precio_compra ?? 0, 0),
    createDemoSnapshot(position, 2 * index + 1, valuationDate, position.valor_actual ?? 0, position.precio_actual ?? 0, position.pnl ?? 0),
  ])

  return {
    positions,
    operations,
    snapshots,
    notificationAlerts: [],
    closedPositions: [],
    analytics: calculateInvestmentAnalytics(positions, operations, snapshots),
  }
}
