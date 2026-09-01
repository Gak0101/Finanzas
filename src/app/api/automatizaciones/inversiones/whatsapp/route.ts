import { NextResponse } from 'next/server'
import { and, eq } from 'drizzle-orm'
import { z } from 'zod'
import { isNextResponse } from '@/lib/api-utils'
import { verifyAutomationSecret, resolveAutomationUserId } from '@/lib/automation-auth'
import { db } from '@/lib/db'
import { configuraciones_fuentes_inversion, inversiones_alertas } from '@/lib/db/schema'
import { decryptSecret } from '@/lib/ai/secret-crypto'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const messageSchema = z.object({
  text: z.string().trim().min(1, 'El mensaje de WhatsApp no puede estar vacío').max(4096),
  alerta_id: z.number().int().positive().optional(),
})

type GraphPayload = {
  messages?: Array<{ id?: string }>
  error?: { message?: string }
}

async function saveWhatsAppError(userId: number, alertaId: number | undefined, message: string) {
  if (!alertaId) return
  try {
    await db.update(inversiones_alertas).set({
      ultimo_error_whatsapp: message.slice(0, 1000),
      updated_at: new Date().toISOString(),
    }).where(and(
      eq(inversiones_alertas.id, alertaId),
      eq(inversiones_alertas.usuario_id, userId),
      eq(inversiones_alertas.canal_whatsapp, true),
    ))
  } catch {
    // El error original de WhatsApp es más útil que ocultarlo por un fallo de registro.
  }
}

async function saveWhatsAppAccepted(userId: number, alertaId: number | undefined, messageId: string | null) {
  if (!alertaId) return
  await db.update(inversiones_alertas).set({
    ultima_entrega_whatsapp_at: new Date().toISOString(),
    whatsapp_message_id: messageId,
    ultimo_error_whatsapp: null,
    updated_at: new Date().toISOString(),
  }).where(and(
    eq(inversiones_alertas.id, alertaId),
    eq(inversiones_alertas.usuario_id, userId),
    eq(inversiones_alertas.canal_whatsapp, true),
  ))
}

export async function POST(request: Request) {
  const secretError = verifyAutomationSecret(request)
  if (secretError) return secretError

  const userId = await resolveAutomationUserId(request)
  if (isNextResponse(userId)) return userId

  const parsed = messageSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Mensaje no válido' }, { status: 400 })
  }

  if (parsed.data.alerta_id) {
    const alert = await db.query.inversiones_alertas.findFirst({
      where: and(
        eq(inversiones_alertas.id, parsed.data.alerta_id),
        eq(inversiones_alertas.usuario_id, userId),
      ),
    })
    if (!alert) return NextResponse.json({ error: 'Alerta no encontrada' }, { status: 404 })
    if (!alert.canal_whatsapp) return NextResponse.json({ error: 'WhatsApp no está activo para esta alerta' }, { status: 409 })
  }

  const settings = await db.query.configuraciones_fuentes_inversion.findFirst({
    where: eq(configuraciones_fuentes_inversion.usuario_id, userId),
  })
  if (!settings?.whatsapp_graph_url || !settings.whatsapp_phone_number_id || !settings.whatsapp_to || !settings.whatsapp_template_name || !settings.whatsapp_access_token_cifrada) {
    await saveWhatsAppError(userId, parsed.data.alerta_id, 'WhatsApp está pendiente de configurar en Configuración')
    return NextResponse.json({ error: 'WhatsApp está pendiente de configurar en Configuración' }, { status: 409 })
  }

  let accessToken: string
  try {
    accessToken = decryptSecret(settings.whatsapp_access_token_cifrada)
  } catch {
    await saveWhatsAppError(userId, parsed.data.alerta_id, 'El token de WhatsApp no se puede descifrar; vuelve a guardarlo en Configuración')
    return NextResponse.json({ error: 'El token de WhatsApp no se puede descifrar; vuelve a guardarlo en Configuración' }, { status: 409 })
  }

  const graphUrl = `${settings.whatsapp_graph_url.replace(/\/$/, '')}/${settings.whatsapp_phone_number_id}/messages`
  const sendGraphMessage = async (body: Record<string, unknown>) => {
    const response = await fetch(graphUrl, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        to: settings.whatsapp_to,
        ...body,
      }),
    }).catch(() => null)

    if (!response) return { response: null, payload: null as GraphPayload | null }

    const payload = await response.json().catch(() => null) as GraphPayload | null
    return { response, payload }
  }

  const templateResult = await sendGraphMessage({
    type: 'template',
    template: {
      name: settings.whatsapp_template_name,
      language: { code: settings.whatsapp_template_language || 'es_ES' },
      components: [{
        type: 'body',
        parameters: [{ type: 'text', text: parsed.data.text }],
      }],
    },
  })

  if (!templateResult.response) {
    await saveWhatsAppError(userId, parsed.data.alerta_id, 'No se pudo conectar con WhatsApp Cloud')
    return NextResponse.json({ error: 'No se pudo conectar con WhatsApp Cloud' }, { status: 502 })
  }

  if (templateResult.response.ok) {
    const messageId = templateResult.payload?.messages?.[0]?.id ?? null
    try {
      await saveWhatsAppAccepted(userId, parsed.data.alerta_id, messageId)
    } catch {
      await saveWhatsAppError(userId, parsed.data.alerta_id, 'WhatsApp aceptó el mensaje, pero no se pudo guardar la confirmación en Finanzas')
    }
    return NextResponse.json({
      ok: true,
      messageId,
      mode: 'template',
    })
  }

  const templateError = templateResult.payload?.error?.message || 'WhatsApp Cloud rechazó la plantilla'
  const textResult = await sendGraphMessage({
    type: 'text',
    text: {
      preview_url: false,
      body: parsed.data.text,
    },
  })

  if (!textResult.response) {
    await saveWhatsAppError(userId, parsed.data.alerta_id, `No se pudo enviar WhatsApp. Plantilla: ${templateError}. Texto directo: no se pudo conectar con WhatsApp Cloud`)
    return NextResponse.json({
      error: `No se pudo enviar WhatsApp. Plantilla: ${templateError}. Texto directo: no se pudo conectar con WhatsApp Cloud`,
    }, { status: 502 })
  }

  if (!textResult.response.ok) {
    const textError = textResult.payload?.error?.message || 'WhatsApp Cloud rechazó el texto directo'
    await saveWhatsAppError(userId, parsed.data.alerta_id, `No se pudo enviar WhatsApp. Plantilla: ${templateError}. Texto directo: ${textError}`)
    return NextResponse.json({
      error: `No se pudo enviar WhatsApp. Plantilla: ${templateError}. Texto directo: ${textError}`,
    }, { status: 502 })
  }

  const messageId = textResult.payload?.messages?.[0]?.id ?? null
  try {
    await saveWhatsAppAccepted(userId, parsed.data.alerta_id, messageId)
  } catch {
    await saveWhatsAppError(userId, parsed.data.alerta_id, 'WhatsApp aceptó el mensaje, pero no se pudo guardar la confirmación en Finanzas')
  }

  return NextResponse.json({
    ok: true,
    messageId,
    mode: 'text_fallback',
    warning: 'La plantilla todavía no está disponible; se envió texto directo dentro de la ventana de conversación de WhatsApp',
  })
}
