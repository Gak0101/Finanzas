'use client'

import { useEffect, useState } from 'react'
import {
  BellRing,
  CalendarClock,
  Check,
  Loader2,
  Mail,
  MessageCircle,
  Save,
  Send,
  Target,
  TrendingDown,
  TrendingUp,
  WalletCards,
} from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'

type NotificationConfig = {
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

const defaultConfig: NotificationConfig = {
  enabled: true,
  canalTelegram: true,
  canalEmail: true,
  canalWhatsapp: true,
  alertasPorcentaje: true,
  alertasPrecio: true,
  alertasFecha: true,
  alertasCartera: true,
  seguimientoLynch: true,
  updatedAt: null,
}

type ToggleProps = {
  label: string
  description: string
  enabled: boolean
  icon: React.ReactNode
  onChange: () => void
}

function Toggle({ label, description, enabled, icon, onChange }: ToggleProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={enabled}
      onClick={onChange}
      className={`group flex min-h-[74px] items-start gap-3 rounded-xl border p-3 text-left transition-all duration-200 hover:-translate-y-0.5 ${enabled ? 'border-[#8bb34d]/50 bg-[#e8f3d8] text-slate-900 shadow-[0_8px_20px_rgba(139,179,77,.12)]' : 'border-slate-200 bg-[#f7f5ef] text-slate-500'}`}
    >
      <span className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${enabled ? 'bg-[#c8f56a] text-[#36521e]' : 'bg-slate-200 text-slate-400'}`}>{icon}</span>
      <span className="min-w-0 flex-1">
        <span className="flex items-center justify-between gap-2 text-xs font-semibold">
          {label}
          <span className={`flex h-5 w-9 shrink-0 items-center rounded-full p-0.5 transition-colors ${enabled ? 'justify-end bg-[#6d9a3b]' : 'justify-start bg-slate-300'}`}>
            <span className="h-4 w-4 rounded-full bg-white shadow-sm" />
          </span>
        </span>
        <span className="mt-1 block text-[10px] leading-4 text-slate-500">{description}</span>
      </span>
    </button>
  )
}

export function InvestmentNotificationControls() {
  const [config, setConfig] = useState<NotificationConfig>(defaultConfig)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)

  useEffect(() => {
    const controller = new AbortController()
    void fetch('/api/inversiones/notificaciones/config', { cache: 'no-store', signal: controller.signal })
      .then(async (response) => {
        const payload = await response.json().catch(() => null)
        if (!response.ok || !payload) throw new Error(payload?.error || 'No se pudo cargar la configuración de avisos')
        setConfig(payload as NotificationConfig)
      })
      .catch((error) => {
        if ((error as Error).name !== 'AbortError') setLoadError(error instanceof Error ? error.message : 'No se pudo cargar la configuración de avisos')
      })
      .finally(() => setLoading(false))
    return () => controller.abort()
  }, [])

  function toggle(key: keyof Omit<NotificationConfig, 'updatedAt'>) {
    setConfig((current) => ({ ...current, [key]: !current[key] }))
  }

  async function save() {
    setSaving(true)
    try {
      const response = await fetch('/api/inversiones/notificaciones/config', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          enabled: config.enabled,
          canalTelegram: config.canalTelegram,
          canalEmail: config.canalEmail,
          canalWhatsapp: config.canalWhatsapp,
          alertasPorcentaje: config.alertasPorcentaje,
          alertasPrecio: config.alertasPrecio,
          alertasFecha: config.alertasFecha,
          alertasCartera: config.alertasCartera,
          seguimientoLynch: config.seguimientoLynch,
        }),
      })
      const payload = await response.json().catch(() => null)
      if (!response.ok || !payload) throw new Error(payload?.error || 'No se pudo guardar la configuración')
      setConfig(payload as NotificationConfig)
      toast.success('Controles de avisos guardados')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'No se pudo guardar la configuración')
    } finally {
      setSaving(false)
    }
  }

  return (
    <section className="mt-3 overflow-hidden rounded-xl bg-[#f7f5ef] text-slate-900 shadow-[0_12px_30px_rgba(0,0,0,.14)]" aria-labelledby="notification-controls-title">
      <div className="border-b border-slate-200 px-5 py-4 sm:px-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="flex items-center gap-2 text-[9px] font-bold uppercase tracking-[0.16em] text-slate-400"><BellRing className="h-3.5 w-3.5" /> Centro de avisos</p>
            <h2 id="notification-controls-title" className="mt-1 text-lg font-semibold tracking-[-0.04em]">Qué puede enviarte la app</h2>
            <p className="mt-1 max-w-2xl text-[10px] leading-4 text-slate-500">Estos interruptores son permisos generales. Cada alerta mantiene además sus propios canales y umbrales.</p>
          </div>
          <button type="button" role="switch" aria-checked={config.enabled} onClick={() => toggle('enabled')} className={`inline-flex items-center gap-2 self-start rounded-full border px-3 py-2 text-[10px] font-semibold transition ${config.enabled ? 'border-[#8bb34d]/50 bg-[#e8f3d8] text-[#36521e]' : 'border-slate-300 bg-slate-100 text-slate-500'}`}>
            <span className={`flex h-5 w-9 items-center rounded-full p-0.5 ${config.enabled ? 'justify-end bg-[#6d9a3b]' : 'justify-start bg-slate-300'}`}><span className="h-4 w-4 rounded-full bg-white shadow-sm" /></span>
            {config.enabled ? 'Avisos activos' : 'Avisos pausados'}
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex min-h-32 items-center justify-center gap-2 text-xs text-slate-500"><Loader2 className="h-4 w-4 animate-spin" /> Cargando controles…</div>
      ) : loadError ? (
        <div className="m-5 rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-800">{loadError}</div>
      ) : (
        <div className="grid gap-5 p-5 sm:p-6">
          <div>
            <p className="text-[9px] font-bold uppercase tracking-[0.16em] text-slate-400">Canales permitidos</p>
            <div className="mt-2 grid gap-2 sm:grid-cols-3">
              <Toggle label="WhatsApp" description="Alertas y seguimiento cuando cada regla lo marque." enabled={config.canalWhatsapp} icon={<MessageCircle className="h-4 w-4" />} onChange={() => toggle('canalWhatsapp')} />
              <Toggle label="Telegram" description="Alertas y seguimiento delegado al workflow de n8n." enabled={config.canalTelegram} icon={<Send className="h-4 w-4" />} onChange={() => toggle('canalTelegram')} />
              <Toggle label="Email" description="Alertas externas que tengan email seleccionado." enabled={config.canalEmail} icon={<Mail className="h-4 w-4" />} onChange={() => toggle('canalEmail')} />
            </div>
          </div>

          <div>
            <p className="text-[9px] font-bold uppercase tracking-[0.16em] text-slate-400">Tipos de aviso</p>
            <div className="mt-2 grid gap-2 sm:grid-cols-2 xl:grid-cols-5">
              <Toggle label="Subidas y caídas" description="Umbrales porcentuales desde el precio base configurado." enabled={config.alertasPorcentaje} icon={<TrendingUp className="h-4 w-4" />} onChange={() => toggle('alertasPorcentaje')} />
              <Toggle label="Precio objetivo" description="Cuando el precio toque el nivel de la alerta." enabled={config.alertasPrecio} icon={<Target className="h-4 w-4" />} onChange={() => toggle('alertasPrecio')} />
              <Toggle label="Fecha objetivo" description="Cuando llegue la fecha guardada en la alerta." enabled={config.alertasFecha} icon={<CalendarClock className="h-4 w-4" />} onChange={() => toggle('alertasFecha')} />
              <Toggle label="Alerta de cartera" description="Permite alertas del valor total de la cartera." enabled={config.alertasCartera} icon={<WalletCards className="h-4 w-4" />} onChange={() => toggle('alertasCartera')} />
              <Toggle label="Seguimiento programado" description="Incluye la revisión de las 22:00 si está configurada en Seguimiento." enabled={config.seguimientoLynch} icon={<TrendingDown className="h-4 w-4" />} onChange={() => toggle('seguimientoLynch')} />
            </div>
          </div>

          <div className="flex flex-col gap-3 border-t border-slate-200 pt-4 sm:flex-row sm:items-center sm:justify-between">
            <p className="flex items-start gap-2 text-[10px] leading-4 text-slate-500"><Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#6d9a3b]" /> El horario de revisión se cambia en la pestaña Seguimiento; aquí solo decides si puede enviar el aviso.</p>
            <Button type="button" size="sm" onClick={() => void save()} disabled={saving} className="bg-[#17223b] text-white hover:bg-[#253454]">
              {saving ? <Loader2 className="animate-spin" /> : <Save />} {saving ? 'Guardando…' : 'Guardar controles'}
            </Button>
          </div>
        </div>
      )}
    </section>
  )
}
