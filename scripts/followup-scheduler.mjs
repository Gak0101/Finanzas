import { pathToFileURL } from 'node:url';

export const POLL_MS = 30_000;
export const TIMEOUT_MS = 15_000;

export function schedulerConfig(env = process.env) {
  if (env.SEGUIMIENTO_ENABLED !== 'true') return null;
  if (!env.AUTOMATION_SECRET?.trim()) throw new Error('AUTOMATION_SECRET requerido para seguimiento');
  const port = env.PORT || '3000';
  if (!/^\d+$/.test(port) || Number(port) < 1 || Number(port) > 65535) {
    throw new Error('PORT inválido');
  }
  const url = new URL(`http://127.0.0.1:${port}/api/automatizaciones/inversiones/seguimiento`);
  if (env.AUTOMATION_USER_ID) url.searchParams.set('user_id', env.AUTOMATION_USER_ID);
  return { url: url.href, secret: env.AUTOMATION_SECRET };
}

// El backend aplica 08:00/14:00 Europe/Madrid, DST, ventana y dedupe.
// Cada POST también es heartbeat, incluso fuera de esas ventanas.
export function startScheduler(config, {
  fetchImpl = globalThis.fetch, timers = globalThis, log = console.error,
} = {}) {
  let stopped = false;
  let active;
  async function tick() {
    if (stopped || active) return;
    const controller = new AbortController();
    active = controller;
    const timeout = timers.setTimeout(() => controller.abort(), TIMEOUT_MS);
    try {
      const response = await fetchImpl(config.url, {
        method: 'POST', redirect: 'error', signal: controller.signal,
        headers: { Authorization: `Bearer ${config.secret}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ scheduled: true }),
      });
      if (!response.ok) log(`[seguimiento] HTTP ${response.status}`);
      // No imprimir ni retener respuestas que puedan contener datos privados.
      await response.body?.cancel();
    } catch {
      if (!stopped) log(controller.signal.aborted
        ? '[seguimiento] Timeout de 15 segundos'
        : '[seguimiento] Fallo de petición; se reintentará en el siguiente ciclo');
    } finally {
      timers.clearTimeout(timeout);
      active = undefined;
    }
  }
  const interval = timers.setInterval(() => { void tick(); }, POLL_MS);
  void tick();
  return {
    tick,
    stop() {
      stopped = true;
      timers.clearInterval(interval);
      active?.abort();
    },
  };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    const config = schedulerConfig();
    if (config) {
      const worker = startScheduler(config);
      process.once('SIGTERM', () => worker.stop());
      process.once('SIGINT', () => worker.stop());
    }
  } catch {
    console.error('[seguimiento] Configuración inválida: revisar AUTOMATION_SECRET y PORT');
    process.exitCode = 1;
  }
}
