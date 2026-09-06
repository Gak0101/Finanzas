import { NextResponse } from 'next/server'
import { isNextResponse } from '@/lib/api-utils'
import { verifyAutomationSecret, resolveAutomationUserId } from '@/lib/automation-auth'
import { heartbeat } from '@/lib/seguimiento/service'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function POST(req: Request) {
  const secretError = verifyAutomationSecret(req)
  if (secretError) return secretError
  const userId = await resolveAutomationUserId(req)
  if (isNextResponse(userId)) return userId
  return NextResponse.json({ ok: true, ...(await heartbeat(userId)) })
}
