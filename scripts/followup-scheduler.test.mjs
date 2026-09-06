import test from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { schedulerConfig, startScheduler, POLL_MS, TIMEOUT_MS } from './followup-scheduler.mjs';
import { startServices } from './start-services.mjs';

const env = { SEGUIMIENTO_ENABLED: 'true', AUTOMATION_SECRET: 'test-secret' };
const flush = () => new Promise((resolve) => setImmediate(resolve));
function fakeTimers() {
  const timeouts = new Map();
  const intervals = new Map();
  return {
    timeouts, intervals,
    setTimeout(fn, ms) { const id = {}; timeouts.set(id, { fn, ms }); return id; },
    clearTimeout(id) { timeouts.delete(id); },
    setInterval(fn, ms) { const id = {}; intervals.set(id, { fn, ms }); return id; },
    clearInterval(id) { intervals.delete(id); },
  };
}

test('opt-in estricto, secreto obligatorio y puerto validado sin exponer valores', () => {
  for (const value of [undefined, 'false', 'TRUE', '1']) {
    assert.equal(schedulerConfig({ SEGUIMIENTO_ENABLED: value }), null);
  }
  assert.throws(() => schedulerConfig({ SEGUIMIENTO_ENABLED: 'true' }), /AUTOMATION_SECRET/);
  assert.throws(() => schedulerConfig({ ...env, PORT: '3000@evil.example' }), /PORT inválido/);
  assert.equal(new URL(schedulerConfig(env).url).port, '3000');
});

test('POST inmediato y cada 30s; bearer, scheduled, query codificada y sin redirects', async () => {
  const calls = [];
  const timers = fakeTimers();
  const worker = startScheduler(schedulerConfig({ ...env, PORT: '4000', AUTOMATION_USER_ID: 'a&b' }), {
    timers, fetchImpl: async (...args) => { calls.push(args); return { ok: true }; },
  });
  await flush();
  const interval = [...timers.intervals.values()][0];
  assert.equal(interval.ms, POLL_MS);
  interval.fn();
  await flush();
  assert.equal(calls.length, 2);
  const [url, options] = calls[0];
  assert.equal(new URL(url).origin, 'http://127.0.0.1:4000');
  assert.equal(new URL(url).pathname, '/api/automatizaciones/inversiones/seguimiento');
  assert.equal(new URL(url).searchParams.get('user_id'), 'a&b');
  assert.equal(options.method, 'POST');
  assert.equal(options.headers.Authorization, 'Bearer test-secret');
  assert.deepEqual(JSON.parse(options.body), { scheduled: true });
  assert.equal(options.redirect, 'error');
  worker.stop();
  assert.equal(timers.intervals.size, 0);
});

// Calendario del contrato: no hay filtro local, tampoco en DST o fin de semana.
// Estos tests no prueban la ventana ni la deduplicación del backend.
for (const [utc, madrid] of [
  ['2026-01-05T06:59:30Z', '07:59'],
  ['2026-01-05T07:00:00Z', '08:00'],
  ['2026-01-05T13:00:00Z', '14:00'],
  ['2026-07-05T06:00:00Z', '08:00'],
  ['2026-07-05T12:00:00Z', '14:00'],
  ['2026-03-29T00:59:30Z', '01:59'],
  ['2026-03-29T01:00:00Z', '03:00'],
  ['2026-10-25T00:30:00Z', '02:30'],
  ['2026-10-25T01:30:00Z', '02:30'],
  ['2026-12-31T23:00:00Z', '00:00'],
]) {
  test(`heartbeat independiente del calendario ${utc} (${madrid} Madrid)`, async (t) => {
    t.mock.timers.enable({ apis: ['Date'], now: Date.parse(utc) });
    assert.equal(new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Europe/Madrid', hour: '2-digit', minute: '2-digit',
    }).format(new Date()), madrid);
    let calls = 0;
    const timers = fakeTimers();
    const worker = startScheduler(schedulerConfig(env), {
      timers, fetchImpl: async () => { calls++; return { ok: true }; },
    });
    await flush();
    t.mock.timers.tick(POLL_MS);
    [...timers.intervals.values()][0].fn();
    await flush();
    assert.equal(calls, 2);
    worker.stop();
  });
}

test('timeout 15s, sin solapamiento, reintento y parada abortan petición', async () => {
  const timers = fakeTimers();
  const logs = [];
  const signals = [];
  const worker = startScheduler(schedulerConfig(env), {
    timers, log: (message) => logs.push(message),
    fetchImpl: (_url, { signal }) => new Promise((_resolve, reject) => {
      signals.push(signal);
      signal.addEventListener('abort', () => reject(new Error('test-secret')));
    }),
  });
  await worker.tick();
  assert.equal(signals.length, 1);
  const timeout = [...timers.timeouts.values()][0];
  assert.equal(timeout.ms, TIMEOUT_MS);
  timeout.fn();
  await flush();
  assert.equal(signals[0].aborted, true);
  assert.match(logs[0], /Timeout/);
  [...timers.intervals.values()][0].fn();
  assert.equal(signals.length, 2);
  worker.stop();
  await flush();
  await worker.tick();
  assert.equal(signals[1].aborted, true);
  assert.equal(signals.length, 2);
  assert.equal(timers.timeouts.size, 0);
  assert.equal(logs.length, 1);
  assert.ok(!logs.join('').includes(env.AUTOMATION_SECRET));
});

test('errores HTTP y red se reportan sin cuerpo ni secretos y permiten reintento', async () => {
  const logs = [];
  let calls = 0;
  let cancelled = false;
  const worker = startScheduler(schedulerConfig(env), {
    timers: fakeTimers(), log: (message) => logs.push(message),
    fetchImpl: async () => {
      calls++;
      if (calls === 1) return { ok: false, status: 401, body: { cancel() { cancelled = true; } } };
      if (calls === 2) throw new Error('test-secret');
      return { ok: true };
    },
  });
  await flush();
  await worker.tick();
  await worker.tick();
  worker.stop();
  assert.equal(calls, 3);
  assert.equal(cancelled, true);
  assert.match(logs[0], /HTTP 401/);
  assert.equal(logs.length, 2);
  assert.ok(!logs.join('').includes(env.AUTOMATION_SECRET));
});

function supervisor(config = env) {
  const children = [];
  const signals = new EventEmitter();
  const timers = fakeTimers();
  const exits = [];
  startServices({ env: config, signals, timers, log() {}, finish: (code) => exits.push(code),
    spawnImpl: (_node, args, options) => {
      const child = new EventEmitter();
      child.args = args;
      child.options = options;
      child.kills = [];
      child.kill = (signal) => child.kills.push(signal);
      children.push(child);
      return child;
    },
  });
  return { children, signals, timers, exits };
}

for (const index of [0, 1]) {
  test(`supervisor: muerte inesperada de proceso ${index} detiene el otro y falla`, () => {
    const { children, exits, timers } = supervisor();
    assert.equal(children.length, 2);
    assert.ok(children[0].args[0].endsWith('server.js'));
    assert.ok(children[1].args[0].endsWith('followup-scheduler.mjs'));
    children[index].emit('close', 0);
    assert.deepEqual(children[1 - index].kills, ['SIGTERM']);
    assert.deepEqual(exits, []);
    children[1 - index].emit('close', 0);
    assert.deepEqual(exits, [1]);
    assert.equal(timers.timeouts.size, 0);
  });
}
for (const signal of ['SIGTERM', 'SIGINT']) {
  test(`supervisor: transmite ${signal}, espera hijos y fuerza cierre tras 10s`, () => {
    const { children, signals, timers, exits } = supervisor();
    signals.emit(signal);
    for (const child of children) assert.deepEqual(child.kills, [signal]);
    const timeout = [...timers.timeouts.values()][0];
    assert.equal(timeout.ms, 10_000);
    timeout.fn();
    for (const child of children) {
      assert.deepEqual(child.kills, [signal, 'SIGKILL']);
      child.emit('close', null);
    }
    assert.deepEqual(exits, [0]);
    assert.equal(signals.listenerCount('SIGTERM'), 0);
    assert.equal(signals.listenerCount('SIGINT'), 0);
  });
}

test('supervisor sin flag solo inicia servidor; configuración inválida no inicia nada', () => {
  const { children, signals, exits } = supervisor({});
  assert.equal(children.length, 1);
  signals.emit('SIGTERM');
  children[0].emit('close', 0);
  assert.deepEqual(exits, [0]);
  assert.throws(() => supervisor({ SEGUIMIENTO_ENABLED: 'true' }), /AUTOMATION_SECRET/);
});

test('supervisor detecta error de spawn y detiene ambos procesos', () => {
  const { children, exits } = supervisor();
  children[1].emit('error', new Error('test-secret'));
  for (const child of children) {
    assert.deepEqual(child.kills, ['SIGTERM']);
    child.emit('close', -1);
  }
  assert.deepEqual(exits, [1]);
});
