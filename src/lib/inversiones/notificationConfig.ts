import { eq } from 'drizzle-orm'
import { db } from '@/lib/db'
import { inversiones_notificaciones_config } from '@/lib/db/schema'
import type { TriggeredInvestmentAlert } from '@/lib/inversiones/alertRules'

export const DEFAULT_NOTIFICATION_CONFIG = {
  enabled: true,
  canalTelegram: true,
  canalEmail: true,
  canalWhatsapp: true,
  alertasPorcentaje: true,
  alertasPrecio: true,
  alertasFecha: true,
  alertasCartera: true,
  seguimientoLynch: true,
} as const

export type InvestmentNotificationConfig = {
  enabled: boolean
  canalTelegram: boolean
  canalEmail: boolean
  canalWhatsapp: boolean
  alertasPorcentaje: boolean
  alertasPrecio: boolean
  alertasFecha: boolean
  alertasCartera: boolean
  seguimientoLynch: boolean
  updatedAt: string | null
}

export type InvestmentNotificationConfigInput = Omit<InvestmentNotificationConfig, 'updatedAt'>

function fromRow(row: typeof inversiones_notificaciones_config.$inferSelect | undefined): InvestmentNotificationConfig {
  return {
    enabled: row?.enabled ?? DEFAULT_NOTIFICATION_CONFIG.enabled,
    canalTelegram: row?.canal_telegram ?? DEFAULT_NOTIFICATION_CONFIG.canalTelegram,
    canalEmail: row?.canal_email ?? DEFAULT_NOTIFICATION_CONFIG.canalEmail,
    canalWhatsapp: row?.canal_whatsapp ?? DEFAULT_NOTIFICATION_CONFIG.canalWhatsapp,
    alertasPorcentaje: row?.alertas_porcentaje ?? DEFAULT_NOTIFICATION_CONFIG.alertasPorcentaje,
    alertasPrecio: row?.alertas_precio ?? DEFAULT_NOTIFICATION_CONFIG.alertasPrecio,
    alertasFecha: row?.alertas_fecha ?? DEFAULT_NOTIFICATION_CONFIG.alertasFecha,
    alertasCartera: row?.alertas_cartera ?? DEFAULT_NOTIFICATION_CONFIG.alertasCartera,
    seguimientoLynch: row?.seguimiento_lynch ?? DEFAULT_NOTIFICATION_CONFIG.seguimientoLynch,
    updatedAt: row?.updated_at || null,
  }
}

export async function getInvestmentNotificationConfig(userId: number) {
  const row = await db.query.inversiones_notificaciones_config.findFirst({
    where: eq(inversiones_notificaciones_config.usuario_id, userId),
  })
  return fromRow(row)
}

export async function updateInvestmentNotificationConfig(userId: number, input: InvestmentNotificationConfigInput) {
  const now = new Date().toISOString()
  const values = {
    usuario_id: userId,
    enabled: input.enabled,
    canal_telegram: input.canalTelegram,
    canal_email: input.canalEmail,
    canal_whatsapp: input.canalWhatsapp,
    alertas_porcentaje: input.alertasPorcentaje,
    alertas_precio: input.alertasPrecio,
    alertas_fecha: input.alertasFecha,
    alertas_cartera: input.alertasCartera,
    seguimiento_lynch: input.seguimientoLynch,
    updated_at: now,
  }
  await db.insert(inversiones_notificaciones_config)
    .values(values)
    .onConflictDoUpdate({ target: inversiones_notificaciones_config.usuario_id, set: values })
  return getInvestmentNotificationConfig(userId)
}

function eventEnabled(config: InvestmentNotificationConfig, alert: Pick<TriggeredInvestmentAlert, 'alcance' | 'razon'>) {
  if (!config.enabled || (alert.alcance === 'cartera' && !config.alertasCartera)) return false
  if (alert.razon === 'precio_objetivo') return config.alertasPrecio
  if (alert.razon === 'fecha_objetivo') return config.alertasFecha
  return config.alertasPorcentaje
}

export function applyInvestmentNotificationConfig(
  alert: TriggeredInvestmentAlert,
  config: InvestmentNotificationConfig,
) {
  if (!eventEnabled(config, alert)) return null
  const filtered = {
    ...alert,
    canal_telegram: alert.canal_telegram && config.canalTelegram,
    canal_email: alert.canal_email && config.canalEmail,
    canal_whatsapp: alert.canal_whatsapp && config.canalWhatsapp,
  }
  return filtered.canal_telegram || filtered.canal_email || filtered.canal_whatsapp ? filtered : null
}

export function shouldRunLynchFollowup(config: InvestmentNotificationConfig) {
  return config.enabled && config.seguimientoLynch
}
