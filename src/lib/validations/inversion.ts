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

export const inversionOperacionSchema = z.object({
  fecha: z.string().min(1, 'La fecha es requerida'),
  tipo: z.enum(tiposOperacionInversion),
  activo: z.string().min(1, 'El activo es requerido').max(160),
  ticker: z.string().min(1, 'El ticker es requerido').max(80),
  tipo_activo: z.enum(tiposActivoInversion).default('Otro'),
  custodia: z.string().min(1, 'La custodia es requerida').max(120),
  cantidad: z.number().positive('La cantidad debe ser mayor que 0'),
  precio_unitario: z.number().nonnegative('El precio no puede ser negativo'),
  importe: z.number().nonnegative('El importe no puede ser negativo').optional(),
  comision: z.number().nonnegative('La comisión no puede ser negativa').default(0),
  impuesto: z.number().nonnegative('El impuesto no puede ser negativo').default(0),
  notas: z.string().max(500).optional(),
})

export type InversionOperacionInput = z.infer<typeof inversionOperacionSchema>
