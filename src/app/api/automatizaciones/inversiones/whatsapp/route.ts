import { NextResponse } from 'next/server'
import { eq } from 'drizzle-orm'
import { z } from 'zod'
import { isNextResponse } from '@/lib/api-utils'
import { verifyAutomationSecret, resolveAutomationUserId } from '@/lib/automation-auth'
import { db } from '@/lib/db'
import { configuraciones_fuentes_inversion } from '@/lib/db/schema'
import { decryptSecret } from '@/lib/ai/secret-crypto'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const messageSchema = z.object({
  text: z.string().trim().min(1, 'El mensaje de WhatsApp no puede estar vacío').max(4096),
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

  const settings = await db.query.configuraciones_fuentes_inversion.findFirst({
    where: eq(configuraciones_fuentes_inversion.usuario_id, userId),
  })
  if (!settings?.whatsapp_graph_url || !settings.whatsapp_phone_number_id || !settings.whatsapp_to || !settings.whatsapp_template_name || !settings.whatsapp_access_token_cifrada) {
    return NextResponse.json({ error: 'WhatsApp está pendiente de configurar en Configuración' }, { status: 409 })
  }

  let accessToken: string
  try {
    accessToken = decryptSecret(settings.whatsapp_access_token_cifrada)
  } catch {
    return NextResponse.json({ error: 'El token de WhatsApp no se puede descifrar; vuelve a guardarlo en Configuración' }, { status: 409 })
  }

  const graphUrl = `${settings.whatsapp_graph_url.replace(/\/$/, '')}/${settings.whatsapp_phone_number_id}/messages`
  const response = await fetch(graphUrl, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      messaging_product: 'whatsapp',
      to: settings.whatsapp_to,
      type: 'template',
      template: {
        name: settings.whatsapp_template_name,
        language: { code: settings.whatsapp_template_language || 'es_ES' },
        components: [{
          type: 'body',
          parameters: [{ type: 'text', text: parsed.data.text }],
        }],
      },
    }),
  }).catch(() => null)

  if (!response) {
    return NextResponse.json({ error: 'No se pudo conectar con WhatsApp Cloud' }, { status: 502 })
  }

  const payload = await response.json().catch(() => null) as { messages?: Array<{ id?: string }>; error?: { message?: string } } | null
  if (!response.ok) {
    return NextResponse.json({ error: payload?.error?.message || 'WhatsApp Cloud rechazó el envío' }, { status: 502 })
  }

  return NextResponse.json({
    ok: true,
    messageId: payload?.messages?.[0]?.id ?? null,
  })
}
