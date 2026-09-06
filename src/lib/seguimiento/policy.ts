// Pure functions: schedule and deterministic triage are independently testable.
export function madridSlot(now: Date) {
  const p = Object.fromEntries(new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Madrid', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', hourCycle: 'h23',
  }).formatToParts(now).map(p => [p.type, p.value]))
  const slot = p.hour === '08' ? 'morning' : p.hour === '14' ? 'premarket' : null
  return slot ? { slot, key: `${p.year}-${p.month}-${p.day}:${slot}` } : null
}

export type FollowupSchedule = {
  timezone?: string
  weekdays: number[]
  slots: string[]
}

function localParts(now: Date, timezone = 'Europe/Madrid'): { year: string; month: string; day: string; hour: string; minute: string; weekdayNumber: number } {
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone, weekday: 'short', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  }).formatToParts(now).map(part => [part.type, part.value])) as Record<string, string>
  const weekday = new Intl.DateTimeFormat('en-US', { timeZone: timezone, weekday: 'short' }).format(now)
  const weekdayNumber = ({ Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6, Sun: 7 } as Record<string, number>)[weekday] ?? 0
  return { year: parts.year || '', month: parts.month || '', day: parts.day || '', hour: parts.hour || '', minute: parts.minute || '', weekdayNumber }
}

export function configuredSlot(now: Date, schedule: FollowupSchedule) {
  const timezone = schedule.timezone || 'Europe/Madrid'
  const parts = localParts(now, timezone)
  const slots = [...new Set(schedule.slots)].filter(slot => /^([01]\d|2[0-3]):[0-5]\d$/.test(slot)).sort()
  if (!schedule.weekdays.includes(parts.weekdayNumber) || !slots.includes(`${parts.hour}:${parts.minute}`)) return null
  const dateKey = `${parts.year}-${parts.month}-${parts.day}`
  return { slot: `schedule-${parts.hour}:${parts.minute}`, key: `${dateKey}:${parts.hour}:${parts.minute}`, timezone }
}
export function triage(held: boolean, price: number | null, target: number | null, stale: boolean) {
  if (price === null || stale) return { decision: 'sin-datos', reason: 'Cotización ausente o antigua. No decidir una entrada con este dato.' }
  if (target !== null && price <= target) return {
    decision: 'revisar-entrada', reason: 'Precio en el umbral configurado: revisar tesis y fuentes primarias; no es una orden de compra.',
  }
  return held
    ? { decision: 'revisar-posicion', reason: 'Posición en cartera. Comprobar tesis, exposición y novedades antes de mantener, ampliar o reducir.' }
    : { decision: 'esperar', reason: target === null ? 'Sin valoración de entrada vigente validada. Investigar antes de fijar un precio.' : 'Cotiza por encima del umbral configurado. Esperar o revalorar con nueva evidencia.' }
}
export function safeUrl(value: string) {
  try { const u = new URL(value); return ['https:', 'http:'].includes(u.protocol) ? u.href : null } catch { return null }
}
