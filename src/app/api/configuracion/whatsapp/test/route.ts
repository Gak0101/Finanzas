import { NextResponse } from 'next/server'
import { getAuthenticatedUserId, isNextResponse } from '@/lib/api-utils'
import { sendWhatsAppMessage, WhatsAppDeliveryError } from '@/lib/inversiones/whatsappDelivery'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function POST() {
  const auth = await getAuthenticatedUserId()
  if (isNextResponse(auth)) return auth

  const timestamp = new Intl.DateTimeFormat('es-ES', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'Europe/Madrid',
  }).format(new Date())
  const text = [
    '✅ *Prueba de WhatsApp · Finanzas*',
    '',
    'El canal de alertas está conectado.',
    `Hora de prueba: ${timestamp}`,
    '',
    'Este mensaje no crea ninguna alerta ni modifica tu cartera.',
  ].join('\n')

  try {
    const result = await sendWhatsAppMessage(auth.userId, text)
    return NextResponse.json({ ok: true, ...result })
  } catch (error) {
    if (error instanceof WhatsAppDeliveryError) {
      return NextResponse.json({ error: error.message }, { status: error.status })
    }
    return NextResponse.json({ error: 'No se pudo enviar la prueba de WhatsApp' }, { status: 500 })
  }
}
