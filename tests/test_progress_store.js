// Tests shared/progressStore.js against a pretend sheet that can go offline, get busy or return junk.
// Run with:  node tests/test_progress_store.js
import assert from 'node:assert/strict';
import { createStore, normalizeCode } from '../shared/progressStore.js';

const CODE = 'K7M2QX';
const OTHER = 'ZZ99AA';

function pretendSheet() {
  const server = {
    students: { [CODE]: { open: [true, false, false, false, false, false, false, false], full: false, progress: null }, [OTHER]: { open: Array(8).fill(false), full: true, progress: null } },
    results: [],
    down: false,        // network unreachable
    html: false,        // answers with an HTML page instead of JSON
    busy: 0,            // answer "busy" this many times
    calls: [],
  };
  const respond = (data) => ({ ok: true, json: async () => data });
  server.fetch = async (url, init = {}) => {
    server.calls.push({ url, method: init.method || 'GET' });
    if (server.down) throw new Error('network down');
    if (server.html) return { ok: true, json: async () => { throw new SyntaxError('Unexpected token <'); } };
    if (!init.method || init.method === 'GET') {
      const code = new URL(url).searchParams.get('code');
      const s = server.students[code];
      return respond(s ? { ok: true, open: s.open, full_access: s.full, progress: s.progress } : { ok: false, error: 'bad_code' });
    }
    const body = JSON.parse(init.body);
    if (server.busy > 0) { server.busy--; return respond({ ok: false, error: 'busy' }); }
    const s = server.students[body.student_code];
    if (!s) return respond({ ok: false, error: 'bad_code' });
    if (body.type === 'save') {
      const text = JSON.stringify(body.progress);
      if (text.length > 8000) return respond({ ok: false, error: 'progress_size' });
      s.progress = text;
    } else if (body.type === 'result') {
      server.results.push(body);
    } else return respond({ ok: false, error: 'bad_type' });
    return respond({ ok: true });
  };
  return server;
}

function memoryStorage() {
  const m = new Map();
  return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k), _map: m };
}

function world(extra = {}) {
  const server = pretendSheet();
  const storage = extra.storage || memoryStorage();
  const sleeps = [];
  let tick = 0;
  const store = createStore({
    endpoint: 'https://example.test/exec', fetchImpl: (...a) => server.fetch(...a), storage,
    sleep: async (ms) => { sleeps.push(ms); }, random: () => 0.5,
    now: () => `2026-01-01T00:00:${String(tick++).padStart(2, '0')}.000Z`,
  });
  return { server, storage, store, sleeps };
}

let passed = 0;
async function test(name, fn) { await fn(); passed++; console.log('PASS', name); }

await test('normalizeCode accepts messy typing and rejects bad codes', () => {
  assert.equal(normalizeCode('k7m-2qx'), 'K7M2QX');
  assert.equal(normalizeCode('  k7m 2qx '), 'K7M2QX');
  assert.equal(normalizeCode('K7M2Q'), null, 'too short');
  assert.equal(normalizeCode('K7M2QXX'), null, 'too long');
  assert.equal(normalizeCode('K7M2Q0'), null, 'zero is not in the alphabet');
  assert.equal(normalizeCode('K7M2QI'), null, 'letter I is not in the alphabet');
  assert.equal(normalizeCode('ALL'), null);
  assert.equal(normalizeCode(null), null);
  assert.equal(normalizeCode(undefined), null);
});

await test('sign in: valid code, unknown code, full access flag', async () => {
  const { store } = world();
  const ok = await store.loadStudent(CODE);
  assert.equal(ok.ok, true);
  assert.equal(ok.source, 'sheet');
  assert.deepEqual(ok.open, [true, false, false, false, false, false, false, false]);
  assert.equal(ok.fullAccess, false);
  assert.equal(ok.progress, null);
  assert.deepEqual(await store.loadStudent('AAAAAA'), { ok: false, error: 'bad_code' });
  assert.equal((await store.loadStudent(OTHER)).fullAccess, true);
});

await test('sign in offline: new device is refused, known device works from its saved copy', async () => {
  const w = world();
  w.server.down = true;
  assert.deepEqual(await w.store.loadStudent(CODE), { ok: false, error: 'offline' });
  w.server.down = false;
  await w.store.loadStudent(CODE);
  await w.store.saveProgress(CODE, { level: 4, towns: {} });
  w.server.down = true;
  const again = await w.store.loadStudent(CODE);
  assert.equal(again.ok, true);
  assert.equal(again.source, 'device');
  assert.equal(again.progress.level, 4);
});

await test('an HTML error page or a server_error counts as unreachable, not as a wrong code', async () => {
  const w = world();
  w.server.html = true;
  assert.deepEqual(await w.store.loadStudent(CODE), { ok: false, error: 'offline' });
});

await test('save reaches the sheet and loads back; queue ends empty', async () => {
  const w = world();
  await w.store.loadStudent(CODE);
  const res = await w.store.saveProgress(CODE, { level: 2, xp: 40, towns: { topic_3: { nodeRecords: { a: 1 } } } });
  assert.equal(res.pending, 0);
  const back = await w.store.loadStudent(CODE);
  assert.equal(back.progress.level, 2);
  assert.equal(back.progress.towns.topic_3.nodeRecords.a, 1);
  assert.ok(back.progress.savedAt);
});

await test('saves made offline wait in the queue, then only the newest save is sent, with results in order', async () => {
  const w = world();
  await w.store.loadStudent(CODE);
  w.server.down = true;
  await w.store.saveProgress(CODE, { level: 1 });
  await w.store.logResult(CODE, { town: 'topic-3', lesson: '3-1', game: 'node_3_1', score: 7 });
  await w.store.saveProgress(CODE, { level: 2 });
  await w.store.logResult(CODE, { town: 'topic-3', lesson: '3-2', game: 'node_3_2', score: 9 });
  assert.equal(w.store.pendingCount(CODE), 3, 'the older save is already superseded by the newer one');
  w.server.down = false;
  w.server.calls.length = 0;
  const res = await w.store.flushQueue(CODE);
  assert.equal(res.pending, 0);
  assert.equal(JSON.parse(w.server.students[CODE].progress).level, 2, 'sheet has the newest save');
  assert.deepEqual(w.server.results.map((r) => r.lesson), ['3-1', '3-2']);
  assert.equal(w.server.calls.filter((c) => c.method === 'POST').length, 3, 'one save plus two results, not two saves');
});

await test('busy answers are retried with a pause, then succeed', async () => {
  const w = world();
  await w.store.loadStudent(CODE);
  w.server.busy = 2;
  const res = await w.store.saveProgress(CODE, { level: 3 });
  assert.equal(res.pending, 0);
  assert.equal(w.sleeps.length, 2);
  assert.ok(w.sleeps.every((ms) => ms >= 400 && ms <= 1600));
  assert.equal(JSON.parse(w.server.students[CODE].progress).level, 3);
});

await test('always busy: the save stays queued for later instead of being lost', async () => {
  const w = world();
  await w.store.loadStudent(CODE);
  w.server.busy = 99;
  const res = await w.store.saveProgress(CODE, { level: 5 });
  assert.equal(res.pending, 1);
  w.server.busy = 0;
  assert.equal((await w.store.flushQueue(CODE)).pending, 0);
  assert.equal(JSON.parse(w.server.students[CODE].progress).level, 5);
});

await test('a rejected item is dropped and does not block the ones behind it', async () => {
  const w = world();
  await w.store.loadStudent(CODE);
  w.server.down = true;
  await w.store.saveProgress(CODE, { big: 'x'.repeat(9000) });   // the sheet will refuse this one
  await w.store.logResult(CODE, { town: 'topic-3', lesson: '3-3', game: 'node_3_3', score: 5 });
  w.server.down = false;
  const res = await w.store.flushQueue(CODE);
  assert.equal(res.pending, 0);
  assert.equal(w.server.results.length, 1, 'the result still got through');
  assert.equal(w.server.students[CODE].progress, null, 'the oversize save was not stored');
});

await test('on sign in, a newer device copy beats an older sheet copy and is sent up', async () => {
  const w = world();
  await w.store.loadStudent(CODE);
  w.server.down = true;
  await w.store.saveProgress(CODE, { level: 9 });                 // only on this device
  w.server.down = false;
  w.server.students[CODE].progress = JSON.stringify({ level: 2, savedAt: '2025-01-01T00:00:00.000Z' });
  const res = await w.store.loadStudent(CODE);
  assert.equal(res.progress.level, 9);
  assert.equal(JSON.parse(w.server.students[CODE].progress).level, 9, 'the sheet caught up');
});

await test('on sign in, a newer sheet copy beats an older device copy (second Chromebook)', async () => {
  const w = world();
  await w.store.loadStudent(CODE);
  await w.store.saveProgress(CODE, { level: 2 });
  w.server.students[CODE].progress = JSON.stringify({ level: 7, savedAt: '2099-01-01T00:00:00.000Z' });
  const res = await w.store.loadStudent(CODE);
  assert.equal(res.progress.level, 7);
});

await test('saves made while a flush is running are not lost', async () => {
  const w = world();
  await w.store.loadStudent(CODE);
  const first = w.store.saveProgress(CODE, { level: 1 });
  const second = w.store.logResult(CODE, { town: 'topic-3', lesson: '3-1', game: 'node_3_1', score: 1 });
  const third = w.store.saveProgress(CODE, { level: 2 });
  await Promise.all([first, second, third]);
  await w.store.flushQueue(CODE);
  assert.equal(w.store.pendingCount(CODE), 0);
  assert.equal(JSON.parse(w.server.students[CODE].progress).level, 2);
  assert.equal(w.server.results.length, 1);
});

await test('active code is remembered on the device, and a junk value is ignored', () => {
  const { store, storage } = world();
  assert.equal(store.getActiveCode(), null);
  store.setActiveCode(CODE);
  assert.equal(store.getActiveCode(), CODE);
  storage.setItem('gw_active_code', 'nonsense!');
  assert.equal(store.getActiveCode(), null);
  store.setActiveCode(CODE); store.clearActiveCode();
  assert.equal(store.getActiveCode(), null);
});

await test('nothing but the code and game data is ever sent', async () => {
  const w = world();
  const bodies = [];
  const original = w.server.fetch;
  w.server.fetch = async (url, init) => { if (init && init.body) bodies.push(init.body); return original(url, init); };
  const store = createStore({ endpoint: 'https://example.test/exec', fetchImpl: w.server.fetch, storage: memoryStorage(), sleep: async () => {} });
  await store.loadStudent(CODE);
  await store.saveProgress(CODE, { level: 1, xp: 2, coins: 3 });
  await store.logResult(CODE, { town: 'topic-3', lesson: '3-1', game: 'node_3_1', score: 1, accuracy: 100 });
  const keys = new Set(bodies.flatMap((b) => Object.keys(JSON.parse(b))));
  assert.deepEqual([...keys].sort(), ['accuracy', 'game', 'lesson', 'progress', 'score', 'student_code', 'town', 'type']);
});

await test('fast sign-in: a code this device knows opens at once, then the sheet is checked in the background', async () => {
  const { server, store } = world();
  await store.loadStudent(CODE);                                   // first sign-in on this device: from the sheet
  let release;
  const slow = server.fetch;
  server.fetch = (url, init) => new Promise((r) => { release = () => r(slow(url, init)); });
  server.students[CODE].open[3] = true;                           // a teacher ticks Town 4 meanwhile
  let fresh = null;
  const res = await store.loadStudent(CODE, { fast: true, onFresh: (f) => { fresh = f; } });
  assert.equal(res.ok, true);
  assert.equal(res.source, 'device', 'answered from the device without waiting');
  assert.equal(res.open[3], false, 'the device copy does not know about the new tick yet');
  assert.equal(fresh, null);
  release(); await res.fresh;
  assert.equal(fresh.source, 'sheet', 'then the sheet answers in the background');
  assert.equal(fresh.open[3], true, 'and brings the teacher tick');
});

await test('fast sign-in: a brand-new code on this device still waits for the sheet; a removed code is reported', async () => {
  const { server, store } = world();
  const first = await store.loadStudent(CODE, { fast: true });
  assert.equal(first.source, 'sheet', 'no device copy, so it asked the sheet');
  const bad = await store.loadStudent('ABCDEF', { fast: true });
  assert.equal(bad.ok, false); assert.equal(bad.error, 'bad_code');
  delete server.students[CODE];                                  // teacher deletes the row
  let fresh = null;
  const res = await store.loadStudent(CODE, { fast: true, onFresh: (f) => { fresh = f; } });
  assert.equal(res.ok, true);
  await res.fresh;
  assert.equal(fresh.ok, false); assert.equal(fresh.error, 'bad_code', 'the background check says the code is gone');
});

console.log(`\n${passed} tests passed`);
