import { z } from 'zod'

export const tiposOperacionInversion = [
  'Compra',
  'Venta',
  'Dividendo',
  'Aportación',
  'Traspaso',
] as const

export const tiposActivoInversion = [
  'Crypto',
  'Crypto / Staking',
  'ETF',
  'Acción',
  'Fondo',
  'Otro',
] as const

export const origenesFondosInversion = [
  'saldo_existente',
  'capital_nuevo',
] as const

export const inversionOperacionSchema = z.object({
  fecha: z.string().min(1, 'La fecha es requerida'),
  tipo: z.enum(tiposOperacionInversion),
  origen_fondos: z.enum(origenesFondosInversion).nullable().optional(),
  activo: z.string().min(1, 'El activo es requerido').max(160),
  ticker: z.string().min(1, 'El ticker es requerido').max(80),
  price_ticker: z.string().max(80).optional(),
  market_symbol: z.string().max(80).nullable().optional(),
  crypto_id: z.string().max(80).nullable().optional(),
  isin: z.string().max(20).nullable().optional(),
  tipo_activo: z.enum(tiposActivoInversion).default('Otro'),
  custodia: z.string().min(1, 'La custodia es requerida').max(120),
  cantidad: z.number().positive('La cantidad debe ser mayor que 0'),
  precio_unitario: z.number().nonnegative('El precio no puede ser negativo'),
  importe: z.number().nonnegative('El importe no puede ser negativo').optional(),
  comision: z.number().nonnegative('La comisión no puede ser negativa').default(0),
  impuesto: z.number().nonnegative('El impuesto no puede ser negativo').default(0),
  divisa: z.string().trim().min(3, 'La divisa no es válida').max(10).default('EUR'),
  notas: z.string().max(500).optional(),
})
  .superRefine((value, context) => {
    if (value.tipo === 'Compra' && !value.origen_fondos) {
      context.addIssue({
        code: 'custom',
        path: ['origen_fondos'],
        message: 'Selecciona si la compra usa saldo existente o capital nuevo',
      })
    }
  })

export type InversionOperacionInput = z.infer<typeof inversionOperacionSchema>
