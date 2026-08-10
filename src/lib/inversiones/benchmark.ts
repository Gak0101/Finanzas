export const BENCHMARKS = {
  world: { label: 'MSCI World', symbol: 'URTH' },
  sp500: { label: 'S&P 500', symbol: '^GSPC' },
  europe: { label: 'Euro Stoxx 50', symbol: '^STOXX50E' },
} as const

export type BenchmarkKey = keyof typeof BENCHMARKS

export type BenchmarkPoint = {
  date: string
  value: number
}
