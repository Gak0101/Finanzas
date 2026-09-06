import { NextResponse } from 'next/server'
import { z } from 'zod'
import { getAuthenticatedUserId, isNextResponse } from '@/lib/api-utils'
import { getFollowupConfig, updateFollowupConfig } from '@/lib/seguimiento/service'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const configSchema = z.object({
  enabled: z.boolean(), timezone: z.literal('Europe/Madrid'),
  weekdays: z.array(z.number().int().min(1).max(7)).min(1).max(7),
  slots: z.array(z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/)).min(1).max(12),
  maxNotificationsPerDay: z.number().int().min(1).max(10), canalWhatsapp: z.boolean(), canalTelegram: z.boolean(),
})

export async function GET() {
  const auth = await getAuthenticatedUserId()
  if (isNextResponse(auth)) return auth
  return NextResponse.json(await getFollowupConfig(auth.userId))
}

export async function PATCH(request: Request) {
  const auth = await getAuthenticatedUserId()
  if (isNextResponse(auth)) return auth
  const parsed = configSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: 'Revisa días, horas y número máximo de avisos.' }, { status: 400 })
  return NextResponse.json(await updateFollowupConfig(auth.userId, parsed.data))
}
