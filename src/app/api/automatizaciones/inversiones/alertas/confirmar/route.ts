import { NextResponse } from 'next/server'
import { and, eq } from 'drizzle-orm'
import { z } from 'zod'
import { isNextResponse } from '@/lib/api-utils'
import { verifyAutomationSecret, resolveAutomationUserId } from '@/lib/automation-auth'
import { db } from '@/lib/db'
import { inversiones_alertas } from '@/lib/db/schema'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const deliverySchema = z.object({
  alerta_id: z.number().int().positive(),
  canal: z.literal('whatsapp'),
  message_id: z.string().trim().min(1).max(200).nullable().optional(),
})

export async function POST(request: Request) {
  const secretError = verifyAutomationSecret(request)
  if (secretError) return secretError

  const userId = await resolveAutomationUserId(request)
  if (isNextResponse(userId)) return userId

  const parsed = deliverySchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Confirmación no válida' }, { status: 400 })
  }

  const rule = await db.query.inversiones_alertas.findFirst({
    where: and(
      eq(inversiones_alertas.id, parsed.data.alerta_id),
      eq(inversiones_alertas.usuario_id, userId),
    ),
  })
  if (!rule) return NextResponse.json({ error: 'Alerta no encontrada' }, { status: 404 })
  if (!rule.canal_whatsapp) return NextResponse.json({ error: 'WhatsApp no está activo para esta alerta' }, { status: 409 })

  const deliveredAt = new Date().toISOString()
  const [updated] = await db.update(inversiones_alertas).set({
    ultima_entrega_whatsapp_at: deliveredAt,
    whatsapp_message_id: parsed.data.message_id ?? null,
    ultimo_error_whatsapp: null,
    updated_at: deliveredAt,
  }).where(and(
    eq(inversiones_alertas.id, rule.id),
    eq(inversiones_alertas.usuario_id, userId),
  )).returning({
    id: inversiones_alertas.id,
    ultima_entrega_whatsapp_at: inversiones_alertas.ultima_entrega_whatsapp_at,
    whatsapp_message_id: inversiones_alertas.whatsapp_message_id,
  })

  return NextResponse.json({
    ok: true,
    canal: 'whatsapp',
    alerta_id: updated.id,
    delivered_at: updated.ultima_entrega_whatsapp_at,
    message_id: updated.whatsapp_message_id,
  })
}
