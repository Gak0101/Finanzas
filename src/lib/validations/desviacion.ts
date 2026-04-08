// Editado: 2026-03-30 — Validación para el formulario de desviaciones
// Define las reglas de validación para registrar una desviación entre categorías
import { z } from 'zod'

// Editado: 2026-04-08 — Añadida etiqueta movimiento_manual
export const ETIQUETAS_DESVIACION = [
  { value: 'ahorro_forzado', label: '💰 Ahorro forzado' },
  { value: 'imprevisto', label: '⚡ Imprevisto' },
  { value: 'capricho', label: '🎁 Capricho' },
  { value: 'emergencia', label: '🚨 Emergencia' },
  { value: 'deuda', label: '📋 Deuda' },
  { value: 'inversion', label: '📈 Inversión' },
  { value: 'movimiento_manual', label: '💸 Movimiento manual' },
  { value: 'otro', label: '📝 Otro' },
] as const

// Schema de Zod para validar una nueva desviación
export const desviacionSchema = z.object({
  registro_id: z.number().int().positive(),
  categoria_origen: z.string().min(1, 'Debes indicar de dónde salió el dinero'),
  categoria_destino: z.string().min(1, 'Debes indicar a dónde va el dinero'),
  monto: z.number().positive('El monto debe ser mayor a 0'),
  motivo: z.string().max(500).optional(),
  etiqueta: z.string().optional(),
})

export type DesviacionInput = z.infer<typeof desviacionSchema>
