import { z } from 'zod'

const currentYear = new Date().getFullYear()

export const ingresoSchema = z.object({
  anio: z
    .number()
    .int()
    .min(2020)
    .max(currentYear + 1),
  mes: z
    .number()
    .int()
    .min(1)
    .max(12),
  ingreso_bruto: z
    .number()
    .positive('El ingreso debe ser mayor a 0'),
  notas: z.string().max(500).optional(),
})

export type IngresoInput = z.infer<typeof ingresoSchema>
