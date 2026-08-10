import { z } from 'zod'

const threshold = z.number().min(0.0001, 'El umbral debe ser mayor que 0').max(10).nullable()

const inversionAlertaBaseSchema = z.object({
  alcance: z.enum(['cartera', 'activo']),
  posicion_id: z.number().int().positive().nullable().optional(),
  activo: z.string().trim().min(1).max(200).nullable().optional(),
  ticker: z.string().trim().min(1).max(40).nullable().optional(),
  tipo_activo: z.string().trim().min(1).max(40).nullable().optional(),
  price_ticker: z.string().trim().max(80).nullable().optional(),
  crypto_id: z.string().trim().max(100).nullable().optional(),
  market_symbol: z.string().trim().max(80).nullable().optional(),
  precio_referencia: z.number().positive().nullable().optional(),
  umbral_subida_pct: threshold,
  umbral_caida_pct: threshold,
  rearmar_pct: z.number().min(0).max(1).default(0.01),
  canal_telegram: z.boolean().default(true),
  canal_email: z.boolean().default(true),
  activa: z.boolean().default(true),
})

export const inversionAlertaSchema = inversionAlertaBaseSchema.superRefine((value, context) => {
  if (value.umbral_subida_pct === null && value.umbral_caida_pct === null) {
    context.addIssue({ code: 'custom', message: 'Configura al menos una alerta de subida o caída', path: ['umbral_subida_pct'] })
  }
  if (!value.canal_telegram && !value.canal_email) {
    context.addIssue({ code: 'custom', message: 'Selecciona Telegram, email o ambos', path: ['canal_telegram'] })
  }
  if (value.alcance === 'activo' && !value.posicion_id && !value.ticker) {
    context.addIssue({ code: 'custom', message: 'Selecciona o indica un activo', path: ['ticker'] })
  }
})

export const inversionAlertaPatchSchema = inversionAlertaBaseSchema.partial().superRefine((value, context) => {
  if (value.umbral_subida_pct === null && value.umbral_caida_pct === null) {
    context.addIssue({ code: 'custom', message: 'Configura al menos una alerta de subida o caída', path: ['umbral_subida_pct'] })
  }
  if (value.canal_telegram === false && value.canal_email === false) {
    context.addIssue({ code: 'custom', message: 'Selecciona Telegram, email o ambos', path: ['canal_telegram'] })
  }
})

export type InversionAlertaInput = z.infer<typeof inversionAlertaSchema>
