import { NextResponse } from 'next/server'
import { isNextResponse } from '@/lib/api-utils'
import { verifyAutomationSecret, resolveAutomationUserId } from '@/lib/automation-auth'
import { checkInvestmentAlerts } from '@/lib/inversiones/alertRules'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

async function run(req: Request) {
  const secretError = verifyAutomationSecret(req)
  if (secretError) return secretError

  const userId = await resolveAutomationUserId(req)
  if (isNextResponse(userId)) return userId

  const result = await checkInvestmentAlerts(userId)
  return NextResponse.json({
    ok: true,
    ...result,
    notifications: result.alerts,
    message: result.alerts.length > 0
      ? `${result.alerts.length} alerta(s) nueva(s); envía solo los canales indicados.`
      : 'No hay cruces nuevos de umbral.',
  })
}

export async function GET(req: Request) {
  return run(req)
}

export async function POST(req: Request) {
  return run(req)
}
