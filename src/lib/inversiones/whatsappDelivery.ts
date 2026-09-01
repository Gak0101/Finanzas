import { and, eq } from 'drizzle-orm'
import { db } from '@/lib/db'
import { configuraciones_fuentes_inversion, inversiones_alertas } from '@/lib/db/schema'
import { decryptSecret } from '@/lib/ai/secret-crypto'

type GraphPayload = {
  messages?: Array<{ id?: string }>
  error?: { message?: string }
}

export type WhatsAppDeliveryResult = {
  messageId: string | null
  mode: 'template' | 'text_fallback'
  warning?: string
}

export type WhatsAppDeliveryOptions = {
  allowTextFallback?: boolean
}

export class WhatsAppDeliveryError extends Error {
  constructor(message: string, readonly status = 502) {
    super(message)
    this.name = 'WhatsAppDeliveryError'
  }
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
  try {
    const acceptedAt = new Date().toISOString()
    await db.update(inversiones_alertas).set({
      ultima_entrega_whatsapp_at: acceptedAt,
      whatsapp_message_id: messageId,
      ultimo_error_whatsapp: null,
      updated_at: acceptedAt,
    }).where(and(
      eq(inversiones_alertas.id, alertaId),
      eq(inversiones_alertas.usuario_id, userId),
      eq(inversiones_alertas.canal_whatsapp, true),
    ))
  } catch {
    await saveWhatsAppError(userId, alertaId, 'WhatsApp aceptó el mensaje, pero no se pudo guardar la confirmación en Finanzas')
  }
}

async function failDelivery(userId: number, alertaId: number | undefined, message: string, status = 502): Promise<never> {
  await saveWhatsAppError(userId, alertaId, message)
  throw new WhatsAppDeliveryError(message, status)
}

export async function sendWhatsAppMessage(
  userId: number,
  text: string,
  alertaId?: number,
  options: WhatsAppDeliveryOptions = {},
): Promise<WhatsAppDeliveryResult> {
  if (alertaId) {
    const alert = await db.query.inversiones_alertas.findFirst({
      where: and(
        eq(inversiones_alertas.id, alertaId),
        eq(inversiones_alertas.usuario_id, userId),
      ),
    })
    if (!alert) return failDelivery(userId, alertaId, 'Alerta no encontrada', 404)
    if (!alert.canal_whatsapp) return failDelivery(userId, alertaId, 'WhatsApp no está activo para esta alerta', 409)
  }

  const settings = await db.query.configuraciones_fuentes_inversion.findFirst({
    where: eq(configuraciones_fuentes_inversion.usuario_id, userId),
  })
  if (!settings?.whatsapp_graph_url || !settings.whatsapp_phone_number_id || !settings.whatsapp_to || !settings.whatsapp_template_name || !settings.whatsapp_access_token_cifrada) {
    return failDelivery(userId, alertaId, 'WhatsApp está pendiente de configurar en Configuración', 409)
  }

  let accessToken: string
  try {
    accessToken = decryptSecret(settings.whatsapp_access_token_cifrada)
  } catch {
    return failDelivery(userId, alertaId, 'El token de WhatsApp no se puede descifrar; vuelve a guardarlo en Configuración', 409)
  }

  const graphUrl = `${settings.whatsapp_graph_url.replace(/\/$/, '')}/${settings.whatsapp_phone_number_id}/messages`
  // Meta puede rechazar con #132018 los saltos de línea dentro de una variable
  // de plantilla. Conservamos el formato original para texto libre, pero
  // enviamos el parámetro de la plantilla en una sola línea.
  const templateParameter = text.replace(/\s+/g, ' ').trim()
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
        parameters: [{ type: 'text', text: templateParameter }],
      }],
    },
  })

  if (!templateResult.response) {
    return failDelivery(userId, alertaId, 'No se pudo conectar con WhatsApp Cloud')
  }

  if (templateResult.response.ok) {
    const messageId = templateResult.payload?.messages?.[0]?.id ?? null
    await saveWhatsAppAccepted(userId, alertaId, messageId)
    return { messageId, mode: 'template' }
  }

  const templateError = templateResult.payload?.error?.message || 'WhatsApp Cloud rechazó la plantilla'
  if (options.allowTextFallback === false) {
    return failDelivery(
      userId,
      alertaId,
      `La plantilla de WhatsApp fue rechazada por Meta: ${templateError}. El test no usa texto libre porque WhatsApp solo lo permite durante las 24 horas posteriores a un mensaje del usuario.`,
    )
  }

  const textResult = await sendGraphMessage({
    type: 'text',
    text: {
      preview_url: false,
      body: text,
    },
  })

  if (!textResult.response) {
    return failDelivery(userId, alertaId, `No se pudo enviar WhatsApp. Plantilla: ${templateError}. Texto directo: no se pudo conectar con WhatsApp Cloud`)
  }

  if (!textResult.response.ok) {
    const textError = textResult.payload?.error?.message || 'WhatsApp Cloud rechazó el texto directo'
    return failDelivery(userId, alertaId, `No se pudo enviar WhatsApp. Plantilla: ${templateError}. Texto directo: ${textError}`)
  }

  const messageId = textResult.payload?.messages?.[0]?.id ?? null
  await saveWhatsAppAccepted(userId, alertaId, messageId)
  return {
    messageId,
    mode: 'text_fallback',
    warning: `La plantilla no fue aceptada por Meta (${templateError}); se envió texto directo dentro de la ventana de conversación de WhatsApp`,
  }
}
