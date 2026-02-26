import { z } from 'zod'

export const categoriaSchema = z.object({
  nombre: z.string().min(1, 'El nombre es requerido').max(50, 'Máximo 50 caracteres'),
  porcentaje: z
    .number()
    .min(0.1, 'El porcentaje debe ser mayor a 0')
    .max(100, 'El porcentaje no puede superar 100'),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/, 'Color inválido').default('#6366f1'),
  icono: z.string().default('💰'),
  orden: z.number().int().default(0),
})

export type CategoriaInput = z.infer<typeof categoriaSchema>
