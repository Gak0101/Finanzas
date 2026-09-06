// Pure functions: schedule and deterministic triage are independently testable.
export function madridSlot(now: Date) {
  const p = Object.fromEntries(new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Madrid', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', hourCycle: 'h23',
  }).formatToParts(now).map(p => [p.type, p.value]))
  const slot = p.hour === '08' ? 'morning' : p.hour === '14' ? 'premarket' : null
  return slot ? { slot, key: `${p.year}-${p.month}-${p.day}:${slot}` } : null
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
