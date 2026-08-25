import { z } from 'zod'

const threshold = z.number().min(0.0001, 'El umbral debe ser mayor que 0').max(10).nullable()
const targetAmount = z.number().positive('El importe objetivo debe ser mayor que 0').nullable().optional()
const targetCurrency = z.string().trim().regex(/^[A-Z]{3}$/i, 'La divisa objetivo debe ser un código ISO de tres letras').transform((value) => value.toUpperCase()).nullable().optional()

const inversionAlertaBaseSchema = z.object({
  alcance: z.enum(['cartera', 'activo']),
  posicion_id: z.number().int().positive().nullable().optional(),
  activo: z.string().trim().min(1).max(200).nullable().optional(),
  ticker: z.string().trim().min(1).max(40).nullable().optional(),
  tipo_activo: z.string().trim().min(1).max(40).nullable().optional(),
  price_ticker: z.string().trim().max(80).nullable().optional(),
  crypto_id: z.string().trim().max(100).nullable().optional(),
  market_symbol: z.string().trim().max(80).nullable().optional(),
  isin: z.string().trim().regex(/^[A-Z]{2}[A-Z0-9]{9}[0-9]$/i, 'El ISIN debe tener 12 caracteres y un formato válido').nullable().optional(),
  precio_referencia: z.number().positive().nullable().optional(),
  precio_objetivo: z.number().positive('El precio objetivo debe ser mayor que 0').nullable().optional(),
  precio_objetivo_importe: targetAmount,
  divisa_objetivo: targetCurrency,
  umbral_subida_pct: threshold,
  umbral_caida_pct: threshold,
  rearmar_pct: z.number().min(0).max(1).default(0.01),
  canal_telegram: z.boolean().default(true),
  canal_email: z.boolean().default(true),
  activa: z.boolean().default(true),
})

type AlertInputShape = Partial<z.infer<typeof inversionAlertaBaseSchema>>

function hasTargetConfiguration(value: AlertInputShape) {
  return value.precio_objetivo != null || value.precio_objetivo_importe != null || value.divisa_objetivo != null
}

function validateTargetPair(value: AlertInputShape, context: z.RefinementCtx) {
  const hasAmount = Object.hasOwn(value, 'precio_objetivo_importe')
  const hasCurrency = Object.hasOwn(value, 'divisa_objetivo')
  if (!hasAmount && !hasCurrency) return
  if (!hasAmount || !hasCurrency || (value.precio_objetivo_importe === null) !== (value.divisa_objetivo === null)) {
    context.addIssue({ code: 'custom', message: 'El importe y la divisa del objetivo deben indicarse juntos', path: hasAmount ? ['divisa_objetivo'] : ['precio_objetivo_importe'] })
  }
}

export const inversionAlertaSchema = inversionAlertaBaseSchema.superRefine((value, context) => {
  validateTargetPair(value, context)
  if (value.umbral_subida_pct === null && value.umbral_caida_pct === null && !hasTargetConfiguration(value)) {
    context.addIssue({ code: 'custom', message: 'Configura una alerta porcentual o un precio objetivo', path: ['umbral_subida_pct'] })
  }
  if (value.alcance === 'cartera' && hasTargetConfiguration(value)) {
    context.addIssue({ code: 'custom', message: 'El precio objetivo solo está disponible para activos', path: ['precio_objetivo'] })
  }
  if (!value.canal_telegram && !value.canal_email) {
    context.addIssue({ code: 'custom', message: 'Selecciona Telegram, email o ambos', path: ['canal_telegram'] })
  }
  if (value.alcance === 'activo' && !value.posicion_id && !value.ticker) {
    context.addIssue({ code: 'custom', message: 'Selecciona o indica un activo', path: ['ticker'] })
  }
})

export const inversionAlertaPatchSchema = inversionAlertaBaseSchema.partial().superRefine((value, context) => {
  validateTargetPair(value, context)
  if (value.alcance === 'cartera' && hasTargetConfiguration(value)) {
    context.addIssue({ code: 'custom', message: 'El precio objetivo solo está disponible para activos', path: ['precio_objetivo'] })
  }
  if (value.canal_telegram === false && value.canal_email === false) {
    context.addIssue({ code: 'custom', message: 'Selecciona Telegram, email o ambos', path: ['canal_telegram'] })
  }
})

export type InversionAlertaInput = z.infer<typeof inversionAlertaSchema>
