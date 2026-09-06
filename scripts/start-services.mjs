import { spawn } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { schedulerConfig } from './followup-scheduler.mjs';

export function startServices({
  env = process.env, spawnImpl = spawn, signals = process, timers = globalThis,
  finish = (code) => { process.exitCode = code; }, log = console.error,
} = {}) {
  // Validar antes de arrancar Next para no dejar un servicio huérfano.
  const enabled = schedulerConfig(env) !== null;
  const children = new Set();
  let stopping = false;
  let exitCode = 0;
  let deadline;
  function complete() {
    if (!stopping || children.size) return;
    timers.clearTimeout(deadline);
    signals.removeListener('SIGTERM', onTerm);
    signals.removeListener('SIGINT', onInt);
    finish(exitCode);
  }
  function shutdown(signal, code) {
    if (stopping) return;
    stopping = true;
    exitCode = code;
    deadline = timers.setTimeout(() => {
      for (const child of children) child.kill('SIGKILL');
    }, 10_000);
    for (const child of children) child.kill(signal);
    complete();
  }
  const onTerm = () => shutdown('SIGTERM', 0);
  const onInt = () => shutdown('SIGINT', 0);
  signals.once('SIGTERM', onTerm);
  signals.once('SIGINT', onInt);
  const entries = ['../server.js', ...(enabled ? ['./followup-scheduler.mjs'] : [])];
  for (const entry of entries) {
    if (stopping) break;
    try {
      const child = spawnImpl(process.execPath, [fileURLToPath(new URL(entry, import.meta.url))], {
        env, stdio: 'inherit',
      });
      children.add(child);
      child.once('error', () => {
        log('[services] Error de proceso; deteniendo servicios');
        shutdown('SIGTERM', 1);
      });
      child.once('close', () => {
        children.delete(child);
        if (!stopping) {
          log('[services] Proceso terminado inesperadamente; deteniendo servicios');
          shutdown('SIGTERM', 1);
        }
        complete();
      });
    } catch {
      log('[services] No se pudo iniciar un proceso');
      shutdown('SIGTERM', 1);
    }
  }
  return { shutdown };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try { startServices(); } catch {
    console.error('[services] Configuración inválida: revisar AUTOMATION_SECRET y PORT');
    process.exitCode = 1;
  }
}
