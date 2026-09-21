import { NextResponse } from 'next/server'
import { z } from 'zod'
import { getAuthenticatedUserId, isNextResponse } from '@/lib/api-utils'
import { getInvestmentNotificationConfig, updateInvestmentNotificationConfig } from '@/lib/inversiones/notificationConfig'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const configSchema = z.object({
  enabled: z.boolean(),
  canalTelegram: z.boolean(),
  canalEmail: z.boolean(),
  canalWhatsapp: z.boolean(),
  alertasPorcentaje: z.boolean(),
  alertasPrecio: z.boolean(),
  alertasFecha: z.boolean(),
  alertasCartera: z.boolean(),
  seguimientoLynch: z.boolean(),
})

export async function GET() {
  const auth = await getAuthenticatedUserId()
  if (isNextResponse(auth)) return auth
  return NextResponse.json(await getInvestmentNotificationConfig(auth.userId))
}

export async function PATCH(request: Request) {
  const auth = await getAuthenticatedUserId()
  if (isNextResponse(auth)) return auth
  const parsed = configSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: 'La configuración de notificaciones no es válida.' }, { status: 400 })
  return NextResponse.json(await updateInvestmentNotificationConfig(auth.userId, parsed.data))
}
