import { NextResponse } from 'next/server'
import { isNextResponse } from '@/lib/api-utils'
import { verifyAutomationSecret, resolveAutomationUserId } from '@/lib/automation-auth'
import { checkInvestmentAlerts } from '@/lib/inversiones/alertRules'
import { applyInvestmentNotificationConfig, getInvestmentNotificationConfig } from '@/lib/inversiones/notificationConfig'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

async function run(req: Request) {
  const secretError = verifyAutomationSecret(req)
  if (secretError) return secretError

  const userId = await resolveAutomationUserId(req)
  if (isNextResponse(userId)) return userId

  const result = await checkInvestmentAlerts(userId)
  const notificationConfig = await getInvestmentNotificationConfig(userId)
  const notifications = result.alerts
    .map((alert) => applyInvestmentNotificationConfig(alert, notificationConfig))
    .filter((alert): alert is NonNullable<typeof alert> => Boolean(alert))
  return NextResponse.json({
    ok: true,
    ...result,
    alerts: notifications,
    notifications,
    detectedAlerts: result.alerts.length,
    suppressedAlerts: result.alerts.length - notifications.length,
    message: notifications.length > 0
      ? `${notifications.length} alerta(s) lista(s); envía solo los canales indicados.`
      : result.alerts.length > 0
        ? 'Hay cruces detectados, pero la configuración global ha bloqueado sus canales o tipo de aviso.'
      : 'No hay cruces nuevos de umbral.',
  })
}

export async function GET(req: Request) {
  return run(req)
}

export async function POST(req: Request) {
  return run(req)
}
