import type { PriceResult } from '@/lib/inversiones/marketData'

export type AlertTargetInput = {
  precio_objetivo?: number | null
  precio_objetivo_importe?: number | null
  divisa_objetivo?: string | null
}

export type AlertTarget = {
  importe: number
  divisa: string
}

export type ResolvedAlertTarget = {
  precio_objetivo: number | null
  precio_objetivo_importe: number | null
  divisa_objetivo: string | null
}

export class AlertTargetResolutionError extends Error {}

function positive(value: number | null | undefined): value is number {
  return value !== null && value !== undefined && Number.isFinite(value) && value > 0
}

export function normalizeTargetCurrency(value: string) {
  return value.trim().toUpperCase()
}

/** Returns undefined when a PATCH did not include any target field. */
export function targetFromInput(input: AlertTargetInput): AlertTarget | null | undefined {
  const hasNativeFields = Object.hasOwn(input, 'precio_objetivo_importe') || Object.hasOwn(input, 'divisa_objetivo')
  if (hasNativeFields) {
    if (input.precio_objetivo_importe === null && input.divisa_objetivo === null) return null
    if (!positive(input.precio_objetivo_importe) || !input.divisa_objetivo) {
      throw new AlertTargetResolutionError('El importe y la divisa del objetivo deben indicarse juntos.')
    }
    return { importe: input.precio_objetivo_importe, divisa: normalizeTargetCurrency(input.divisa_objetivo) }
  }

  if (Object.hasOwn(input, 'precio_objetivo')) {
    if (input.precio_objetivo === null) return null
    if (!positive(input.precio_objetivo)) throw new AlertTargetResolutionError('El precio objetivo debe ser mayor que 0.')
    return { importe: input.precio_objetivo, divisa: 'EUR' }
  }

  return undefined
}

export function resolveAlertTarget(target: AlertTarget | null, quote?: PriceResult | null): ResolvedAlertTarget {
  if (target === null) {
    return { precio_objetivo: null, precio_objetivo_importe: null, divisa_objetivo: null }
  }

  if (target.divisa === 'EUR') {
    return {
      precio_objetivo: target.importe,
      precio_objetivo_importe: target.importe,
      divisa_objetivo: 'EUR',
    }
  }

  const quoteCurrency = quote?.nativeCurrency ? normalizeTargetCurrency(quote.nativeCurrency) : null
  const nativePrice = quote?.nativePrice
  const canonicalPrice = quote?.price
  const derivedRate = quote?.fxRate ?? (
    positive(canonicalPrice) && positive(nativePrice) ? canonicalPrice / nativePrice : null
  )

  if (quoteCurrency !== target.divisa || !positive(nativePrice) || !positive(derivedRate)) {
    throw new AlertTargetResolutionError(`No hay una cotización nativa ${target.divisa} válida para guardar este objetivo.`)
  }

  return {
    precio_objetivo: target.importe * derivedRate,
    precio_objetivo_importe: target.importe,
    divisa_objetivo: target.divisa,
  }
}
