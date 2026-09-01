import { NextResponse } from 'next/server'
import { z } from 'zod'
import { isNextResponse } from '@/lib/api-utils'
import { verifyAutomationSecret, resolveAutomationUserId } from '@/lib/automation-auth'
import { sendWhatsAppMessage, WhatsAppDeliveryError } from '@/lib/inversiones/whatsappDelivery'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const messageSchema = z.object({
  text: z.string().trim().min(1, 'El mensaje de WhatsApp no puede estar vacío').max(4096),
  alerta_id: z.number().int().positive().optional(),
})

export async function POST(request: Request) {
  const secretError = verifyAutomationSecret(request)
  if (secretError) return secretError

  const userId = await resolveAutomationUserId(request)
  if (isNextResponse(userId)) return userId

  const parsed = messageSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Mensaje no válido' }, { status: 400 })
  }

  try {
    const result = await sendWhatsAppMessage(userId, parsed.data.text, parsed.data.alerta_id)
    return NextResponse.json({ ok: true, ...result })
  } catch (error) {
    if (error instanceof WhatsAppDeliveryError) {
      return NextResponse.json({ error: error.message }, { status: error.status })
    }
    return NextResponse.json({ error: 'No se pudo enviar WhatsApp' }, { status: 500 })
  }
}
