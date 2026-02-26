import { z } from 'zod'

export const huchaSchema = z.object({
  nombre: z.string().min(1, 'El nombre es requerido').max(50),
  objetivo: z
    .number()
    .positive('El objetivo debe ser mayor a 0'),
  descripcion: z.string().max(200).optional(),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/, 'Color inválido').default('#4ECDC4'),
  icono: z.string().default('🐷'),
  fecha_objetivo: z.string().optional().nullable(),
})

export const aportacionSchema = z.object({
  cantidad: z
    .number()
    .refine((v) => v !== 0, 'La cantidad no puede ser 0'),
  fecha: z.string().min(1, 'La fecha es requerida'),
  notas: z.string().max(200).optional(),
})

export type HuchaInput = z.infer<typeof huchaSchema>
export type AportacionInput = z.infer<typeof aportacionSchema>
