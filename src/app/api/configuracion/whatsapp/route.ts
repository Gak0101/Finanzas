import { NextResponse } from 'next/server'
import { eq } from 'drizzle-orm'
import { z } from 'zod'
import { getAuthenticatedUserId, isNextResponse } from '@/lib/api-utils'
import { db } from '@/lib/db'
import { configuraciones_fuentes_inversion } from '@/lib/db/schema'
import { decryptSecret, encryptSecret, maskedSecret } from '@/lib/ai/secret-crypto'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const settingsSchema = z.object({
  graph_url: z.union([z.string().trim().url('La URL de WhatsApp Cloud no es válida'), z.literal('')]).default(''),
  access_token: z.string().trim().max(5000).optional(),
  phone_number_id: z.string().trim().max(200).default(''),
  recipient: z.string().trim().max(40).default(''),
  template_name: z.string().trim().max(512).default(''),
  template_language: z.string().trim().min(1).max(40).default('es_ES'),
})

type SettingsRow = typeof configuraciones_fuentes_inversion.$inferSelect

function normalizeRecipient(value: string) {
  return value.replace(/[^0-9]/g, '')
}

function publicSettings(row: SettingsRow | undefined) {
  let accessTokenConfigured = false
  let accessTokenHint: string | null = null

  if (row?.whatsapp_access_token_cifrada) {
    try {
      const token = decryptSecret(row.whatsapp_access_token_cifrada)
      accessTokenConfigured = token.length > 0
      accessTokenHint = accessTokenConfigured ? maskedSecret(token) : null
    } catch {
      accessTokenHint = 'Token guardado no disponible'
    }
  }

  const graphUrl = row?.whatsapp_graph_url ?? ''
  const phoneNumberId = row?.whatsapp_phone_number_id ?? ''
  const recipient = row?.whatsapp_to ?? ''
  const templateName = row?.whatsapp_template_name ?? ''
  const templateLanguage = row?.whatsapp_template_language ?? 'es_ES'
  const missing = [
    !graphUrl ? 'URL de Graph API' : null,
    !accessTokenConfigured ? 'token de acceso' : null,
    !phoneNumberId ? 'Phone Number ID' : null,
    !recipient ? 'número de destino' : null,
    !templateName ? 'nombre de plantilla' : null,
  ].filter((value): value is string => Boolean(value))

  return {
    graphUrl,
    phoneNumberId,
    recipient,
    templateName,
    templateLanguage,
    accessToken: {
      configured: accessTokenConfigured,
      hint: accessTokenHint,
    },
    ready: missing.length === 0,
    missing,
  }
}

export async function GET() {
  const auth = await getAuthenticatedUserId()
  if (isNextResponse(auth)) return auth

  const row = await db.query.configuraciones_fuentes_inversion.findFirst({
    where: eq(configuraciones_fuentes_inversion.usuario_id, auth.userId),
  })
  return NextResponse.json(publicSettings(row))
}

export async function PUT(request: Request) {
  const auth = await getAuthenticatedUserId()
  if (isNextResponse(auth)) return auth

  const parsed = settingsSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Configuración de WhatsApp no válida' }, { status: 400 })
  }

  const existing = await db.query.configuraciones_fuentes_inversion.findFirst({
    where: eq(configuraciones_fuentes_inversion.usuario_id, auth.userId),
  })
  const input = parsed.data
  const now = new Date().toISOString()
  const values = {
    whatsapp_graph_url: input.graph_url || null,
    whatsapp_phone_number_id: input.phone_number_id || null,
    whatsapp_to: normalizeRecipient(input.recipient) || null,
    whatsapp_template_name: input.template_name || null,
    whatsapp_template_language: input.template_language || 'es_ES',
    ...(input.access_token ? { whatsapp_access_token_cifrada: encryptSecret(input.access_token) } : {}),
    updated_at: now,
  }

  if (existing) {
    await db.update(configuraciones_fuentes_inversion)
      .set(values)
      .where(eq(configuraciones_fuentes_inversion.id, existing.id))
  } else {
    await db.insert(configuraciones_fuentes_inversion).values({
      usuario_id: auth.userId,
      ...values,
      created_at: now,
    })
  }

  const saved = await db.query.configuraciones_fuentes_inversion.findFirst({
    where: eq(configuraciones_fuentes_inversion.usuario_id, auth.userId),
  })
  return NextResponse.json(publicSettings(saved))
}
